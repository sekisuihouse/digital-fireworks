/**
 * 決定論的な擬似乱数。
 * 花火プレビューが再描画のたびにチラつかないよう、id からシードを作って使う。
 */

/** 文字列 -> 32bit ハッシュ */
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: 高速・軽量なシード付き乱数 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** id からシード付き乱数を作る */
export function rngFromId(id) {
  return mulberry32(hashString(String(id)));
}

/** 実行時のランダム（本番再生用） */
export const random = Math.random;

export function randRange(rand, min, max) {
  return min + rand() * (max - min);
}

export function pick(rand, arr) {
  return arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];
}

export function uid(prefix = 'fw') {
  return (
    prefix +
    '_' +
    Date.now().toString(36) +
    '_' +
    Math.floor(Math.random() * 1e6).toString(36)
  );
}
