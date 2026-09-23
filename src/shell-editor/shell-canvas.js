/**
 * 花火玉エディタのキャンバス（直径6cmの円 + 直径1cmの珠）
 * =========================================================================
 * 画面上の見た目も、実物と同じ比率（珠の直径 = 玉の直径の 1/6）で描く。
 * 置けない場所には半透明の赤と × を出し、なぜ置けないかが分かるようにする。
 */
import { drawShell } from '../components/shell-render.js';
import { SHELL_RADIUS_CM, PELLET_RADIUS_CM } from '../types/shell.js';

export class ShellCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.cx = 0;
    this.cy = 0;
    this.rPx = 1;
    this._shell = { pellets: [] };
    this._opts = {};
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.cx = w / 2;
    this.cy = h / 2;
    this.rPx = Math.min(w, h) * 0.44;
    this.render(this._shell, this._opts);
  }

  /** cm -> px 係数 */
  get scale() {
    return this.rPx / SHELL_RADIUS_CM;
  }

  render(shell, opts = {}) {
    this._shell = shell;
    this._opts = opts;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // 玉のまわりの光
    const halo = ctx.createRadialGradient(this.cx, this.cy, this.rPx * 0.6, this.cx, this.cy, this.rPx * 1.6);
    halo.addColorStop(0, 'rgba(70,110,200,0.18)');
    halo.addColorStop(1, 'rgba(70,110,200,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    drawShell(ctx, shell, this.cx, this.cy, this.rPx, {
      showCase: true,
      showLimit: true,
      selectedId: opts.selectedId,
      hoverId: opts.hoverId,
      conflictId: opts.conflictId,
      ghost: opts.ghost,
    });

    // ドラッグ中は元の位置を薄く残す
    if (opts.dragOrigin) {
      const k = this.scale;
      ctx.save();
      ctx.setLineDash([this.rPx * 0.03, this.rPx * 0.025]);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(1, this.rPx * 0.008);
      ctx.beginPath();
      ctx.arc(
        this.cx + opts.dragOrigin.x * k,
        this.cy + opts.dragOrigin.y * k,
        PELLET_RADIUS_CM * k,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }
  }

  /** 画面座標 -> 玉中心基準の cm */
  clientToCm(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * this.dpr;
    const py = (clientY - rect.top) * this.dpr;
    const k = this.scale;
    return { x: (px - this.cx) / k, y: (py - this.cy) / k };
  }

  /** その座標にある珠 */
  hitTest(xCm, yCm, shell) {
    let best = null;
    let bestD = Infinity;
    for (const p of shell.pellets) {
      const d = Math.hypot(p.x - xCm, p.y - yCm);
      if (d <= PELLET_RADIUS_CM * 1.1 && d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}
