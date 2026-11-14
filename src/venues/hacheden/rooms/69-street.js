/* ================= улица: ночной вход в Hacheden, стук в дверь и пароль ================= */
const STREET = { on: false, step: "idle", wrong: 0 };
const street = group(0, 0, 0);
const FZ = 6.1;   // фасад начинается сразу за передней стеной бара

/* ---------- текстуры улицы ---------- */
TEX.brick = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = "#1c1210"; g.fillRect(0, 0, w, h);
  const rows = 16, bh = h / rows, bw = 96;
  for (let r = 0; r < rows; r++) {
    for (let x = -(r % 2) * bw / 2; x < w; x += bw) {
      const l = R(14, 24), hue = R(4, 16);
      g.fillStyle = `hsl(${hue} ${R(30, 45)}% ${l}%)`;
      g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x + 2, r * bh + bh - 6, bw - 4, 4);
      g.fillStyle = "rgba(255,255,255,.05)"; g.fillRect(x + 2, r * bh + 2, bw - 4, 2);
    }
  }
  speckle(g, w, h, 6000, .12);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.25)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
TEX.cobble = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = "#0c0b0c"; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) {
    const x = c * 43 + (r % 2) * 21 + R(-3, 3), y = r * 43 + R(-3, 3), s = R(34, 39);
    const l = R(12, 22);
    g.fillStyle = `hsl(${R(200, 230)} ${R(4, 10)}% ${l}%)`;
    g.beginPath(); g.ellipse(x + 21, y + 21, s / 2, s / 2.2, R(0, 1), 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,.07)"; g.beginPath(); g.ellipse(x + 17, y + 15, s / 4, s / 6, -.5, 0, 7); g.fill();
  }
  speckle(g, w, h, 4000, .1);
});
TEX.slab = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = "#1a1818"; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    g.fillStyle = `hsl(30 4% ${R(14, 20)}%)`;
    g.fillRect(c * 128 + 3, r * 128 + 3, 122, 122);
  }
  speckle(g, w, h, 5000, .12);
});
/* полосатая маркиза с фестонами */
const awningTex = canvasTex(128, 256, (g, w, h) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#e8dcc0" : "#6a1220"; g.fillRect(0, i * 32, w, 32); }
  speckle(g, w, h, 900, .1);
});
const valanceTex = canvasTex(256, 64, (g, w, h) => {
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? "#e8dcc0" : "#5a1018";
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 32, 0); g.lineTo(i * 32 + 32, 30);
    g.quadraticCurveTo(i * 32 + 16, 64, i * 32, 30); g.closePath(); g.fill();
  }
});
valanceTex.wrapS = THREE.RepeatWrapping;
/* шторы в окнах: тёплый свет изнутри, складки */
const curtainTex = canvasTex(128, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, "#ffb070"); gr.addColorStop(1, "#c25a28");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) { const k = g.createLinearGradient(x, 0, x + 16, 0); k.addColorStop(0, "rgba(80,20,10,.45)"); k.addColorStop(.5, "rgba(255,220,170,.15)"); k.addColorStop(1, "rgba(80,20,10,.45)"); g.fillStyle = k; g.fillRect(x, 0, 16, h); }
});
/* следы света на мокрой мостовой */
const streakTex = canvasTex(64, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(.15, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const side = g.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, "rgba(0,0,0,1)"); side.addColorStop(.5, "rgba(0,0,0,0)"); side.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out"; g.fillStyle = side; g.fillRect(0, 0, w, h);
});
streakTex.wrapS = streakTex.wrapT = THREE.ClampToEdgeWrapping;

/* ---------- фасад ---------- */
const MS = {
  brick: lam({ map: TEX.brick }),
  stone: std({ color: 0x2c2826, roughness: .7 }),
  trim: std({ color: 0x14100e, roughness: .5 }),
  iron: std({ color: 0x0d0c0c, metalness: .6, roughness: .45 })
};
(() => {
  const z0 = FZ, z1 = FZ + .22;
  box(-10, -.62, 0, 9, z0, z1, MS.brick, street, 1.6);
  box(.62, 10, 0, 9, z0, z1, MS.brick, street, 1.6);
  box(-.62, .62, 2.42, 9, z0, z1, MS.brick, street, 1.6);
  // цоколь, пояса, карниз
  const parts = [];
  for (const [a, b] of [[-10, -.78], [.78, 10]]) parts.push(boxAt(a, b, 0, .45, z1, z1 + .05, .8));
  parts.push(boxAt(-10, 10, 4.2, 4.38, z1, z1 + .1, .8), boxAt(-10, 10, 8.6, 8.9, z1, z1 + .25, .8));
  // каменный портал вокруг двери
  parts.push(boxAt(-.8, -.62, 0, 2.62, z0, z1 + .1, .8), boxAt(.62, .8, 0, 2.62, z0, z1 + .1, .8), boxAt(-.86, .86, 2.42, 2.66, z0, z1 + .12, .8));
  parts.push(boxAt(-.1, .1, 2.42, 2.72, z1 + .1, z1 + .15, .8));
  parts.push(boxAt(-.95, .95, 0, .12, z1, z1 + .42, .8));
  merged(parts, MS.stone, street);
  // окна первого этажа: шторы светятся изнутри
  STREET.silhouettes = []; STREET.winGlow = [];
  for (const x of [-2.9, 2.9]) {
    const f = [boxAt(x - .9, x + .9, .82, .92, z1, z1 + .12, .8), boxAt(x - .9, x + .9, 2.62, 2.74, z1, z1 + .06, .8),
      boxAt(x - .9, x - .8, .92, 2.62, z1, z1 + .06, .8), boxAt(x + .8, x + .9, .92, 2.62, z1, z1 + .06, .8),
      boxAt(x - .02, x + .02, .92, 2.62, z1, z1 + .05, .8), boxAt(x - .8, x + .8, 1.96, 2.0, z1, z1 + .05, .8)];
    merged(f, MS.trim, street);
    const glow = mesh(new THREE.PlaneGeometry(1.6, 1.7), basic({ map: curtainTex, color: 0xcc8866 }), x, 1.77, z1 + .01, street);
    STREET.winGlow.push(glow, glowSprite(0xffa060, 2.2, x, 1.8, z1 + .4, street, 0));
    // силуэт гостя иногда проходит за шторой
    const sil = mesh(new THREE.PlaneGeometry(.5, 1.0), basic({ map: TEX.glow, color: 0x000000, transparent: true, opacity: 0, depthWrite: false }), x, 1.6, z1 + .015, street);
    sil.scale.set(1, 1.3, 1);
    STREET.silhouettes.push({ m: sil, x0: x, t: R(2, 9), k: 1 });
    STREET.winGlow[STREET.winGlow.length - 1].material.opacity = .18;
  }
  // окна второго этажа
  for (const x of [-5.6, -2.9, 0, 2.9, 5.6]) {
    merged([boxAt(x - .6, x + .6, 4.95, 5.05, z1, z1 + .1, .8), boxAt(x - .6, x + .6, 6.75, 6.85, z1, z1 + .05, .8),
      boxAt(x - .6, x - .52, 5.05, 6.75, z1, z1 + .05, .8), boxAt(x + .52, x + .6, 5.05, 6.75, z1, z1 + .05, .8)], MS.trim, street);
    const lit = x === -2.9;
    mesh(new THREE.PlaneGeometry(1.04, 1.7), lit ? basic({ map: curtainTex, color: 0x8a5a40 }) : std({ color: 0x0a0c12, roughness: .08, metalness: .5, envMapIntensity: .6 }), x, 5.9, z1 + .01, street);
  }
})();

/* ---------- дверь с окошком ---------- */
const SDOOR = { g: group(-.6, 0, FZ + .12, street) };
(() => {
  const g = SDOOR.g;
  box(0, 1.2, 0, 2.42, -.04, .04, M.darkwood, g, .8);
  const pn = [];
  for (const [y0, y1] of [[.2, 1.0], [1.2, 1.48], [1.78, 2.2]]) for (const [a, b] of [[.1, .55], [.65, 1.1]]) pn.push(boxAt(a, b, y0, y1, .04, .06, .8));
  merged(pn, M.walnut, g);
  mesh(new THREE.SphereGeometry(.035, 14, 10), M.brass, 1.02, 1.05, .08, g);
  box(.98, 1.06, .9, 1.2, .04, .055, M.brass, g, 0);
  // кованые петли
  merged([boxAt(.0, .3, .45, .5, .04, .055, 0), boxAt(.0, .3, 1.95, 2.0, .04, .055, 0)], MS.iron, g);
  // окошко: щель, заслонка, глаза
  box(.45, .75, 1.56, 1.64, .04, .05, basic({ color: 0x020101 }), g, 0);
  SDOOR.flap = box(.44, .76, 1.555, 1.645, .05, .064, M.brass, g, 0);
  SDOOR.flapY = SDOOR.flap.position.y;
  SDOOR.eyes = group(.6, 1.6, .045, g);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.012, 10, 8), basic({ color: 0xfff0c8, toneMapped: false }), s * .045, 0, 0, SDOOR.eyes);
  SDOOR.eyes.visible = false;
  SDOOR.anchor = group(.6, 1.48, .1, g);   // отсюда «говорит» швейцар
  SDOOR.voice = { head: SDOOR.anchor };
  // табличка с часами работы
  const plate = canvasTex(256, 96, (c, w, h) => {
    c.fillStyle = "#b8864a"; c.fillRect(0, 0, w, h); c.strokeStyle = "#5a3a18"; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = "#2a1408"; c.textAlign = "center"; fitFont(c, BAR_SIGN, w - 30, 30, "Forum, Georgia, serif"); c.fillText(BAR_SIGN, w / 2, 44);
    c.font = "18px Literata, Georgia, serif"; c.fillText("с 17:00 до 3:00", w / 2, 72);
  });
  mesh(new THREE.PlaneGeometry(.34, .13), std({ map: plate, metalness: .4, roughness: .4 }), 1.14, 1.55, FZ + .33, street);
})();
// тёплый проём за дверью: виден, когда она открыта
const doorway = mesh(new THREE.PlaneGeometry(1.2, 2.42), basic({ color: 0xffb070, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), 0, 1.21, FZ - .02, street);

/* ---------- маркиза, неон, фонари ---------- */
(() => {
  // маркиза: четверть цилиндра от стены вниз и вперёд, полосы бегут к краю
  const ag = new THREE.CylinderGeometry(.72, .72, 2.3, 24, 1, true, 0, Math.PI / 2);
  ag.rotateZ(Math.PI / 2);
  const awMat = std({ map: awningTex, side: THREE.DoubleSide, roughness: .8, emissive: 0x3a0a10, emissiveIntensity: .6 });
  mesh(ag, awMat, 0, 2.66, FZ + .22, street);
  const val = mesh(new THREE.PlaneGeometry(2.3, .2), std({ map: valanceTex, transparent: true, alphaTest: .5, side: THREE.DoubleSide, roughness: .8, emissive: 0x3a0a10, emissiveIntensity: .6 }), 0, 2.58, FZ + .94, street);
  valanceTex.repeat.set(1, 1);
  merged([boxAt(-1.17, -1.13, 2.62, 3.4, FZ + .22, FZ + .26, 0), boxAt(1.13, 1.17, 2.62, 3.4, FZ + .22, FZ + .26, 0)], MS.iron, street);
  // неоновая вывеска над маркизой
  STREET.neon = mesh(new THREE.PlaneGeometry(2.6, .65), basic({ map: neonTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 0, 3.62, FZ + .26, street);
  STREET.neonGlow = glowSprite(0xff2a50, 4, 0, 3.62, FZ + .5, street, .45);
  STREET.neonGlow.scale.set(4.6, 1.6, 1);
  // настенные фонари у двери
  for (const s of [-1, 1]) {
    const x = s * 1.1;
    const fr = [boxAt(x - .065, x + .065, 2.02, 2.04, FZ + .26, FZ + .4, 0), boxAt(x - .075, x + .075, 2.27, 2.3, FZ + .25, FZ + .41, 0), boxAt(x - .012, x + .012, 2.14, 2.17, FZ + .22, FZ + .27, 0)];
    for (const [dx, dz] of [[-.06, .27], [.06, .27], [-.06, .39], [.06, .39]]) fr.push(boxAt(x + dx - .006, x + dx + .006, 2.04, 2.27, FZ + dz - .006, FZ + dz + .006, 0));
    const cap = new THREE.ConeGeometry(.1, .08, 4); cap.rotateY(Math.PI / 4); cap.translate(x, 2.34, FZ + .33); fr.push(cap);
    merged(fr, MS.iron, street);
    mesh(new THREE.BoxGeometry(.1, .21, .1), basic({ color: 0xffb060, transparent: true, opacity: .75, toneMapped: false }), x, 2.155, FZ + .33, street);
    glowSprite(0xffa050, .8, x, 2.16, FZ + .4, street, .55);
  }
  // уличный фонарь
  const lx = 3.7, lz = FZ + 2.0;
  const pole = [];
  const p1 = new THREE.CylinderGeometry(.05, .09, 3.2, 12); p1.translate(lx, 1.6, lz); pole.push(p1);
  const p2 = new THREE.CylinderGeometry(.16, .2, .25, 14); p2.translate(lx, .12, lz); pole.push(p2);
  const p3 = new THREE.CylinderGeometry(.13, .06, .14, 4); p3.rotateY(Math.PI / 4); p3.translate(lx, 3.27, lz); pole.push(p3);
  const p4 = new THREE.ConeGeometry(.22, .2, 4); p4.rotateY(Math.PI / 4); p4.translate(lx, 3.78, lz); pole.push(p4);
  merged(pole, MS.iron, street);
  mesh(new THREE.CylinderGeometry(.17, .11, .4, 4, 1, true), basic({ color: 0xffd8a0, transparent: true, opacity: .9, side: THREE.DoubleSide, toneMapped: false }), lx, 3.52, lz, street).rotation.y = Math.PI / 4;
  STREET.lampGlow = glowSprite(0xffb060, 3.2, lx, 3.5, lz, street, .5);
  STREET.lampPos = V3(lx, 3.4, lz);
})();

/* ---------- тротуар, бордюр, мостовая ---------- */
(() => {
  const side = mesh(new THREE.PlaneGeometry(22, 2.3), std({ map: TEX.slab, roughness: .3, envMapIntensity: .6 }), 0, .1, FZ + .22 + 1.15, street);
  side.rotation.x = -Math.PI / 2;
  TEX.slab.repeat.set(16, 1.7);
  box(-11, 11, 0, .1, FZ + .22, FZ + 2.45, MS.stone, street, 0);
  box(-11, 11, 0, .12, FZ + 2.45, FZ + 2.6, MS.stone, street, 0);
  const road = mesh(new THREE.PlaneGeometry(22, 14), std({ map: TEX.cobble, roughness: .16, metalness: .1, envMapIntensity: .9 }), 0, 0, FZ + 2.6 + 7, street);
  road.rotation.x = -Math.PI / 2;
  TEX.cobble.repeat.set(26, 16);
  // люк, из которого идёт пар
  const hatch = mesh(new THREE.CircleGeometry(.36, 24), std({ color: 0x141414, metalness: .7, roughness: .45 }), -2.4, .006, FZ + 5.2, street);
  hatch.rotation.x = -Math.PI / 2;
  // отблески на мокрых камнях
  const streak = (x, z0, len, w, color, op) => {
    const m = mesh(new THREE.PlaneGeometry(w, len), basic({ map: streakTex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), x, .015, z0 + len / 2, street);
    m.rotation.x = -Math.PI / 2;
    return m;
  };
  STREET.streaks = [streak(0, FZ + .4, 4.5, 1.8, 0xff2a50, .32), streak(3.7, FZ + 1.4, 4, .9, 0xffa050, .35), streak(-2.9, FZ + .4, 3, 1.1, 0xff9a50, .18), streak(2.9, FZ + .4, 3, 1.1, 0xff9a50, .18)];
  STREET.doorStreak = streak(0, FZ + .3, 4, 1.2, 0xffb070, 0);
})();

/* ---------- дождь или снег, брызги, пар ---------- */
const PREC = (() => {
  const snow = WEATHER.snow > 0, dry = !snow && WEATHER.rain === 0;
  const N = QUALITY > 1 ? 900 : 500, box = { x0: -5, x1: 5, z0: FZ + .5, z1: FZ + 9, h: 6.5 };
  const pos = new Float32Array(N * 6), seeds = [];
  for (let i = 0; i < N; i++) seeds.push([R(box.x0, box.x1), R(0, box.h), R(box.z0, box.z1), R(.8, 1.2)]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: snow ? 0xffffff : 0xb8c8e8, transparent: true, opacity: snow ? .8 : .33, depthWrite: false }));
  lines.frustumCulled = false;
  street.add(lines);
  // кольца от капель на лужах
  const RN = 40;
  const rings = new THREE.InstancedMesh(new THREE.RingGeometry(.8, 1, 20), basic({ color: 0xa0b0d0, transparent: true, opacity: .35, depthWrite: false }), Math.max(1, RN));
  rings.count = dry || snow ? 0 : RN;
  const ringT = [];
  for (let i = 0; i < RN; i++) ringT.push([R(-4, 4), R(FZ + .6, FZ + 8), R(0, 1)]);
  street.add(rings);
  // пар из люка
  const steam = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.puff, color: 0x8a8a96, transparent: true, opacity: 0, depthWrite: false }));
    s.userData.t = i / 8; street.add(s); steam.push(s);
  }
  const active = dry ? 0 : N;
  g.setDrawRange(0, active * 2);
  return { N, active, pos, seeds, g, box, snow, rings, ringT, RN, steam, lines };
})();
const _rm = new THREE.Matrix4(), _rq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), _rs = V3();
onTick((t, dt) => {
  if (!street.visible) return;
  const P = PREC, b = P.box;
  for (let i = 0; i < P.active; i++) {
    const s = P.seeds[i];
    if (P.snow) { s[1] -= dt * .55 * s[3]; s[0] += Math.sin(t * .8 + i) * dt * .15; }
    else s[1] -= dt * 7.5 * s[3];
    if (s[1] < 0) { s[1] += b.h; s[0] = R(b.x0, b.x1); s[2] = R(b.z0, b.z1); }
    const k = i * 6, len = P.snow ? .025 : .32;
    P.pos[k] = s[0]; P.pos[k + 1] = s[1]; P.pos[k + 2] = s[2];
    P.pos[k + 3] = s[0] + (P.snow ? .02 : .01); P.pos[k + 4] = s[1] + len; P.pos[k + 5] = s[2];
  }
  if (P.active) P.g.attributes.position.needsUpdate = true;
  for (let i = 0; i < P.rings.count; i++) {
    const r = P.ringT[i];
    r[2] += dt * 1.4;
    if (r[2] > 1) { r[2] = 0; r[0] = R(-4, 4); r[1] = R(FZ + .6, FZ + 8); }
    const sc = .02 + r[2] * .12;
    _rm.compose(_rs.set(r[0], .02, r[1]), _rq, V3(sc, sc, sc));
    P.rings.setMatrixAt(i, _rm);
  }
  if (P.rings.count) P.rings.instanceMatrix.needsUpdate = true;
  for (const s of P.steam) {
    s.userData.t += dt * .12;
    if (s.userData.t > 1) s.userData.t -= 1;
    const k = s.userData.t;
    s.position.set(-2.4 + Math.sin(k * 6 + s.id) * .15 * k, .1 + k * 2.2, FZ + 5.2 + Math.cos(k * 5 + s.id) * .1 * k);
    const sc = .4 + k * 1.6; s.scale.set(sc, sc, 1);
    s.material.opacity = Math.sin(Math.PI * k) * .16;
  }
  // силуэты за шторами
  for (const s of STREET.silhouettes) {
    s.t -= dt;
    if (s.t < 0) { s.t = R(6, 14); s.k = 0; s.dir = rng() < .5 ? -1 : 1; }
    if (s.k < 1) { s.k = Math.min(1, s.k + dt * .35); s.m.position.x = s.x0 + s.dir * (s.k - .5) * 1.5; s.m.material.opacity = Math.sin(Math.PI * s.k) * .55; }
  }
  // неон мигает в такт с вывеской внутри
  STREET.neon.material.opacity = neonMat.opacity;
  STREET.neonGlow.material.opacity = .45 * neonMat.opacity;
  STREET.streaks[0].material.opacity = .32 * neonMat.opacity;
});

/* ---------- кадры камеры ---------- */
const SHOT = {
  wide: { pos: [2.6, 1.55, FZ + 10.5], tgt: [.4, 1.95, FZ], span: 10, pull: 3 },
  near: { pos: [.7, 1.5, FZ + 5.2], tgt: [0, 1.75, FZ], span: 4.8, pull: 2 },
  door: { pos: [.12, 1.64, FZ + 2.3], tgt: [.02, 1.7, FZ], span: 2.2, pull: 1.4 }
};

/* ---------- сцена у двери ---------- */
function streetTalk(list) {
  talkEl.innerHTML = "";
  list.forEach(([label, fn, quiet], i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    if (quiet) b.className = "quiet";
    b.style.animationDelay = (i * .07) + "s";
    b.addEventListener("click", () => { if (STREET.on) fn(); });
    talkEl.appendChild(b);
  });
  talkEl.hidden = !list.length;
}
function doormanSays(text, dur = 60) {
  bubbleEl.classList.remove("show");
  return new Promise(res => setTimeout(() => { say(SDOOR.voice, text, dur); res(); }, STILL ? 0 : 200));
}
let STREET_LIGHT = null;
function streetLights(on) {
  const f = LIGHTS.fill, w = LIGHTS.window;
  if (on) {
    STREET_LIGHT = { f: f.position.clone(), w: w.position.clone(), wc: w.color.clone(), wi: w.intensity };
    f.position.set(1.4, 2.9, FZ + 1.7);
    w.position.set(0, 2.0, FZ - .8); w.color.setHex(0xffb070); w.intensity = 0;
  } else if (STREET_LIGHT) {
    f.position.copy(STREET_LIGHT.f);
    w.position.copy(STREET_LIGHT.w); w.color.copy(STREET_LIGHT.wc);
  }
}
/* швейцар помнит тех, кто уже заходил */
let greeted = false;
try { greeted = localStorage.getItem("hacheden-visited") === "1"; } catch (e) {}
let GREET = () => OWNER ? "Хозяин! Проходите, всё готово."
  : greeted ? pickOne(["С возвращением. Ваше место ждёт.", "Рады снова видеть. Проходите.", "А, это вы. Проходите, у нас тепло."])
  : pickOne([`Добрый вечер. Добро пожаловать в ${BAR_NAME}.`, "Добрый вечер. Проходите, вас ждут.", "Добро пожаловать. Музыка уже играет."]);

function streetIntro() {
  STREET.on = true;
  STREET.step = "outside";
  STREET.wrong = 0;
  street.visible = true;
  app.classList.add("street");
  streetLights(true);
  Music.room(3);
  setCam(framed(SHOT.wide));
  hintEl.textContent = WX_NOW.ok ? `${weatherLine()} Дверь без вывески. Постучи.` : SEASON === "winter" ? "Снег, фонарь и дверь без вывески. Постучи." : WEATHER.rain ? "Ночь, дождь и дверь без вывески. Постучи." : "Тёплая ночь и дверь без вывески. Постучи.";
  flyTo(framed(SHOT.near), STILL ? 0 : 5.5, 0).then(() => {
    if (STREET.step === "outside") streetTalk([["Постучать в дверь", () => knockStreet()], ["Сразу войти", () => openDoor(), true]]);
  });
  if (STILL) streetTalk([["Постучать в дверь", () => knockStreet()], ["Сразу войти", () => openDoor(), true]]);
}
async function knockStreet() {
  if (STREET.step !== "outside") return;
  STREET.step = "knock";
  streetTalk([]);
  hintEl.textContent = "";
  // ритм входа ~8 с вместо 10: подойти, постучать, глаза в окошке, приветствие (время прочитать), дверь, внутрь
  await flyTo(framed(SHOT.door), STILL ? 0 : 1.3, 0);
  knock();
  await sleep(.9);
  SDOOR.eyes.visible = true;
  tween(SDOOR.flap.position, { y: SDOOR.flapY + .11 }, .35, ease.out);
  await sleep(.45);
  await doormanSays(GREET(), 4);
  try { localStorage.setItem("hacheden-visited", "1"); } catch (e) {}
  greeted = true;
  await sleep(1.7);
  return openDoor();
}
async function openDoor() {
  if (STREET.step === "inside") return;
  STREET.step = "inside";
  streetTalk([]);
  SDOOR.eyes.visible = false;
  tween(SDOOR.flap.position, { y: SDOOR.flapY }, .25);
  // засов, скрип, дверь распахивается внутрь
  const c = fx();
  if (c) {
    const t0 = c.currentTime + .05;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "square"; o.frequency.setValueAtTime(120, t0); o.frequency.exponentialRampToValueAtTime(60, t0 + .08);
    g.gain.setValueAtTime(.12, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + .12);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + .15);
    const cr = c.createOscillator(), cg = c.createGain(), bp = c.createBiquadFilter();
    cr.type = "sawtooth"; cr.frequency.setValueAtTime(180, t0 + .35); cr.frequency.linearRampToValueAtTime(260, t0 + 1.1);
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 6;
    cg.gain.setValueAtTime(0, t0 + .35); cg.gain.linearRampToValueAtTime(.05, t0 + .5); cg.gain.linearRampToValueAtTime(0, t0 + 1.2);
    cr.connect(bp).connect(cg).connect(c.destination); cr.start(t0 + .35); cr.stop(t0 + 1.3);
  }
  await sleep(.35);
  tween(SDOOR.g.rotation, { y: 1.65 }, STILL ? 0 : 1.6, ease.io);
  tween(doorway.material, { opacity: .55 }, 1.2);
  tween(STREET.doorStreak.material, { opacity: .45 }, 1.2);
  tween(LIGHTS.window, { intensity: 9 }, 1.2);
  Music.room(1);
  bubbleEl.classList.remove("show");
  await sleep(.55);
  hintEl.textContent = ZONES[1].hint;
  await flyTo(framed(1), STILL ? 0 : 3.1, 0);
  // внутри: дверь закрывается, улица засыпает до следующего визита
  app.classList.remove("street");
  STREET.on = false;
  renderZoneUI(1);
  tween(SDOOR.g.rotation, { y: 0 }, 1.4);
  tween(doorway.material, { opacity: 0 }, 1);
  tween(STREET.doorStreak.material, { opacity: 0 }, 1);
  await tween(LIGHTS.window, { intensity: 0 }, 1);
  streetLights(false);
  street.visible = false;
}
hot(SDOOR.g, "street", "Постучать в дверь", () => { if (STREET.step === "outside") knockStreet(); }, { grow: 0, noChip: true });
