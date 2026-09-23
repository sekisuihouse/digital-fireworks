/**
 * パーティクルシステム
 * =========================================================================
 * Structure-of-Arrays（型付き配列）で持つ。GC を出さず、数千粒でも安定する。
 *
 * 座標系:
 *   ステージ（16:9 の夜空）の「高さ = 1.0」を単位とする正規化座標。
 *   x は 0 .. アスペクト比(1.777…)、y は 0(空のてっぺん) .. 1(地面)。
 *   これで縦横のスケールが等方になり、物理が歪まない。
 */
import { colorAt } from './palette.js';

/**
 * 重力（単位: ステージ高さ / 秒^2）
 * 型物（かたもの）は、開いた形が崩れる前に見せる花火なので重力は弱めにする。
 * ポカ物のように星が垂れ落ちてしまうと形が読めなくなる。
 */
export const GRAVITY = 0.1;
/**
 * 空気抵抗（1秒あたり exp(-DRAG) 倍に減速）
 * 大きいほど「パッと開いて、その位置で止まる」= 型物らしい見え方になる。
 * 時定数 1/DRAG ≒ 0.33 秒で所定の位置に到達する。
 */
export const DRAG = 3.0;

const ALPHA_BUCKETS = 6;
const SIZE_BUCKETS = 4;
const SIZE_LW = [0.9, 1.5, 2.3, 3.4]; // 基準太さ（ステージ高さ1000pxのとき）
const BUCKETS_PER_COLOR = ALPHA_BUCKETS * SIZE_BUCKETS;

export class ParticleSystem {
  constructor(capacity = 26000) {
    this.cap = capacity;
    this.count = 0;

    const f = () => new Float32Array(capacity);
    this.x = f();
    this.y = f();
    this.px = f();
    this.py = f();
    this.vx = f();
    this.vy = f();
    this.age = f();
    this.life = f();
    this.size = f();
    this.bright = f();
    this.twinkle = f();
    this.phase = f();
    this.freq = f();
    this.gmul = f();
    this.dmul = f();
    this.ci = new Uint16Array(capacity);
    this.flags = new Uint8Array(capacity);

    /** @type {Array<number[]>} 描画バッチ（色×明るさ×太さ） */
    this.buckets = [];
    this.usedKeys = [];
    /** 尾を引く粒（錦）から二次火花を出すためのコールバック置き場 */
    this.emitTrail = null;
  }

  reset() {
    this.count = 0;
  }

  get freeSlots() {
    return this.cap - this.count;
  }

  /**
   * 1 粒追加
   * @param {number} x @param {number} y
   * @param {number} vx @param {number} vy
   * @param {object} o  { life, size, ci, bright, twinkle, gmul, dmul, trail }
   */
  spawn(x, y, vx, vy, o) {
    if (this.count >= this.cap) return -1;
    const i = this.count++;
    this.x[i] = x;
    this.y[i] = y;
    this.px[i] = x;
    this.py[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.age[i] = 0;
    this.life[i] = o.life;
    this.size[i] = o.size;
    this.bright[i] = o.bright ?? 1;
    this.twinkle[i] = o.twinkle ?? 0;
    this.phase[i] = Math.random() * 6.283;
    this.freq[i] = 14 + Math.random() * 26;
    this.gmul[i] = o.gmul ?? 1;
    this.dmul[i] = o.dmul ?? 1;
    this.ci[i] = o.ci;
    this.flags[i] = o.trail ? 1 : 0;
    return i;
  }

  _kill(i) {
    const last = --this.count;
    if (i !== last) {
      this.x[i] = this.x[last];
      this.y[i] = this.y[last];
      this.px[i] = this.px[last];
      this.py[i] = this.py[last];
      this.vx[i] = this.vx[last];
      this.vy[i] = this.vy[last];
      this.age[i] = this.age[last];
      this.life[i] = this.life[last];
      this.size[i] = this.size[last];
      this.bright[i] = this.bright[last];
      this.twinkle[i] = this.twinkle[last];
      this.phase[i] = this.phase[last];
      this.freq[i] = this.freq[last];
      this.gmul[i] = this.gmul[last];
      this.dmul[i] = this.dmul[last];
      this.ci[i] = this.ci[last];
      this.flags[i] = this.flags[last];
    }
  }

  /**
   * 物理更新
   * @param {number} dt 秒
   * @param {(x:number,y:number,ci:number)=>void} [onTrail] 錦の火の粉を出す
   */
  update(dt, onTrail) {
    const { x, y, px, py, vx, vy, age, life, gmul, dmul, flags, ci } = this;
    const gdt = GRAVITY * dt;
    for (let i = 0; i < this.count; i++) {
      const a = (age[i] += dt);
      if (a >= life[i]) {
        this._kill(i);
        i--;
        continue;
      }
      const d = Math.exp(-DRAG * dmul[i] * dt);
      vx[i] *= d;
      vy[i] *= d;
      vy[i] += gdt * gmul[i];
      px[i] = x[i];
      py[i] = y[i];
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;

      if (y[i] > 1.25) {
        this._kill(i);
        i--;
        continue;
      }
      // 錦: 落ちながら火の粉をこぼす
      if (flags[i] === 1 && onTrail && Math.random() < dt * 14) {
        onTrail(x[i], y[i], ci[i]);
      }
    }
  }

  /** いま生きている粒の明るさ（0..1） */
  _alpha(i) {
    const t = this.age[i] / this.life[i];
    let a = Math.pow(1 - t, 1.15);
    // 生まれた瞬間の強い光
    a *= 1 + 0.4 * Math.exp(-this.age[i] * 11);
    const tw = this.twinkle[i];
    if (tw > 0) {
      const s = Math.sin(this.phase[i] + this.age[i] * this.freq[i]);
      a *= 1 - tw + tw * (0.45 + 0.55 * s * s);
    }
    a *= this.bright[i];
    return a > 1 ? 1 : a;
  }

  /**
   * 描画
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} ox ステージ左上 X（デバイスpx）
   * @param {number} oy ステージ左上 Y（デバイスpx）
   * @param {number} unit ステージ高さ（デバイスpx）
   */
  draw(ctx, ox, oy, unit) {
    const { buckets, usedKeys } = this;
    usedKeys.length = 0;

    // 1) バケツ分け
    for (let i = 0; i < this.count; i++) {
      const a = this._alpha(i);
      if (a < 0.035) continue;
      let ab = (a * ALPHA_BUCKETS) | 0;
      if (ab >= ALPHA_BUCKETS) ab = ALPHA_BUCKETS - 1;
      const s = this.size[i];
      const sb = s < 1.2 ? 0 : s < 1.9 ? 1 : s < 2.8 ? 2 : 3;
      const key = this.ci[i] * BUCKETS_PER_COLOR + ab * SIZE_BUCKETS + sb;
      let arr = buckets[key];
      if (arr === undefined) {
        arr = buckets[key] = [];
      }
      if (arr.length === 0) usedKeys.push(key);
      arr.push(i);
    }

    // 2) まとめて描画
    const lwScale = unit / 1000;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let k = 0; k < usedKeys.length; k++) {
      const key = usedKeys[k];
      const arr = buckets[key];
      const sb = key % SIZE_BUCKETS;
      const ab = ((key / SIZE_BUCKETS) | 0) % ALPHA_BUCKETS;
      const cidx = (key / BUCKETS_PER_COLOR) | 0;
      const alpha = (ab + 1) / ALPHA_BUCKETS;
      const lw = Math.max(0.6, SIZE_LW[sb] * lwScale);

      const path = new Path2D();
      for (let j = 0; j < arr.length; j++) {
        const i = arr[j];
        path.moveTo(ox + this.px[i] * unit, oy + this.py[i] * unit);
        path.lineTo(ox + this.x[i] * unit, oy + this.y[i] * unit);
      }
      ctx.strokeStyle = colorAt(cidx);
      // 光のにじみ（ブルーム）
      if (alpha > 0.32) {
        ctx.globalAlpha = alpha * 0.085;
        ctx.lineWidth = lw * 2.9;
        ctx.stroke(path);
      }
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.stroke(path);

      arr.length = 0;
    }
    ctx.globalAlpha = 1;
  }
}
