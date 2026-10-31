import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* ================= ядро: рендер, помощники, анимации ================= */
const canvas = document.getElementById("gl");
const loadBar = document.getElementById("load");
const progress = p => { loadBar.style.width = Math.round(p * 100) + "%"; };
progress(.08);

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const STILL = reduceMotion.matches;
/* шейдеры прогреваются заранее (99-warm.js): пока не готово, кнопка «Войти» ждёт */
let WARM_DONE = false;
const COARSE = matchMedia("(pointer: coarse)").matches;
const SMALL = Math.min(innerWidth, innerHeight) < 620;
/* 1 — телефон, 2 — компьютер; гость может выбрать сам в настройках */
const LOWQ = SET.saver || SET.quality === "low";
let QUALITY = LOWQ ? 1 : SET.quality === "high" || SET.quality === "medium" ? 2 : (COARSE || SMALL ? 1 : 2);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY > 1, powerPreference: "high-performance" });
} catch (e) {
  noGL();
  throw e;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const dprCap = () => SET.saver || SET.quality === "low" ? 1 : SET.quality === "medium" ? 1.25 : SET.quality === "high" ? 2 : QUALITY > 1 ? 1.75 : 1.5;
let DPR = Math.min(devicePixelRatio || 1, dprCap());
renderer.setPixelRatio(DPR);
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060203);
scene.fog = new THREE.FogExp2(0x0a0405, .028);
const world = new THREE.Group();
scene.add(world);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .05, 60);

/* детерминированный случайный генератор: комната каждый раз одинаковая */
let seed = 20240611;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R = (a, b) => a + rng() * (b - a);
const pickOne = arr => arr[Math.floor(rng() * arr.length)];

/* ---------- материалы и меши ---------- */
const std = (o = {}) => new THREE.MeshStandardMaterial(Object.assign({ roughness: .7, metalness: 0 }, o));
const lam = (o = {}) => new THREE.MeshLambertMaterial(o);
const basic = (o = {}) => new THREE.MeshBasicMaterial(o);
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = world) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}
const group = (x = 0, y = 0, z = 0, parent = world) => { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; };

/* коробка по границам: x0..x1, y0..y1, z0..z1, текстура ложится в метрах */
function boxGeo(w, h, d, uvScale = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (uvScale) worldUV(g, w, h, d, uvScale);
  return g;
}
function worldUV(g, w, h, d, s) {
  const uv = g.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * faces[f][0] / s, uv.getY(i) * faces[f][1] / s);
  }
}
function box(x0, x1, y0, y1, z0, z1, mat, parent = world, uvScale = 1) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  return mesh(boxGeo(w, h, d, uvScale), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent);
}
/* геометрия коробки, сдвинутая в мировые координаты: для склейки в один меш */
function boxAt(x0, x1, y0, y1, z0, z1, uvScale = 1) {
  const g = boxGeo(x1 - x0, y1 - y0, z1 - z0, uvScale);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
function merged(geos, mat, parent = world) {
  const g = mergeGeometries(geos.map(x => x.index ? x.toNonIndexed() : x), false);
  geos.forEach(x => x.dispose());
  return mesh(g, mat, 0, 0, 0, parent);
}
const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/* ---------- анимации: твины на любых числовых полях ---------- */
const tweens = new Set();
const ease = {
  io: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  sine: k => -(Math.cos(Math.PI * k) - 1) / 2,
  lin: k => k
};
let NOW = performance.now();
function tween(obj, to, dur, e = ease.io) {
  return new Promise(res => {
    for (const t of tweens) if (t.obj === obj) for (const k in to) delete t.to[k];
    const from = {};
    for (const k in to) from[k] = obj[k];
    if (STILL || dur <= 0) { Object.assign(obj, to); res(); return; }
    tweens.add({ obj, from, to, dur: dur * 1000, t0: NOW, e, res });
  });
}
function runTweens() {
  for (const t of tweens) {
    const k = clamp((NOW - t.t0) / t.dur, 0, 1), v = t.e(k);
    for (const key in t.to) t.obj[key] = t.from[key] + (t.to[key] - t.from[key]) * v;
    if (k >= 1) { tweens.delete(t); t.res(); }
  }
}
const wait = s => new Promise(r => STILL ? r() : setTimeout(r, s * 1000));
/* каждый кадр: обработчики живой сцены */
const tickers = [];
const onTick = fn => tickers.push(fn);

/* ---------- предметы, на которые можно нажать ---------- */
const HOT = [], hotMeshes = [];
function hot(root, zone, label, act, opt = {}) {
  root.userData.hot = Object.assign({ zone, label, act, h: 0, grow: .03, lift: 0, base: root.scale.clone(), y0: root.position.y }, opt);
  root.traverse(o => { if (o.isMesh && !o.userData.noHit) { o.userData.hotRoot = root; hotMeshes.push(o); } });
  HOT.push(root);
  return root;
}
/* шрифт для неона и надписей на этикетках */
await Promise.race([
  Promise.all([document.fonts.load("120px Forum"), document.fonts.load("20px Literata")]),
  new Promise(r => setTimeout(r, 2500))
]).catch(() => {});
