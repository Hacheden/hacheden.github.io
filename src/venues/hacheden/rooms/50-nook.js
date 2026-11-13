/* ================= ЧИТАЛЬНЯ: книжные шкафы, окно с дождём, стол писателя ================= */
const NOOK = { flash: 0, candleOn: true, globeSpeed: .25 };

/* ---------- книжные шкафы ---------- */
const BOOK_COL = ["#5a1414", "#1f3a26", "#1a2440", "#4a2a14", "#2a1a10", "#6a4a1a", "#3a0e1e", "#14140f", "#56301e", "#2c3a2a", "#6a1a1a", "#203048"];
let books = [];
let caseGeos = [], caseBacks = [];
const SHELF_Y = [.12, .52, .92, 1.32, 1.72, 2.12, 2.52, 2.92];
function bookcase(axis, a0, a1, fixed, side, top = 3.32) {
  // axis "z": шкаф вдоль стены x=fixed, смотрит в +x (side=1); axis "x": вдоль стены z=fixed, смотрит в +z
  const D = .32, f0 = fixed, f1 = fixed + side * D;
  const B = (u0, u1, y0, y1, d0, d1) => axis === "x"
    ? boxAt(u0, u1, y0, y1, Math.min(d0, d1), Math.max(d0, d1), .8)
    : boxAt(Math.min(d0, d1), Math.max(d0, d1), y0, y1, u0, u1, .8);
  caseBacks.push(B(a0, a1, 0, top, f0, f0 + side * .02));
  caseGeos.push(B(a0 - .03, a1 + .03, top, top + .1, f0, f1 + side * .03));
  caseGeos.push(B(a0, a1, 0, .1, f0, f1));
  const n = Math.max(1, Math.round((a1 - a0) / 1.0)), seg = (a1 - a0) / n;
  for (let i = 0; i <= n; i++) { const u = a0 + i * seg; caseGeos.push(B(u - .025, u + .025, 0, top, f0, f1)); }
  for (const y of SHELF_Y) caseGeos.push(B(a0, a1, y - .025, y, f0, f1));
  for (let i = 0; i < n; i++) for (const y of SHELF_Y) {
    let u = a0 + i * seg + .03;
    const end = a0 + (i + 1) * seg - .03;
    while (u < end - .03) {
      if (rng() < .05) { u += R(.06, .14); continue; }
      const t = R(.026, .06), h = R(.22, .34), d = R(.19, .25);
      if (u + t > end) break;
      const lean = rng() < .04 && u + .12 < end ? R(.15, .3) : 0;
      books.push({ axis, u: u + t / 2 + (lean ? .05 : 0), y: y + h / 2 + (lean ? -.01 : 0), f: fixed + side * (D - d / 2 - .015), t, h, d, lean, c: pickOne(BOOK_COL) });
      u += t + (lean ? .1 : R(0, .004));
    }
  }
}
/* левая стена: в середине — секция-дверь в тайный погреб (собирается отдельно) */
const SECRET = { a0: -.79, a1: .257, hx: -8, hz: .257 };
bookcase("z", -4.96, SECRET.a0, -8, 1);
bookcase("z", SECRET.a1, 1.3, -8, 1);
{
  const keep = [caseGeos, caseBacks, books];
  caseGeos = []; caseBacks = []; books = [];
  bookcase("z", SECRET.a0, SECRET.a1, -8, 1);
  SECRET.parts = { geos: caseGeos, backs: caseBacks, books };
  [caseGeos, caseBacks, books] = keep;
}
bookcase("x", -7.66, -6.98, -5, 1);
bookcase("x", -5.02, -4.0, -5, 1);
merged(caseGeos, M.walnut);
merged(caseBacks, std({ color: 0x120a07, roughness: .9 }));
(() => {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam({ map: TEX.spine }), books.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  books.forEach((b, i) => {
    if (b.axis === "z") {
      q.setFromEuler(e.set(b.lean, 0, 0));
      m4.compose(V3(b.f, b.y, b.u), q, V3(b.d, b.h, b.t));
    } else {
      q.setFromEuler(e.set(0, 0, -b.lean));
      m4.compose(V3(b.u, b.y, b.f), q, V3(b.t, b.h, b.d));
    }
    im.setMatrixAt(i, m4);
    im.setColorAt(i, col.set(b.c).multiplyScalar(R(.8, 1.25)));
  });
  world.add(im);
})();
// стремянка на рельсе
(() => {
  const parts = [];
  for (const s of [-1, 1]) {
    const r = new THREE.CylinderGeometry(.018, .018, 3.3, 8);
    r.rotateZ(-.13); r.translate(-7.42, 1.65, -3.0 + s * .22); parts.push(r);
  }
  for (let i = 0; i < 10; i++) { const y = .25 + i * .31; const g = new THREE.CylinderGeometry(.013, .013, .44, 6); g.rotateX(Math.PI / 2); g.translate(-7.42 + (y - 1.65) * .131, y, -3.0); parts.push(g); }
  merged(parts, M.oak);
  const rail = new THREE.CylinderGeometry(.015, .015, 6.2, 8); rail.rotateX(Math.PI / 2);
  mesh(rail, M.brass, -7.62, 3.22, -1.83);
})();

/* ---------- арочное окно с дождём ---------- */
const WIN = { x: -6.0, sill: 1.08, w: 1.5, rect: 1.42, r: .75 };
const winH = WIN.rect + WIN.r;
const rainMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uSky: { value: 0 }, uRain: { value: 1 }, uSnow: { value: 0 }, uStars: { value: 0 }, uLeaves: { value: 0 }, uFrost: { value: 0 } },
  vertexShader: VERT_UV,
  fragmentShader: `uniform float uTime, uFlash, uSky, uRain, uSnow, uStars, uLeaves, uFrost; varying vec2 vUv; ${NOISE_GLSL}
    void main(){
      vec2 p = vUv * vec2(${WIN.w.toFixed(2)}, ${winH.toFixed(2)});
      vec2 a = vec2(p.x - ${(WIN.w / 2).toFixed(3)}, p.y - ${WIN.rect.toFixed(3)});
      if (p.y > ${WIN.rect.toFixed(3)} && length(a) > ${WIN.r.toFixed(3)}) discard;
      // небо: ночь или вечерние сумерки
      vec3 night = mix(vec3(.13, .1, .15), vec3(.035, .05, .1), smoothstep(.2, 2., p.y));
      night += vec3(.35, .16, .06) * smoothstep(.9, 0., p.y) * .5;
      vec3 dusk = mix(vec3(1., .52, .28), vec3(.3, .36, .66), smoothstep(.15, 1.9, p.y));
      dusk = mix(dusk, vec3(1., .78, .52), smoothstep(.7, 0., p.y) * .45);
      vec3 col = mix(night, dusk * .8, uSky);
      // звёзды
      vec2 sq = p * 42.; vec2 sid = floor(sq); float sh = hash(sid * 1.31);
      col += uStars * (1. - uSky) * step(.982, sh) * smoothstep(.32, 0., length(fract(sq) - .5)) * (.55 + .45 * sin(uTime * 2. + sh * 40.)) * smoothstep(.7, 1.3, p.y) * vec3(1., .95, .85);
      // дальние огни
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        vec2 q = p * (5. + fi * 3.) + vec2(fi * 7.3, 0.);
        vec2 id = floor(q), f = fract(q) - .5;
        float on = step(.78, hash(id + fi)) * step(p.y, .9 - fi * .2);
        col += on * vec3(1., .7, .35) * smoothstep(.45, 0., length(f)) * .25 * (1. - uSky * .7);
      }
      // силуэты домов с окнами и снегом на крышах
      float bx = floor(p.x * 5.);
      float bh = .3 + hash(vec2(bx, 3.)) * .55;
      if (p.y < bh) {
        col = mix(vec3(.02, .022, .035), vec3(.13, .11, .16), uSky);
        vec2 g = vec2(p.x * 26., p.y * 20.), gi = floor(g), gf = fract(g);
        float lit = step(.7 + uSky * .15, hash(gi + bx));
        col += lit * vec3(1., .72, .38) * .5 * step(.25, gf.x) * step(gf.x, .7) * step(.3, gf.y) * step(gf.y, .75);
        col = mix(col, vec3(.72, .76, .84) * (.45 + .4 * uSky), uSnow * smoothstep(bh - .035, bh - .01, p.y));
      }
      // струи дождя
      float r = 0.;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float k = 38. + fi * 22.;
        float cx = p.x * k + p.y * 1.2;
        float h = hash(vec2(floor(cx), fi));
        float y = fract(p.y * (.5 + h * .4) + uTime * (1.6 + h + fi * .6) + h * 9.);
        r += smoothstep(.13, 0., y) * smoothstep(.0, .02, y) * smoothstep(.5, .1, abs(fract(cx) - .5)) * step(.45, h) * (.55 - fi * .12);
      }
      col += vec3(.55, .62, .8) * r * .55 * uRain;
      // снег
      float sn = 0.;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 q = p * (6. + fi * 4.);
        q.y += uTime * (.35 + fi * .15);
        q.x += sin(q.y * .7 + fi * 3. + uTime * .6) * .4;
        vec2 id = floor(q), f = fract(q) - .5;
        vec2 o = vec2(hash(id + 2.) - .5, hash(id + 7.) - .5) * .6;
        sn += step(.5, hash(id + fi * 11.)) * smoothstep(.1 - fi * .02, 0., length(f - o));
      }
      col += vec3(.9, .92, 1.) * min(sn, 1.) * uSnow * .85;
      // листопад
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        vec2 q = p * vec2(3., 2.4) + vec2(fi * 1.7, 0.);
        q.y += uTime * (.2 + fi * .08);
        q.x += sin(uTime * .9 + q.y * 1.3 + fi) * .3;
        vec2 id = floor(q), f = fract(q) - .5;
        float h = hash(id + fi * 5.);
        vec2 d = f - vec2(hash(id + 3.) - .5, hash(id + 9.) - .5) * .4;
        float an = uTime * 1.6 + h * 6.;
        d = mat2(cos(an), -sin(an), sin(an), cos(an)) * d;
        float leaf = step(.72, h) * smoothstep(.01, -.01, length(d * vec2(1., 2.3)) - .075);
        col = mix(col, mix(vec3(.8, .36, .07), vec3(.55, .12, .05), hash(id + 1.)) * (.5 + .5 * uSky + .3), leaf * uLeaves);
      }
      // капли на стекле
      vec2 dq = p * vec2(14., 10.);
      vec2 did = floor(dq), df = fract(dq) - .5;
      float dh = hash(did * 1.7);
      vec2 off = vec2(hash(did + 3.) - .5, hash(did + 5.) - .5) * .5;
      col += smoothstep(.16 * dh, .06 * dh, length(df - off)) * step(.55, dh) * vec3(.5, .55, .7) * .35 * uRain;
      // иней по краям стекла
      float e = length((vUv - .5) * vec2(1.25, 1.));
      float frost = smoothstep(.36, .62, e + (fbm(p * 14.) - .5) * .18);
      col = mix(col, vec3(.78, .85, .93), frost * uFrost * .6);
      col += uFlash * vec3(.7, .75, .95) * (1.2 - p.y * .25);
      gl_FragColor = vec4(col, 1.);
    }`
});
const winPlane = mesh(new THREE.PlaneGeometry(WIN.w, winH), rainMat, WIN.x, WIN.sill + winH / 2, -4.995);
(() => {
  const S = (rx, ry, hw, rect, r) => {
    const s = new THREE.Shape();
    s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, rect); s.absarc(0, rect, r, 0, Math.PI, false); s.lineTo(-hw, 0);
    return s;
  };
  const outer = S(0, 0, WIN.w / 2 + .09, WIN.rect, WIN.r + .09);
  const inner = new THREE.Path();
  inner.moveTo(-WIN.w / 2, 0); inner.lineTo(-WIN.w / 2, WIN.rect); inner.absarc(0, WIN.rect, WIN.r, Math.PI, 0, true); inner.lineTo(WIN.w / 2, 0); inner.lineTo(-WIN.w / 2, 0);
  outer.holes.push(inner);
  const fg = new THREE.ExtrudeGeometry(outer, { depth: .09, bevelEnabled: false, curveSegments: 24 });
  mesh(fg, M.walnut, WIN.x, WIN.sill, -5.0);
  const bars = [boxAt(-.02, .02, 0, WIN.rect + WIN.r, -.005, .03, 0)];
  for (const y of [.48, .95, WIN.rect]) bars.push(boxAt(-WIN.w / 2, WIN.w / 2, y - .015, y + .015, -.005, .03, 0));
  const bm = merged(bars, M.darkwood);
  bm.position.set(WIN.x, WIN.sill, -4.99);
  box(WIN.x - .95, WIN.x + .95, WIN.sill - .06, WIN.sill, -5.0, -4.8, M.walnutGloss, world, .8);
  // шторы
  const curtain = s => {
    const g = new THREE.PlaneGeometry(.48, 2.75, 28, 20), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i) + 1.375;
      const tie = 1 - .55 * Math.exp(-Math.pow((y - 1.25) / .35, 2));
      p.setX(i, -.24 + (x + .24) * tie);
      p.setZ(i, Math.sin((x + .24) / .48 * Math.PI * 6) * .03 * tie);
    }
    g.computeVertexNormals();
    return g;
  };
  const cm = std({ map: TEX.velvet, color: 0x4a0e18, roughness: .85, side: THREE.DoubleSide });
  const cL = mesh(curtain(1), cm, WIN.x - 1.0, 2.1 + .33, -4.86);
  const cR = mesh(curtain(1), cm, WIN.x + 1.0, 2.1 + .33, -4.86);
  cR.scale.x = -1;
  const rod = new THREE.CylinderGeometry(.015, .015, 2.6, 8); rod.rotateZ(Math.PI / 2);
  mesh(rod, M.brass, WIN.x, 3.8 - .1, -4.84);
  const wg = group(WIN.x, 0, -4.98);
  mesh(new THREE.PlaneGeometry(WIN.w, winH), basic({ visible: false }), 0, WIN.sill + winH / 2, .02, wg);
  hot(wg, 0, "Окно: дождь", () => lightning(), { grow: 0 });
})();
function lightning() {
  if (STILL) return;
  NOOK.flash = 1;
  setTimeout(() => { NOOK.flash = .7; }, 140);
  setTimeout(() => { Music.thunder(); }, 600 + Math.random() * 900);
}

/* ---------- стол писателя у окна ---------- */
(() => {
  const x = WIN.x, z0 = -4.66, z1 = -3.98;
  box(x - .78, x + .78, .74, .785, z0, z1, M.walnutGloss, world, .8);
  for (const s of [-1, 1]) {
    box(x + s * .55 - .2, x + s * .55 + .2, 0, .74, z0 + .02, z1 - .02, M.walnut, world, .8);
    for (let i = 0; i < 3; i++) {
      box(x + s * .55 - .17, x + s * .55 + .17, .06 + i * .22, .25 + i * .22, z1 - .02, z1, M.darkwood, world, .8);
      mesh(new THREE.SphereGeometry(.012, 8, 6), M.brass, x + s * .55, .155 + i * .22, z1 + .01);
    }
  }
  const top = .785;
  // лампа банкира
  const lx = x - .5, lz = -4.42;
  mesh(new THREE.CylinderGeometry(.07, .08, .025, 20), M.brass, lx, top + .012, lz);
  mesh(new THREE.CylinderGeometry(.008, .008, .3, 8), M.brass, lx, top + .17, lz);
  const shade = mesh(new THREE.CylinderGeometry(.075, .075, .3, 20, 1, true, 0, Math.PI), std({ color: 0x1f6a3a, roughness: .15, emissive: 0x0a3a1a, emissiveIntensity: .8, side: THREE.DoubleSide, transparent: true, opacity: .92 }), lx, top + .34, lz + .06);
  shade.rotation.set(0, 0, Math.PI / 2);
  mesh(new THREE.PlaneGeometry(.29, .1), basic({ color: 0xfff0c8, toneMapped: false }), lx, top + .31, lz + .06).rotation.x = -Math.PI / 2;
  NOOK.lampGlow = glowSprite(0xffd090, .9, lx, top + .28, lz + .08, world, .5);
  LIGHTS.lamp.position.set(lx, top + .25, lz + .15);
  // письмо с сургучом
  const letter = group(x + .25, top + .002, -4.15);
  letter.rotation.y = -.35;
  const env = mesh(new THREE.PlaneGeometry(.2, .14), std({ color: 0xd8c8a4, roughness: .9 }), 0, .001, 0, letter);
  env.rotation.x = -Math.PI / 2;
  const sheet = mesh(new THREE.PlaneGeometry(.17, .23), std({ map: TEX.letter, roughness: .9 }), .05, .003, -.03, letter);
  sheet.rotation.set(-Math.PI / 2, 0, .25);
  mesh(new THREE.CylinderGeometry(.016, .016, .006, 14), std({ color: 0x8a0f1e, roughness: .4 }), -.05, .004, .03, letter);
  hot(letter, 0, "Письмо между книгами", () => openCard(JAZZ_STORY), { grow: .12 });
  // чернильница и перо
  mesh(lathe([[0, 0], [.03, 0], [.034, .02], [.03, .045], [.012, .055], [.012, .065]], 16), std({ color: 0x101820, roughness: .05, envMapIntensity: 2 }), x + .5, top, -4.45);
  const quill = mesh(new THREE.ConeGeometry(.012, .26, 6), std({ color: 0xe8e0d0, roughness: .8 }), x + .52, top + .15, -4.43);
  quill.rotation.set(.35, 0, -.3);
  quill.scale.set(1.6, 1, .3);
  // стопка книг
  for (let i = 0; i < 4; i++) { const b = box(-.13, .13, 0, .045, -.09, .09, lam({ map: TEX.spine, color: BOOK_COL[i * 3] }), world, 0); b.position.set(x - .2 + R(-.01, .01), top + .023 + i * .046, -4.5); b.rotation.y = R(-.2, .2); }
  // свеча: можно задуть
  const candle = group(x + .62, top, -4.2);
  mesh(lathe([[0, 0], [.05, 0], [.05, .008], [.015, .015], [.015, .03], [.03, .035]], 16), M.brass, 0, 0, 0, candle);
  mesh(new THREE.CylinderGeometry(.014, .014, .14, 10), M.candle, 0, .105, 0, candle);
  NOOK.flame = mesh(new THREE.ConeGeometry(.009, .035, 8), basic({ color: 0xffd078, toneMapped: false }), 0, .195, 0, candle);
  NOOK.flameGlow = glowSprite(0xffa040, .42, 0, .195, 0, candle, .8);
  hot(candle, 0, "Свеча", () => toggleCandle(), { grow: .1 });
  // стул писателя
  const ch = group(x, 0, -3.6);
  const cp = [boxAt(-.22, .22, .45, .5, -.2, .22, .6)];
  for (const [a, b] of [[-.19, -.17], [.19, -.17], [-.19, .19], [.19, .19]]) cp.push(boxAt(a - .02, a + .02, 0, .45, b - .02, b + .02, .6));
  for (const s of [-1, 1]) cp.push(boxAt(s * .19 - .02, s * .19 + .02, .5, .98, .17, .21, .6));
  cp.push(boxAt(-.21, .21, .82, .96, .17, .21, .6));
  merged(cp, M.walnut, ch);
})();
function toggleCandle() {
  NOOK.candleOn = !NOOK.candleOn;
  NOOK.flame.visible = NOOK.candleOn;
  tween(NOOK.flameGlow.material, { opacity: NOOK.candleOn ? .8 : 0 }, .4);
  tween(LIGHTS.lamp.userData, { mul: NOOK.candleOn ? 1 : .35 }, .6);
  const h = HOT.find(o => o.userData.hot.act === toggleCandle);
  if (h) h.userData.hot.label = NOOK.candleOn ? "Задуть свечу" : "Зажечь свечу";
}
LIGHTS.lamp.userData.mul = 1;


/* ---------- кафедра с книгой рецептов ---------- */
(() => {
  const g = group(-4.75, 0, -1.25);
  g.rotation.y = .62;
  g.scale.setScalar(1.25);
  const parts = [boxAt(-.22, .22, 0, .05, -.18, .18, .6), boxAt(-.04, .04, .05, .95, -.04, .04, .6)];
  merged(parts, M.walnut, g);
  const top = group(0, 1.0, 0, g);
  top.rotation.x = .5;
  mesh(new RoundedBoxGeometry(.5, .04, .36, 2, .01), M.walnutGloss, 0, 0, 0, top);
  mesh(new THREE.BoxGeometry(.5, .02, .03), M.walnut, 0, .03, .17, top);
  // раскрытая книга
  const bk = group(0, .03, -.01, top);
  mesh(new THREE.BoxGeometry(.46, .012, .32), std({ color: 0x5a0f1c, roughness: .6 }), 0, 0, 0, bk);
  const page = (s, tex) => {
    const geo = new THREE.PlaneGeometry(.21, .3, 10, 1), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + .105) / .21; p.setZ(i, Math.sin(u * Math.PI) * .012 + (1 - u) * .014); }
    geo.computeVertexNormals();
    const m = mesh(geo, std({ map: tex, roughness: .95 }), s * .111, .008, 0, bk);
    m.rotation.x = -Math.PI / 2;
    if (s < 0) m.scale.x = -1;
    return m;
  };
  page(-1, paperTex(12, "Рецепты"));
  page(1, paperTex(13));
  glowSprite(0xffc890, .8, 0, .25, 0, top, .3);
  hot(g, 0, "Книга рецептов", () => Book.open(), { grow: .03 });
})();

/* ---------- кресло с высокой спинкой, столик ---------- */
(() => {
  const g = group(-6.85, 0, -1.25);
  g.rotation.y = .95;
  const parts = [];
  const rb = (w, h, d, px, py, pz, rx = 0, ry = 0) => { const b = new RoundedBoxGeometry(w, h, d, 3, .04); worldUV(b, w, h, d, .3); if (rx) b.rotateX(rx); if (ry) b.rotateY(ry); b.translate(px, py, pz); parts.push(b); };
  rb(.78, .3, .74, 0, .28, 0);
  rb(.66, .12, .6, 0, .48, .05);
  rb(.78, 1.0, .16, 0, .9, -.32, -.08);
  for (const s of [-1, 1]) { rb(.14, .3, .66, s * .34, .55, .02); rb(.14, .42, .34, s * .38, 1.12, -.2, 0, s * .5); }
  merged(parts, M.velvetGreen, g);
  for (const [fx, fz] of [[-.33, -.3], [.33, -.3], [-.33, .3], [.33, .3]]) mesh(new THREE.CylinderGeometry(.025, .018, .14, 8), M.darkwood, fx, .07, fz, g);
  const t = group(-6.2, 0, -.55);
  mesh(new THREE.CylinderGeometry(.24, .24, .03, 24), M.walnutGloss, 0, .56, 0, t);
  mesh(new THREE.CylinderGeometry(.03, .03, .54, 10), M.darkwood, 0, .28, 0, t);
  mesh(new THREE.CylinderGeometry(.16, .18, .03, 20), M.darkwood, 0, .015, 0, t);
  mesh(lathe([[0, 0], [.03, 0], [.04, .03], [.045, .055]], 16), std({ color: 0xf2ece0, roughness: .2 }), .05, .575, .02, t);
  mesh(new THREE.CylinderGeometry(.07, .07, .004, 20), std({ color: 0xf2ece0, roughness: .2 }), .05, .577, .02, t);
  for (let i = 0; i < 2; i++) { const b = box(-.1, .1, 0, .04, -.07, .07, lam({ map: TEX.spine, color: BOOK_COL[2 + i * 5] }), t, 0); b.position.set(-.07, .595 + i * .042, -.04); b.rotation.y = .3 * i; }
})();
const rug2 = mesh(new THREE.PlaneGeometry(2.4, 3.2), std({ map: TEX.rugGreen, roughness: .95 }), -5.75, .004, -2.3);
rug2.rotation.set(-Math.PI / 2, 0, .1);

/* ---------- глобус ---------- */
(() => {
  const g = group(-7.05, 0, .55);
  const parts = [];
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, l = new THREE.CylinderGeometry(.018, .012, .72, 8); l.rotateZ(.32); l.rotateY(a); l.translate(Math.cos(a) * .12, .34, -Math.sin(a) * .12); parts.push(l); }
  const ring = new THREE.TorusGeometry(.28, .014, 8, 40); ring.rotateX(Math.PI / 2); ring.translate(0, .72, 0); parts.push(ring);
  merged(parts, M.walnut, g);
  const tilt = group(0, 1.0, 0, g);
  tilt.rotation.z = .41;
  mesh(new THREE.TorusGeometry(.28, .008, 8, 48, Math.PI * 1.2), M.brass, 0, 0, 0, tilt).rotation.z = -Math.PI * .1;
  NOOK.globe = mesh(new THREE.SphereGeometry(.26, 40, 28), std({ map: TEX.globe, roughness: .4, envMapIntensity: .9 }), 0, 0, 0, tilt);
  hot(g, 0, "Глобус", () => { NOOK.globeSpeed = 9; }, { grow: .03 });
})();

/* мотылёк вокруг лампы */
const moth = mesh(new THREE.PlaneGeometry(.025, .015), basic({ color: 0xc8b8a0, side: THREE.DoubleSide, transparent: true, opacity: .85 }), 0, 0, 0);
moth.userData.noHit = true;
