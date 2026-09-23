/** 極小 DOM ヘルパー（フレームワーク非依存・依存パッケージなし） */

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * 要素を作る
 * @param {string} tag  'div.foo.bar' のように class も書ける
 * @param {object} [props] attrs / dataset / event / style
 * @param {Array|string} [children]
 */
export function el(tag, props = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.className = classes.join(' ');

  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class' || key === 'className') {
      node.className = (node.className ? node.className + ' ' : '') + value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, value);
    }
  }

  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function setActive(nodes, activeNode, className = 'is-active') {
  for (const n of nodes) n.classList.toggle(className, n === activeNode);
}

/** 秒を「0.5秒後」のような表示にする */
export function formatDelay(sec) {
  if (sec <= 0.001) return 'すぐ';
  const s = Math.round(sec * 10) / 10;
  return (Number.isInteger(s) ? s : s.toFixed(1)) + '秒後';
}

export function formatDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
