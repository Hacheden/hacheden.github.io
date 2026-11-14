/* ================= звуки движка: общий аудиоконтекст эффектов, треск дров, стук в дверь =================
   Нужны любому бару (улица, облава, шоу бармена), поэтому не в зале курилки. */
let fxCtx = null;
const fx = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  fxCtx = fxCtx || AUDIO.route(new AC(), "ambient");
  fxCtx.resume();
  return fxCtx;
};
function crackle() {
  const c = fx(); if (!c) return;
  const len = c.sampleRate * 1.2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  let env = 0;
  for (let i = 0; i < len; i++) { if (Math.random() < .002) env = .5 + Math.random() * .5; env *= .99; d[i] = (Math.random() * 2 - 1) * env * (1 - i / len); }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = "highpass"; f.frequency.value = 700; g.gain.value = .35;
  s.connect(f).connect(g).connect(c.destination); s.start();
}
function knock() {
  const c = fx(); if (!c) return;
  const t0 = c.currentTime + .05;
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * .3, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + .12);
    g.gain.setValueAtTime(.6, t); g.gain.exponentialRampToValueAtTime(.0001, t + .18);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + .2);
  }
}
