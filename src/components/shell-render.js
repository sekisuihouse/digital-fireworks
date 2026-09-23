/**
 * 花火玉（珠の配置）の描画 — 編集画面・ギャラリー・一覧で共通に使う
 * =========================================================================
 * cm をそのまま px に変換して描くだけ。
 * 「直径6cmの円」「直径1cmの珠」の比率が常に画面上でも保たれる。
 */
import {
  SHELL_RADIUS_CM,
  PELLET_RADIUS_CM,
  MAX_PELLET_CENTER_R_CM,
  MIN_PELLET_GAP_CM,
} from '../types/shell.js';
import { getPelletColor } from '../data/pellet-colors.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{pellets:Array}} shell
 * @param {number} cx 中心 X [px]
 * @param {number} cy 中心 Y [px]
 * @param {number} rPx 玉の半径（＝3cm 相当）[px]
 * @param {object} [opts]
 *   showCase   外周（直径6cm）を描く
 *   showLimit  星の中心が入れる限界円（2.5cm）を描く
 *   selectedId 選択中の星
 *   hoverId    ホバー中の星
 *   conflictId ぶつかっている星（赤く光らせて理由を示す）
 *   ghost      {x,y,color,valid} 置こうとしている星のプレビュー
 *   dim        全体を薄く
 */
export function drawShell(ctx, shell, cx, cy, rPx, opts = {}) {
  const k = rPx / SHELL_RADIUS_CM; // cm -> px
  const pelletR = PELLET_RADIUS_CM * k;

  ctx.save();

  /* --- 外周（花火玉のケース） --------------------------------------- */
  if (opts.showCase) {
    const g = ctx.createRadialGradient(cx, cy - rPx * 0.25, rPx * 0.1, cx, cy, rPx);
    g.addColorStop(0, 'rgba(38,50,86,0.95)');
    g.addColorStop(1, 'rgba(16,22,44,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(170,200,255,0.55)';
    ctx.lineWidth = Math.max(1.5, rPx * 0.016);
    ctx.stroke();
  }

  /* --- 珠の中心が入れる限界（2.5cm） -------------------------------- */
  if (opts.showLimit) {
    ctx.strokeStyle = 'rgba(150,185,255,0.22)';
    ctx.lineWidth = Math.max(1, rPx * 0.006);
    ctx.setLineDash([rPx * 0.05, rPx * 0.04]);
    ctx.beginPath();
    ctx.arc(cx, cy, MAX_PELLET_CENTER_R_CM * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* --- ぶつかっている星を赤く示す（なぜ置けないかを伝える） ---------- */
  if (opts.conflictId) {
    const c = shell.pellets.find((p) => p.id === opts.conflictId);
    if (c) {
      const gx = cx + c.x * k;
      const gy = cy + c.y * k;
      // この星に触れてしまう範囲（中心間 1cm 未満）
      ctx.fillStyle = 'rgba(255,70,88,0.13)';
      ctx.beginPath();
      ctx.arc(gx, gy, MIN_PELLET_GAP_CM * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,110,125,0.7)';
      ctx.lineWidth = Math.max(1.5, pelletR * 0.12);
      ctx.setLineDash([pelletR * 0.4, pelletR * 0.3]);
      ctx.beginPath();
      ctx.arc(gx, gy, MIN_PELLET_GAP_CM * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* --- 珠 ------------------------------------------------------------- */
  if (opts.dim) ctx.globalAlpha = 0.5;
  for (const p of shell.pellets) {
    drawPellet(ctx, cx + p.x * k, cy + p.y * k, pelletR, getPelletColor(p.color).swatch, {
      selected: p.id === opts.selectedId,
      hovered: p.id === opts.hoverId,
      conflict: p.id === opts.conflictId,
    });
  }
  ctx.globalAlpha = 1;

  /* --- 置こうとしている珠のプレビュー -------------------------------- */
  if (opts.ghost) {
    const gx = cx + opts.ghost.x * k;
    const gy = cy + opts.ghost.y * k;
    if (opts.ghost.valid) {
      ctx.globalAlpha = 0.55;
      drawPellet(ctx, gx, gy, pelletR, getPelletColor(opts.ghost.color).swatch, {});
      ctx.globalAlpha = 1;
    } else {
      // 置けない場所は 赤 + ×
      ctx.fillStyle = 'rgba(255,70,88,0.34)';
      ctx.beginPath();
      ctx.arc(gx, gy, pelletR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,130,0.95)';
      ctx.lineWidth = Math.max(2, pelletR * 0.16);
      ctx.stroke();
      const c = pelletR * 0.45;
      ctx.beginPath();
      ctx.moveTo(gx - c, gy - c);
      ctx.lineTo(gx + c, gy + c);
      ctx.moveTo(gx + c, gy - c);
      ctx.lineTo(gx - c, gy + c);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** 珠 1 個 */
export function drawPellet(ctx, x, y, r, css, { selected, hovered, conflict } = {}) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, css);
  g.addColorStop(1, shade(css, -0.32));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = conflict
    ? 'rgba(255,90,105,0.95)'
    : selected
      ? 'rgba(255,255,255,0.98)'
      : hovered
        ? 'rgba(255,255,255,0.6)'
        : 'rgba(10,16,34,0.45)';
  ctx.lineWidth = Math.max(1, r * (selected || conflict ? 0.22 : 0.1));
  ctx.beginPath();
  ctx.arc(x, y, r * (selected ? 0.94 : 1), 0, Math.PI * 2);
  ctx.stroke();

  if (selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.setLineDash([r * 0.35, r * 0.3]);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** 一覧やボタン用の小さなサムネイル（dataURL） */
export function renderShellThumbnail(shell, size = 192) {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#080d1c';
  ctx.fillRect(0, 0, size, size);
  drawShell(ctx, shell, size / 2, size / 2, size * 0.44, { showCase: true });
  try {
    // localStorage を圧迫しないよう JPEG（背景は不透明なので劣化が目立たない）
    return cv.toDataURL('image/jpeg', 0.8);
  } catch {
    return '';
  }
}

function shade(hex, amount) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amount)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
