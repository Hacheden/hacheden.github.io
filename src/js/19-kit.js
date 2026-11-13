/* ================= набор движка: материалы, свет, бутылки и бокалы =================
   Общее для всех заведений. Залы конкретного бара (src/venues/<id>/rooms) строятся из этих деталей. */
const M = {
  floor: std({ map: TEX.floor, roughness: .38, envMapIntensity: .8 }),
  walnut: std({ map: TEX.walnut, roughness: .45, envMapIntensity: .6 }),
  walnutGloss: std({ map: TEX.walnut, roughness: .2, envMapIntensity: 1.1 }),
  darkwood: std({ map: TEX.darkwood, roughness: .55, envMapIntensity: .5 }),
  oak: std({ map: TEX.oak, roughness: .5 }),
  panel: lam({ map: TEX.darkwood }),
  ceiling: lam({ color: 0x1a0f0a }),
  beam: lam({ map: TEX.darkwood, color: 0x8a7a70 }),
  brass: std({ color: 0xc9944a, metalness: 1, roughness: .28, envMapIntensity: 1.4 }),
  brassDark: std({ color: 0x8a6430, metalness: 1, roughness: .4 }),
  chrome: std({ color: 0xd8dde2, metalness: 1, roughness: .16, envMapIntensity: 1.6 }),
  black: std({ color: 0x0b0908, roughness: .6 }),
  iron: std({ color: 0x1a1816, metalness: .7, roughness: .5 }),
  leatherRed: std({ map: TEX.leather, color: 0x5a1a14, roughness: .45, envMapIntensity: .7 }),
  leatherBrown: std({ map: TEX.leather, color: 0x4a2414, roughness: .5, envMapIntensity: .6 }),
  velvetGreen: std({ map: TEX.velvet, color: 0x1f3a2a, roughness: .9 }),
  velvetRed: std({ map: TEX.velvet, color: 0x4a0e18, roughness: .9 }),
  marble: std({ color: 0x1b1816, roughness: .22, envMapIntensity: .9 }),
  stone: std({ color: 0x24201c, roughness: .8 }),
  paper: std({ map: TEX.page, roughness: .9 }),
  candle: std({ color: 0xefe3c8, roughness: .6, emissive: 0x3a2410, emissiveIntensity: .6 })
};

/* ---------- свет ---------- */
const hemi = new THREE.HemisphereLight(0x8a4a3a, 0x1a0c08, 1.6);
scene.add(hemi);
const LIGHTS = {};
function point(name, color, intensity, dist, x, y, z) {
  const l = new THREE.PointLight(color, intensity, dist, 2);
  l.position.set(x, y, z);
  world.add(l);
  LIGHTS[name] = l;
  l.userData.base = intensity;
  return l;
}

/* профили бутылок в сантиметрах: [радиус, высота]; крышка отдельно */
const BOTTLE = {
  bordeaux: { p: [[0, 0], [3.5, 0], [3.75, .6], [3.75, 20], [3.5, 22.5], [2.5, 25], [1.45, 26.6], [1.3, 28], [1.3, 30.4]], cap: [1.45, 2.6], seg: 24 },
  squat:    { p: [[0, 0], [5.1, 0], [5.4, .6], [5.4, 12.5], [5, 15], [3.4, 17.2], [1.8, 18.6], [1.5, 20], [1.5, 21.6]], cap: [2, 2.8], seg: 24 },
  tall:     { p: [[0, 0], [3.3, 0], [3.55, .6], [3.55, 22], [3.2, 24], [1.8, 25.6], [1.4, 27], [1.4, 30.6]], cap: [1.6, 2.4], seg: 24 },
  flask:    { p: [[0, 0], [4.3, 0], [4.6, .6], [4.6, 16.5], [4.2, 19], [2.4, 21.2], [1.5, 22.6], [1.5, 25.8]], cap: [1.8, 2.6], seg: 24 },
  square:   { p: [[0, 0], [5.4, 0], [5.6, .6], [5.6, 18.5], [4.8, 20.6], [1.9, 22.2], [1.5, 22.8], [1.5, 25.6]], cap: [1.8, 2.6], seg: 4 },
  round:    { p: [[0, 0], [3.6, 0], [4.1, 1.2], [4.5, 6], [4.5, 13], [4.1, 17], [2.9, 19.4], [1.6, 20.8], [1.4, 21.8], [1.4, 25.4]], cap: [1.7, 2.4], seg: 24 }
};
const bodyR = s => Math.max(...BOTTLE[s].p.map(q => q[0])) / 100;
const neckTop = s => BOTTLE[s].p[BOTTLE[s].p.length - 1][1] / 100;
const BGEO = {};
for (const k in BOTTLE) {
  const b = BOTTLE[k];
  const g = lathe(b.p.map(([r, y]) => [r / 100, y / 100]).concat([[0, b.p[b.p.length - 1][1] / 100]]), b.seg);
  if (b.seg === 4) g.rotateY(Math.PI / 4);
  BGEO[k] = g;
  const lo = lathe(b.p.map(([r, y]) => [r / 100, y / 100]).concat([[0, b.p[b.p.length - 1][1] / 100]]), b.seg > 4 ? 10 : 4);
  if (b.seg === 4) lo.rotateY(Math.PI / 4);
  BGEO[k + "Lo"] = lo;
}

/* ---------- посуда для коктейлей ---------- */
const CUPS = {
  highball: { p: [[0, 0], [3, 0], [3.1, .5], [3.3, 14.5]], liq: [2.9, 3.15, .6, 13.2] },
  rocks:    { p: [[0, 0], [4, 0], [4.1, .8], [4.4, 9]], liq: [3.85, 4.2, .9, 7.4] },
  shot:     { p: [[0, 0], [2.1, 0], [2.2, .8], [2.6, 6.2]], liq: [2.05, 2.45, .9, 5.2] },
  coupe:    { p: [[0, 0], [3.5, 0], [3.5, .3], [.6, .8], [.4, 7.6], [1.6, 8.4], [4.4, 9.8], [5.4, 11.8]], liq: [.8, 5, 8.2, 11] },
  martini:  { p: [[0, 0], [3.5, 0], [3.5, .3], [.6, .8], [.4, 8], [.7, 8.4], [6, 14]], liq: [.7, 5.4, 8.5, 13.2] },
  wine:     { p: [[0, 0], [3.5, 0], [3.5, .3], [.6, .8], [.4, 8], [2.4, 9.4], [4, 12.8], [3.7, 18.2]], liq: [2.2, 3.9, 9.4, 13] },
  snifter:  { p: [[0, 0], [3.5, 0], [3.5, .3], [.6, .8], [.4, 4], [3, 5.4], [4.9, 8.6], [4.5, 12.4], [3.4, 13.8]], liq: [3, 4.9, 5.5, 8.6] }
};
const glassMat = std({ color: 0xeef4ff, transparent: true, opacity: .2, roughness: .02, envMapIntensity: 2.5, side: THREE.DoubleSide, depthWrite: false });
KEEP.add(glassMat); Object.values(M).forEach(m => KEEP.add(m)); Object.values(BGEO).forEach(g => KEEP.add(g));
function makeGlass(cup, color, { garnish = null, ice = false, op = .85 } = {}) {
  const c = CUPS[cup] || CUPS.rocks, gr = new THREE.Group();
  const g = mesh(lathe(c.p.map(([r, y]) => [r / 100, y / 100]), 28), glassMat, 0, 0, 0, gr);
  g.renderOrder = 5;
  const [r0, r1, y0, y1] = c.liq.map(v => v / 100);
  const liq = mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 24), std({ color, transparent: true, opacity: op, roughness: .15, emissive: new THREE.Color(color), emissiveIntensity: .25 }), 0, (y0 + y1) / 2, 0, gr);
  liq.renderOrder = 4;
  gr.userData.liq = { mesh: liq, y0, y1 };
  if (ice) for (let i = 0; i < 2; i++) {
    const cube = mesh(new RoundedBoxGeometry(.028, .028, .028, 2, .006), std({ color: 0xffffff, transparent: true, opacity: .35, roughness: .05 }), R(-.012, .012), y1 - .016 - i * .02, R(-.012, .012), gr);
    cube.rotation.set(R(0, 1), R(0, 1), 0);
    cube.renderOrder = 5;
  }
  if (garnish) {
    const col = { flame: 0xf08a22, wheel: 0x9fc23a, wedge: 0x9fc23a, lemon: 0xf2d24a, orange: 0xf08a22, mint: 0x3f8f3a, cherry: 0x9a0f1e, pineapple: 0xf2c84a, olive: 0x7a8a2a }[garnish] || 0x9fc23a;
    const topR = c.p[c.p.length - 1][0] / 100, topY = c.p[c.p.length - 1][1] / 100;
    if (garnish === "cherry" || garnish === "olive") mesh(new THREE.SphereGeometry(.012, 12, 8), std({ color: col, roughness: .3 }), 0, y1 - .004, 0, gr);
    else if (garnish === "mint") for (let i = 0; i < 3; i++) { const l = mesh(new THREE.SphereGeometry(.016, 8, 6), std({ color: col }), R(-.01, .01), topY + .01, R(-.01, .01), gr); l.scale.set(1, .35, .6); l.rotation.set(R(0, 1), R(0, 3), 0); }
    else { const w = mesh(new THREE.CylinderGeometry(.024, .024, .005, 18), std({ color: col, roughness: .5 }), topR - .01, topY - .012, 0, gr); w.rotation.z = Math.PI / 2.4; }
  }
  return gr;
}

/* ---------- затемнение экрана (закрытие смены, вход, погреб) ---------- */
const fadeEl = document.getElementById("fade");
function fade(on, dur = .6) {
  fadeEl.style.transitionDuration = (STILL ? 0 : dur) + "s";
  fadeEl.classList.toggle("on", on);
  return sleep(STILL ? 0 : dur);
}
