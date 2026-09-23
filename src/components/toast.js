/** 画面下に出る小さな通知（操作結果がすぐ分かるように） */
import { el, qs } from '../core/dom.js';

let root = null;
/** @type {Map<string, {node:HTMLElement, timer:number}>} */
const live = new Map();

function ensureRoot() {
  if (!root) root = qs('#toast-root') || document.body;
  return root;
}

function dismiss(key) {
  const entry = live.get(key);
  if (!entry) return;
  live.delete(key);
  entry.node.classList.remove('is-in');
  setTimeout(() => entry.node.remove(), 260);
}

export function showToast(message, type = 'info', ms = 2200) {
  const key = type + '|' + message;

  // 同じ通知が出ているときは積み上げずに時間だけ延ばす
  const existing = live.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => dismiss(key), ms);
    return existing.node;
  }

  const node = el('div.toast.toast-' + type, {}, [message]);
  ensureRoot().append(node);
  // rAF に頼らず確実にトランジションさせる
  void node.offsetWidth;
  node.classList.add('is-in');

  live.set(key, { node, timer: setTimeout(() => dismiss(key), ms) });
  return node;
}
