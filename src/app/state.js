/**
 * アプリの状態管理（フレームワークなし・単一ストア）
 * =========================================================================
 * このアプリが扱う「作品」は 2.5号玉 1発（FireworkShell）。
 * ストアは編集中の玉を 1 つだけ持ち、UI は 'change' / 'select' / 'tool' を購読する。
 *
 * 珠の追加・移動はすべて canPlacePellet() を通すので、
 * 状態の中に不正な配置（はみ出し・重なり）が入ることはない。
 * 狙った場所が塞がっているときだけ findNearbySpot() ですぐ近くへ逃がす。
 */
import { createEmitter } from '../core/events.js';
import { uid } from '../core/rng.js';
import {
  createShell,
  createPellet,
  cloneShell,
  canPlacePellet,
  findFreeSpot,
  findNearbySpot,
  isInsideShell,
  isShellFull,
  MAX_PELLETS,
} from '../types/shell.js';
import { DEFAULT_PELLET_COLOR_ID, isPelletColorId } from '../data/pellet-colors.js';
import * as storage from '../storage/storage.js';

const HISTORY_LIMIT = 80;

const emitter = createEmitter();
export const on = emitter.on;

const settings = storage.getSettings();

export const state = {
  /** @type {import('../types/shell.js').FireworkShell} 編集中の2.5号玉 */
  shell: createShell({ name: 'わたしの花火' }),
  selectedPelletId: null,
  activeColor: settings.activeColor && isPelletColorId(settings.activeColor)
    ? settings.activeColor
    : DEFAULT_PELLET_COLOR_ID,
  sound: settings.sound ?? true,
  dirty: false,
};

let past = [];
let future = [];

function snapshot() {
  return { shell: cloneShell(state.shell), selectedPelletId: state.selectedPelletId };
}

export function pushHistory() {
  past.push(snapshot());
  if (past.length > HISTORY_LIMIT) past.shift();
  future.length = 0;
  emitter.emit('history');
}

export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;

export function undo() {
  if (!past.length) return false;
  future.push(snapshot());
  const s = past.pop();
  state.shell = s.shell;
  state.selectedPelletId = s.selectedPelletId;
  markDirty();
  emitChange();
  emitter.emit('history');
  return true;
}

export function redo() {
  if (!future.length) return false;
  past.push(snapshot());
  const s = future.pop();
  state.shell = s.shell;
  state.selectedPelletId = s.selectedPelletId;
  markDirty();
  emitChange();
  emitter.emit('history');
  return true;
}

export function resetHistory() {
  past = [];
  future = [];
  emitter.emit('history');
}

function markDirty() {
  state.dirty = true;
  storage.saveDraft(state.shell);
}

function emitChange() {
  emitter.emit('change', state.shell);
  emitter.emit('select', getSelected());
}

/* --------------------------------------------------------------- shell */

export function setShell(shell, { dirty = false } = {}) {
  state.shell = cloneShell(shell);
  state.selectedPelletId = null;
  resetHistory();
  state.dirty = dirty;
  storage.saveDraft(state.shell);
  emitChange();
}

export function setShellName(name) {
  if (state.shell.name === name) return;
  pushHistory();
  state.shell.name = name;
  markDirty();
  emitChange();
}

export function getSelected() {
  return state.shell.pellets.find((p) => p.id === state.selectedPelletId) || null;
}

export function select(id) {
  if (state.selectedPelletId === id) return;
  state.selectedPelletId = id;
  emitter.emit('select', getSelected());
  emitter.emit('change', state.shell);
}

/* -------------------------------------------------------------- pellet */

/**
 * 星はグリッドに縛られず、クリック／ドラッグした位置にそのまま置く。
 * そこが塞がっているときだけ、すぐ近くの空きへ数ミリずらす。
 */
export function resolvePosition(x, y) {
  return isInsideShell(x, y) ? { x, y } : { x, y, outside: true };
}

/**
 * 実際に置かれる場所を先に調べる（ゴースト表示用。状態は変えない）。
 * ここで返る座標と、addPellet / movePellet が置く座標は必ず一致する。
 * @returns {{x:number, y:number, snapped:boolean}|null}
 */
export function previewSpot(x, y, ignoreId) {
  if (canPlacePellet(x, y, state.shell.pellets, { ignoreId }).ok) {
    return { x, y, snapped: false };
  }
  return findNearbySpot(x, y, state.shell.pellets, { ignoreId });
}

/**
 * 珠を置く。どこにも置けない場合だけ理由を返し、状態は一切変えない。
 * @returns {{ok:boolean, reason?:string, pellet?:object}}
 */
export function addPellet(x, y, colorId = state.activeColor, { snap = true } = {}) {
  const direct = canPlacePellet(x, y, state.shell.pellets);
  let spot = direct.ok ? { x, y, snapped: false } : null;

  // 狙った場所がダメでも、すぐ近くに置けるならそこへ。
  // こどもが大まかに狙っても置けるようにするための救済（形はほぼ崩れない）。
  if (!spot && snap) spot = findNearbySpot(x, y, state.shell.pellets);

  if (!spot) {
    // 近くにも空きがなかった理由を、いちばん分かりやすい言葉で返す
    const reason = isInsideShell(x, y) && isShellFull(state.shell.pellets)
      ? 'full'
      : direct.reason || 'outside';
    const check = { ...direct, ok: false, reason };
    emitter.emit('reject', check);
    return check;
  }
  pushHistory();
  const pellet = createPellet(spot.x, spot.y, colorId);
  state.shell.pellets.push(pellet);
  state.selectedPelletId = pellet.id;
  markDirty();
  emitChange();
  return { ok: true, pellet };
}

/**
 * 珠を動かす。無効な位置なら動かさない（＝ドロップ時は元の位置のまま）。
 * @returns {{ok:boolean, reason?:string}}
 */
export function movePellet(id, x, y, { history = true, snap = false } = {}) {
  const pellet = state.shell.pellets.find((p) => p.id === id);
  if (!pellet) return { ok: false, reason: 'missing' };
  const direct = canPlacePellet(x, y, state.shell.pellets, { ignoreId: id });
  let spot = direct.ok ? { x, y } : null;
  if (!spot && snap) spot = findNearbySpot(x, y, state.shell.pellets, { ignoreId: id });
  if (!spot) {
    emitter.emit('reject', direct);
    return direct;
  }
  if (pellet.x === spot.x && pellet.y === spot.y) return { ok: true };
  if (history) pushHistory();
  pellet.x = spot.x;
  pellet.y = spot.y;
  markDirty();
  emitChange();
  return { ok: true };
}

/** 置けるかどうかだけ調べる（ゴースト表示用。状態は変えない） */
export function testPosition(x, y, ignoreId) {
  const pos = resolvePosition(x, y);
  const check = pos.outside
    ? { ok: false, reason: 'outside' }
    : canPlacePellet(pos.x, pos.y, state.shell.pellets, { ignoreId });
  return { ...pos, ...check };
}

export function setPelletColor(id, colorId) {
  const pellet = state.shell.pellets.find((p) => p.id === id);
  if (!pellet || pellet.color === colorId || !isPelletColorId(colorId)) return false;
  pushHistory();
  pellet.color = colorId;
  markDirty();
  emitChange();
  return true;
}

export function removePellet(id) {
  const i = state.shell.pellets.findIndex((p) => p.id === id);
  if (i < 0) return false;
  pushHistory();
  state.shell.pellets.splice(i, 1);
  if (state.selectedPelletId === id) state.selectedPelletId = null;
  markDirty();
  emitChange();
  return true;
}

export function clearPellets() {
  if (!state.shell.pellets.length) return;
  pushHistory();
  state.shell.pellets = [];
  state.selectedPelletId = null;
  markDirty();
  emitChange();
}

/** 空いているところを最後まで埋める */
export function fillFreeSpots(colorId = state.activeColor) {
  let added = 0;
  let first = true;
  while (state.shell.pellets.length < MAX_PELLETS) {
    const spot = findFreeSpot(state.shell.pellets);
    if (!spot) break;
    if (first) {
      pushHistory();
      first = false;
    }
    state.shell.pellets.push(createPellet(spot.x, spot.y, colorId));
    added++;
  }
  if (!added) {
    emitter.emit('reject', { ok: false, reason: 'full' });
    return 0;
  }
  markDirty();
  emitChange();
  return added;
}

/** 選んだ星を少しだけ動かす（矢印キー用・重なる方向へは動かない） */
export function nudgePellet(id, dx, dy) {
  const p = state.shell.pellets.find((q) => q.id === id);
  if (!p) return false;
  const res = movePellet(id, p.x + dx, p.y + dy);
  return res.ok;
}

/* ----------------------------------------------------------------- 設定 */

export function setTool(patch) {
  let changed = false;
  if (patch.activeColor && isPelletColorId(patch.activeColor) && state.activeColor !== patch.activeColor) {
    state.activeColor = patch.activeColor;
    changed = true;
  }
  if (changed) {
    storage.setSettings({ activeColor: state.activeColor });
    emitter.emit('tool', state);
  }
  return changed;
}

export function setView(patch) {
  let changed = false;
  for (const k of ['sound']) {
    if (patch[k] != null && state[k] !== patch[k]) {
      state[k] = patch[k];
      changed = true;
    }
  }
  if (changed) {
    storage.setSettings({ sound: state.sound });
    emitter.emit('view', state);
    emitter.emit('change', state.shell);
  }
  return changed;
}

/** これ以上どこにも星を置けないか */
export function isFull() {
  return isShellFull(state.shell.pellets);
}

export function markSaved() {
  state.dirty = false;
  emitter.emit('saved', state.shell);
}

export function newShell() {
  setShell(createShell({ id: uid('shell'), name: 'わたしの花火' }));
}

export { emitter };
