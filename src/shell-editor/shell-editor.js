/**
 * 「花火玉をつくる」画面
 * =========================================================================
 * 直径6cmの円の中に、直径1cmの珠を 6 色で並べて 2.5号玉を設計する。
 *
 * 操作はこの 3 つだけ:
 *   ① いろを えらぶ   左のパレットで「つぎに おく ほし」の色を決める
 *   ② ならべる        まるの中をタップして置く／ドラッグで動かす
 *                     置いた星をタップすると、いまの色に塗りかわる
 *   ③ うちあげる      下の大きなボタン
 *
 * 置けない場所（外周からはみ出す・他の珠と重なる）には置かせないが、
 * すぐ近くに空きがあれば数ミリだけずらして置く（狙いが大まかでも置ける）。
 */
import { el, qs, clear } from '../core/dom.js';
import { uiIcon } from '../components/icons.js';
import { showToast } from '../components/toast.js';
import { confirmDialog, promptDialog, openModal } from '../components/modal.js';
import * as store from '../app/state.js';
import * as storage from '../storage/storage.js';
import { ShellCanvas } from './shell-canvas.js';
import { renderShellThumbnail, drawShell } from '../components/shell-render.js';
import { PELLET_COLORS } from '../data/pellet-colors.js';
import { SHELL_PRESETS } from '../data/shell-presets.js';
import {
  createShell,
  cloneShell,
  SHELL_RADIUS_CM,
  PLACE_ERROR_TEXT,
} from '../types/shell.js';
import { uid } from '../core/rng.js';
import * as player from '../player/player.js';

let view = null;
let canvasEl = null;
let hoverId = null;
let conflictId = null;
let ghost = null;
let drag = null;
let eraser = false;
let onSavedCb = null;
let syncTools = () => {};

/* --------------------------------------------------------------- 描画 */

function render() {
  if (!view) return;
  view.render(store.state.shell, {
    selectedId: store.state.selectedPelletId,
    hoverId,
    conflictId,
    ghost,
    dragOrigin: drag && drag.moved ? drag.origin : null,
  });
  syncMeta();
}

/**
 * 「もう置けない」の判定は玉ぜんぶを走査するので、
 * 星の並びが変わったときだけ数え直す（ドラッグ中の毎フレーム再計算を避ける）。
 */
let fullCache = { sig: null, value: false };
function shellIsFull() {
  const ps = store.state.shell.pellets;
  let sig = String(ps.length);
  for (const p of ps) sig += `|${p.x},${p.y}`;
  if (fullCache.sig !== sig) fullCache = { sig, value: store.isFull() };
  return fullCache.value;
}

function syncMeta() {
  const n = store.state.shell.pellets.length;
  const badge = qs('#pellet-count');
  if (badge) {
    const full = n > 0 && shellIsFull();
    badge.textContent = full ? `ほし ${n} こ（まんぱい）` : `ほし ${n} こ`;
    badge.classList.toggle('is-full', full);
  }

  const nameInput = qs('#shell-name');
  if (nameInput && document.activeElement !== nameInput) {
    nameInput.value = store.state.shell.name;
  }
  const u = qs('#btn-undo');
  const r = qs('#btn-redo');
  if (u) u.disabled = !store.canUndo();
  if (r) r.disabled = !store.canRedo();

  const hint = qs('#shell-hint');
  if (hint) hint.hidden = n > 0;
}

/* ------------------------------------------------------------- 入力 */

function onPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button === 2) return;
  const { x, y } = view.clientToCm(e.clientX, e.clientY);
  const hit = view.hitTest(x, y, store.state.shell);
  e.preventDefault();
  canvasEl.focus();

  // 玉の外側（背景）をタップしたときは選択解除だけ
  if (!hit && Math.hypot(x, y) > SHELL_RADIUS_CM) {
    store.select(null);
    render();
    return;
  }

  if (eraser) {
    if (hit) {
      store.removePellet(hit.id);
      showToast('ほしを けしたよ', 'info', 1200);
    }
    return;
  }

  if (hit) {
    // 置いてある星: そのままドラッグで移動、動かさずに離せば「いまの色に塗る」
    store.select(hit.id);
    drag = {
      id: hit.id,
      origin: { x: hit.x, y: hit.y },
      offX: hit.x - x,
      offY: hit.y - y,
      moved: false,
      sx: x,
      sy: y,
      last: null,
      fresh: false,
    };
    ghost = null;
    canvasEl.setPointerCapture?.(e.pointerId);
    render();
    return;
  }

  const res = store.addPellet(x, y);
  if (!res.ok) {
    flashError(res.reason);
    return;
  }
  // 置いた直後からそのままドラッグで微調整できる
  const placed = res.pellet;
  drag = {
    id: placed.id,
    origin: { x: placed.x, y: placed.y },
    offX: 0,
    offY: 0,
    moved: false,
    sx: x,
    sy: y,
    last: null,
    fresh: true,
  };
  ghost = null;
  canvasEl.setPointerCapture?.(e.pointerId);
}

function onPointerMove(e) {
  if (!view) return;
  const { x, y } = view.clientToCm(e.clientX, e.clientY);

  if (drag) {
    if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) < 0.12) return;
    drag.moved = true;
    // 実際にドロップされる場所をそのままゴーストで見せる（見た目と結果が一致する）
    const spot = store.previewSpot(x + drag.offX, y + drag.offY, drag.id);
    drag.last = spot;
    const t = store.testPosition(x + drag.offX, y + drag.offY, drag.id);
    conflictId = spot ? null : t.conflictId || null;
    ghost = {
      x: spot ? spot.x : t.x,
      y: spot ? spot.y : t.y,
      color: store.state.shell.pellets.find((p) => p.id === drag.id)?.color,
      valid: !!spot,
    };
    render();
    return;
  }

  const hit = view.hitTest(x, y, store.state.shell);
  hoverId = hit ? hit.id : null;
  canvasEl.style.cursor = eraser ? 'crosshair' : hit ? 'grab' : 'copy';

  if (hit || eraser || Math.hypot(x, y) > SHELL_RADIUS_CM) {
    ghost = null;
    conflictId = null;
  } else {
    const spot = store.previewSpot(x, y);
    const t = store.testPosition(x, y);
    conflictId = spot ? null : t.conflictId || null;
    ghost = {
      x: spot ? spot.x : x,
      y: spot ? spot.y : y,
      color: store.state.activeColor,
      valid: !!spot,
    };
  }
  render();
}

function onPointerUp() {
  if (!drag) return;
  const d = drag;
  drag = null;
  ghost = null;
  conflictId = null;

  if (d.moved) {
    if (d.last) {
      // 置いたばかりの星は addPellet がすでに履歴を積んでいるので、
      // ここで積み直さない（「もどす」1回で置く前に戻れるようにする）
      const res = store.movePellet(d.id, d.last.x, d.last.y, { history: !d.fresh, snap: true });
      if (!res.ok) flashError(res.reason);
    } else {
      showToast('そこには おけないよ。もとの ばしょに もどしたよ', 'warn', 1800);
    }
  } else if (!d.fresh) {
    // 動かさずに離した = タップ -> いまえらんでいる色に塗りかえる
    store.setPelletColor(d.id, store.state.activeColor);
  }
  render();
}

function onPointerLeave() {
  hoverId = null;
  if (!drag) {
    ghost = null;
    conflictId = null;
  }
  render();
}

function flashError(reason) {
  showToast(PLACE_ERROR_TEXT[reason] || 'そこには おけないよ', 'warn', 1500);
  const frame = qs('#shell-frame');
  if (frame) {
    frame.classList.remove('is-shake');
    void frame.offsetWidth;
    frame.classList.add('is-shake');
  }
}

/* ------------------------------------------------------------- 打ち上げ */

function launch(fullscreen) {
  const shell = store.state.shell;
  if (!shell.pellets.length) {
    showToast('ほしを おいてから うちあげてね', 'warn');
    return;
  }
  player.launchShell(cloneShell(shell), { fullscreen, title: shell.name });
}

/* --------------------------------------------------------------- 保存 */

async function saveShell() {
  const shell = store.state.shell;
  if (!shell.pellets.length) {
    showToast('ほしを おいてから ほぞんしてね', 'warn');
    return;
  }
  const name = await promptDialog({
    title: 'なまえを つけて ほぞん',
    label: 'はなびの なまえ',
    value: shell.name === 'わたしの花火' ? '' : shell.name,
    placeholder: 'たとえば「なつまつり」',
    okLabel: 'ほぞんする',
  });
  if (name == null) return;
  const finalName = name.trim() || 'なまえのない花火';
  if (finalName !== shell.name) store.setShellName(finalName);

  const thumb = renderShellThumbnail(store.state.shell, 256);
  const res = storage.saveShell(store.state.shell, thumb);
  if (!res.ok) {
    showToast(res.error || 'ほぞんに しっぱいしました', 'error');
    return;
  }
  store.markSaved();
  showToast('「' + finalName + '」を ほぞんしたよ', 'success');
  onSavedCb?.();
}

async function clearAll() {
  if (!store.state.shell.pellets.length) return;
  const ok = await confirmDialog({
    title: 'ほしを ぜんぶ けしますか？',
    message: 'おいた ほしが ぜんぶ なくなります（「もどす」で ふっかつできます）',
    okLabel: 'けす',
    danger: true,
  });
  if (!ok) return;
  store.clearPellets();
  showToast('ぜんぶ けしました（もどす で ふっかつ）', 'info');
}

export async function newShell({ confirm = true } = {}) {
  const go = () => {
    store.newShell();
    showToast('あたらしい たまに なりました', 'info');
  };
  if (!confirm || !store.state.shell.pellets.length) return go();
  const ok = await confirmDialog({
    title: 'あたらしく つくりますか？',
    message: 'いまの たまは きえます（ほぞんして いなければ）',
    okLabel: 'あたらしく つくる',
  });
  if (ok) go();
}

/* ----------------------------------------------------------- おてほん */

export function openPresets() {
  const grid = el('div.tpl-grid');
  const m = openModal({ title: 'おてほんを えらぶ', wide: true, body: grid });

  for (const preset of SHELL_PRESETS) {
    const cv = el('canvas.tpl-canvas', { width: '132', height: '132' });
    const shell = createShell({ name: preset.name, pellets: preset.pellets });
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0a1122';
    ctx.fillRect(0, 0, 132, 132);
    drawShell(ctx, shell, 66, 66, 58, { showCase: true });

    grid.append(
      el(
        'button.tpl-card',
        {
          type: 'button',
          onClick: async () => {
            m.close();
            if (store.state.shell.pellets.length) {
              const ok = await confirmDialog({
                title: 'いまの たまを おきかえますか？',
                message: 'おてほんを よみこむと いまの たまは きえます',
                okLabel: 'よみこむ',
              });
              if (!ok) return;
            }
            store.setShell(
              createShell({
                id: uid('shell'),
                name: preset.id === 'blank' ? 'わたしの花火' : preset.name + 'の花火',
                pellets: preset.pellets,
              })
            );
            showToast(`「${preset.name}」を よみこんだよ`, 'success');
          },
        },
        [
          cv,
          el('span.tpl-name', {}, [preset.name]),
          el('span.tpl-hint', {}, [preset.hint]),
          el('span.tpl-count', {}, [preset.pellets.length + ' こ']),
        ]
      )
    );
  }
}

/* --------------------------------------------------------------- 構築 */

export function mountShellEditor(rootEl, { onSaved } = {}) {
  onSavedCb = onSaved;
  canvasEl = qs('#shell-canvas', rootEl);
  view = new ShellCanvas(canvasEl);

  buildToolPanel(qs('#shell-tools', rootEl));
  buildActionBar(qs('#shell-actions', rootEl));

  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('pointercancel', onPointerUp);
  canvasEl.addEventListener('pointerleave', onPointerLeave);
  canvasEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const { x, y } = view.clientToCm(e.clientX, e.clientY);
    const hit = view.hitTest(x, y, store.state.shell);
    if (hit) store.removePellet(hit.id);
  });

  const nameInput = qs('#shell-name', rootEl);
  nameInput.addEventListener('change', () => {
    const v = nameInput.value.trim() || 'なまえのない花火';
    nameInput.value = v;
    store.setShellName(v);
  });

  const frame = qs('#shell-frame', rootEl);
  new ResizeObserver(() => {
    view.resize();
    render();
  }).observe(frame);

  store.on('change', render);
  store.on('select', render);
  store.on('view', render);
  store.on('history', syncMeta);
  store.on('reject', (r) => flashError(r.reason));

  render();

  return {
    render,
    refreshSize: () => {
      view.resize();
      render();
    },
    launch,
    saveShell,
  };
}

function buildToolPanel(root) {
  clear(root);

  /* --- ① 6色パレット --- */
  const colorWrap = el('div.color-grid');
  for (const c of PELLET_COLORS) {
    colorWrap.append(
      el(
        'button.color-btn',
        {
          type: 'button',
          title: c.name,
          dataset: { color: c.id },
          // ここで決まるのは「つぎに おく ほし」の色。
          // すでに置いてある星は、その星をタップしたときだけ塗りかわる。
          onClick: () => {
            eraser = false;
            store.setTool({ activeColor: c.id });
            sync();
            render();
          },
        },
        [
          el('span.color-dot', { style: { background: c.swatch } }),
          el('span.color-label', {}, [c.name]),
        ]
      )
    );
  }

  /* --- けしゴム --- */
  const eraserBtn = el('button.tool-wide', {
    type: 'button',
    id: 'btn-eraser',
    onClick: () => {
      eraser = !eraser;
      sync();
      render();
    },
    html: uiIcon('trash') + '<span>けしゴム</span>',
  });

  root.append(
    el('div.panel-section', {}, [
      el('div.step-badge.step-badge-panel', {}, [el('b', {}, ['1']), el('span', {}, ['いろを えらぶ'])]),
      colorWrap,
    ]),
    el('div.panel-section.tool-row', {}, [
      eraserBtn,
      el('button.btn.btn-ghost.btn-block', {
        type: 'button',
        onClick: openPresets,
        html: uiIcon('brush') + '<span>おてほん</span>',
      }),
      el('button.btn.btn-ghost.btn-block', {
        type: 'button',
        html: uiIcon('grid') + '<span>ぜんぶ うめる</span>',
        title: 'あいている ところを いまの いろで うめる',
        onClick: () => {
          const added = store.fillFreeSpots();
          if (added) showToast(`${added}こ ふやしたよ`, 'success', 1400);
          else showToast('もう あいてる ところが ないよ', 'warn', 1400);
        },
      }),
      el('button.btn.btn-ghost.btn-block', {
        type: 'button',
        html: uiIcon('reset') + '<span>ぜんぶ けす</span>',
        onClick: clearAll,
      }),
    ]),
    el('div.panel-section.panel-section-compact', {}, [
      el('p.panel-note', {}, [
        'タップで おく ／ ドラッグで うごかす ／ おいた ほしを タップすると いまの いろに かわるよ。',
      ]),
    ])
  );

  function sync() {
    for (const b of colorWrap.children) {
      b.classList.toggle('is-active', !eraser && b.dataset.color === store.state.activeColor);
    }
    eraserBtn.classList.toggle('is-active', eraser);
    root.classList.toggle('is-erasing', eraser);
  }

  syncTools = sync;
  sync();
  store.on('tool', sync);
}

function buildActionBar(bar) {
  clear(bar);
  bar.append(
    el('button.btn.btn-launch', {
      type: 'button',
      html:
        uiIcon('rocket') +
        '<span class="btn-launch-text"><i>3</i>うちあげる</span>',
      onClick: () => launch(false),
    }),
    el('button.btn.btn-big.btn-soft', {
      type: 'button',
      title: 'ぜんがめんで うちあげる（プロジェクター用）',
      html: uiIcon('expand') + '<span>ぜんがめん</span>',
      onClick: () => launch(true),
    }),
    el('div.actionbar-spacer'),
    el('button.btn.btn-big.btn-soft', {
      type: 'button',
      html: uiIcon('save') + '<span>ほぞん</span>',
      onClick: saveShell,
    })
  );
}

/* ------------------------------------------------------------ キーボード */

export function handleEditorKey(e) {
  const active = document.activeElement;
  const tag = active?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const mod = e.metaKey || e.ctrlKey;

  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) store.redo();
    else store.undo();
    return;
  }
  if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    store.redo();
    return;
  }
  if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveShell();
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (store.state.selectedPelletId) {
      e.preventDefault();
      store.removePellet(store.state.selectedPelletId);
    }
    return;
  }
  if (e.key === 'Escape') {
    if (eraser) {
      eraser = false;
      syncTools();
      render();
    }
    store.select(null);
    return;
  }
  // スペースで打ち上げ。ただしボタンにフォーカスがあるときは
  // ブラウザのボタン操作（クリック）と二重に発火するので譲る。
  if (e.key === ' ') {
    if (tag === 'BUTTON' || tag === 'A') return;
    e.preventDefault();
    launch(false);
    return;
  }
  // 矢印キーで選んだ星を少しずつ動かす（重なる方向へは動かない）
  const sel = store.getSelected();
  if (sel && e.key.startsWith('Arrow')) {
    e.preventDefault();
    const step = e.shiftKey ? 0.3 : 0.05; // cm
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    store.nudgePellet(sel.id, dx, dy);
    return;
  }

  // 数字キーで「つぎに おく ほし」の色を選ぶ
  const num = Number(e.key);
  if (num >= 1 && num <= PELLET_COLORS.length) {
    eraser = false;
    store.setTool({ activeColor: PELLET_COLORS[num - 1].id });
    syncTools();
    render();
  }
}
