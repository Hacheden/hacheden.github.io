/* ================= сезоны: погода за окном, звук и убранство бара ================= */
const WEATHER = {
  winter: { rain: 0, snow: 1, stars: .3, leaves: 0, frost: 1, storm: false, sound: { rain: 0, wind: .5, crickets: 0, fire: .6 } },
  spring: { rain: .6, snow: 0, stars: 0, leaves: 0, frost: 0, storm: true, sound: { rain: .24, wind: 0, crickets: 0, fire: .45 } },
  summer: { rain: 0, snow: 0, stars: 1, leaves: 0, frost: 0, storm: false, sound: { rain: 0, wind: 0, crickets: .35, fire: 0 } },
  autumn: { rain: 1, snow: 0, stars: 0, leaves: 1, frost: 0, storm: true, sound: { rain: .32, wind: .12, crickets: 0, fire: .5 } }
}[SEASON];
rainMat.uniforms.uRain.value = WEATHER.rain;
rainMat.uniforms.uSnow.value = WEATHER.snow;
rainMat.uniforms.uStars.value = WEATHER.stars;
rainMat.uniforms.uLeaves.value = WEATHER.leaves;
rainMat.uniforms.uFrost.value = WEATHER.frost;
Music.weather(WEATHER.sound);

/* летом камин не топят: в нём стоят свечи */
const SUMMER_FIRE = SEASON === "summer" && FEAT.smoke;
if (SUMMER_FIRE) {
  FIRE.flames.forEach(f => { f.visible = false; });
  FIRE.glow.visible = false;
  FIRE.logMat.emissiveIntensity = 0;
  FIRE.logMat.emissive.setHex(0x000000);
  FIRE.embers.pts.visible = false;
  LIGHTS.fire.userData.base = 1.6;
  LIGHTS.fire.color.setHex(0xffb060);
  for (const [dz, h] of [[-.28, .18], [-.14, .26], [0, .32], [.13, .22], [.27, .16]]) {
    mesh(new THREE.CylinderGeometry(.03, .03, h, 14), M.candle, 7.84, .06 + h / 2, FP.z + dz);
    mesh(new THREE.SphereGeometry(.011, 8, 6), basic({ color: 0xffd890, toneMapped: false }), 7.84, .08 + h, FP.z + dz).scale.set(1, 1.8, 1);
    FIRE.candles.push(glowSprite(0xffa050, .3, 7.84, .08 + h, FP.z + dz, world, .7));
  }
  const fpHot = HOT.find(h => h.userData.hot.label === "Подбросить дров");
  if (fpHot) { fpHot.userData.hot.label = "Свечи в камине"; fpHot.userData.hot.act = () => { FIRE.boost = 1.5; }; }
}
if (SEASON === "winter") LIGHTS.fire.userData.base *= 1.15;

/* ---------- убранство по сезону ---------- */
const SEASONAL = [];
// гирлянда: лампочки провисают дугами между точками
function garland(points, sag = .07, per = .09, colors = [0xffc860, 0xff5a5a, 0x7ad0ff, 0xa0ff8a]) {
  const pos = [];
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k], b = points[k + 1], n = Math.max(2, Math.round(a.distanceTo(b) / per));
    for (let i = 0; i < n; i++) { const t = i / n; pos.push(V3().lerpVectors(a, b, t).add(V3(0, -Math.sin(Math.PI * t) * sag, 0))); }
  }
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(.014, 8, 6), basic({ toneMapped: false }), pos.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  pos.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m4); im.setColorAt(i, col.setHex(colors[i % colors.length])); });
  world.add(im);
  const cord = new THREE.CatmullRomCurve3(pos);
  mesh(new THREE.TubeGeometry(cord, pos.length * 2, .003, 4), std({ color: 0x0e1a0e }), 0, 0, 0);
  SEASONAL.push({ garland: im, n: pos.length, colors });
  return im;
}
if (FESTIVE) {
  // по карнизу бара и по каминной полке
  const pts = [];
  for (let x = -3.3; x <= 3.31; x += .66) pts.push(V3(x, 2.97, BB.z0 + .46));
  garland(pts, .08);
  if (FEAT.smoke) {
    const mp = [];
    for (let z = FP.z - 1.1; z <= FP.z + 1.11; z += .55) mp.push(V3(7.5, 1.3, z));
    garland(mp, .06);
  }
  // ёлка в углу курилки
  const t = group(4.45, 0, -3.55);
  mesh(new THREE.CylinderGeometry(.05, .06, .3, 8), M.darkwood, 0, .15, 0, t);
  mesh(new THREE.CylinderGeometry(.2, .24, .18, 16), std({ color: 0x5a1414, roughness: .6 }), 0, .09, 0, t);
  const pine = std({ color: 0x173a22, roughness: .9 });
  [[.62, .7, .55], [.5, .6, .95], [.38, .5, 1.3], [.24, .4, 1.6]].forEach(([r, h, y]) => mesh(new THREE.ConeGeometry(r, h, 18), pine, 0, y, 0, t));
  const star = mesh(new THREE.OctahedronGeometry(.07), basic({ color: 0xffd060, toneMapped: false }), 0, 1.86, 0, t);
  star.scale.set(1, 1.3, .4);
  glowSprite(0xffd060, .6, 0, 1.86, 0, t, .7);
  const balls = [], m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < 26; i++) {
    const y = R(.4, 1.55), r = (1.75 - y) * .42 + .04, a = R(0, 6.3);
    balls.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(.032, 12, 8), std({ roughness: .15, metalness: .6, envMapIntensity: 1.5 }), balls.length);
  balls.forEach((b, i) => { m4.makeTranslation(...b); bi.setMatrixAt(i, m4); bi.setColorAt(i, col.setHex([0xb01820, 0xd4a040, 0x2050a0, 0xe8e0d0][i % 4])); });
  t.add(bi);
  const lights = [];
  for (let i = 0; i < 40; i++) { const y = .35 + i / 40 * 1.25, r = (1.75 - y) * .44 + .03, a = i * 2.4; lights.push(V3(Math.cos(a) * r, y, Math.sin(a) * r).add(t.position)); }
  const li = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 6, 5), basic({ toneMapped: false }), lights.length);
  lights.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); li.setMatrixAt(i, m4); li.setColorAt(i, col.setHex(0xffc860)); });
  world.add(li);
  SEASONAL.push({ garland: li, n: lights.length, colors: [0xffc860, 0xffe0a0] });
  glowSprite(0xffb050, 1.6, 4.45, 1.0, -3.55, world, .25);
  // подарки
  [[.25, .2, .22, .18, .1, 0xb01820], [-.22, .16, .18, .16, .08, 0x1f4a7a], [.05, .14, .14, .14, .3, 0xd4a040]].forEach(([x, w, h, d, z, c]) => {
    const g = mesh(new THREE.BoxGeometry(w, h, d), std({ color: c, roughness: .5 }), x, h / 2, z, t);
    mesh(new THREE.BoxGeometry(w + .004, h + .004, .025), std({ color: 0xf0e0b0, roughness: .4 }), 0, 0, 0, g);
  });
  hot(t, 2, "Ёлка", () => { for (const s of SEASONAL) s.boost = 1; }, { grow: .02 });
}
if (SEASON === "winter") {
  // кружки с глинтвейном на стойке
  for (const [x, z] of [[-2.3, -2.3], [-2.15, -2.42]]) {
    const g = group(x, CT.top, z);
    mesh(lathe([[0, 0], [.035, 0], [.038, .09], [.04, .1]], 18), std({ color: 0xf0e8dc, roughness: .3 }), 0, 0, 0, g);
    mesh(new THREE.CylinderGeometry(.034, .034, .004, 18), std({ color: 0x5a0a14, roughness: .15, emissive: 0x2a0408 }), 0, .085, 0, g);
    const h = mesh(new THREE.TorusGeometry(.025, .006, 6, 12, Math.PI), std({ color: 0xf0e8dc }), .04, .05, 0, g);
    h.rotation.z = -Math.PI / 2;
  }
}
if (SEASON === "spring") {
  // ваза с цветами на стойке и веточка на столе писателя
  const vase = (x, y, z, s = 1) => {
    const g = group(x, y, z); g.scale.setScalar(s);
    mesh(lathe([[0, 0], [.04, 0], [.05, .06], [.03, .16], [.035, .2]], 18), std({ color: 0xcfe6e0, transparent: true, opacity: .45, roughness: .05 }), 0, 0, 0, g);
    const stem = std({ color: 0x3a6a2a });
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * 6.28, l = R(.22, .34), tilt = R(.12, .3);
      const st = mesh(new THREE.CylinderGeometry(.003, .003, l, 4), stem, Math.cos(a) * tilt * l / 2, .14 + l / 2, Math.sin(a) * tilt * l / 2, g);
      st.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
      const top = V3(Math.cos(a) * tilt * l, .14 + l, Math.sin(a) * tilt * l);
      for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(.018, 8, 6), std({ color: [0xf2b8c8, 0xfff0f4, 0xe890a8][i % 3], roughness: .7 }), top.x + R(-.015, .015), top.y + R(-.015, .015), top.z + R(-.015, .015), g);
    }
  };
  vase(2.35, CT.top, -2.35, 1.1);
  if (FEAT.nook) vase(WIN.x - .65, .785, -4.2, .8);
}
if (SEASON === "summer") {
  // ведёрко со льдом и шампанским, фрукты
  const g = group(-2.35, CT.top, -2.4);
  mesh(lathe([[0, 0], [.09, 0], [.11, .2], [.115, .21]], 24), M.chrome, 0, 0, 0, g);
  const ice = [];
  for (let i = 0; i < 12; i++) { const c = new RoundedBoxGeometry(.03, .03, .03, 1, .006); c.rotateY(R(0, 3)); c.translate(R(-.07, .07), .2 + R(-.01, .01), R(-.07, .07)); ice.push(c); }
  merged(ice, std({ color: 0xe8f4ff, transparent: true, opacity: .5, roughness: .05 }), g);
  const bot = mesh(BGEO.bordeaux, std({ color: 0x1a2a14, roughness: .1, metalness: .2, envMapIntensity: 1.6 }), .01, .05, 0, g);
  bot.rotation.z = .25; bot.scale.setScalar(1.05);
  for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(.032, 12, 10), std({ color: [0xf0a020, 0xf2d24a][i % 2], roughness: .5 }), -1.25 + Math.cos(i * 1.6) * .05, CT.top + .075, -2.45 + Math.sin(i * 1.6) * .05);
}
if (SEASON === "autumn") {
  // тыквы на каминной полке и у камина
  const pumpkin = (x, y, z, s, c = 0xd2701a) => {
    const g = group(x, y, z); g.scale.setScalar(s);
    const m = std({ color: c, roughness: .6 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; const p = mesh(new THREE.SphereGeometry(.06, 14, 10), m, Math.cos(a) * .045, .055, Math.sin(a) * .045, g); p.scale.set(.75, .9, .75); }
    mesh(new THREE.CylinderGeometry(.008, .012, .04, 6), std({ color: 0x4a3a1a }), 0, .12, 0, g).rotation.z = .3;
  };
  if (FEAT.smoke) {
  pumpkin(7.72, 1.32, FP.z - .6, 1);
  pumpkin(7.72, 1.32, FP.z + .55, .75, 0xb8851e);
  pumpkin(7.4, .04, FP.z - 1.25, 1.6);
  pumpkin(7.55, .04, FP.z - 1.0, 1.1, 0xc06018);
  }
  // кленовые листья на подоконнике
  if (FEAT.nook) for (let i = 0; i < 5; i++) { const l = mesh(new THREE.CircleGeometry(.03, 5), std({ color: [0xc04a10, 0x9a2a0a, 0xd08a1a][i % 3], side: THREE.DoubleSide }), WIN.x + R(-.7, .7), WIN.sill + .003, -4.88 + R(-.05, .05)); l.rotation.set(-Math.PI / 2, 0, R(0, 6)); }
}

/* ---------- меловая доска с сезонным напитком ---------- */
(() => {
  const dr = SEASON_DRINK[SEASON];
  const board = group(2.75, CT.top, -2.18);
  board.rotation.y = -.25;
  const tex = canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = "#1a1f1c"; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1500, .08, "#fff", "#000");
    g.fillStyle = "#e8e2d4"; g.textAlign = "center";
    g.font = "26px Forum, Georgia, serif"; g.globalAlpha = .75; g.fillText(SEASON_INFO[SEASON].name.toUpperCase(), w / 2, 52);
    g.globalAlpha = 1; g.font = "40px Forum, Georgia, serif";
    const words = dr.name.split(" ");
    words.forEach((t, i) => g.fillText(t, w / 2, 124 + i * 46 - (words.length - 1) * 23));
    g.strokeStyle = "rgba(232,226,212,.6)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(60, 200); g.quadraticCurveTo(128, 214, 196, 200); g.stroke();
    g.font = "20px Literata, Georgia, serif"; g.globalAlpha = .8; g.fillText("сезонное предложение", w / 2, 250);
  });
  const frame = mesh(new THREE.BoxGeometry(.26, .32, .02), M.oak, 0, .2, 0, board);
  frame.rotation.x = -.18;
  const face = mesh(new THREE.PlaneGeometry(.22, .28), std({ map: tex, roughness: .95 }), 0, .2, .011, board);
  face.rotation.x = -.18;
  face.position.z = .011 * Math.cos(.18); face.position.y = .2 - .011 * Math.sin(.18);
  hot(board, 1, `Сезонное: ${dr.name}`, () => openCard(dr), { grow: .08 });
})();

/* каждый кадр: огоньки гирлянд переливаются */
const _gc = new THREE.Color();
onTick((t, dt) => {
  const col = _gc;
  for (const s of SEASONAL) {
    if (!s.garland) continue;
    s.boost = Math.max(0, (s.boost || 0) - dt * .3);
    s.ph = (s.ph || 0) + dt * (2.2 + s.boost * 9);
    for (let i = 0; i < s.n; i++) {
      const k = .45 + .55 * Math.max(0, Math.sin(s.ph + i * .9));
      s.garland.setColorAt(i, col.setHex(s.colors[i % s.colors.length]).multiplyScalar(k));
    }
    s.garland.instanceColor.needsUpdate = true;
  }
});
