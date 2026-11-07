// Resumable model downloads. curl writes to <file>.part, the SHA-256 is checked in
// streaming, and only then the file takes its final name. A cancelled download keeps
// the .part so the next attempt resumes where it stopped.
import { spawn, execFile } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { rename, unlink, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { promisify } from 'node:util';
import { ROOT, getItem, itemPath, isInstalled, downloadUrl, runtimeLoraPath } from './model-selection.mjs';

const execFileAsync = promisify(execFile);

class Cancelled extends Error {
  constructor() { super('Descarga cancelada.'); this.cancelled = true; }
}

async function sha256File(path, onProgress) {
  const hash = createHash('sha256');
  let read = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    read += chunk.length;
    onProgress?.(read);
  }
  return hash.digest('hex');
}

export class ModelDownloader {
  constructor({ onIdle } = {}) {
    this.entries = new Map();
    this.queue = [];
    this.running = false;
    this.curl = null;
    this.onIdle = onIdle || (async () => {});
  }

  get busy() { return this.running || this.queue.length > 0; }

  entry(id) {
    if (!this.entries.has(id)) this.entries.set(id, { id, state: 'queued', received: 0, total: 0, error: null, startedAt: null });
    return this.entries.get(id);
  }

  stateOf(id) { return this.entries.get(id) || null; }

  enqueue(id) {
    const item = getItem(id);
    if (isInstalled(item)) return { id, state: 'done' };
    if (this.queue.includes(id) || (this.entries.get(id)?.state === 'downloading')) return this.entries.get(id);
    const current = this.entries.get(id);
    if (current && ['queued', 'downloading', 'verifying', 'converting'].includes(current.state)) return current;
    const entry = this.entry(id);
    Object.assign(entry, { state: 'queued', received: 0, total: item.bytes, error: null, startedAt: null, cancelled: false });
    this.queue.push(id);
    void this.pump();
    return entry;
  }

  enqueueMany(ids) { return ids.map(id => this.enqueue(id)); }

  cancel(id) {
    const entry = this.entries.get(id);
    if (!entry) return false;
    entry.cancelled = true;
    if (entry.state === 'queued') {
      this.queue = this.queue.filter(queued => queued !== id);
      entry.state = 'cancelled';
      entry.error = null;
      if (!this.busy) void this.finish();
      return true;
    }
    if (entry.state === 'downloading' && this.curl) {
      this.curl.kill();
      return true;
    }
    if (['verifying', 'converting'].includes(entry.state)) return false;
    return false;
  }

  async pump() {
    if (this.running) return;
    const id = this.queue.shift();
    if (!id) { await this.finish(); return; }
    this.running = true;
    const entry = this.entry(id);
    entry.state = 'downloading';
    entry.startedAt = Date.now();
    entry.error = null;
    try {
      await this.download(entry, getItem(id));
      entry.state = 'done';
      entry.received = entry.total;
    } catch (error) {
      if (error.cancelled || entry.cancelled) {
        entry.state = 'cancelled';
        entry.error = null;
      } else {
        entry.state = 'error';
        entry.error = error.message;
      }
    } finally {
      this.running = false;
      this.curl = null;
    }
    if (this.queue.length) void this.pump();
    else await this.finish();
  }

  async finish() {
    if (this.running || this.queue.length) return;
    try { await this.onIdle(); } catch { /* the status endpoint still reports the error */ }
  }

  async download(entry, item) {
    const target = itemPath(item);
    const part = target + '.part';
    await mkdir(dirname(target), { recursive: true });
    entry.total = item.bytes;
    const already = existsSync(target) ? statSync(target).size : -1;
    if (already === item.bytes) {
      entry.state = 'verifying';
      const hash = await sha256File(target, read => { entry.received = read; });
      if (hash === item.sha256) { await this.afterDownload(item); return; }
      await unlink(target).catch(() => {});
    }
    if (existsSync(part)) entry.received = statSync(part).size;
    entry.state = 'downloading';
    const url = downloadUrl(item);
    if (!url) throw new Error('Este modelo no se descarga: se genera localmente.');
    await this.runCurl(url, part, entry);
    if (entry.cancelled) throw new Cancelled();
    const size = existsSync(part) ? statSync(part).size : 0;
    if (size !== item.bytes) throw new Error(`Descarga incompleta (${size} de ${item.bytes} bytes). Reintenta para reanudar.`);
    entry.state = 'verifying';
    const hash = await sha256File(part, read => { entry.received = read; });
    if (hash !== item.sha256) {
      await unlink(part).catch(() => {});
      throw new Error('El archivo descargado no coincide con el oficial. Se ha borrado para descargarlo de nuevo.');
    }
    await rename(part, target);
    await this.afterDownload(item);
  }

  runCurl(url, part, entry) {
    return new Promise((done, reject) => {
      const child = spawn('curl.exe', [
        '--fail', '--location', '--silent', '--show-error', '--retry', '8', '--retry-delay', '1',
        '--connect-timeout', '30',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        '--continue-at', '-', '--output', part, url
      ], { windowsHide: true, stdio: 'ignore' });
      this.curl = child;
      let settled = false;
      const timer = setInterval(() => {
        try { if (existsSync(part)) entry.received = statSync(part).size; } catch { /* transient */ }
      }, 400);
      const stop = () => { clearInterval(timer); this.curl = null; };
      child.on('error', error => { if (!settled) { settled = true; stop(); reject(error); } });
      child.on('exit', code => {
        if (settled) return;
        settled = true;
        stop();
        if (entry.cancelled) { reject(new Cancelled()); return; }
        if (code !== 0) {
          // 33: the server refused the resume range because the file is already complete.
          if (code === 33 && existsSync(part) && statSync(part).size === entry.total) { done(); return; }
          reject(new Error(`curl terminó con código ${code}. Reintenta para reanudar la descarga.`));
          return;
        }
        done();
      });
    });
  }

  // LoRA sources need the exact sd.cpp layout before the engine can use them.
  async afterDownload(item) {
    if (item.role !== 'lora') return;
    const entry = this.entry(item.id);
    entry.state = 'converting';
    await execFileAsync(process.execPath, [resolve(ROOT, 'scripts', 'prepare-lora.mjs'), item.id], {
      cwd: ROOT, windowsHide: true, timeout: 15 * 60 * 1000
    });
    if (!existsSync(runtimeLoraPath(item))) throw new Error('No se pudo convertir el LoRA al formato del motor.');
  }

  snapshot() {
    return [...this.entries.values()].map(entry => ({
      id: entry.id,
      state: entry.state,
      received: entry.received,
      total: entry.total,
      error: entry.error,
      seconds: entry.startedAt ? Math.round((Date.now() - entry.startedAt) / 1000) : 0
    }));
  }

  clearFinished() {
    for (const [id, entry] of this.entries) {
      if (['done', 'cancelled'].includes(entry.state) && !this.queue.includes(id)) this.entries.delete(id);
    }
  }
}
