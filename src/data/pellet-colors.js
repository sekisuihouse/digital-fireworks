/**
 * 星（珠）の色 — 6色のみ
 * =========================================================================
 * 実際の2.5号玉「型物」に詰める星の色は 6 種類だけ。
 * 最終的な 6 色は変更される可能性があるため、値はこのファイル 1 か所だけで管理する。
 * UI（パレット）・玉の描画・サムネイル・花火エンジンはすべてここを参照する。
 * （RGBピッカーや任意色指定は実装しない）
 *
 * @typedef {object} PelletColor
 * @property {string}   id        保存される値
 * @property {string}   name      画面に出す名前
 * @property {string}   swatch    パレット／星の表示色
 * @property {string[]} particles 打ち上げ時の火花色（1粒ごとにこの中から選ばれる）
 * @property {number}   twinkle   0..1 瞬きの強さ
 * @property {number}   glow      明るさ倍率
 */

/** ★ 6色。順番もこの通りに画面へ並ぶ。ここを書き換えるだけで全体に反映される。 */
export const PELLET_COLORS = [
  {
    id: 'red',
    name: 'あか',
    swatch: '#ff3b4a',
    particles: ['#ff1a2e', '#ff3a44', '#ff5c48', '#ff8f63'],
    twinkle: 0.12,
    glow: 1.0,
  },
  {
    id: 'lemon',
    name: 'レモン',
    swatch: '#f4ec4a',
    particles: ['#f2e800', '#f7ef3a', '#fbf673', '#fdfab0'],
    twinkle: 0.16,
    glow: 1.12,
  },
  {
    id: 'green',
    name: 'みどり',
    swatch: '#25cf6c',
    particles: ['#0ec95c', '#31e478', '#63f39c', '#a6ffc6'],
    twinkle: 0.12,
    glow: 1.0,
  },
  {
    id: 'purple',
    name: 'むらさき',
    swatch: '#a862ff',
    particles: ['#8a33ff', '#a55cff', '#c188ff', '#dfb6ff'],
    twinkle: 0.14,
    glow: 1.0,
  },
  {
    id: 'blue',
    name: 'あお',
    swatch: '#3b8dff',
    particles: ['#1a5cff', '#2f93ff', '#4fc0ff', '#8fd8ff'],
    twinkle: 0.14,
    glow: 1.05,
  },
  {
    id: 'white',
    name: 'しろ',
    swatch: '#f2f6ff',
    particles: ['#ffffff', '#eef4ff', '#d8e6ff', '#ffffff'],
    twinkle: 0.1,
    glow: 1.15,
  },
];

/** 色数は必ず 6。増やすとバリデーションで気づけるようにしておく。 */
export const PELLET_COLOR_COUNT = 6;

export const PELLET_COLOR_MAP = new Map(PELLET_COLORS.map((c) => [c.id, c]));

export const DEFAULT_PELLET_COLOR_ID = PELLET_COLORS[0].id;

/** 昔の保存データとの読み替え（色を入れ替えても作品が壊れないように） */
const COLOR_ALIASES = {
  yellow: 'lemon',
  gold: 'lemon',
  sparkle: 'white',
};

export function isPelletColorId(id) {
  return PELLET_COLOR_MAP.has(id);
}

/** 未知のIDが来ても必ず有効な色を返す（保存データの互換性） */
export function getPelletColor(id) {
  return (
    PELLET_COLOR_MAP.get(id) ||
    PELLET_COLOR_MAP.get(COLOR_ALIASES[id]) ||
    PELLET_COLOR_MAP.get(DEFAULT_PELLET_COLOR_ID)
  );
}

/** 保存データ読み込み時に使う（別名を正式な id に直す） */
export function resolvePelletColorId(id) {
  if (PELLET_COLOR_MAP.has(id)) return id;
  if (COLOR_ALIASES[id] && PELLET_COLOR_MAP.has(COLOR_ALIASES[id])) return COLOR_ALIASES[id];
  return DEFAULT_PELLET_COLOR_ID;
}

if (PELLET_COLORS.length !== PELLET_COLOR_COUNT) {
  console.warn(
    `[pellet-colors] 星の色は ${PELLET_COLOR_COUNT} 色の想定ですが ${PELLET_COLORS.length} 色あります`
  );
}
