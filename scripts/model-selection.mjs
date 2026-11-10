// Resolves which file backs each piece of the pipeline. The selection lives in
// model-selection.json; the catalogue in model-catalog.json. Everything is validated
// against the catalogue so a client can never point the engine at an arbitrary path.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { rename, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MODEL, mergedProofValid } from './core.mjs';

export const ROOT = resolve(import.meta.dirname, '..');
const CATALOG_PATH = resolve(import.meta.dirname, 'model-catalog.json');
export const SELECTION_PATH = resolve(ROOT, 'model-selection.json');
export const PENDING_PATH = resolve(ROOT, 'model-selection.pending.json');
export const CATALOG = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
export const ROLES = CATALOG.roles;
export const ITEMS = new Map(CATALOG.items.map(item => [item.id, item]));
export const ROLE_IDS = ROLES.map(role => role.id);

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

export function itemPath(item) { return resolve(ROOT, item.dir, item.file); }
export function runtimeLoraPath(item) { return resolve(ROOT, item.dir, item.runtimeFile); }
export function loraProofPath(item) { return resolve(ROOT, item.dir, item.runtimeFile + '.proof.json'); }
export function downloadUrl(item) {
  if (!item.repo || !item.revision) return null;
  const file = item.remoteFile || item.file;
  if (!file) return null;
  return `https://huggingface.co/${item.repo}/resolve/${item.revision}/${file}`;
}

export function getItem(id) {
  const item = ITEMS.get(id);
  if (!item) fail('Modelo desconocido.', 404);
  return item;
}

function localMergedProof(item) {
  if (!item.local) return true;
  try {
    const proof = readJson(resolve(ROOT, 'models/merged-lora.json'));
    if (!mergedProofValid(proof)) return false;
    return statSync(itemPath(item)).size === proof.outputBytes;
  } catch { return false; }
}

// A LoRA is usable once its converted runtime file exists; the HF source can be removed later.
export function isInstalled(item) {
  if (!item) return false;
  if (item.role === 'diffusion' && item.kind === 'merged' && item.local) return localMergedProof(item);
  if (item.role === 'lora') return existsSync(runtimeLoraPath(item));
  return existsSync(itemPath(item));
}

export function installedCount(role) {
  return CATALOG.items.filter(item => item.role === role && isInstalled(item)).length;
}

export function defaultSelection() {
  const merged = ITEMS.get('diff-merged-local');
  return {
    version: 1,
    diffusion: isInstalled(merged) ? merged.id : 'diff-base-q4k',
    textEncoder: 'text-qwen3vl-q4km',
    mmproj: 'mmproj-f16',
    lora: 'lora-r256',
    vae: 'vae-bf16'
  };
}

export function normalizeSelection(input = {}, { strict = false } = {}) {
  const fallback = defaultSelection();
  const out = { version: 1 };
  for (const role of ROLES) {
    const value = input?.[role.id] ?? fallback[role.id];
    const item = ITEMS.get(value);
    if (!item || item.role !== role.id) {
      if (strict) fail(`Selección inválida para «${role.label}».`);
      out[role.id] = fallback[role.id];
    } else out[role.id] = value;
  }
  // A merged diffusion already carries the LoRA; keep a valid lora id for the UI.
  return out;
}

export function readSelection() {
  try { return normalizeSelection(readJson(SELECTION_PATH)); }
  catch { return defaultSelection(); }
}

export function readPending() {
  try { return normalizeSelection(readJson(PENDING_PATH)); }
  catch { return null; }
}

export async function saveSelection(selection) {
  const body = JSON.stringify(normalizeSelection(selection, { strict: true }), null, 2);
  const tmp = SELECTION_PATH + '.tmp';
  await writeFile(tmp, body);
  await rename(tmp, SELECTION_PATH);
}

export async function savePending(selection) {
  const body = JSON.stringify(normalizeSelection(selection, { strict: true }), null, 2);
  const tmp = PENDING_PATH + '.tmp';
  await writeFile(tmp, body);
  await rename(tmp, PENDING_PATH);
}

export async function clearPending() {
  await unlink(PENDING_PATH).catch(error => { if (error.code !== 'ENOENT') throw error; });
}

export async function promotePending() {
  await rename(PENDING_PATH, SELECTION_PATH);
}

// Items whose files are not on disk yet, in the order they must be downloaded.
export function missingItems(selection) {
  const items = ROLE_IDS.map(role => getItem(selection[role]));
  return items.filter(item => !isInstalled(item));
}

// The LoRA only matters when the diffusion model is a base, not an already-fused one.
export function requiredItems(selection) {
  const diffusion = getItem(selection.diffusion);
  const items = [getItem(selection.textEncoder), getItem(selection.mmproj), getItem(selection.vae), diffusion];
  if (diffusion.kind !== 'merged') items.push(getItem(selection.lora));
  return items;
}

export function missingRequired(selection) {
  return requiredItems(selection).filter(item => !isInstalled(item));
}

export function selectionSummary(selection = readSelection()) {
  const diffusion = getItem(selection.diffusion);
  const items = requiredItems(selection);
  return {
    selection,
    merged: diffusion.kind === 'merged',
    loraApplication: diffusion.kind === 'merged' ? 'merged' : 'runtime',
    totalBytes: items.reduce((sum, item) => sum + item.bytes, 0),
    items: Object.fromEntries(items.map(item => [item.role, item]))
  };
}

// Throws a readable error when the selected files are not on disk. The engine is only
// started after this passes, so a failed download can never leave it half-loaded.
export function resolveActive() {
  const selection = readSelection();
  const missing = missingRequired(selection);
  if (missing.length) {
    fail('Faltan modelos de la configuración activa: ' + missing.map(item => item.file).join(', ') + '. Abre «Configuración de modelos» para descargarlos.', 409);
  }
  const diffusion = getItem(selection.diffusion);
  const lora = getItem(selection.lora);
  return {
    ...selectionSummary(selection),
    diffusion,
    lora,
    merged: diffusion.kind === 'merged',
    diffusionPath: itemPath(diffusion),
    llmPath: itemPath(getItem(selection.textEncoder)),
    mmprojPath: itemPath(getItem(selection.mmproj)),
    vaePath: itemPath(getItem(selection.vae)),
    runtimeLora: lora.runtimeFile,
    runtimeLoraPath: runtimeLoraPath(lora),
    quant: diffusion.quant,
    modelLabel: `${diffusion.label}${diffusion.kind === 'merged' ? '' : ' + LoRA ' + lora.short}`
  };
}

export function tryResolveActive() {
  try { return resolveActive(); } catch { return null; }
}

// Hashing is only used after a download; startup checks size/existence for speed.
export function itemExists(item) { return existsSync(itemPath(item)); }
