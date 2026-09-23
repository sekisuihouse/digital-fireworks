/**
 * 効果音（完全プロシージャル / 音声ファイルなし = オフラインでも鳴る）
 * =========================================================================
 * WebAudio で「ヒュー」という打ち上げ音と「ドン」という開花音を合成する。
 */

let ctx = null;
let master = null;
let noiseBuf = null;
let enabled = true;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  const len = Math.floor(ctx.sampleRate * 1.6);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

export function setSoundEnabled(v) {
  enabled = !!v;
  if (enabled) resume();
}
export function isSoundEnabled() {
  return enabled;
}
export function resume() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

function noiseSource(playbackRate = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = playbackRate;
  return src;
}

/** 打ち上げ「ヒュ〜」 */
export function playLaunch(volume = 1) {
  if (!enabled) return;
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;

  const src = noiseSource(1);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 6;
  bp.frequency.setValueAtTime(600, t);
  bp.frequency.exponentialRampToValueAtTime(2100, t + 0.75);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09 * volume, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);

  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.9);
}

/** 開花「ドンッ」 + パチパチ */
export function playBurst(scale = 1, crackle = false, volume = 1) {
  if (!enabled) return;
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;

  // 低音のボディ
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150 / scale, t);
  osc.frequency.exponentialRampToValueAtTime(38 / scale, t + 0.35);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.5 * volume, t + 0.012);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + 0.75);

  // 破裂のノイズ
  const src = noiseSource(1);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2600, t);
  lp.frequency.exponentialRampToValueAtTime(320, t + 0.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.34 * volume, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  src.connect(lp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.65);

  // パチパチ（錦・キラキラ用）
  if (crackle) {
    const cs = noiseSource(1.6);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const cg = c.createGain();
    cg.gain.setValueAtTime(0.0001, t + 0.05);
    cg.gain.exponentialRampToValueAtTime(0.1 * volume, t + 0.18);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    cs.connect(hp).connect(cg).connect(master);
    cs.start(t + 0.05);
    cs.stop(t + 1.5);
  }
}
