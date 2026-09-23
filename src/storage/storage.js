/**
 * 保存まわり（localStorage / 外部DBなし・オフラインで動く）
 * =========================================================================
 * 保存する単位は「2.5号玉 1発（FireworkShell）」。
 *
 * キー:
 *   digital-fireworks.v2.shells    保存した花火玉の一覧
 *   digital-fireworks.v2.settings  音・スナップなどの設定
 *   digital-fireworks.v2.draft     編集中の下書き（リロードしても消えない）
 *
 * 読み込み時は必ず normalizeShell() を通すので、
 * 外周からはみ出した珠・重なった珠・6色以外の珠はアプリに入らない。
 *
 * @typedef {object} ShellRecord
 * @property {string} id
 * @property {string} name
 * @property {import('../types/shell.js').FireworkShell} shell
 * @property {string} thumbnail  dataURL (image/png)
 * @property {number} createdAt
 * @property {number} updatedAt
 */
import { normalizeShell, cloneShell } from '../types/shell.js';
import { uid } from '../core/rng.js';
import { DEFAULT_PELLET_COLOR_ID, isPelletColorId } from '../data/pellet-colors.js';

const NS = 'digital-fireworks.v2';
const K_SHELLS = NS + '.shells';
const K_SETTINGS = NS + '.settings';
const K_DRAFT = NS + '.draft';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[storage] 読み込み失敗', key, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('[storage] 保存失敗', key, e);
    return false;
  }
}

export function isStorageAvailable() {
  try {
    const t = NS + '.test';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------- shells */

/** @returns {ShellRecord[]} 新しい順 */
export function listShells() {
  const raw = readJSON(K_SHELLS, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && r.shell)
    .map((r) => {
      const shell = normalizeShell(r.shell);
      return {
        id: r.id || shell.id,
        name: r.name || shell.name,
        shell,
        thumbnail: typeof r.thumbnail === 'string' ? r.thumbnail : '',
        createdAt: Number(r.createdAt) || Date.now(),
        updatedAt: Number(r.updatedAt) || Number(r.createdAt) || Date.now(),
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getShellRecord(id) {
  return listShells().find((r) => r.id === id) || null;
}

/**
 * 保存（同じ id があれば上書き）
 * @returns {{ok:boolean, record?:ShellRecord, error?:string}}
 */
export function saveShell(shell, thumbnail = '') {
  const all = listShells();
  const now = Date.now();
  const idx = all.findIndex((r) => r.id === shell.id);
  const stored = cloneShell(shell);
  stored.updatedAt = now;
  /** @type {ShellRecord} */
  const record = {
    id: shell.id,
    name: shell.name,
    shell: stored,
    thumbnail,
    createdAt: idx >= 0 ? all[idx].createdAt : now,
    updatedAt: now,
  };
  if (idx >= 0) all[idx] = record;
  else all.unshift(record);

  if (!writeJSON(K_SHELLS, all)) {
    // 容量オーバー時はサムネイルを落としてもう一度
    const slim = all.map((r) => ({ ...r, thumbnail: r.id === record.id ? thumbnail : '' }));
    if (!writeJSON(K_SHELLS, slim)) {
      return { ok: false, error: 'ほぞんできませんでした（ようりょう不足かも）' };
    }
  }
  return { ok: true, record };
}

export function deleteShell(id) {
  return writeJSON(K_SHELLS, listShells().filter((r) => r.id !== id));
}

/** @returns {ShellRecord|null} */
export function duplicateShell(id) {
  const src = getShellRecord(id);
  if (!src) return null;
  const copy = cloneShell(src.shell);
  copy.id = uid('shell');
  copy.name = src.name + ' のコピー';
  copy.pellets = copy.pellets.map((p) => ({ ...p, id: uid('pel') }));
  const res = saveShell(copy, src.thumbnail);
  return res.ok ? res.record : null;
}

export function clearAllShells() {
  return writeJSON(K_SHELLS, []);
}

/* ------------------------------------------------------------- settings */

const DEFAULT_SETTINGS = {
  sound: true,
  activeColor: DEFAULT_PELLET_COLOR_ID,
};

export function getSettings() {
  const s = { ...DEFAULT_SETTINGS, ...readJSON(K_SETTINGS, {}) };
  if (!isPelletColorId(s.activeColor)) s.activeColor = DEFAULT_PELLET_COLOR_ID;
  return s;
}

export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  writeJSON(K_SETTINGS, next);
  return next;
}

/* ---------------------------------------------------------------- draft */

export function saveDraft(shell) {
  writeJSON(K_DRAFT, { shell: cloneShell(shell), savedAt: Date.now() });
}

export function loadDraft() {
  const d = readJSON(K_DRAFT, null);
  if (!d || !d.shell) return null;
  try {
    return normalizeShell(d.shell);
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(K_DRAFT);
  } catch {
    /* noop */
  }
}

/* -------------------------------------------------------- export/import */

/** バックアップ用 JSON（ワークショップで PC をまたぐとき用） */
export function exportAll() {
  return JSON.stringify({ app: 'digital-fireworks', version: 2, shells: listShells() }, null, 2);
}

export function importAll(json, { merge = true } = {}) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'JSON が読めませんでした' };
  }
  const incomingRaw = Array.isArray(data?.shells) ? data.shells : null;
  if (!incomingRaw) return { ok: false, error: '形式がちがいます' };

  const incoming = incomingRaw.map((r) => {
    const shell = normalizeShell(r.shell || r);
    return {
      id: r.id || shell.id,
      name: r.name || shell.name,
      shell,
      thumbnail: r.thumbnail || '',
      createdAt: Number(r.createdAt) || Date.now(),
      updatedAt: Number(r.updatedAt) || Date.now(),
    };
  });
  const base = merge ? listShells() : [];
  const byId = new Map(base.map((r) => [r.id, r]));
  for (const r of incoming) byId.set(r.id, r);
  writeJSON(K_SHELLS, Array.from(byId.values()));
  return { ok: true, count: incoming.length };
}
