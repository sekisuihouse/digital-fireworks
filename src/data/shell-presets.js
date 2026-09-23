/**
 * 花火玉のおてほん（珠配置プリセット）
 * =========================================================================
 * すべて六角格子（1.004cm 間隔）の上に置いてあるので、
 *   ・直径6cmの円の内側に収まる
 *   ・珠どうしが重ならない
 * という条件を必ず満たす。createShell() が canPlacePellet() を通すため、
 * 万一ここが間違っていても不正な珠はアプリに入らない。
 *
 * 格子の行と列:
 *   row -2 : col -1, 0, 1
 *   row -1 : col -2, -1, 0, 1     （半個ぶん右にずれる）
 *   row  0 : col -2, -1, 0, 1, 2
 *   row  1 : col -2, -1, 0, 1
 *   row  2 : col -1, 0, 1
 */
import { slotAt } from '../types/shell.js';

/** [row, col, colorId] の配列から珠のリストを作る */
function P(list) {
  return list.map(([row, col, color]) => {
    const { x, y } = slotAt(row, col);
    return { x, y, color };
  });
}

const RING = [
  [-2, -1], [-2, 0], [-2, 1],
  [-1, -2], [-1, 1],
  [0, -2], [0, 2],
  [1, -2], [1, 1],
  [2, -1], [2, 0], [2, 1],
];

const ALL = [
  [-2, -1], [-2, 0], [-2, 1],
  [-1, -2], [-1, -1], [-1, 0], [-1, 1],
  [0, -2], [0, -1], [0, 0], [0, 1], [0, 2],
  [1, -2], [1, -1], [1, 0], [1, 1],
  [2, -1], [2, 0], [2, 1],
];

const withColor = (cells, color) => cells.map(([r, c]) => [r, c, color]);

/** @type {{id:string,name:string,hint:string,pellets:Array}[]} */
export const SHELL_PRESETS = [
  {
    id: 'blank',
    name: 'からっぽ',
    hint: 'なにもない たまから つくる',
    pellets: [],
  },
  {
    id: 'full',
    name: 'まんまる',
    hint: 'たまを ぎっしり つめた 菊',
    pellets: P(withColor(ALL, 'lemon')),
  },
  {
    id: 'ring',
    name: 'わっか',
    hint: 'まわりだけ に たまを おく',
    pellets: P(withColor(RING, 'blue')),
  },
  {
    id: 'heart',
    name: 'ハート',
    hint: 'したが とがった ハート',
    pellets: P([
      ...withColor([[-2, -1], [-2, 1]], 'red'),
      ...withColor([[-1, -2], [-1, -1], [-1, 0], [-1, 1]], 'red'),
      ...withColor([[0, -2], [0, -1], [0, 1], [0, 2]], 'red'),
      ...withColor([[0, 0]], 'white'),
      ...withColor([[1, -1], [1, 0]], 'red'),
      ...withColor([[2, 0]], 'red'),
    ]),
  },
  {
    id: 'star',
    name: 'ほし',
    hint: 'ごぼうせいの かたち',
    pellets: P([
      ...withColor([[-2, 0]], 'lemon'),
      ...withColor([[-1, -1], [-1, 0]], 'lemon'),
      ...withColor([[0, -2], [0, -1], [0, 1], [0, 2]], 'lemon'),
      ...withColor([[0, 0]], 'white'),
      ...withColor([[1, -1], [1, 0]], 'lemon'),
      ...withColor([[2, -1], [2, 1]], 'lemon'),
    ]),
  },
  {
    id: 'smile',
    name: 'にこちゃん',
    hint: 'めと くちの ある かお',
    pellets: P([
      ...withColor(RING, 'lemon'),
      ...withColor([[-1, -1], [-1, 0]], 'purple'),
      ...withColor([[1, -1], [1, 0]], 'red'),
    ]),
  },
  {
    id: 'rainbow',
    name: 'にじいろ',
    hint: '6しょくを ぜんぶ つかう',
    pellets: P([
      ...withColor([[-2, -1], [-2, 0], [-2, 1]], 'red'),
      ...withColor([[-1, -2], [-1, -1], [-1, 0], [-1, 1]], 'lemon'),
      ...withColor([[0, -2], [0, -1], [0, 0], [0, 1], [0, 2]], 'green'),
      ...withColor([[1, -2], [1, -1], [1, 0], [1, 1]], 'blue'),
      ...withColor([[2, -1], [2, 0], [2, 1]], 'purple'),
    ]),
  },
];

export function getShellPreset(id) {
  return SHELL_PRESETS.find((p) => p.id === id) || SHELL_PRESETS[0];
}
