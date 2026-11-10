/* ================= БАР: задняя стенка с бутылками, стойка, табуреты, лампы ================= */

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

/* ---------- задняя стенка бара ---------- */
const BB = { x0: -3.3, x1: 3.3, z0: -4.98, z1: -4.42, top: 1.04, shelves: [1.44, 1.9, 2.36], cor: 2.8 };
box(BB.x0, BB.x1, 0, 1.0, BB.z0, BB.z1, M.walnut, world, .8);
box(BB.x0 - .03, BB.x1 + .03, 1.0, BB.top, BB.z0, BB.z1 + .04, M.marble, world, 0);
box(BB.x0, BB.x1, 0, .08, BB.z0, BB.z1 + .01, M.black, world, 0);
(() => {
  // дверцы шкафа
  const geos = [];
  for (let i = 0; i < 6; i++) {
    const x0 = BB.x0 + .06 + i * 1.08, x1 = x0 + 1.0;
    geos.push(boxAt(x0, x1, .16, .94, BB.z1, BB.z1 + .02, .8));
    geos.push(boxAt(x0 + .08, x1 - .08, .26, .84, BB.z1 + .02, BB.z1 + .035, .8));
  }
  merged(geos, M.darkwood);
  const knobs = [];
  for (let i = 0; i < 6; i++) { const k = new THREE.SphereGeometry(.018, 10, 8); k.translate(BB.x0 + .06 + i * 1.08 + (i % 2 ? .1 : .9), .55, BB.z1 + .05); knobs.push(k); }
  merged(knobs, M.brass);
})();

/* подсветка за бутылками: тёплый красный, как в баре на референсе */
const glowPanelTex = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = "#1a0306"; g.fillRect(0, 0, w, h);
  const yOf = y => h - (y - 1.06) / 1.72 * h;
  for (const [a, b] of [[1.44, 1.9], [1.9, 2.36], [2.36, 2.78], [1.06, 1.44]]) {
    const y0 = yOf(b), y1 = yOf(a);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, "rgba(255,40,60,.05)"); gr.addColorStop(.55, "rgba(255,40,64,.55)"); gr.addColorStop(1, "rgba(255,90,100,1)");
    g.fillStyle = gr; g.fillRect(0, y0, w, y1 - y0);
  }
  const side = g.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, "rgba(0,0,0,.55)"); side.addColorStop(.18, "rgba(0,0,0,0)"); side.addColorStop(.82, "rgba(0,0,0,0)"); side.addColorStop(1, "rgba(0,0,0,.55)");
  g.fillStyle = side; g.fillRect(0, 0, w, h);
});
glowPanelTex.wrapS = glowPanelTex.wrapT = THREE.ClampToEdgeWrapping;
const glowPanelMat = basic({ map: glowPanelTex, color: 0xd8b0b0 });
/* подсветка задней стенки: гаснет в конце смены */
const BACKLIT = { panel: glowPanelMat };
for (const [x0, x1] of [[-3.1, -1.09], [-1.01, 1.01], [1.09, 3.1]]) {
  const p = mesh(new THREE.PlaneGeometry(x1 - x0, 1.72), glowPanelMat, (x0 + x1) / 2, 1.06 + .86, BB.z0 + .01);
}
/* стойки-перегородки, полки, карниз */
(() => {
  const geos = [];
  for (const x of [-3.18, -1.05, 1.05, 3.18]) geos.push(boxAt(x - .045, x + .045, BB.top, BB.cor, BB.z0, BB.z0 + .34, .8));
  geos.push(boxAt(BB.x0 - .05, BB.x1 + .05, BB.cor, BB.cor + .16, BB.z0, BB.z0 + .4, .8));
  geos.push(boxAt(BB.x0 - .08, BB.x1 + .08, BB.cor + .16, BB.cor + .2, BB.z0, BB.z0 + .44, .8));
  merged(geos, M.walnut);
  const sh = [];
  for (const y of BB.shelves) for (const [x0, x1] of [[-3.135, -1.095], [-1.005, 1.005], [1.095, 3.135]]) sh.push(boxAt(x0, x1, y - .03, y, BB.z0, BB.z0 + .3, 0));
  mesh(mergeGeometries(sh.map(g => g.toNonIndexed())), std({ color: 0x2a1a14, roughness: .15, metalness: .3, envMapIntensity: 1.2 }));
  // светодиодные ленты под полками
  const led = [];
  for (const y of BB.shelves.concat([BB.cor])) for (const [x0, x1] of [[-3.135, -1.095], [-1.005, 1.005], [1.095, 3.135]]) led.push(boxAt(x0, x1, y - .042, y - .03, BB.z0 + .26, BB.z0 + .29, 0));
  BACKLIT.led = mesh(mergeGeometries(led.map(g => g.toNonIndexed())), basic({ color: 0xff5a70, toneMapped: false })).material;
})();

/* неоновая вывеска Hacheden */
const neonTex = canvasTex(1024, 256, (g, w, h) => {
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "150px Forum, 'Palatino Linotype', Georgia, serif";
  g.lineJoin = "round";
  for (const [blur, col, lw, a] of [[60, "#ff1840", 10, .9], [28, "#ff2a55", 8, 1], [10, "#ff7a90", 5, 1]]) {
    g.shadowBlur = blur; g.shadowColor = col; g.strokeStyle = col; g.lineWidth = lw; g.globalAlpha = a;
    g.strokeText("Hacheden", w / 2, h / 2 + 8);
  }
  g.shadowBlur = 6; g.shadowColor = "#fff"; g.strokeStyle = "#ffe8ee"; g.lineWidth = 2.2; g.globalAlpha = 1;
  g.strokeText("Hacheden", w / 2, h / 2 + 8);
});
neonTex.wrapS = neonTex.wrapT = THREE.ClampToEdgeWrapping;
const neonMat = basic({ map: neonTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const neon = mesh(new THREE.PlaneGeometry(2.7, .675), neonMat, 0, 3.24, -4.96);
const neonGlow = glowSprite(0xff2a50, 4.2, 0, 3.24, -4.9, world, .35);
neonGlow.scale.set(4.4, 1.5, 1);
// держатели вывески
for (const x of [-1.1, 1.1]) mesh(new THREE.CylinderGeometry(.008, .008, .06, 6), M.chrome, x, 3.24, -4.97).rotation.x = Math.PI / 2;

/* ---------- бутылки: шесть главных и много декоративных ---------- */
function labelTex(d) {
  return canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = d.labelBg; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 500, .08);
    g.strokeStyle = d.labelInk; g.globalAlpha = .7; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
    g.lineWidth = 1; g.strokeRect(17, 17, w - 34, h - 34); g.globalAlpha = 1;
    g.fillStyle = d.labelInk; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "44px Forum, Georgia, serif";
    g.fillText(d.name.toUpperCase(), w / 2, h / 2 - 6);
    g.font = "18px Literata, Georgia, serif";
    g.globalAlpha = .75; g.fillText("HACHEDEN", w / 2, h / 2 + 34);
  });
}
const HERO_X = [-2.55, -1.6, -.5, .5, 1.6, 2.55];
const HERO_Y = BB.shelves[0], HERO_Z = BB.z0 + .15;
const heroes = {};
DRINKS.forEach((d, i) => {
  const shape = d.shape, r = bodyR(shape), top = neckTop(shape);
  const root = group(HERO_X[i], HERO_Y, HERO_Z);
  root.scale.setScalar(1.28);
  const glassMat = std({ color: d.glass, transparent: true, opacity: Math.min(.92, .4 + d.glassOp * .5), roughness: .05, metalness: .1, envMapIntensity: 2.2 });
  const glass = mesh(BGEO[shape], glassMat, 0, 0, 0, root);
  glass.renderOrder = 2;
  // жидкость внутри
  const bodyTop = Math.max(...BOTTLE[shape].p.filter(q => q[0] >= r * 92).map(q => q[1])) / 100;
  const lvl = bodyTop * clamp(d.level / 70, .45, .95);
  const liq = mesh(new THREE.CylinderGeometry(r * .88, r * .88, lvl, BOTTLE[shape].seg > 4 ? 18 : 4, 1), std({ color: d.liquid, transparent: true, opacity: .85, roughness: .2, emissive: new THREE.Color(d.liquid), emissiveIntensity: .35 }), 0, lvl / 2 + .006, 0, root);
  if (BOTTLE[shape].seg === 4) liq.rotation.y = Math.PI / 4;
  liq.renderOrder = 1;
  liq.userData.noHit = true;
  // крышка
  const [cr, ch] = BOTTLE[shape].cap;
  mesh(new THREE.CylinderGeometry(cr / 100, cr / 100, ch / 100, 14), std({ color: d.cap, roughness: .4, metalness: .5 }), 0, top + ch / 200, 0, root);
  // этикетка
  const lab = BOTTLE[shape].seg === 4
    ? new THREE.PlaneGeometry(r * 1.25, .09)
    : new THREE.CylinderGeometry(r * 1.01, r * 1.01, .085, 20, 1, true, -1.05, 2.1);
  const label = mesh(lab, std({ map: labelTex(d), roughness: .7 }), 0, .095, BOTTLE[shape].seg === 4 ? r * .72 : 0, root);
  label.renderOrder = 3;
  // тёплый ореол: главные бутылки видно издалека
  const halo = glowSprite(0xffb070, .62, 0, .17, -.1, root, .3);
  box(HERO_X[i] - .07, HERO_X[i] + .07, HERO_Y - .028, HERO_Y - .005, BB.z0 + .3, BB.z0 + .305, M.brass, world, 0);
  halo.userData.noHit = true;
  heroes[d.id] = { root, d, halo, home: root.position.clone() };
  hot(root, 1, d.name, () => H3D.bottle(d.id), { lift: .03, grow: .06 });
});

/* декоративные бутылки: инстансами, чтобы не тормозило на телефоне */
(() => {
  const PAL = ["#16210f", "#2a1308", "#4a2108", "#1c1a10", "#0e1a16", "#3a1a0a", "#22301c", "#56300e", "#1a0c08"];
  const CAPS = ["#c9944a", "#1a1210", "#6a1a1a", "#d8dde2", "#2a1a10"];
  const items = Object.fromEntries(Object.keys(BOTTLE).map(k => [k, []]));
  const caps = [];
  const fill = (y, x0, x1, zRow, free = []) => {
    let x = x0 + R(0, .03);
    while (x < x1 - .05) {
      const shape = pickOne(Object.keys(BOTTLE)), s = R(.82, 1.04), r = bodyR(shape) * s;
      if (x + 2 * r > x1) break;
      const cx = x + r;
      if (!free.some(f => Math.abs(cx - f) < .16)) {
        items[shape].push({ x: cx, y, z: zRow + R(-.02, .02), s, ry: R(0, 6.3), c: pickOne(PAL) });
        const [cr, ch] = BOTTLE[shape].cap;
        caps.push({ x: cx, y: y + neckTop(shape) * s, z: zRow, r: cr / 100 * s, h: ch / 100 * s, c: pickOne(CAPS) });
      }
      x += 2 * r + R(.012, .04);
    }
  };
  const bays = [[-3.12, -1.1], [-1.0, 1.0], [1.1, 3.12]];
  for (const [x0, x1] of bays) {
    fill(BB.shelves[0], x0, x1, BB.z0 + .08, HERO_X);
    fill(BB.shelves[1], x0, x1, BB.z0 + .15);
    fill(BB.shelves[1], x0 + .05, x1, BB.z0 + .06);
    fill(BB.shelves[2], x0, x1, BB.z0 + .15);
    fill(BB.shelves[2], x0 + .04, x1, BB.z0 + .06);
  }
  fill(BB.top, -3.2, -2.3, BB.z0 + .12);
  fill(BB.top, 2.35, 3.2, BB.z0 + .12);
  const mat = std({ roughness: .12, metalness: .15, envMapIntensity: 1.6 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  for (const k in items) {
    const list = items[k];
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(BGEO[k + "Lo"], mat, list.length);
    list.forEach((b, i) => {
      q.setFromEuler(e.set(0, b.ry, 0));
      m4.compose(V3(b.x, b.y, b.z), q, V3(b.s, b.s, b.s));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, col.set(b.c));
    });
    world.add(im);
  }
  const cg = new THREE.CylinderGeometry(1, 1, 1, 8);
  const ci = new THREE.InstancedMesh(cg, std({ roughness: .4, metalness: .6 }), caps.length);
  caps.forEach((c, i) => {
    m4.compose(V3(c.x, c.y + c.h / 2, c.z), q.identity(), V3(c.r, c.h, c.r));
    ci.setMatrixAt(i, m4); ci.setColorAt(i, col.set(c.c));
  });
  world.add(ci);
})();

/* ---------- стойка ---------- */
const CT = { x0: -3.3, x1: 3.3, z0: -2.8, z1: -2.0, top: 1.12 };
box(CT.x0, CT.x1, 1.06, CT.top, CT.z0, CT.z1, M.walnutGloss, world, 1.2);
mesh(new THREE.CylinderGeometry(.035, .035, CT.x1 - CT.x0, 16), M.walnutGloss, 0, 1.085, CT.z1).rotation.z = Math.PI / 2;
box(CT.x0 + .05, CT.x1 - .05, .1, 1.06, CT.z0 + .05, CT.z1 - .06, M.darkwood, world, .8);
box(CT.x0 + .05, CT.x1 - .05, 0, .1, CT.z0 + .1, CT.z1 - .1, M.black, world, 0);
(() => {
  // каннелюры: вертикальные полуколонны по фасаду
  const geos = [];
  const n = Math.floor((CT.x1 - CT.x0 - .2) / .065);
  for (let i = 0; i < n; i++) {
    const g = new THREE.CylinderGeometry(.028, .028, .9, 8, 1, false, -Math.PI / 2, Math.PI);
    g.translate(CT.x0 + .13 + i * .065, .56, CT.z1 - .065);
    geos.push(g);
  }
  merged(geos, M.walnut);
  // латунная подножка на кронштейнах
  const bar = new THREE.CylinderGeometry(.024, .024, CT.x1 - CT.x0 - .2, 14);
  bar.rotateZ(Math.PI / 2); bar.translate(0, .24, CT.z1 + .1);
  const parts = [bar];
  for (let x = CT.x0 + .3; x <= CT.x1 - .3; x += 1.05) {
    const b = new THREE.CylinderGeometry(.012, .012, .16, 8); b.rotateX(Math.PI / 2); b.translate(x, .24, CT.z1 + .03); parts.push(b);
  }
  merged(parts, M.brass);
})();
// тёплый отсвет ленты на фасаде стойки
const washTex = canvasTex(8, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, "rgba(255,170,100,.55)"); gr.addColorStop(.25, "rgba(255,120,70,.16)"); gr.addColorStop(1, "rgba(255,90,60,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
washTex.wrapS = washTex.wrapT = THREE.ClampToEdgeWrapping;
mesh(new THREE.PlaneGeometry(CT.x1 - CT.x0 - .2, .95), basic({ map: washTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 0, .56, CT.z1 - .02).userData.noHit = true;
// тёплая лента под столешницей
mesh(new THREE.BoxGeometry(CT.x1 - CT.x0 - .1, .012, .012), basic({ color: 0xffa860, toneMapped: false }), 0, 1.045, CT.z1 - .07);
// рабочая поверхность бармена с обратной стороны
box(CT.x0 + .05, CT.x1 - .05, .9, .94, CT.z0 - .32, CT.z0 + .05, M.chrome, world, 0);

/* ---------- табуреты ---------- */
(() => {
  const leather = [], metal = [];
  for (const x of [-2.5, -1.25, 0, 1.25, 2.5]) {
    const z = -1.5;
    const seat = new THREE.CylinderGeometry(.21, .19, .09, 22); seat.translate(x, .79, z); leather.push(seat);
    const top = new THREE.SphereGeometry(.21, 22, 6, 0, Math.PI * 2, 0, Math.PI / 2); top.scale(1, .2, 1); top.translate(x, .835, z); leather.push(top);
    const pole = new THREE.CylinderGeometry(.03, .035, .74, 12); pole.translate(x, .4, z); metal.push(pole);
    const base = new THREE.CylinderGeometry(.2, .23, .03, 22); base.translate(x, .015, z); metal.push(base);
    const ring = new THREE.TorusGeometry(.17, .012, 8, 24); ring.rotateX(Math.PI / 2); ring.translate(x, .3, z); metal.push(ring);
    const cup = new THREE.CylinderGeometry(.12, .06, .06, 16); cup.translate(x, .73, z); metal.push(cup);
  }
  merged(leather, M.leatherRed);
  merged(metal, M.brass);
})();

/* ---------- подвесные лампы и световые конусы ---------- */
const coneMat = new THREE.ShaderMaterial({
  uniforms: { uOp: { value: .16 }, uCol: { value: new THREE.Color(0xffb070) } },
  vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
    void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uOp; uniform vec3 uCol; varying float vY; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(clamp(abs(dot(normalize(vN), normalize(vV))), .0001, 1.), 2.2); float a = clamp(uOp * f * pow(clamp(vY, .0001, 1.), 1.6), 0., 1.); gl_FragColor = vec4(uCol * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
});
const pendants = [];
for (const x of [-1.7, 1.7]) {
  const z = -2.4;
  mesh(new THREE.CylinderGeometry(.006, .006, ROOM.h - 2.78, 6), M.black, x, (ROOM.h + 2.78) / 2, z);
  const shade = mesh(lathe([[.02, .2], [.06, .19], [.14, .12], [.19, .02], [.2, 0]], 28), M.brass, x, 2.6, z);
  shade.material = std({ color: 0x6a4420, metalness: .85, roughness: .32, envMapIntensity: 1.2 });
  const inner = mesh(lathe([[.195, .002], [.14, .115], [.06, .185], [.02, .195]], 28), basic({ color: 0x8a5a30, side: THREE.BackSide }), x, 2.6, z);
  const bulb = mesh(new THREE.SphereGeometry(.05, 16, 10), basic({ color: 0xfff0d0, toneMapped: false }), x, 2.62, z);
  const cone = mesh(new THREE.CylinderGeometry(.17, .85, 1.45, 28, 1, true), coneMat, x, 2.6 - .73, z);
  cone.userData.noHit = true;
  const glow = glowSprite(0xffc080, .6, x, 2.56, z, world, .4);
  pendants.push({ x, z, cone, bulb, glow });
}

/* стеклянная полка с бокалами над задней частью стойки */
const stemGeo = lathe([[0, 0], [.036, 0], [.036, .003], [.005, .008], [.004, .08], [.024, .095], [.04, .13], [.037, .18], [.036, .183]], 16);
stemGeo.rotateX(Math.PI);
(() => {
  const rails = [];
  for (const [x0, x1] of [[-3.0, -1.3], [1.3, 3.0]]) {
    for (const z of [-3.05, -3.3]) {
      const g = new THREE.CylinderGeometry(.01, .01, x1 - x0, 8); g.rotateZ(Math.PI / 2); g.translate((x0 + x1) / 2, 2.86, z); rails.push(g);
    }
    for (const x of [x0 + .05, x1 - .05]) { const g = new THREE.CylinderGeometry(.006, .006, ROOM.h - 2.86, 6); g.translate(x, (ROOM.h + 2.86) / 2, -3.17); rails.push(g); }
  }
  merged(rails, M.brass);
  const pos = [];
  for (const [x0, x1] of [[-2.95, -1.35], [1.35, 2.95]]) for (const z of [-3.05, -3.3]) for (let x = x0; x <= x1; x += .14) pos.push([x, 2.86, z]);
  const im = new THREE.InstancedMesh(stemGeo, std({ color: 0xf0f4ff, transparent: true, opacity: .22, roughness: .03, envMapIntensity: 2.5, side: THREE.DoubleSide, depthWrite: false }), pos.length);
  const m4 = new THREE.Matrix4();
  pos.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m4); });
  im.renderOrder = 4;
  world.add(im);
})();

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

/* на стойке: свечи, лаймы, шейкер, карта коктейлей */
const STATIC_TOOLS = [];
(() => {
  for (const x of [-2.95, 2.95]) {
    mesh(new THREE.CylinderGeometry(.04, .036, .08, 16), std({ color: 0x7a1a20, transparent: true, opacity: .55, roughness: .1 }), x, CT.top + .04, -2.25);
    mesh(new THREE.SphereGeometry(.01, 8, 6), basic({ color: 0xffd080, toneMapped: false }), x, CT.top + .07, -2.25);
    glowSprite(0xffa050, .35, x, CT.top + .08, -2.25, world, .7);
  }
  // миска с лаймами
  const bowlX = -1.25;
  mesh(lathe([[0, 0], [.05, 0], [.09, .02], [.11, .06], [.112, .062]], 24), M.chrome, bowlX, CT.top, -2.45);
  const limeMat = std({ color: 0x7aa02a, roughness: .55 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; mesh(new THREE.SphereGeometry(.03, 12, 10), limeMat, bowlX + Math.cos(a) * .05, CT.top + .055 + (i % 2) * .01, -2.45 + Math.sin(a) * .05).scale.set(1, .85, .85); }
  // шейкер и джиггер у рабочего места
  const tin = mesh(lathe([[0, 0], [.04, 0], [.045, .16], [.046, .17]], 20), M.chrome, 1.05, CT.top, -2.55);
  const jig = mesh(lathe([[.018, 0], [.024, .002], [.01, .045], [.024, .09]], 16), M.chrome, 1.17, CT.top, -2.5);
  STATIC_TOOLS.push(tin, jig);
  const mat = box(.75, 1.4, CT.top, CT.top + .006, -2.68, -2.3, std({ color: 0x141012, roughness: .9 }), world, 0);
  // меню на подставке: открывает барную карту
  const menu = group(-.35, CT.top, -2.15);
  mesh(new THREE.BoxGeometry(.2, .26, .012), std({ color: 0x3a0e16, roughness: .6 }), 0, .13, 0, menu).rotation.x = -.25;
  const face = mesh(new THREE.PlaneGeometry(.17, .22), std({ map: paperTex(8, "Меню"), roughness: .9 }), 0, .132, .0075, menu);
  face.rotation.x = -.25;
  mesh(new THREE.BoxGeometry(.12, .01, .06), M.brass, 0, .005, -.02, menu);
  hot(menu, 1, "Барная карта", () => openMix(), { grow: .1 });
})();
let servedGlass = null, servedV = null;
function placeServed(c) {
  abortSip();
  servedV = null;
  if (servedGlass) world.remove(servedGlass);
  servedGlass = makeGlass(c.cup, c.pour, { garnish: c.garnish, ice: c.cup === "rocks" || c.cup === "highball", op: c.pourOp || .88 });
  // сидящему гостю — прямо перед ним
  if (SEAT.on) servedGlass.position.set(SEAT_X + .08, CT.top, -2.12);
  else servedGlass.position.set(clamp(BT.x - .25, -2.6, 2.6), CT.top, -2.25);
  world.add(servedGlass);
  servedGlass.scale.setScalar(.001);
  tween(servedGlass.scale, { x: 1.35, y: 1.35, z: 1.35 }, .5, ease.out);
}
