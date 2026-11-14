/* ================= КУРИЛКА: камин, кресла, граммофон, дверь с глазком ================= */
const NOISE_GLSL = `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= .5; } return v; }`;
const VERT_UV = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const FIRE = { boost: 1, t: 0, lvl: 1, on: true };
const flameMats = [];
function flameMat(seedV) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seedV }, uBoost: { value: 1 } },
    vertexShader: VERT_UV,
    fragmentShader: `uniform float uTime, uSeed, uBoost; varying vec2 vUv; ${NOISE_GLSL}
      void main(){
        vec2 uv = vUv; float t = uTime * 1.4 + uSeed * 10.;
        float n = fbm(vec2(uv.x * 3.5 + uSeed * 3., uv.y * 2.6 - t * 1.5));
        float n2 = fbm(vec2(uv.x * 7. - uSeed, uv.y * 5. - t * 2.4));
        float x = uv.x - .5 + (n - .5) * .42 * uv.y;
        float w = mix(.36, .015, pow(uv.y, .75));
        float body = smoothstep(w, w * .1, abs(x));
        float top = smoothstep(1., .2, uv.y * (.8 + n2 * .7) / uBoost);
        float f = body * top * smoothstep(0., .1, uv.y);
        vec3 col = mix(vec3(.85, .16, .02), vec3(1., .66, .2), smoothstep(.15, .85, f));
        col = mix(col, vec3(1., .93, .7), smoothstep(.8, 1., f) * (1. - uv.y));
        gl_FragColor = vec4(col * f * 1.5, f);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  flameMats.push(m);
  return m;
}

/* камин на правой стене */
const FP = { x: 7.98, z: -1.7 };
(() => {
  const z = FP.z, x1 = 8.0;
  const parts = [
    boxAt(7.66, x1, 0, 1.24, z - 1.0, z - .46, .5), boxAt(7.66, x1, 0, 1.24, z + .46, z + 1.0, .5),
    boxAt(7.66, x1, .96, 1.24, z - .46, z + .46, .5)
  ];
  merged(parts, M.marble);
  box(7.52, x1, 1.24, 1.32, z - 1.12, z + 1.12, M.walnutGloss, world, .8);
  box(7.6, x1, 1.17, 1.24, z - 1.06, z + 1.06, M.darkwood, world, .8);
  box(7.2, x1, 0, .04, z - 1.1, z + 1.1, M.stone, world, 0);
  // топка: тёмная ниша с отблесками
  const soot = std({ color: 0x0a0605, roughness: 1, emissive: 0x2a0802, emissiveIntensity: 1 });
  box(7.94, x1, .04, .96, z - .46, z + .46, soot, world, 0);
  box(7.7, x1, .04, .96, z - .47, z - .44, soot, world, 0);
  box(7.7, x1, .04, .96, z + .44, z + .47, soot, world, 0);
  // решётка и поленья
  const grate = [];
  for (let i = -3; i <= 3; i++) { const g = new THREE.CylinderGeometry(.008, .008, .36, 6); g.rotateZ(Math.PI / 2); g.translate(7.82, .1, z + i * .06); grate.push(g); }
  merged(grate, M.iron);
  const logMat = std({ color: 0x2a160c, roughness: .9, emissive: 0xff4a10, emissiveIntensity: .35 });
  FIRE.logMat = logMat;
  for (const [a, dy, dz] of [[.35, 0, -.08], [-.3, .02, .1], [.05, .1, 0]]) {
    const l = mesh(new THREE.CylinderGeometry(.05, .055, .62, 10), logMat, 7.83, .16 + dy, z + dz);
    l.rotation.set(Math.PI / 2, 0, a);
  }
  // языки пламени
  FIRE.flames = [];
  for (const [dz, s, sd] of [[-.12, .9, .1], [.1, 1, .5], [0, 1.15, .8], [.18, .7, .3]]) {
    const f = mesh(new THREE.PlaneGeometry(.42 * s, .62 * s), flameMat(sd), 7.8, .16 + .3 * s, z + dz);
    f.rotation.y = -Math.PI / 2;
    f.userData.noHit = true;
    FIRE.flames.push(f);
  }
  FIRE.glow = glowSprite(0xff6a20, 1.6, 7.72, .45, z, world, .5);
  // угольки летят вверх
  const N = 36, pos = new Float32Array(N * 3), life = new Float32Array(N);
  for (let i = 0; i < N; i++) life[i] = rng();
  const eg = new THREE.BufferGeometry();
  eg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa040, size: .018, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, map: TEX.glow }));
  world.add(embers);
  FIRE.embers = { pos, life, N, eg, pts: embers };
  // картина в раме
  // рама — матовое старое золото, а не зеркальная латунь: иначе ловит огонь камина и светится, как неон
  box(7.93, 7.99, 1.62, 2.52, z - .72, z + .72, std({ color: 0x7a5a2e, metalness: .55, roughness: .62, envMapIntensity: .5 }), world, 0);
  const pic = mesh(new THREE.PlaneGeometry(1.32, .82), std({ map: TEX.painting, roughness: .8 }), 7.925, 2.07, z);
  pic.rotation.y = -Math.PI / 2;
  glowSprite(0xffc890, .5, 7.8, 2.64, z, world, .08);
  // часы на каминной полке, стрелки идут по-настоящему
  const clock = group(7.78, 1.32, z);
  mesh(new RoundedBoxGeometry(.12, .3, .28, 3, .03), M.walnutGloss, 0, .15, 0, clock);
  const face = mesh(new THREE.CircleGeometry(.09, 32), basic({ map: TEX.clock }), -.061, .17, 0, clock);
  face.rotation.y = -Math.PI / 2;
  mesh(new THREE.TorusGeometry(.092, .008, 8, 32), M.brass, -.062, .17, 0, clock).rotation.y = -Math.PI / 2;
  const hand = (len, w) => { const g = group(-.065, .17, 0, clock); const m = mesh(new THREE.BoxGeometry(.003, len, w), M.black, 0, len / 2, 0, g); return g; };
  FIRE.hour = hand(.05, .008); FIRE.min = hand(.075, .005);
  // подсвечники
  FIRE.candles = [];
  for (const dz of [-.9, .9]) {
    mesh(lathe([[0, 0], [.045, 0], [.04, .02], [.012, .04], [.01, .2], [.03, .22], [.032, .235]], 16), M.brass, 7.75, 1.32, z + dz);
    mesh(new THREE.CylinderGeometry(.013, .013, .12, 10), M.candle, 7.75, 1.615, z + dz);
    mesh(new THREE.SphereGeometry(.009, 8, 6), basic({ color: 0xffd890, toneMapped: false }), 7.75, 1.69, z + dz).scale.set(1, 1.8, 1);
    FIRE.candles.push(glowSprite(0xffa050, .32, 7.75, 1.69, z + dz, world, .7));
  }
  // бра по бокам
  for (const dz of [-1.35, 1.35]) {
    box(7.96, 8.0, 1.85, 2.05, z + dz - .05, z + dz + .05, M.brass, world, 0);
    mesh(new THREE.CylinderGeometry(.03, .02, .12, 12), std({ color: 0xffe8c0, emissive: 0xffb060, emissiveIntensity: .9 }), 7.9, 2.1, z + dz);
    glowSprite(0xffa860, .6, 7.88, 2.12, z + dz, world, .6);
  }
  const fp = group(7.9, 0, z);
  const hit = mesh(new THREE.BoxGeometry(.4, 1.0, 1.0), basic({ visible: false }), -.15, .5, 0, fp);
  hot(fp, 2, "Подбросить дров", () => stoke(), { grow: 0 });
})();
function stoke() {
  FIRE.boost = 1.6;
  const e = FIRE.embers;
  for (let i = 0; i < e.N; i++) e.life[i] = rng() * .3;
  crackle();
}

/* ---------- ковёр, кресла и столик ---------- */
const rug = mesh(new THREE.PlaneGeometry(2.5, 3.5), std({ map: TEX.rugRed, roughness: .95 }), 6.2, .004, FP.z);
rug.rotation.x = -Math.PI / 2;

function clubChair(mat, x, z, ry) {
  const g = group(x, 0, z);
  g.rotation.y = ry;
  const parts = [];
  const rb = (w, h, d, px, py, pz, rx = 0) => { const b = new RoundedBoxGeometry(w, h, d, 3, .05); worldUV(b, w, h, d, .35); if (rx) b.rotateX(rx); b.translate(px, py, pz); parts.push(b); };
  rb(.88, .28, .8, 0, .2, 0);
  rb(.72, .14, .62, 0, .4, .05);
  rb(.88, .56, .2, 0, .66, -.31, -.12);
  for (const s of [-1, 1]) {
    rb(.17, .34, .8, s * .38, .48, 0);
    const roll = new THREE.CylinderGeometry(.1, .1, .8, 16); roll.rotateX(Math.PI / 2); roll.translate(s * .39, .64, 0); parts.push(roll);
  }
  merged(parts, mat, g);
  const feet = [];
  for (const [fx, fz] of [[-.36, -.32], [.36, -.32], [-.36, .32], [.36, .32]]) { const f = new THREE.SphereGeometry(.045, 10, 8); f.translate(fx, .04, fz); feet.push(f); }
  merged(feet, M.darkwood, g);
  return g;
}
const chairA = clubChair(M.leatherBrown, 6.75, -3.25, .45);
const chairB = clubChair(M.leatherRed, 6.75, -.15, 2.69);

(() => {
  const x = 6.05, z = FP.z;
  mesh(new THREE.CylinderGeometry(.36, .36, .04, 32), M.walnutGloss, x, .46, z);
  mesh(new THREE.CylinderGeometry(.04, .05, .42, 12), M.darkwood, x, .23, z);
  mesh(new THREE.CylinderGeometry(.22, .25, .03, 24), M.darkwood, x, .015, z);
  // пепельница с сигарой и дымом
  mesh(lathe([[0, 0], [.06, 0], [.07, .015], [.068, .028], [.05, .028], [.048, .012], [0, .012]], 24), std({ color: 0x8a6a4a, transparent: true, opacity: .7, roughness: .1 }), x - .1, .48, z - .12);
  const cigar = mesh(new THREE.CylinderGeometry(.009, .009, .13, 10), std({ color: 0x4a2a14, roughness: .8 }), x - .06, .51, z - .12);
  cigar.rotation.set(0, .5, Math.PI / 2 - .1);
  const tip = mesh(new THREE.SphereGeometry(.01, 8, 6), basic({ color: 0xff6a20, toneMapped: false }), x + .0, .515, z - .155);
  FIRE.cigarTip = tip;
  FIRE.smokeFrom = V3(x + .0, .53, z - .155);
  // виски со льдом
  const w = makeGlass("rocks", "#c27a1a", { ice: true, op: .8 });
  w.position.set(x + .14, .48, z + .08);
  world.add(w);
  // фишки и карты
  const chipCol = [0x9a1a22, 0x111111, 0xe8e0d0, 0x1a3a6a];
  for (let s = 0; s < 4; s++) for (let i = 0; i < 3 + s; i++) mesh(new THREE.CylinderGeometry(.019, .019, .005, 16), std({ color: chipCol[s], roughness: .5 }), x - .02 + s * .045, .483 + i * .0055, z + .2);
  const cardMat = std({ color: 0xf2ece0, roughness: .6 });
  for (let i = 0; i < 5; i++) { const c = mesh(new THREE.PlaneGeometry(.06, .088), cardMat, x + .12 + R(-.05, .05), .4815 + i * .0004, z - .12 + R(-.05, .05)); c.rotation.set(-Math.PI / 2, 0, R(0, 3)); }
})();
/* дым сигары */
const smoke = [];
for (let i = 0; i < 12; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.puff, color: 0xd8c8c0, transparent: true, opacity: 0, depthWrite: false }));
  s.userData.t = i / 12;
  world.add(s);
  smoke.push(s);
}
/* дымка под потолком курилки */
const haze = [];
for (let i = 0; i < 6; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.puff, color: 0x8a6a64, transparent: true, opacity: .16, depthWrite: false }));
  s.position.set(R(4.6, 7.6), R(2.2, 3.3), R(-4.4, .8));
  s.scale.set(2.6, 1.6, 1);
  s.userData.ph = R(0, 6);
  world.add(s);
  haze.push(s);
}


/* ---------- граммофон ---------- */
const GR = {};
(() => {
  const g = group(4.95, 0, -4.6);
  g.rotation.y = .5;
  mesh(new RoundedBoxGeometry(.66, .78, .5, 2, .02), M.walnut, 0, .39, 0, g);
  box(-.28, .28, .1, .66, .25, .255, M.darkwood, g, .8);
  const top = group(0, .78, 0, g);
  mesh(new RoundedBoxGeometry(.42, .1, .38, 2, .015), M.walnutGloss, 0, .05, 0, top);
  GR.disc = mesh(new THREE.CylinderGeometry(.15, .15, .008, 32), std({ color: 0x0a0a0a, roughness: .25, metalness: .3 }), 0, .105, .02, top);
  mesh(new THREE.CylinderGeometry(.04, .04, .002, 20), basic({ color: 0x8a1428 }), 0, .005, 0, GR.disc);
  const arm = mesh(new THREE.CylinderGeometry(.006, .006, .2, 8), M.brass, .1, .14, -.06, top);
  arm.rotation.set(Math.PI / 2, 0, .6);
  // труба
  const horn = group(-.05, .12, -.14, top);
  const neckG = new THREE.CylinderGeometry(.015, .02, .22, 12); neckG.translate(0, .11, 0);
  mesh(neckG, M.brass, 0, 0, 0, horn);
  const bell = mesh(lathe([[.02, 0], [.03, .08], [.05, .16], [.09, .24], [.16, .3], [.23, .33], [.24, .335]], 32), std({ color: 0xc9944a, metalness: 1, roughness: .25, side: THREE.DoubleSide, envMapIntensity: 1.5 }), 0, .2, 0, horn);
  bell.rotation.x = .9;
  bell.position.z = .02;
  hot(g, 2, "Граммофон: музыка", () => setMusic(!Music.on), { grow: .03 });
})();

/* ---------- дверь с глазком ---------- */
const DOOR = { busy: false };
(() => {
  const g = group(6.9, 0, -4.99);
  box(-.6, .6, 0, 2.32, 0, .05, M.walnut, g, .8);
  box(-.5, .5, 0, 2.2, .05, .09, M.darkwood, g, .8);
  const pn = [];
  for (const [y0, y1] of [[.2, 1.0], [1.15, 1.5], [1.75, 2.05]]) for (const s of [-1, 1]) pn.push(boxAt(s > 0 ? .05 : -.42, s > 0 ? .42 : -.05, y0, y1, .09, .105, .8));
  merged(pn, M.walnut, g);
  mesh(new THREE.SphereGeometry(.03, 12, 10), M.brass, .38, 1.0, .12, g);
  mesh(new THREE.CylinderGeometry(.03, .03, .02, 12), M.brass, .38, 1.0, .1, g).rotation.x = Math.PI / 2;
  // окошко: тёмная щель, латунная заслонка, глаза за ней
  box(-.12, .12, 1.58, 1.66, .09, .1, basic({ color: 0x020101 }), g, 0);
  DOOR.flap = box(-.13, .13, 1.575, 1.665, .1, .112, M.brass, g, 0);
  DOOR.eyes = group(0, 1.62, .095, g);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.011, 10, 8), basic({ color: 0xfff0c0, toneMapped: false }), s * .04, 0, 0, DOOR.eyes);
  DOOR.eyes.visible = false;
  DOOR.flapY = DOOR.flap.position.y;
  // табличка
  const plate = mesh(new THREE.PlaneGeometry(.22, .07), basic({ map: canvasTex(256, 80, (c, w, h) => {
    c.fillStyle = "#c9944a"; c.fillRect(0, 0, w, h); c.fillStyle = "#2a1408"; c.font = "34px Forum, Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("ПРИВАТ", w / 2, h / 2 + 2);
  }) }), 0, 1.85, .108, g);
  glowSprite(0xffa860, .7, 0, 2.5, .2, g, .4);
  hot(g, 2, "Постучать в дверь", () => knockDoor(), { grow: 0 });
})();
async function knockDoor() {
  if (DOOR.busy || busy) return;
  DOOR.busy = true;
  knock();
  await wait(1.0);
  DOOR.eyes.visible = true;
  await tween(DOOR.flap.position, { y: DOOR.flapY + .1 }, .35, ease.out);
  await wait(.9);
  openCard(DOOR_STORY);
  dlg.addEventListener("close", async () => {
    await tween(DOOR.flap.position, { y: DOOR.flapY }, .3);
    DOOR.eyes.visible = false;
    DOOR.busy = false;
  }, { once: true });
}

/* ---------- кот у огня ---------- */
const CAT = {};
(() => {
  const g = group(7.32, .04, -.62);
  g.rotation.y = -1.2;
  const fur = std({ color: 0x3a2214, roughness: .95 });
  CAT.body = mesh(new THREE.SphereGeometry(.17, 20, 14), fur, 0, .085, 0, g);
  CAT.body.scale.set(1.25, .5, .9);
  CAT.head = group(.17, .07, .08, g);
  mesh(new THREE.SphereGeometry(.075, 16, 12), fur, 0, 0, 0, CAT.head).scale.set(1, .85, .95);
  for (const s of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(.026, .05, 4), fur, .0, .06, s * .04, CAT.head); e.rotation.x = s * .3; }
  const tail = mesh(new THREE.TorusGeometry(.17, .025, 8, 20, Math.PI * 1.1), fur, -.02, .03, 0, g);
  tail.rotation.x = Math.PI / 2;
  hot(g, 2, "Кот", () => petCat(), { grow: .05, secret: true });   // кота находят сами
})();
function petCat() {
  tween(CAT.head.rotation, { z: .5 }, .5, ease.out).then(() => wait(1.6)).then(() => tween(CAT.head.rotation, { z: 0 }, .8));
  const c = fx(); if (!c) return;
  const len = c.sampleRate * 1.8, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) { const t = i / c.sampleRate; d[i] = (Math.random() * 2 - 1) * (.5 + .5 * Math.sin(t * 2 * Math.PI * 24)) * Math.sin(Math.PI * i / len) * (.6 + .4 * Math.sin(t * 2 * Math.PI * 1.1)); }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), gg = c.createGain();
  s.buffer = b; f.type = "lowpass"; f.frequency.value = 260; gg.gain.value = .9;
  s.connect(f).connect(gg).connect(c.destination); s.start();
}

/* торшер у кресла */
(() => {
  const x = 7.5, z = .85;
  mesh(new THREE.CylinderGeometry(.14, .16, .03, 20), M.brassDark, x, .015, z);
  mesh(new THREE.CylinderGeometry(.012, .012, 1.5, 8), M.brassDark, x, .77, z);
  mesh(new THREE.CylinderGeometry(.16, .25, .26, 24, 1, true), std({ color: 0xe8c890, emissive: 0xffa050, emissiveIntensity: .7, side: THREE.DoubleSide }), x, 1.6, z);
  glowSprite(0xffb060, 1.2, x, 1.55, z, world, .45);
})();

/* ---------- курилка живёт сама: огонь, угольки, часы, дым сигары, дымка, пластинка, кот ---------- */
onTick((t, dt) => {
  // камин
  FIRE.boost += (1 - FIRE.boost) * dt * .5;
  const fl = .78 + .14 * Math.sin(t * 7.3) + .1 * Math.sin(t * 13.1 + 1) + .06 * Math.sin(t * 23.7);
  FIRE.lvl += ((FIRE.on ? 1 : .1) - FIRE.lvl) * Math.min(1, dt * 1.2);
  LIGHTS.fire.intensity = LIGHTS.fire.userData.base * fl * FIRE.boost * FIRE.lvl;
  for (const f of FIRE.flames) { f.visible = FIRE.lvl > .25; f.scale.y = Math.max(.05, Math.min(1, (FIRE.lvl - .2) * 1.3)); }
  for (const m of flameMats) { m.uniforms.uTime.value = t; m.uniforms.uBoost.value = Math.min(1.35, FIRE.boost); }
  FIRE.logMat.emissiveIntensity = .3 + .12 * Math.sin(t * 2.1) * fl;
  FIRE.glow.material.opacity = .38 * fl * FIRE.boost * (.25 + .75 * FIRE.lvl);
  FIRE.embers.pts.visible = FIRE.lvl > .4 && SET.effects && !SET.saver;
  {
    const e = FIRE.embers;
    for (let i = 0; i < e.N; i++) {
      e.life[i] += dt * (.35 + (i % 5) * .06) * (FIRE.boost > 1.1 ? 1.8 : 1);
      if (e.life[i] > 1) e.life[i] -= 1;
      const k = e.life[i];
      e.pos[i * 3] = 7.82 - k * .25 + Math.sin(i * 7 + t * 2) * .04;
      e.pos[i * 3 + 1] = .18 + k * 1.1;
      e.pos[i * 3 + 2] = FP.z + Math.sin(i * 3.1 + t * 1.3) * (.1 + k * .15);
    }
    e.eg.attributes.position.needsUpdate = true;
  }
  for (const c of FIRE.candles) c.material.opacity = .62 + .12 * Math.sin(t * 9 + c.position.z * 3);
  // часы
  {
    const d = new Date(), h = d.getHours() % 12, m = d.getMinutes() + d.getSeconds() / 60;
    FIRE.hour.rotation.x = -(h + m / 60) / 12 * Math.PI * 2;
    FIRE.min.rotation.x = -m / 60 * Math.PI * 2;
  }
  // дым сигары
  for (const s of smoke) {
    s.userData.t += dt * .09;
    if (s.userData.t > 1) s.userData.t -= 1;
    const k = s.userData.t;
    s.position.set(FIRE.smokeFrom.x + Math.sin(k * 9 + s.id) * .05 * k, FIRE.smokeFrom.y + k * 1.5, FIRE.smokeFrom.z + Math.cos(k * 7 + s.id) * .05 * k);
    const sc = .06 + k * .5;
    s.scale.set(sc, sc, 1);
    s.material.opacity = Math.sin(Math.PI * Math.min(1, k * 1.4)) * .32 * (1 - k);
    s.material.rotation = k * 2 + s.id;
  }
  FIRE.cigarTip.material.color.setHSL(.05, 1, .45 + .1 * Math.sin(t * 1.3));
  for (const s of haze) { s.position.x += Math.sin(t * .1 + s.userData.ph) * .0015; s.material.opacity = .1 + .05 * Math.sin(t * .2 + s.userData.ph); }
  if (Music.on) GR.disc.rotation.y -= dt * 3.4;
  CAT.body.scale.y = .5 + .025 * Math.sin(t * 1.9);
});
