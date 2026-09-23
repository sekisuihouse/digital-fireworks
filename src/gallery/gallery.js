/**
 * ギャラリー画面
 * =========================================================================
 * 保存した 2.5号玉の一覧。打ち上げ / 編集 / 複製 / 削除ができる。
 * 「みんなの花火を打ち上げる」で、全部を順番に打ち上げ、最後にフィナーレ。
 */
import { el, qs, clear, formatDate } from '../core/dom.js';
import { uiIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';
import * as storage from '../storage/storage.js';
import * as player from '../player/player.js';
import { renderShellThumbnail } from '../components/shell-render.js';

let listEl = null;
let headEl = null;
let handlers = {};

export function mountGallery(root, h = {}) {
  handlers = h;
  headEl = qs('#gallery-head', root);
  listEl = qs('#gallery-list', root);
  render();
  return { render };
}

export function render() {
  if (!listEl) return;
  const records = storage.listShells();

  clear(headEl);
  headEl.append(
    el('div.gallery-heading', {}, [
      el('h2.gallery-title', {}, ['ギャラリー']),
      el('span.gallery-count', {}, [`${records.length} はつ`]),
    ]),
    el('div.gallery-actions', {}, [
      el('button.btn.btn-big.btn-accent', {
        type: 'button',
        disabled: records.length === 0,
        html: uiIcon('rocket') + '<span>みんなの花火を 打ち上げる</span>',
        onClick: () => playShow(records),
      }),
      el('button.btn.btn-ghost', {
        type: 'button',
        html: uiIcon('save') + '<span>バックアップ</span>',
        title: 'すべての花火玉を JSON ファイルに書き出す',
        disabled: records.length === 0,
        onClick: exportAll,
      }),
      el('label.btn.btn-ghost.file-btn', {}, [
        el('span', { html: uiIcon('gallery') }),
        el('span', {}, ['よみこみ']),
        el('input', { type: 'file', accept: 'application/json,.json', onChange: importFile }),
      ]),
    ])
  );

  clear(listEl);
  if (!records.length) {
    listEl.append(
      el('div.gallery-empty', {}, [
        el('div.gallery-empty-emoji', {}, ['🎆']),
        el('p', {}, ['まだ 花火玉が ありません']),
        el('button.btn.btn-primary.btn-big', {
          type: 'button',
          html: uiIcon('brush') + '<span>つくりに いく</span>',
          onClick: () => handlers.onGoEditor?.(),
        }),
      ])
    );
    return;
  }

  for (const rec of records) listEl.append(card(rec));
}

function card(rec) {
  const thumb = rec.thumbnail || renderShellThumbnail(rec.shell, 256);
  return el('article.g-card', {}, [
    el('button.g-thumb', {
      type: 'button',
      title: 'うちあげる',
      onClick: () => launch(rec),
      html:
        `<img src="${thumb}" alt="${escapeHtml(rec.name)}" loading="lazy">` +
        `<span class="g-play">${uiIcon('rocket')}</span>`,
    }),
    el('div.g-body', {}, [
      el('div.g-name', { title: rec.name }, [rec.name]),
      el('div.g-meta', {}, [
        `ほし ${rec.shell.pellets.length} こ`,
        el('span.g-dot', {}, ['・']),
        formatDate(rec.updatedAt),
      ]),
    ]),
    el('div.g-actions', {}, [
      el('button.icon-btn', {
        type: 'button',
        title: 'うちあげる',
        html: uiIcon('rocket'),
        onClick: () => launch(rec),
      }),
      el('button.icon-btn', {
        type: 'button',
        title: 'へんしゅう',
        html: uiIcon('edit'),
        onClick: () => handlers.onEdit?.(rec),
      }),
      el('button.icon-btn', {
        type: 'button',
        title: 'ふくせい',
        html: uiIcon('copy'),
        onClick: () => {
          if (storage.duplicateShell(rec.id)) {
            showToast('ふくせい しました', 'success');
            render();
          }
        },
      }),
      el('button.icon-btn.icon-btn-danger', {
        type: 'button',
        title: 'さくじょ',
        html: uiIcon('trash'),
        onClick: async () => {
          const ok = await confirmDialog({
            title: 'さくじょ しますか？',
            message: `「${rec.name}」を けします。もとに もどせません。`,
            okLabel: 'けす',
            danger: true,
          });
          if (!ok) return;
          storage.deleteShell(rec.id);
          showToast('さくじょ しました', 'info');
          render();
        },
      }),
    ]),
  ]);
}

function launch(rec) {
  player.launchShell(rec.shell, { fullscreen: true, title: rec.name });
}

function playShow(records) {
  // 古い順に上映する（つくった順に並ぶほうが会として自然）
  const entries = [...records]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => ({ name: r.name, shell: r.shell }));
  player.playShow(entries, { fullscreen: true });
}

/* ------------------------------------------------------- バックアップ */

function exportAll() {
  const json = storage.exportAll();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  a.href = url;
  a.download = `digital-fireworks-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('バックアップを ほぞんしました', 'success');
}

function importFile(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const res = storage.importAll(String(reader.result), { merge: true });
    if (!res.ok) {
      showToast(res.error || 'よみこめませんでした', 'error');
      return;
    }
    showToast(`${res.count} はつ よみこみました`, 'success');
    render();
  };
  reader.readAsText(file);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
