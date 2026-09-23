/**
 * FireworkShell / Pellet — 2.5号玉 1発の設計データ
 * =========================================================================
 * 実際の 2.5号玉の制作条件をそのままデータモデルにしている。
 *
 *   ・花火玉の外周    : 直径 6cm（半径 3cm）
 *   ・珠（星）1個      : 直径 1cm（半径 0.5cm）
 *   ・珠は外周の内側に完全に収まる  -> 中心からの距離 <= 3 - 0.5 = 2.5cm
 *   ・珠どうしは絶対に重ならない    -> 珠の中心間距離 >= 1.0cm
 *   ・珠の色は 6 種類のみ（data/pellet-colors.js）
 *
 * 座標は「花火玉の中心を原点とした cm」。
 *   x : 右が +
 *   y : 下が +（画面座標と同じ向き。編集画面と夜空で向きがずれないようにするため）
 *
 * @typedef {object} Pellet
 * @property {string} id
 * @property {number} x      cm（玉中心基準）
 * @property {number} y      cm（玉中心基準）
 * @property {string} color  PELLET_COLORS の id
 *
 * @typedef {object} FireworkShell
 * @property {string} id
 * @property {string} name
 * @property {Pellet[]} pellets
 * @property {number} [createdAt]
 * @property {number} [updatedAt]
 */

import { uid } from '../core/rng.js';
import { resolvePelletColorId } from '../data/pellet-colors.js';

/* ------------------------------------------------------------ 物理定数 */

/** 花火玉の直径 [cm] */
export const SHELL_DIAMETER_CM = 6;
/** 花火玉の半径 [cm] */
export const SHELL_RADIUS_CM = SHELL_DIAMETER_CM / 2;
/** 珠の直径 [cm] */
export const PELLET_DIAMETER_CM = 1;
/** 珠の半径 [cm] */
export const PELLET_RADIUS_CM = PELLET_DIAMETER_CM / 2;
/** 珠の中心が入れる最大半径 [cm] = 2.5 */
export const MAX_PELLET_CENTER_R_CM = SHELL_RADIUS_CM - PELLET_RADIUS_CM;
/** 珠どうしの最小中心間距離 [cm] = 1.0 */
export const MIN_PELLET_GAP_CM = PELLET_DIAMETER_CM;
/** 浮動小数の誤差許容 */
export const EPS = 1e-6;

/** 珠の上限（物理的にはこれ以上入らない。安全弁） */
export const MAX_PELLETS = 24;

/* ---------------------------------------------------------- 配置の判定 */

/** 珠 1 個が外周の内側に完全に収まるか */
export function isInsideShell(x, y) {
  return Math.hypot(x, y) <= MAX_PELLET_CENTER_R_CM + EPS;
}

/**
 * ここに珠を置けるか？（唯一の判定処理。UI もエンジンも保存もこれを通す）
 *
 * @param {number} x cm
 * @param {number} y cm
 * @param {Pellet[]} existingPellets すでに置かれている珠
 * @param {{ignoreId?: string}} [opts] ドラッグ中に自分自身を無視するため
 * @returns {{ok: boolean, reason?: 'outside'|'overlap'|'full', conflictId?: string}}
 */
export function canPlacePellet(x, y, existingPellets = [], opts = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { ok: false, reason: 'outside' };
  }
  // 1) 外周からはみ出さないか
  if (!isInsideShell(x, y)) {
    return { ok: false, reason: 'outside' };
  }
  // 2) 既存の珠と重ならないか
  for (const p of existingPellets) {
    if (opts.ignoreId && p.id === opts.ignoreId) continue;
    if (Math.hypot(p.x - x, p.y - y) < MIN_PELLET_GAP_CM - EPS) {
      return { ok: false, reason: 'overlap', conflictId: p.id };
    }
  }
  // 3) 個数の安全弁
  const count = opts.ignoreId
    ? existingPellets.filter((p) => p.id !== opts.ignoreId).length
    : existingPellets.length;
  if (count >= MAX_PELLETS) return { ok: false, reason: 'full' };

  return { ok: true };
}

export const PLACE_ERROR_TEXT = {
  outside: 'たまが まるから はみだしちゃう',
  overlap: 'たまが かさなっちゃう',
  full: 'もう ほしを おく ばしょが ないよ',
};

/* --------------------------------------------------------- 生成・検証 */

/** @returns {Pellet} */
export function createPellet(x, y, color) {
  return {
    id: uid('pel'),
    x: round4(x),
    y: round4(y),
    color: resolvePelletColorId(color),
  };
}

/** @returns {FireworkShell} */
export function createShell(partial = {}) {
  const shell = {
    id: partial.id || uid('shell'),
    name: partial.name || 'なまえのない たま',
    pellets: [],
    createdAt: partial.createdAt || Date.now(),
    updatedAt: partial.updatedAt || Date.now(),
  };
  for (const raw of partial.pellets || []) {
    const p = createPellet(Number(raw.x), Number(raw.y), raw.color);
    if (raw.id) p.id = raw.id;
    if (canPlacePellet(p.x, p.y, shell.pellets).ok) shell.pellets.push(p);
  }
  return shell;
}

export function cloneShell(shell) {
  return {
    id: shell.id,
    name: shell.name,
    pellets: shell.pellets.map((p) => ({ ...p })),
    createdAt: shell.createdAt,
    updatedAt: shell.updatedAt,
  };
}

/**
 * 保存データの読み込み時に使う。
 * 制約を破っている珠は落とす（＝無効なデータをアプリに入れない）。
 * @returns {FireworkShell}
 */
export function normalizeShell(raw) {
  return createShell({
    id: raw?.id,
    name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name : 'なまえのない たま',
    pellets: Array.isArray(raw?.pellets) ? raw.pellets : [],
    createdAt: Number(raw?.createdAt) || Date.now(),
    updatedAt: Number(raw?.updatedAt) || Date.now(),
  });
}

/**
 * 玉全体が制作条件を満たしているか検査する（保存前チェック用）
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validateShell(shell) {
  const errors = [];
  const seen = [];
  for (const p of shell.pellets || []) {
    if (resolvePelletColorId(p.color) !== p.color) errors.push(`${p.id}: 使えない色`);
    const r = canPlacePellet(p.x, p.y, seen);
    if (!r.ok) errors.push(`${p.id}: ${PLACE_ERROR_TEXT[r.reason] || r.reason}`);
    else seen.push(p);
  }
  if ((shell.pellets || []).length > MAX_PELLETS) errors.push('珠が多すぎる');
  return { ok: errors.length === 0, errors };
}

/* ------------------------------------------------------- 六角配置の補助 */
/**
 * 星は自由な位置に置ける（グリッドには縛られない）。
 * ただし「おてほん」の定義と、自動でひとつ増やすときの候補として、
 * いちばん密に詰められる 1cm 間隔の六角配置を内部的に持っておく。
 */
let _slots = null;

/**
 * 格子の間隔 [cm]。
 * ちょうど 1.0 にすると座標を丸めた瞬間に「わずかに 1.0 未満」となり
 * 自分で作った格子が重なり判定に引っかかる。わずかに広げて確実に合法にする。
 */
export const SLOT_SPACING_CM = MIN_PELLET_GAP_CM * 1.004;

/** @returns {{x:number,y:number}[]} 合法な格子点（19点） */
export function hexSlots() {
  if (_slots) return _slots;
  const out = [];
  const a = SLOT_SPACING_CM;
  const dy = a * (Math.sqrt(3) / 2);
  for (let row = -3; row <= 3; row++) {
    const y = row * dy;
    const offset = (row & 1) === 0 ? 0 : 0.5;
    for (let col = -4; col <= 4; col++) {
      const x = (col + offset) * a;
      if (Math.hypot(x, y) <= MAX_PELLET_CENTER_R_CM + EPS) out.push({ x: round4(x), y: round4(y) });
    }
  }
  _slots = out;
  return out;
}

/** 格子の行・列から座標を得る（プリセット定義用） */
export function slotAt(row, col) {
  const a = SLOT_SPACING_CM;
  const offset = (row & 1) === 0 ? 0 : 0.5;
  return { x: round4((col + offset) * a), y: round4(row * a * (Math.sqrt(3) / 2)) };
}

/**
 * 空いている場所をひとつ探す（「あいてる ところに ふやす」ボタン用）。
 * まず最密の六角配置を試し、ダメなら自由座標をサンプリングする。
 * ユーザー自身は格子に縛られず自由に置けるので、これはあくまで自動配置の補助。
 * @param {Pellet[]} pellets
 * @returns {{x:number,y:number}|null}
 */
export function findFreeSpot(pellets) {
  for (const s of hexSlots()) {
    if (canPlacePellet(s.x, s.y, pellets).ok) return { x: s.x, y: s.y };
  }
  // 自由配置の玉に合わせて、細かくサンプリングして探す
  const RINGS = 9;
  for (let ri = 0; ri <= RINGS; ri++) {
    const r = (MAX_PELLET_CENTER_R_CM * ri) / RINGS;
    const steps = Math.max(1, Math.round((2 * Math.PI * r) / 0.25));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2 + ri * 0.37;
      const x = round4(Math.cos(a) * r);
      const y = round4(Math.sin(a) * r);
      if (canPlacePellet(x, y, pellets).ok) return { x, y };
    }
  }
  return null;
}

/** 珠の数 */
export function pelletCount(shell) {
  return shell?.pellets?.length || 0;
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

/**
 * クリックした場所に置けないとき、すぐ近くの置ける場所を探す。
 * =========================================================================
 * こどもが指やマウスでだいたいの位置をねらっても置けるようにするための補助。
 * 「少しだけ」ずらすだけなので、狙った形はくずれない。
 *
 *   1) 円からはみ出す位置なら、まず中心方向へ引き戻した点を試す
 *   2) それでもダメなら、クリック位置のまわりを少しずつ広げながら探す
 *
 * @param {number} x cm
 * @param {number} y cm
 * @param {Pellet[]} pellets
 * @param {{ignoreId?:string, maxDist?:number}} [opts] maxDist: 何cmまでずらしてよいか
 * @returns {{x:number, y:number, snapped:boolean}|null} 置ける場所（見つからなければ null）
 */
export function findNearbySpot(x, y, pellets = [], opts = {}) {
  const maxDist = opts.maxDist ?? 0.9;
  const ignoreId = opts.ignoreId;

  if (canPlacePellet(x, y, pellets, { ignoreId }).ok) {
    return { x: round4(x), y: round4(y), snapped: false };
  }

  /** @type {{x:number,y:number}[]} 近い順に試す候補 */
  const tries = [];

  // 1) 円の外なら、まっすぐ中心へ引き戻す
  const r = Math.hypot(x, y);
  if (r > MAX_PELLET_CENTER_R_CM && r > EPS) {
    const k = MAX_PELLET_CENTER_R_CM / r;
    tries.push({ x: x * k, y: y * k });
  }

  // 2) クリック位置のまわりを、近いところから順に探す
  for (let d = 0.1; d <= maxDist + EPS; d += 0.1) {
    const steps = Math.max(8, Math.round((TAU_CM * d) / 0.12));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU_CM + d * 3.1;
      tries.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
    }
  }

  for (const t of tries) {
    const tx = round4(t.x);
    const ty = round4(t.y);
    if (canPlacePellet(tx, ty, pellets, { ignoreId }).ok) {
      return { x: tx, y: ty, snapped: true };
    }
  }
  return null;
}

const TAU_CM = Math.PI * 2;

/** これ以上どこにも星を置けないか（=「まんぱい」表示用） */
export function isShellFull(pellets = []) {
  if (pellets.length >= MAX_PELLETS) return true;
  return findFreeSpot(pellets) === null;
}
