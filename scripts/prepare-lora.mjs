// Exact adapter layout conversion for sd.cpp's fused Qwen21 gate_up base.
// A = [A_gate; A_proj], B = diag(B_gate, B_proj); B*A preserves both deltas.
// No quantization, floating-point arithmetic or merging with base weights.
// Works for any LoRA rank: the rank is read from the adapter shapes.
import { open, rename, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { ROOT, getItem, itemPath, runtimeLoraPath, loraProofPath, readSelection } from './model-selection.mjs';

const root = ROOT;
const SHA_TENSORS = 32;

async function hash(path) {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path)) h.update(chunk);
  return h.digest('hex');
}

function loraIdFromArgs() {
  const arg = process.argv[2];
  if (arg) return arg;
  try { return readSelection().lora; } catch { return 'lora-r256'; }
}

export async function convertLora(id = loraIdFromArgs(), { log = console.log } = {}) {
  const item = getItem(id);
  if (item.role !== 'lora') throw new Error(`${id} no es un LoRA.`);
  const source = itemPath(item), target = runtimeLoraPath(item), proofPath = loraProofPath(item);
  if (!existsSync(source)) throw new Error(`Falta el LoRA de origen: ${item.file}. Descárgalo primero.`);
  const sourceSha = await hash(source);
  assert.equal(sourceSha, item.sha256, 'El LoRA de origen no coincide con el oficial.');

  if (existsSync(target) && existsSync(proofPath)) {
    try {
      const proof = JSON.parse(await readFile(proofPath, 'utf8'));
      if (proof.targetSha256 === await hash(target) && proof.sourceSha256 === sourceSha && proof.rank === item.rank) {
        log('LoRA compatible verificado; no necesita cambios.');
        return proof;
      }
    } catch { /* regenerate below */ }
  }

  await mkdir(resolve(root, item.dir), { recursive: true });
  const input = await open(source, 'r');
  const read = async (position, length) => {
    const buffer = Buffer.alloc(length);
    let readBytes = 0;
    while (readBytes < length) {
      const result = await input.read(buffer, readBytes, length - readBytes, position + readBytes);
      assert.ok(result.bytesRead);
      readBytes += result.bytesRead;
    }
    return buffer;
  };

  const headerSize = Number((await read(0, 8)).readBigUInt64LE());
  const header = JSON.parse((await read(8, headerSize)).toString());
  const base = 8 + headerSize, entries = [], consumed = new Set();
  const bytes = async key => {
    const tensor = header[key];
    return read(base + tensor.data_offsets[0], tensor.data_offsets[1] - tensor.data_offsets[0]);
  };

  let rank = null;
  for (let i = 0; i < SHA_TENSORS; i++) {
    const prefix = `transformer.transformer_blocks.${i}.img_mlp.`;
    const keys = ['gate_layer.lora_A.weight', 'proj.lora_A.weight', 'gate_layer.lora_B.weight', 'proj.lora_B.weight'].map(key => prefix + key);
    for (const key of keys) { assert.equal(header[key]?.dtype, 'BF16', `Tensor inesperado: ${key}`); consumed.add(key); }
    const [ga, pa, gb, pb] = keys.map(key => header[key]);
    const r = ga.shape[0];
    if (rank === null) rank = r; else assert.equal(r, rank, 'Los bloques usan rangos distintos.');
    assert.deepEqual(pa.shape, [r, 4096]);
    assert.deepEqual(gb.shape, [12288, r]);
    assert.deepEqual(pb.shape, [12288, r]);
    entries.push({ key: prefix + 'gate_up.lora_A.weight', shape: [2 * r, 4096], length: 2 * r * 4096 * 2, keys: keys.slice(0, 2), kind: 'down' });
    entries.push({ key: prefix + 'gate_up.lora_B.weight', shape: [24576, 2 * r], length: 24576 * 2 * r * 2, keys: keys.slice(2), kind: 'up' });
  }
  assert.ok(Number.isInteger(rank) && rank > 0, 'No se pudo determinar el rango del LoRA.');
  if (item.rank && item.rank !== rank) throw new Error(`El catálogo espera rango ${item.rank} pero el archivo usa ${rank}.`);
  const tensorCount = Object.keys(header).filter(key => key !== '__metadata__').length;
  for (const [key, tensor] of Object.entries(header)) if (key !== '__metadata__' && !consumed.has(key)) entries.push({ key, shape: tensor.shape, length: tensor.data_offsets[1] - tensor.data_offsets[0], keys: [key], kind: 'copy', dtype: tensor.dtype });
  assert.equal(consumed.size, SHA_TENSORS * 4);
  assert.equal(entries.length, tensorCount - consumed.size + SHA_TENSORS * 2, 'Número de tensores inesperado.');

  let offset = 0;
  const outHeader = { __metadata__: { format: 'pt', source: item.repo, revision: item.revision, source_sha256: item.sha256, conversion: `Exact BF16 block diagonal gate_up layout for sd.cpp 88411ef; rank ${rank}; all alpha/rank scales = 1.` } };
  for (const entry of entries) { outHeader[entry.key] = { dtype: entry.dtype || 'BF16', shape: entry.shape, data_offsets: [offset, offset + entry.length] }; offset += entry.length; }
  let json = JSON.stringify(outHeader);
  json += ' '.repeat((8 - Buffer.byteLength(json) % 8) % 8);
  const head = Buffer.from(json), length = Buffer.alloc(8);
  length.writeBigUInt64LE(BigInt(head.length));
  const output = await open(target + '.tmp', 'w');
  const write = async buffer => {
    let written = 0;
    while (written < buffer.length) {
      const result = await output.write(buffer, written, buffer.length - written);
      assert.ok(result.bytesWritten);
      written += result.bytesWritten;
    }
  };

  try {
    await write(length); await write(head);
    for (const entry of entries) {
      const parts = await Promise.all(entry.keys.map(bytes));
      let buffer;
      if (entry.kind === 'copy') buffer = parts[0];
      else if (entry.kind === 'down') buffer = Buffer.concat(parts);
      else {
        buffer = Buffer.alloc(entry.length);
        const rowBytes = rank * 2, outRowBytes = 2 * rank * 2;
        for (let half = 0; half < 2; half++) for (let row = 0; row < 12288; row++) {
          parts[half].copy(buffer, (half * 12288 + row) * outRowBytes + half * rank * 2, row * rowBytes, (row + 1) * rowBytes);
        }
      }
      assert.equal(buffer.length, entry.length);
      await write(buffer);
    }
  } finally { await output.close(); await input.close(); }

  const targetSha = await hash(target + '.tmp');
  await rename(target + '.tmp', target);
  const proof = {
    source: item.file, sourceSha256: sourceSha, target: item.runtimeFile, targetSha256: targetSha,
    rank, alpha: rank, scale: 1, sourceTensors: tensorCount, targetTensors: entries.length,
    fusedPairs: SHA_TENSORS,
    conversion: 'A stacked; B block diagonal, gate first. Original BF16 values copied without arithmetic.'
  };
  await writeFile(proofPath, JSON.stringify(proof, null, 2));
  log(JSON.stringify(proof, null, 2));
  return proof;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await convertLora();
}
