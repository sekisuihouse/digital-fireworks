/**
 * digital-fireworks 専用 花火エンジン
 * =========================================================================
 * 「2.5号玉（型物）の中に詰めた星の配置が、そのまま空に開く」ことを再現する。
 *
 * これは型物（かたもの）であって、ポカ物ではない。
 *   型物 : 割薬で星を球状に一気に押し出し、玉の中の並びを拡大した「形」を空に描く。
 *          星はその位置で燃え、形がしばらく保たれる。
 *   ポカ物: 玉が二つに割れて中身をばらまく（星が垂れ落ちる）。今回は作らない。
 *
 * そのため
 *   ・星は素早く所定の位置まで開いて、そこで止まる（空気抵抗を強めに）
 *   ・形が崩れないよう重力は弱め
 *   ・星ひとつが「ひとつの光点」として見える（火花を狭い範囲に固める）
 * という設定にしてある。計算そのものは実物と同じ理屈:
 *
 *   珠の位置 (x,y)[cm]  ──(2.5cm → 開花半径)──>  火花の初速ベクトル
 *
 * したがって
 *   ・玉の中でハートに並べた珠 → 空でもハートに開く
 *   ・珠の色                   → そのまま火花の色
 *
 * キャンバスは 2 枚:
 *   bgCanvas : 夜空・星・地平線（リサイズ時だけ描き直す静止レイヤー）
 *   fxCanvas : 花火（毎フレーム destination-out で薄く消す → 残像が出る）
 */
import { ParticleSystem, DRAG } from './particles.js';
import { colorIndex, WHITE, EMBER, EMBER_HOT } from './palette.js';
import { drawSky, computeStage, STAGE_ASPECT } from './sky.js';
import { getPelletColor } from '../data/pellet-colors.js';
import { MAX_PELLET_CENTER_R_CM } from '../types/shell.js';
import { playLaunch, playBurst } from './audio.js';

const MAX_DPR = 2;
/** 1フレームで進める実時間の上限（タブ復帰時に一気に進まないように） */
const MAX_FRAME_DT = 0.25;
/** 物理 1 ステップの上限（これ以上は分割する） */
const SUB_STEP = 1 / 30;

/**
 * 玉の中の 2.5cm（珠が置ける限界）が、空でこの半径に開く。
 * 単位は「ステージ（16:9 の夜空）の高さ = 1.0」。
 * 2.5号玉の開花直径はおよそ 50m なので、画面の約半分の高さに相当させている。
 */
export const BURST_RADIUS = 0.34;
/** 星 1 個あたりの火花数（品質で増減する） */
const PARTICLES_PER_PELLET = 30;
/**
 * 星 1 個が空で広がる大きさ（開花半径に対する割合）。
 * 星どうしの間隔（1cm / 2.5cm = 0.4）より十分小さくして、
 * 1 個の星が 1 個の光点として分かれて見えるようにする。
 */
const PELLET_SPREAD = 0.06;

const TAU = Math.PI * 2;

/**
 * @typedef {object} Shot 空に上げる 1 発
 * @property {import('../types/shell.js').FireworkShell} shell 設計した2.5号玉
 * @property {number} [x]     0..1 開く位置（既定 0.5）
 * @property {number} [y]     0..1 開く高さ（既定 0.34）
 * @property {number} [delay] 秒
 */

export class FireworksEngine {
  /**
   * @param {HTMLElement} container キャンバスを入れる親要素
   */
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = { maxParticles: 26000, ...opts };

    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.className = 'fw-layer fw-layer-bg';
    this.fxCanvas = document.createElement('canvas');
    this.fxCanvas.className = 'fw-layer fw-layer-fx';
    container.append(this.bgCanvas, this.fxCanvas);

    this.bg = this.bgCanvas.getContext('2d');
    this.fx = this.fxCanvas.getContext('2d');

    this.particles = new ParticleSystem(this.opts.maxParticles);
    /** @type {Array<object>} 上昇中の玉 */
    this.shells = [];
    /** @type {Array<object>} 開花の閃光 */
    this.flashes = [];
    /** @type {Array<{time:number, shot:Shot}>} 打ち上げ待ち */
    this.pending = [];

    this.time = 0;
    this.running = false;
    this.rafId = 0;
    this.lastTs = 0;
    this.idleSince = -1;
    this.onIdle = null;
    this.onProgress = null;
    this.duration = 0;

    this.quality = 1;
    this._frameAcc = 0;
    this._frameCount = 0;
    this.fps = 60;

    this.dpr = 1;
    this.stage = { x: 0, y: 0, w: 1, h: 1 };

    this._onResize = () => this.resize();
    this._ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this._onResize) : null;
    this._ro?.observe(container);
    window.addEventListener('resize', this._onResize);

    this.resize();
  }

  destroy() {
    this.stop();
    this._ro?.disconnect();
    window.removeEventListener('resize', this._onResize);
    this.bgCanvas.remove();
    this.fxCanvas.remove();
  }

  /* --------------------------------------------------------------- 画面 */

  resize() {
    const rect = this.container.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    this.dpr = dpr;

    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    for (const cv of [this.bgCanvas, this.fxCanvas]) {
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      cv.style.width = cssW + 'px';
      cv.style.height = cssH + 'px';
    }
    this.stage = computeStage(w, h, STAGE_ASPECT);
    drawSky(this.bg, w, h, this.stage);
    this.fx.setTransform(1, 0, 0, 1, 0, 0);
    this.fx.clearRect(0, 0, w, h);
  }

  /* ----------------------------------------------------------- 再生制御 */

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTs = 0;
    const loop = (ts) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
      if (!this.lastTs) {
        this.lastTs = ts;
        return;
      }
      let dt = (ts - this.lastTs) / 1000;
      this.lastTs = ts;
      if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;
      this._tick(dt);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  clear() {
    this.particles.reset();
    this.shells.length = 0;
    this.flashes.length = 0;
    this.pending.length = 0;
    this.time = 0;
    this.duration = 0;
    this.fx.setTransform(1, 0, 0, 1, 0, 0);
    this.fx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
  }

  /**
   * 設計した玉を 1 発打ち上げる
   * @param {import('../types/shell.js').FireworkShell} shell
   * @param {{x?:number,y?:number,onEnd?:Function}} [opts]
   */
  launch(shell, opts = {}) {
    return this.playShots([{ shell, x: opts.x, y: opts.y, delay: 0 }], opts);
  }

  /**
   * 複数発（上映・フィナーレ用）。頭から再生する。
   * @param {Shot[]} shots
   */
  playShots(shots, opts = {}) {
    this.clear();
    this.schedule(shots, 0);
    const last = shots.length ? Math.max(...shots.map((s) => s.delay || 0)) : 0;
    this.duration = last + (opts.tail ?? 4.4);
    this.onIdle = opts.onEnd || null;
    this.start();
    return this.duration;
  }

  /** 現在時刻 + offset で予約する */
  schedule(shots, offset = 0) {
    for (const shot of shots) {
      this.pending.push({ time: this.time + offset + (shot.delay || 0), shot });
    }
    this.pending.sort((a, b) => a.time - b.time);
    const last = this.pending.length ? this.pending[this.pending.length - 1].time : this.time;
    this.duration = Math.max(this.duration, last + 4.4);
    this.start();
  }

  isBusy() {
    return (
      this.pending.length > 0 ||
      this.shells.length > 0 ||
      this.flashes.length > 0 ||
      this.particles.count > 0
    );
  }

  /* ------------------------------------------------------------ 内部処理 */

  _tick(dt) {
    // FPS 計測 & 自動品質調整（プロジェクタでも 30fps を切らないように）
    this._frameAcc += dt;
    this._frameCount++;
    if (this._frameAcc >= 0.5) {
      this.fps = this._frameCount / this._frameAcc;
      this._frameAcc = 0;
      this._frameCount = 0;
      if (this.fps < 42 && this.quality > 0.45) this.quality = Math.max(0.45, this.quality - 0.1);
      else if (this.fps > 56 && this.quality < 1) this.quality = Math.min(1, this.quality + 0.05);
    }

    let remain = dt;
    while (remain > 1e-4) {
      const step = Math.min(SUB_STEP, remain);
      remain -= step;
      this._step(step);
    }

    this._render(dt);

    if (this.onProgress) this.onProgress(this.time, this.duration);

    if (!this.isBusy()) {
      if (this.idleSince < 0) this.idleSince = this.time;
      const idleFor = this.time - this.idleSince;
      if (idleFor > 0.4 && this.onIdle) {
        const cb = this.onIdle;
        this.onIdle = null;
        cb();
      }
      if (idleFor > 1.2) this.stop();
    } else {
      this.idleSince = -1;
    }
  }

  /** 物理 1 ステップ */
  _step(dt) {
    this.time += dt;
    while (this.pending.length && this.pending[0].time <= this.time) {
      this._launchShot(this.pending.shift().shot);
    }
    this._updateShells(dt);
    this.particles.update(dt, this._trailEmitter);
    this._updateFlashes(dt);
  }

  /* ------------------------------------------------- 打ち上げ（上昇） */

  _launchShot(shot) {
    const nx = shot.x ?? 0.5;
    const ny = shot.y ?? 0.34;
    const ux = nx * STAGE_ASPECT;
    const dist = Math.max(0.12, 1 - ny);

    const rising = {
      shot,
      x0: ux + (Math.random() - 0.5) * 0.03,
      y0: 1.02,
      tx: ux,
      ty: ny,
      t: 0,
      dur: 0.55 + dist * 0.9,
      wob: (Math.random() - 0.5) * 0.02,
      x: ux + (Math.random() - 0.5) * 0.03,
      y: 1.02,
      trailAcc: 0,
    };
    this.shells.push(rising);
    playLaunch(0.7);
  }

  _updateShells(dt) {
    const ps = this.particles;
    for (let i = 0; i < this.shells.length; i++) {
      const s = this.shells[i];
      s.t += dt;
      const p = Math.min(1, s.t / s.dur);
      const pe = 1 - Math.pow(1 - p, 2.2); // 上に行くほど減速

      const prevX = s.x;
      const prevY = s.y;
      s.x = s.x0 + (s.tx - s.x0) * pe + s.wob * Math.sin(p * Math.PI);
      s.y = s.y0 + (s.ty - s.y0) * pe;

      // 光跡（尾）: 前フレームとの間を補間して撒く = fps が落ちても途切れない
      s.trailAcc += dt;
      const step = 0.01;
      while (s.trailAcc > step) {
        s.trailAcc -= step;
        const k = Math.min(1, Math.max(0, s.trailAcc / dt));
        const bx = s.x + (prevX - s.x) * k;
        const by = s.y + (prevY - s.y) * k;
        ps.spawn(
          bx + (Math.random() - 0.5) * 0.004,
          by + Math.random() * 0.004,
          (Math.random() - 0.5) * 0.02,
          0.02 + Math.random() * 0.05,
          {
            life: 0.28 + Math.random() * 0.4,
            size: 1.0 + Math.random() * 1.0,
            ci: Math.random() < 0.3 ? EMBER_HOT : EMBER,
            bright: 0.55 + Math.random() * 0.35,
            twinkle: 0.35,
            gmul: 0.25,
            dmul: 1.6,
          }
        );
      }
      // 玉の頭（明るい点）
      ps.spawn(s.x, s.y, 0, 0, {
        life: 0.1,
        size: 3.0,
        ci: EMBER_HOT,
        bright: 1.3,
        twinkle: 0,
        gmul: 0,
        dmul: 3,
      });

      if (p >= 1) {
        this._burst(s);
        this.shells.splice(i, 1);
        i--;
      }
    }
  }

  /** 尾を引く火花がこぼす火の粉 */
  _trailEmitter = (x, y, ci) => {
    const ps = this.particles;
    if (ps.freeSlots < 500) return;
    ps.spawn(x, y, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, {
      life: 0.22 + Math.random() * 0.3,
      size: 0.9 + Math.random() * 0.6,
      ci,
      bright: 0.75,
      twinkle: 0.7,
      gmul: 0.5,
      dmul: 2.2,
    });
  };

  /* --------------------------------------------------------------- 開花 */

  /**
   * 玉の中の星の配置を、そのまま空へ拡大して開かせる（型物の開き方）。
   *   星の中心 (x,y)[cm] / 2.5cm  ->  -1..1 の方向ベクトル
   *   その方向へ「開花半径 R」ぶん飛ぶ初速 v0 = R × DRAG を与える
   * 空気抵抗 DRAG により最終的な到達距離がちょうど R になり、
   * 0.3 秒ほどで開ききって止まるため、玉の中の並びが R 倍に拡大された
   * 「形」として空にしばらく残る。
   */
  _burst(rising) {
    const ps = this.particles;
    const rand = Math.random;
    const shell = rising.shot.shell;
    const pellets = shell?.pellets || [];

    const R = BURST_RADIUS;
    const v0 = R * DRAG;
    const cmToUnit = 1 / MAX_PELLET_CENTER_R_CM; // 2.5cm -> 1.0

    // 珠が多いほど 1 個あたりの火花を減らして総数を一定に保つ
    const budget = Math.max(200, ps.freeSlots - 900);
    let per = Math.round(PARTICLES_PER_PELLET * this.quality);
    if (pellets.length) per = Math.min(per, Math.floor(budget / pellets.length));
    per = Math.max(6, per);

    for (const pel of pellets) {
      const color = getPelletColor(pel.color);
      const palette = color.particles;
      const dirX = pel.x * cmToUnit;
      const dirY = pel.y * cmToUnit;
      const glow = color.glow ?? 1;

      for (let i = 0; i < per; i++) {
        // 星は「ひとかたまり」なので、ばらけ幅は星の間隔よりずっと小さくする
        const a = rand() * TAU;
        const rr = Math.sqrt(rand()) * PELLET_SPREAD;
        const jx = Math.cos(a) * rr;
        const jy = Math.sin(a) * rr;

        // 手前／奥の粒を作って球らしい奥行きを出す
        const depth = 0.72 + 0.28 * rand();
        // 速度をそろえるほど形がそろう（型物は星が一斉に同じ距離まで開く）
        const speed = v0 * (0.97 + rand() * 0.07);
        const accent = rand() < 0.14;

        ps.spawn(rising.x, rising.y, (dirX + jx) * speed, (dirY + jy) * speed, {
          // 開いた形が読み取れるよう、星はしばらく燃え続ける
          life: 2.3 + rand() * 0.9,
          size: (accent ? 2.5 : 1.75) * depth * (0.85 + rand() * 0.35),
          ci: colorIndex(
            palette[Math.min(palette.length - 1, (Math.pow(rand(), 2.2) * palette.length) | 0)]
          ),
          bright: glow * (accent ? 1.15 : 0.88) * depth,
          twinkle: color.twinkle + (accent ? 0.12 : 0),
          gmul: 1,
          dmul: 1,
        });
      }

      // 星そのものの光（どこに星があるかがはっきり分かるように）
      for (let c = 0; c < 2; c++) {
        ps.spawn(rising.x, rising.y, dirX * v0, dirY * v0, {
          life: 2.6 + rand() * 0.7,
          size: c === 0 ? 4.0 : 2.6,
          ci: colorIndex(palette[c === 0 ? 0 : 1 % palette.length]),
          bright: c === 0 ? 1.4 : 1.05,
          twinkle: color.twinkle * 0.6,
          gmul: 1,
          dmul: 1,
        });
      }
    }

    // 割薬の光（開いた瞬間だけ中心で光る。すぐ消して形の邪魔をしない）
    if (ps.freeSlots > 400) {
      const n = Math.round(26 * this.quality);
      for (let i = 0; i < n; i++) {
        const u = rand() * 2 - 1;
        const th = rand() * TAU;
        const s = Math.sqrt(1 - u * u);
        const sp = R * 0.34 * DRAG * (0.4 + rand() * 0.8);
        ps.spawn(rising.x, rising.y, s * Math.cos(th) * sp, s * Math.sin(th) * sp, {
          life: 0.24 + rand() * 0.26,
          size: 1.2 + rand() * 0.6,
          ci: rand() < 0.5 ? WHITE : EMBER_HOT,
          bright: 0.55,
          twinkle: 0.35,
          gmul: 0.9,
          dmul: 1.6,
        });
      }
    }

    this.flashes.push({
      x: rising.x,
      y: rising.y,
      r: R * 0.8,
      t: 0,
      dur: 0.22,
    });

    playBurst(1, pellets.length > 12, 0.75);
  }

  _updateFlashes(dt) {
    for (let i = 0; i < this.flashes.length; i++) {
      const f = this.flashes[i];
      f.t += dt;
      if (f.t >= f.dur) {
        this.flashes.splice(i, 1);
        i--;
      }
    }
  }

  /* --------------------------------------------------------------- 描画 */

  _render(dt) {
    const ctx = this.fx;
    const { x: ox, y: oy, h: unit } = this.stage;
    const w = this.fxCanvas.width;
    const h = this.fxCanvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 残像フェード（前フレームの光を少しずつ消す）
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(0,0,0,${(1 - Math.exp(-dt * 9)).toFixed(4)})`;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';

    for (const f of this.flashes) {
      const p = f.t / f.dur;
      const a = Math.pow(1 - p, 2.6);
      const cx = ox + f.x * unit;
      const cy = oy + f.y * unit;
      const r = f.r * unit * (0.35 + p * 0.9);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,252,240,${(a * 0.42).toFixed(3)})`);
      g.addColorStop(0.3, `rgba(255,240,205,${(a * 0.1).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,230,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    this.particles.draw(ctx, ox, oy, unit);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

export { STAGE_ASPECT };
