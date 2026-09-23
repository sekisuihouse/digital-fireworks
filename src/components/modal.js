/** モーダル（確認・名前入力・テンプレート選択） */
import { el, qs, clear } from '../core/dom.js';
import { uiIcon } from './icons.js';

function root() {
  return qs('#modal-root') || document.body;
}

/**
 * @param {object} o {title, body:Node|string, actions:Array<{label,variant,onClick,value}>, onClose}
 */
export function openModal({ title, body, actions = [], wide = false, onClose }) {
  const backdrop = el('div.modal-backdrop');
  const panel = el('div.modal' + (wide ? '.modal-wide' : ''), { role: 'dialog', 'aria-modal': 'true' });

  const close = (value) => {
    backdrop.classList.remove('is-in');
    setTimeout(() => backdrop.remove(), 180);
    document.removeEventListener('keydown', onKey);
    onClose?.(value);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close(undefined);
    }
  };

  const head = el('div.modal-head', {}, [
    el('h2.modal-title', {}, [title || '']),
    el('button.icon-btn.modal-close', {
      type: 'button',
      title: 'とじる',
      html: uiIcon('close'),
      onClick: () => close(undefined),
    }),
  ]);

  const bodyNode = el('div.modal-body');
  if (body instanceof Node) bodyNode.append(body);
  else if (body != null) bodyNode.append(document.createTextNode(String(body)));

  const foot = el('div.modal-foot');
  for (const a of actions) {
    foot.append(
      el(
        'button.btn' + (a.variant ? '.btn-' + a.variant : ''),
        { type: 'button', onClick: () => (a.onClick ? a.onClick(close) : close(a.value)) },
        [a.label]
      )
    );
  }

  panel.append(head, bodyNode);
  if (actions.length) panel.append(foot);
  backdrop.append(panel);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close(undefined);
  });
  root().append(backdrop);
  // rAF に頼らない（バックグラウンドタブでも確実にフェードインさせる）
  void backdrop.offsetWidth;
  backdrop.classList.add('is-in');
  document.addEventListener('keydown', onKey);

  return { close, panel, body: bodyNode };
}

/** はい／いいえ */
export function confirmDialog({ title, message, okLabel = 'はい', cancelLabel = 'やめる', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    openModal({
      title,
      body: el('p.modal-text', {}, [message]),
      actions: [
        { label: cancelLabel, variant: 'ghost', onClick: (close) => { done(false); close(); } },
        {
          label: okLabel,
          variant: danger ? 'danger' : 'primary',
          onClick: (close) => { done(true); close(); },
        },
      ],
      onClose: () => done(false),
    });
  });
}

/** なまえ入力 */
export function promptDialog({ title, label, value = '', placeholder = '', okLabel = 'けってい' }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const input = el('input.text-input', {
      type: 'text',
      value,
      placeholder,
      maxlength: '40',
    });
    const wrap = el('div.form-row', {}, [label ? el('label.form-label', {}, [label]) : null, input]);
    const m = openModal({
      title,
      body: wrap,
      actions: [
        { label: 'やめる', variant: 'ghost', onClick: (close) => { done(null); close(); } },
        {
          label: okLabel,
          variant: 'primary',
          onClick: (close) => { done(input.value.trim() || value || ''); close(); },
        },
      ],
      onClose: () => done(null),
    });
    setTimeout(() => {
      input.focus();
      input.select();
    }, 60);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        done(input.value.trim() || value || '');
        m.close();
      }
    });
  });
}

export { clear };
