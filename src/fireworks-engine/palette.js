/**
 * 描画用カラーパレット（インデックス化）
 * =========================================================================
 * パーティクルは色を文字列ではなく「パレット番号」で持つ。
 * 同じ色・同じ明るさのものをまとめて 1 回の stroke で描くため、
 * 数千粒でも 60fps を保てる。
 */
import { PELLET_COLORS } from '../data/pellet-colors.js';

const list = [];
const map = new Map();

/** 色を登録して番号を得る（既出ならその番号） */
export function colorIndex(css) {
  let i = map.get(css);
  if (i === undefined) {
    i = list.length;
    list.push(css);
    map.set(css, i);
  }
  return i;
}

export function colorAt(index) {
  return list[index] || '#ffffff';
}

export function paletteSize() {
  return list.length;
}

/** 6色ぶんの火花色をあらかじめ登録しておく */
for (const c of PELLET_COLORS) {
  for (const p of c.particles) colorIndex(p);
}
/** 尾・閃光など共通で使う色 */
export const WHITE = colorIndex('#ffffff');
export const EMBER = colorIndex('#ffd9a0');
export const EMBER_HOT = colorIndex('#fff3d0');
