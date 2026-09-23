/**
 * 打ち上げシミュレーター（STEP 3）
 * =========================================================================
 * 設計した 2.5号玉を、そのまま夜空へ打ち上げて見せる。
 *
 *   うちあげる  : 夜空をかぶせて再生 → 終わったら自動で編集へ戻る
 *   ぜんがめん  : 同じ再生を全画面で（プロジェクタ投影用）
 *   みんなの花火: 保存した玉を順番に打ち上げ、最後に全部まとめてフィナーレ
 *
 * 花火エンジンはここで 1 つだけ作って使い回す。
 */
import { el, qs } from '../core/dom.js';
import { uiIcon } from '../components/icons.js';
import { FireworksEngine } from '../fireworks-engine/engine.js';
import { resume as resumeAudio } from '../fireworks-engine/audio.js';

let overlay = null;
let stageEl = null;
let titleEl = null;
let subEl = null;
let barEl = null;
let hintEl = null;
let engine = null;
let token = null;

function build() {
  if (overlay) return;
  overlay = el('div.player-overlay', { hidden: true });
  stageEl = el('div.player-stage');
  titleEl = el('div.player-title');
  subEl = el('div.player-sub');
  barEl = el('div.player-bar-fill');
  hintEl = el('div.player-hint', {}, ['ESC / とじる でもどる']);

  const closeBtn = el('button.player-close', {
    type: 'button',
    title: 'とじる (ESC)',
    html: uiIcon('close') + '<span>とじる</span>',
    onClick: () => cancel(),
  });

  overlay.append(
    stageEl,
    el('div.player-caption', {}, [titleEl, subEl]),
    el('div.player-bar', {}, [barEl]),
    hintEl,
    closeBtn
  );
  (qs('#player-root') || document.body).append(overlay);

  document.addEventListener('keydown', (e) => {
    if (!overlay.hidden && e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  });
}

function ensureEngine() {
  build();
  if (!engine) engine = new FireworksEngine(stageEl);
  return engine;
}

const wait = (ms, tk) =>
  new Promise((res) => {
    const id = setTimeout(res, ms);
    if (tk) tk.timers.push(() => { clearTimeout(id); res(); });
  });

async function openOverlay(fullscreen) {
  build();
  overlay.hidden = false;
  overlay.classList.add('is-open');
  document.body.classList.add('is-playing');
  // 前回の再生で 100% まで伸びたままのバーを戻す
  if (barEl) barEl.style.width = '0%';
  resumeAudio();
  if (fullscreen && !document.fullscreenElement) {
    try {
      await overlay.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      /* 全画面に入れなくても再生は続ける */
    }
  }
  const eng = ensureEngine();
  await new Promise((r) => setTimeout(r, 40));
  eng.resize();
  eng.onProgress = (t, d) => {
    if (barEl) barEl.style.width = Math.min(100, d > 0 ? (t / d) * 100 : 0) + '%';
  };
  return eng;
}

function closeOverlay() {
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.body.classList.remove('is-playing');
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  setTimeout(() => {
    if (!overlay.classList.contains('is-open')) {
      overlay.hidden = true;
      engine?.clear();
      engine?.stop();
    }
  }, 220);
}

/** 再生中のものを中止して編集へ戻す */
export function cancel() {
  if (token) {
    token.cancelled = true;
    for (const fn of token.timers.splice(0)) fn();
    token.abort?.();
    token = null;
  }
  engine?.clear();
  closeOverlay();
}

function cancelSilently() {
  if (token) {
    token.cancelled = true;
    for (const fn of token.timers.splice(0)) fn();
    token.abort?.();
    token = null;
  }
  engine?.clear();
}

export function isOpen() {
  return !!overlay && !overlay.hidden;
}

function setCaption(main, sub = '') {
  if (!titleEl) return;
  titleEl.textContent = main || '';
  subEl.textContent = sub || '';
  titleEl.parentElement.classList.toggle('is-visible', !!main);
}

/** shots を打ち上げて、終わるまで待つ */
function runShots(shots, tk) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      resolve();
    };
    const eng = engine;
    const last = shots.length ? Math.max(...shots.map((s) => s.delay || 0)) : 0;
    const guard = setTimeout(finish, (last + 5) * 1000 + 3000);
    tk.timers.push(() => { clearTimeout(guard); finish(); });
    tk.abort = () => { eng.clear(); finish(); };
    eng.playShots(shots, { onEnd: finish });
  });
}

/**
 * 設計した玉を 1 発打ち上げる
 * @param {import('../types/shell.js').FireworkShell} shell
 */
export async function launchShell(shell, opts = {}) {
  cancelSilently();
  const tk = { cancelled: false, timers: [] };
  token = tk;

  await openOverlay(!!opts.fullscreen);
  if (tk.cancelled) return;

  hintEl.textContent = 'ESC / とじる でもどる';
  if (opts.title) {
    setCaption(opts.title, `ほし ${shell.pellets.length}こ の 2.5号玉`);
    await wait(1100, tk);
    setCaption('');
  } else {
    setCaption('');
  }
  if (tk.cancelled) return;

  await runShots([{ shell, x: 0.5, y: 0.34, delay: 0 }], tk);
  if (tk.cancelled) return;

  await wait(500, tk);
  if (tk.cancelled) return;

  token = null;
  closeOverlay();
  opts.onDone?.();
}

/**
 * みんなの花火（順番に打ち上げ + フィナーレ）
 * @param {Array<{name:string, shell:object}>} entries
 */
export async function playShow(entries, opts = {}) {
  cancelSilently();
  const tk = { cancelled: false, timers: [] };
  token = tk;

  await openOverlay(opts.fullscreen !== false);
  if (tk.cancelled) return;
  hintEl.textContent = 'ESC / とじる で上映をやめる';

  setCaption('みんなの花火大会', entries.length + ' はつ');
  await wait(2200, tk);
  setCaption('');
  await wait(300, tk);

  for (let i = 0; i < entries.length; i++) {
    if (tk.cancelled) return;
    const entry = entries[i];
    setCaption(entry.name, `${i + 1} / ${entries.length}`);
    await wait(1500, tk);
    if (tk.cancelled) return;
    setCaption('');
    await runShots([{ shell: entry.shell, x: 0.5, y: 0.33, delay: 0 }], tk);
    if (tk.cancelled) return;
    await wait(600, tk);
  }

  if (tk.cancelled) return;

  const finale = buildFinale(entries.map((e) => e.shell));
  if (finale.length) {
    setCaption('フィナーレ', 'みんなの花火が いっしょに');
    await wait(1800, tk);
    setCaption('');
    await runShots(finale, tk);
    if (tk.cancelled) return;
  }

  setCaption('おしまい', 'ありがとうございました');
  await wait(2600, tk);
  token = null;
  closeOverlay();
  opts.onDone?.();
}

/**
 * みんなの玉を混ぜた特大フィナーレの shots を作る。
 * 「夜空の盤面」をユーザーが編集するわけではなく、上映のためにその場で組み立てるだけ。
 * @param {Array<object>} shells
 * @returns {Array<import('../fireworks-engine/engine.js').Shot>}
 */
export function buildFinale(shells, { waveGap = 0.5, maxShots = 30 } = {}) {
  const usable = shells.filter((s) => s && s.pellets && s.pellets.length);
  if (!usable.length) return [];

  const xs = [0.2, 0.5, 0.8, 0.34, 0.66];
  const ys = [0.3, 0.24, 0.3, 0.42, 0.42];

  const shots = [];
  let i = 0;
  // 全員ぶんを 1 周以上、最大 maxShots まで
  const rounds = Math.max(1, Math.ceil(Math.min(maxShots, usable.length * 2) / usable.length));
  for (let r = 0; r < rounds; r++) {
    for (const shell of usable) {
      if (shots.length >= maxShots) break;
      shots.push({
        shell,
        x: xs[i % xs.length],
        y: ys[i % ys.length],
        delay: Math.round(Math.floor(i / 2) * waveGap * 10) / 10,
      });
      i++;
    }
  }

  // 最後の一斉打ち上げ
  const last = shots.length ? Math.max(...shots.map((s) => s.delay)) : 0;
  const grand = last + 1.4;
  [0.18, 0.36, 0.5, 0.64, 0.82].forEach((x, k) => {
    shots.push({
      shell: usable[k % usable.length],
      x,
      y: k === 2 ? 0.24 : 0.33,
      delay: grand,
    });
  });

  return shots;
}

export function getEngine() {
  return engine;
}
