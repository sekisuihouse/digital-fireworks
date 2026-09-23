/**
 * 夜空の背景描画（静止レイヤー）
 * =========================================================================
 * リサイズ時だけ描き直す。花火レイヤーとはキャンバスを分けているので、
 * 火花の残像フェードで星が消えたりしない。
 */
import { mulberry32 } from '../core/rng.js';

const STAR_SEED = 20250922;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w キャンバス幅（デバイスpx）
 * @param {number} h キャンバス高さ（デバイスpx）
 * @param {{x:number,y:number,w:number,h:number}} stage 夜空ステージ矩形
 */
export function drawSky(ctx, w, h, stage) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // --- 空のグラデーション -------------------------------------------------
  const g = ctx.createLinearGradient(0, stage.y, 0, stage.y + stage.h);
  g.addColorStop(0, '#04060f');
  g.addColorStop(0.45, '#081127');
  g.addColorStop(0.78, '#0d1c3c');
  g.addColorStop(1, '#152a4e');
  ctx.fillStyle = '#02030a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = g;
  ctx.fillRect(stage.x, stage.y, stage.w, stage.h);

  const rand = mulberry32(STAR_SEED);
  const unit = stage.h;

  // --- 天の川っぽいもや ---------------------------------------------------
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const cx = stage.x + rand() * stage.w;
    const cy = stage.y + rand() * stage.h * 0.75;
    const r = unit * (0.1 + rand() * 0.25);
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, 'rgba(90,120,190,0.07)');
    rg.addColorStop(1, 'rgba(90,120,190,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- 星 -----------------------------------------------------------------
  const starCount = Math.round(260 * (stage.w / unit / 1.777));
  for (let i = 0; i < starCount; i++) {
    const sx = stage.x + rand() * stage.w;
    const sy = stage.y + rand() * stage.h * 0.94;
    const depth = rand();
    const r = (0.4 + depth * 1.5) * (unit / 1000);
    const a = 0.18 + depth * 0.65 * (1 - (sy - stage.y) / stage.h) * 1.1;
    ctx.fillStyle = `rgba(${210 + ((rand() * 45) | 0)},${225 + ((rand() * 30) | 0)},255,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    // 明るい星は少しにじませる
    if (depth > 0.92) {
      const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 7);
      rg.addColorStop(0, 'rgba(200,220,255,0.28)');
      rg.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  drawGround(ctx, stage, rand);

  // --- 外側（レターボックス）を暗く -------------------------------------
  if (stage.x > 0 || stage.y > 0) {
    ctx.fillStyle = '#010206';
    if (stage.x > 0) {
      ctx.fillRect(0, 0, stage.x, h);
      ctx.fillRect(stage.x + stage.w, 0, w - stage.x - stage.w, h);
    }
    if (stage.y > 0) {
      ctx.fillRect(0, 0, w, stage.y);
      ctx.fillRect(0, stage.y + stage.h, w, h - stage.y - stage.h);
    }
  }
}

/** 地平線・丘・小さな街明かり */
function drawGround(ctx, stage, rand) {
  const baseY = stage.y + stage.h;
  const unit = stage.h;
  const horizon = baseY - unit * 0.085;

  // 地平線の淡い光
  const hg = ctx.createLinearGradient(0, horizon - unit * 0.18, 0, horizon + unit * 0.02);
  hg.addColorStop(0, 'rgba(60,110,190,0)');
  hg.addColorStop(1, 'rgba(90,150,220,0.16)');
  ctx.fillStyle = hg;
  ctx.fillRect(stage.x, horizon - unit * 0.18, stage.w, unit * 0.2);

  // 奥の丘
  ctx.fillStyle = '#060a17';
  ctx.beginPath();
  ctx.moveTo(stage.x, baseY);
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = stage.x + t * stage.w;
    const wobble =
      Math.sin(t * 7.3 + 1.2) * 0.012 + Math.sin(t * 17.1) * 0.005 + rand() * 0.002;
    ctx.lineTo(px, horizon + wobble * unit);
  }
  ctx.lineTo(stage.x + stage.w, baseY);
  ctx.closePath();
  ctx.fill();

  // 手前の地面
  ctx.fillStyle = '#03050d';
  ctx.fillRect(stage.x, baseY - unit * 0.035, stage.w, unit * 0.035);

  // 街明かり
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const lights = Math.round(48 * (stage.w / unit / 1.777));
  for (let i = 0; i < lights; i++) {
    const lx = stage.x + rand() * stage.w;
    const ly = horizon + rand() * unit * 0.05;
    const r = unit * 0.0016 * (0.6 + rand());
    ctx.fillStyle = rand() < 0.3 ? 'rgba(255,205,130,0.75)' : 'rgba(180,215,255,0.5)';
    ctx.beginPath();
    ctx.arc(lx, ly, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * ステージ矩形（16:9）を計算する。
 * 編集画面と再生画面で同じ計算を使うので、置いた位置と爆発位置が必ず一致する。
 */
export const STAGE_ASPECT = 16 / 9;

export function computeStage(w, h, aspect = STAGE_ASPECT) {
  let sw = w;
  let sh = w / aspect;
  if (sh > h) {
    sh = h;
    sw = h * aspect;
  }
  return { x: (w - sw) / 2, y: (h - sh) / 2, w: sw, h: sh };
}
