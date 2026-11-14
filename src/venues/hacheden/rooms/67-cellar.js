/* ================= тайный погреб: книга, шкаф-дверь, лестница вниз, дегустация ================= */
const CEL = { O: V3(-26, 0, 0), on: false, busy: false, open: 0, tasted: new Set() };
const CO = (x, y, z) => V3(CEL.O.x + x, y, CEL.O.z + z);
try { JSON.parse(localStorage.getItem("hacheden-tasted") || "[]").forEach(id => CEL.tasted.add(id)); } catch (e) {}

/* ---------- шкаф-дверь в читальне ---------- */
const SDOOR2 = { g: group(SECRET.hx, 0, SECRET.hz), a: 0 };
(() => {
  const g = SDOOR2.g, px = SECRET.hx, pz = SECRET.hz;
  const shift = gg => { gg.translate(-px, 0, -pz); return gg; };
  merged(SECRET.parts.geos.map(shift), M.walnut, g);
  merged(SECRET.parts.backs.map(shift), std({ color: 0x120a07, roughness: .9 }), g);
  const bk = SECRET.parts.books;
  // одна книга на уровне глаз выдвинута: за неё и тянут
  let pull = bk.reduce((best, b, i) => Math.abs(b.y - 1.48) + Math.abs(b.u - (SECRET.a0 + SECRET.a1) / 2) < best[0] ? [Math.abs(b.y - 1.48) + Math.abs(b.u - (SECRET.a0 + SECRET.a1) / 2), i] : best, [9, -1])[1];
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam({ map: TEX.spine }), bk.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  bk.forEach((b, i) => {
    if (i === pull) { m4.makeScale(0, 0, 0); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(0)); return; }
    q.setFromEuler(e.set(b.lean, 0, 0));
    m4.compose(V3(b.f - px, b.y, b.u - pz), q, V3(b.d, b.h, b.t));
    im.setMatrixAt(i, m4);
    im.setColorAt(i, col.set(b.c).multiplyScalar(R(.8, 1.25)));
  });
  g.add(im);
  const b = bk[pull];
  // книга-рычаг: вишнёвый переплёт, золотое тиснение; петля внизу корешка
  const hinge = group(b.f - px - b.d / 2, b.y - b.h / 2, b.u - pz, g);
  const book = mesh(new THREE.BoxGeometry(b.d, b.h, .05), std({ color: 0x7a0f1e, roughness: .45 }), b.d / 2 + .035, b.h / 2, 0, hinge);
  mesh(new THREE.BoxGeometry(.004, .03, .052), M.brass, b.d + .037, b.h * .7, 0, hinge);
  mesh(new THREE.BoxGeometry(.004, .03, .052), M.brass, b.d + .037, b.h * .3, 0, hinge);
  SDOOR2.lever = hinge;
  if (FEAT.cellar) hot(hinge, 0, "Книга, которая торчит", () => enterCellar(), { grow: .15, secret: true });   // тайник: только в самой сцене, без кнопки внизу
})();
/* потайной ход за стеной: каменные стены, площадка и ступени вниз, свеча */
(() => {
  const stoneM = std({ color: 0x2a2420, roughness: .95 });
  box(-10.6, -8.1, -.02, 0, -.84, .31, stoneM, world, 0);
  box(-10.6, -8.1, 0, 3.6, -.94, -.84, stoneM, world, 0);
  box(-10.6, -8.1, 0, 3.6, .31, .41, stoneM, world, 0);
  box(-10.6, -8.1, 3.5, 3.6, -.84, .31, stoneM, world, 0);
  for (let i = 0; i < 7; i++) box(-9.3 - i * .3 - .3, -9.3 - i * .3, -.02 - (i + 1) * .2 - .2, -(i + 1) * .2, -.84, .31, stoneM, world, 0);
  box(-10.7, -10.6, -2, 3.6, -.84, .31, M.black, world, 0);
  // свеча в нише: тёплый свет зовёт вниз
  const c = group(-9.0, 1.45, -.8);
  mesh(new THREE.CylinderGeometry(.014, .016, .12, 10), M.candle, 0, 0, .03, c);
  CEL.passFlame = mesh(new THREE.ConeGeometry(.009, .035, 8), basic({ color: 0xffd078, toneMapped: false }), 0, .08, .03, c);
  CEL.passGlow = glowSprite(0xffa040, .9, 0, .08, .05, c, .7);
})();

/* ---------- погреб: свод из кирпича, каменный пол ---------- */
TEX.brick = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = "#2a1610"; g.fillRect(0, 0, w, h);
  const bh = 32, bw = 96;
  for (let r = 0; r < h / bh; r++) for (let c = -1; c < w / bw + 1; c++) {
    const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh;
    const v = R(.75, 1.15), red = 108 * v, gr = 52 * v, bl = 36 * v;
    g.fillStyle = `rgb(${red | 0},${gr | 0},${bl | 0})`;
    g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(0,0,0,${R(.05, .2)})`; g.fillRect(x + R(4, bw - 8), y + R(4, bh - 8), R(2, 8), R(1, 4)); }
    if (rng() < .12) { g.fillStyle = "rgba(220,210,190,.12)"; g.fillRect(x + 3, y + R(4, 20), bw - 6, R(2, 6)); }
  }
}, { repeat: [1, 1] });
TEX.flags = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = "#1a1714"; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 128) for (let x = (y / 128) % 2 ? -64 : 0; x < w; x += 128) {
    const v = R(.8, 1.2); g.fillStyle = `rgb(${58 * v | 0},${52 * v | 0},${46 * v | 0})`; g.fillRect(x + 4, y + 4, 120, 120);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${R(.04, .14)})`; g.beginPath(); g.arc(x + R(8, 120), y + R(8, 120), R(2, 10), 0, 7); g.fill(); }
  }
});
const CM = {
  brick: std({ map: TEX.brick, roughness: .92 }),
  flags: std({ map: TEX.flags, roughness: .8, envMapIntensity: .4 }),
  barrel: std({ map: TEX.oak, color: 0x9a6a46, roughness: .7 }),
  hoop: std({ color: 0x2a2624, metalness: .8, roughness: .5 }),
  rackWood: std({ map: TEX.darkwood, roughness: .75 }),
  chalk: std({ color: 0xe8e2d6, roughness: 1 })
};
(() => {
  const g = group(CEL.O.x, 0, CEL.O.z);
  const W = 4, Z0 = -3.6, Z1 = 3.4, SPR = 2.2, RISE = 1.6;
  // пол
  const fl = mesh(new THREE.PlaneGeometry(2 * W, Z1 - Z0), CM.flags, 0, 0, (Z0 + Z1) / 2, g);
  fl.rotation.x = -Math.PI / 2;
  fl.material.map.repeat.set(4, 3.5);
  // стены до пяты свода
  const brick = (w, h) => { const m = CM.brick.clone(); m.map = TEX.brick.clone(); m.map.needsUpdate = true; m.map.repeat.set(w / 1.6, h / 1.6); return m; };
  for (const sx of [-1, 1]) { const m = mesh(new THREE.PlaneGeometry(Z1 - Z0, SPR), brick(Z1 - Z0, SPR), sx * W, SPR / 2, (Z0 + Z1) / 2, g); m.rotation.y = -sx * Math.PI / 2; }
  // свод: полуэллипс поперёк, вдоль z
  const vg = new THREE.CylinderGeometry(W, W, Z1 - Z0, 40, 1, true, -Math.PI / 2, Math.PI);
  vg.rotateX(-Math.PI / 2); vg.scale(1, RISE / W, 1);
  const vault = mesh(vg, brick(12, 7), 0, SPR, (Z0 + Z1) / 2, g);
  vault.material.side = THREE.BackSide;
  // арки-рёбра свода
  for (const z of [-2.2, -.2, 1.8]) {
    const tg = new THREE.TorusGeometry(W - .02, .09, 8, 40, Math.PI); tg.scale(1, RISE / W, 1);
    mesh(tg, CM.rackWood, 0, SPR, z, g);
  }
  // торцевые стены: прямоугольник и лунета
  const endWall = z => {
    const sh = new THREE.Shape();
    sh.moveTo(-W, 0); sh.lineTo(W, 0); sh.lineTo(W, SPR);
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; sh.lineTo(Math.cos(a) * W, SPR + Math.sin(a) * RISE); }
    sh.lineTo(-W, 0);
    if (z < 0) { const hole = new THREE.Path(); hole.moveTo(2.75, 1.55); hole.lineTo(3.75, 1.55); hole.lineTo(3.75, 2.55); hole.absarc(3.25, 2.55, .5, 0, Math.PI, false); hole.lineTo(2.75, 1.55); sh.holes.push(hole); }
    const geo = new THREE.ShapeGeometry(sh, 24);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.6, uv.getY(i) / 1.6);
    const m = mesh(geo, CM.brick, 0, 0, z, g);
    if (z > 0) m.rotation.y = Math.PI;
  };
  endWall(Z0); endWall(Z1);
  // проём лестницы в задней стене: тьма и отсвет свечи
  mesh(new THREE.PlaneGeometry(1.1, 1.6), basic({ color: 0x050302 }), 3.25, 2.35, Z0 - .05, g);
  glowSprite(0xffa040, .7, 3.6, 2.4, Z0 - .02, g, .45);

  // каменная лестница вдоль правой стены: сверху у задней стены вниз к столу
  const stoneM = std({ color: 0x3a342e, roughness: .9 });
  const steps = [];
  for (let i = 0; i < 8; i++) { const y = 1.55 - i * .195, z = Z0 + .2 + i * .36; steps.push(boxAt(2.7, 3.95, 0, y, z, z + .36, .5)); }
  merged(steps, stoneM, g);
  // перила-канат на латунных стойках
  for (let i = 0; i < 4; i++) { const z = Z0 + .5 + i * .85, y = 1.55 - i * .45; mesh(new THREE.CylinderGeometry(.012, .012, .9, 6), M.brass, 2.72, y + .45, z, g); }
  const rope = new THREE.CatmullRomCurve3([V3(2.72, 2.45, Z0 + .5), V3(2.72, 2.2, Z0 + 1.35), V3(2.72, 1.75, Z0 + 2.2), V3(2.72, 1.35, Z0 + 3.05)]);
  mesh(new THREE.TubeGeometry(rope, 24, .014, 6), std({ color: 0x8a6a3a, roughness: .9 }), 0, 0, 0, g);

  // стеллажи с вином вдоль задней стены: ячейки, бутылки лежат донышками к нам
  const rack = [];
  const RX0 = -3.5, RX1 = 2.4, RY1 = 2.05, cell = .135;
  const nx = Math.floor((RX1 - RX0) / cell), ny = Math.floor(RY1 / cell);
  for (let i = 0; i <= nx; i++) rack.push(boxAt(RX0 + i * cell - .008, RX0 + i * cell + .008, 0, ny * cell, Z0, Z0 + .42, .4));
  for (let j = 0; j <= ny; j++) rack.push(boxAt(RX0, RX0 + nx * cell, j * cell - .008, j * cell + .008, Z0, Z0 + .42, .4));
  rack.push(boxAt(RX0 - .03, RX0 + nx * cell + .03, ny * cell, ny * cell + .05, Z0, Z0 + .46, .4));
  merged(rack, CM.rackWood, g);
  const bot = new THREE.CylinderGeometry(.037, .037, .3, 14); bot.rotateX(Math.PI / 2);
  const neck = new THREE.CylinderGeometry(.013, .016, .1, 8); neck.rotateX(Math.PI / 2); neck.translate(0, 0, -.2);
  const bgeo = mergeGeometries([(bot.index ? bot.toNonIndexed() : bot), (neck.index ? neck.toNonIndexed() : neck)]);
  const bm = new THREE.InstancedMesh(bgeo, std({ color: 0xffffff, roughness: .12, metalness: .2, envMapIntensity: 1.6 }), nx * ny);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), GL = [0x1a2a14, 0x14200f, 0x2a140a, 0x101010, 0x3a1a0a, 0x1f2a1a];
  let n = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (rng() < .08) continue;
    m4.makeTranslation(RX0 + (i + .5) * cell, (j + .5) * cell, Z0 + .26 + R(-.02, .02));
    bm.setMatrixAt(n, m4);
    const dusty = rng() < .35;
    bm.setColorAt(n, col.setHex(pickOne(GL)).lerp(new THREE.Color(0x8a8070), dusty ? R(.25, .45) : 0));
    n++;
  }
  bm.count = n;
  g.add(bm);
  // меловые таблички на стеллаже
  const chalkTex = (txt) => canvasTex(256, 96, (c, w, h) => { c.fillStyle = "#1a1a18"; c.fillRect(0, 0, w, h); c.strokeStyle = "#8a6a3a"; c.lineWidth = 8; c.strokeRect(0, 0, w, h); c.fillStyle = "#e8e2d6"; c.font = "400 44px Literata, serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, w / 2, h / 2 + 2); });
  [["BORDEAUX", -2.9], ["PORTO", -1.6], ["JEREZ", -.3], ["CHAMPAGNE", 1.0]].forEach(([t, x]) => mesh(new THREE.PlaneGeometry(.42, .16), std({ map: chalkTex(t), roughness: 1 }), x, ny * cell + .14, Z0 + .47, g));

  // бочки на левой стене: три внизу, две сверху; днища к залу с меловыми цифрами
  const barrelG = lathe([[0, -.42], [.27, -.42], [.31, -.3], [.335, -.12], [.34, 0], [.335, .12], [.31, .3], [.27, .42], [0, .42]], 28);
  barrelG.rotateZ(Math.PI / 2);
  const hoopG = [];
  for (const y of [-.36, -.24, .24, .36]) { const t = new THREE.TorusGeometry(y > .3 || y < -.3 ? .285 : .325, .012, 6, 28); t.rotateY(Math.PI / 2); t.translate(y, 0, 0); hoopG.push(t); }
  const hoopM = mergeGeometries(hoopG.map(x => (x.index ? x.toNonIndexed() : x)));
  const marks = ["1912", "1921", "1924", "XO", "№7"];
  [[-3.55, .36, -1.75], [-3.55, .36, -1.05], [-3.55, .36, -.35], [-3.55, .98, -1.4], [-3.55, .98, -.7]].forEach(([x, y, z], i) => {
    const b = group(x + .42, y, z, g);
    b.rotation.y = 0;
    mesh(barrelG, CM.barrel, 0, 0, 0, b);
    mesh(hoopM, CM.hoop, 0, 0, 0, b);
    const head = mesh(new THREE.CircleGeometry(.27, 28), std({ map: chalkTex(marks[i]), color: 0xb08a5a, roughness: .8 }), .421, 0, 0, b);
    head.rotation.y = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(.018, .018, .03, 8), CM.rackWood, .43, -.17, 0, b).rotation.z = Math.PI / 2;
  });

  // дегустационный стол, лавка и стул
  const T = { x0: -1.0, x1: 1.0, z0: -.45, z1: .42, top: .78 };
  merged([boxAt(T.x0, T.x1, T.top - .06, T.top, T.z0, T.z1, .5),
    ...[[T.x0 + .08, T.z0 + .08], [T.x1 - .08, T.z0 + .08], [T.x0 + .08, T.z1 - .08], [T.x1 - .08, T.z1 - .08]].map(([x, z]) => boxAt(x - .05, x + .05, 0, T.top - .06, z - .05, z + .05, .5)),
    boxAt(T.x0 + .1, T.x1 - .1, .12, .18, -.03, .03, .5)], std({ map: TEX.oak, color: 0x7a5232, roughness: .5, envMapIntensity: .6 }), g);
  CEL.T = T;
  // подсвечник на три свечи
  const cand = group(.45, T.top, -.1, g);
  mesh(lathe([[0, 0], [.07, 0], [.075, .012], [.02, .03], [.014, .2], [.02, .22]], 16), M.brass, 0, 0, 0, cand);
  const arm = new THREE.TorusGeometry(.1, .008, 6, 20, Math.PI); arm.rotateX(Math.PI); arm.translate(0, .3, 0);
  mesh(arm, M.brass, 0, 0, 0, cand);
  CEL.flames = [];
  for (const dx of [-.1, 0, .1]) {
    const yy = dx ? .31 : .36;
    mesh(new THREE.CylinderGeometry(.013, .013, .1, 10), M.candle, dx, yy + .05, 0, cand);
    const f = mesh(new THREE.ConeGeometry(.008, .032, 8), basic({ color: 0xffd078, toneMapped: false }), dx, yy + .118, 0, cand);
    CEL.flames.push([f, glowSprite(0xffa040, .36, dx, yy + .12, 0, cand, .8)]);
  }
  // сырная доска и виноград
  const board = group(-.55, T.top, .1, g);
  mesh(new RoundedBoxGeometry(.32, .02, .2, 2, .006), CM.rackWood, 0, .01, 0, board);
  for (let i = 0; i < 3; i++) { const w = mesh(new THREE.CylinderGeometry(.05, .05, .05, 20, 1, false, 0, Math.PI * .6), std({ color: 0xe8c86a, roughness: .7 }), -.08 + i * .07, .045, -.02, board); w.rotation.y = i; }
  for (let i = 0; i < 12; i++) mesh(new THREE.SphereGeometry(.012, 8, 6), std({ color: 0x4a1a3a, roughness: .3 }), .09 + R(-.03, .03), .035 + (i % 3) * .015, .05 + R(-.03, .03), board);
  // пыльные паутинки в углах свода
  const webT = canvasTex(128, 128, (c, w, h) => { c.strokeStyle = "rgba(220,215,200,.35)"; c.lineWidth = 1; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i / 8 * Math.PI / 2) * 128, Math.sin(i / 8 * Math.PI / 2) * 128); c.stroke(); } for (let r = 20; r < 128; r += 18) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI / 2); c.stroke(); } });
  for (const [x, z, ry] of [[-3.9, Z0 + .05, 0], [3.9, Z1 - .05, Math.PI]]) { const wb = mesh(new THREE.PlaneGeometry(.6, .6), new THREE.MeshBasicMaterial({ map: webT, transparent: true, depthWrite: false }), x + (ry ? -.3 : .3), SPR + .1, z, g); wb.rotation.set(0, ry, ry ? Math.PI / 2 : -Math.PI / 2); }
  // стулья гостя (камера сидит здесь) и бра на стенах
  for (const [x, z] of [[-3.95, 1.0], [3.95, .4]]) {
    const s = group(x, 1.7, z, g);
    mesh(new THREE.BoxGeometry(.04, .2, .12), M.brass, 0, 0, 0, s);
    mesh(new THREE.CylinderGeometry(.014, .014, .1, 8), M.candle, x < 0 ? .06 : -.06, .1, 0, s);
    glowSprite(0xffa040, .5, x < 0 ? .06 : -.06, .18, 0, s, .7);
  }
  CEL.g = g;
})();

/* ---------- сомелье: зелёный фартук, серебряный тастевен на цепочке ---------- */
const SOM = makeFigure({ kind: "vest", body: "#1a2a20", shirt: "#ece6d8", skin: 0xd09a7a, hair: 0x8a8278, hairStyle: "slick", mustache: true, bowtie: 0x3a0a10, rolled: false, fingers: true });
placeFig(SOM, CEL.O.x, CEL.O.z - .64, 0);
SOM.off = true;
SOM.lines = ["В годы сухого закона в Америке, с 1920 по 1933-й, такие погреба прятали за фальшивыми стенами и книжными шкафами.", "Серебряная чашечка на цепочке — тастевен. Раньше сомелье пробовали из неё вино при свечах.", "Вино в погребе лежит на боку: пробка остаётся влажной и не пропускает воздух."];
(() => {
  const ap = new THREE.PlaneGeometry(.42, .7, 6, 1), p = ap.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.cos(p.getX(i) / .21 * 1.2) * .03);
  ap.computeVertexNormals();
  mesh(ap, std({ color: 0x14301e, roughness: .85, side: THREE.DoubleSide }), 0, -.3, .1, SOM.pelvis);
  const chain = new THREE.CatmullRomCurve3([V3(-.06, .48, .06), V3(0, .36, .14), V3(.06, .48, .06)]);
  mesh(new THREE.TubeGeometry(chain, 16, .002, 4), M.brass, 0, 0, 0, SOM.spine);
  mesh(lathe([[0, 0], [.03, 0], [.034, .012], [.032, .016]], 16), std({ color: 0xd8dde2, metalness: 1, roughness: .2 }), 0, .345, .14, SOM.spine).rotation.x = 1.2;
})();
hot(SOM.root, 4, "Сомелье", () => { if (!CEL.busy) say(SOM, lineOf(SOM), 7); }, { grow: 0 });

/* ---------- вина для дегустации: правдивые истории ---------- */
const WINES = [
  { id: "champagne", name: "Шампанское", label: "CHAMPAGNE · BRUT", glass: "flute", col: 0xf0dc8a, op: .55, bottle: 0x1e3018, foil: 0xc8a050, ml: 90, bubbles: true,
    line: "Шампанское. В 1816 году вдова Клико придумала пюпитр для ремюажа: бутылки день за днём поворачивают горлышком вниз, осадок собирается у пробки, и вино становится прозрачным.",
    taste: "Пузырьки тонкие и долгие. Во вкусе яблоко, бриошь и свежая кислинка." },
  { id: "bordeaux", name: "Красное бордо", label: "BORDEAUX · MÉDOC", glass: "wine", col: 0x5a0a1c, op: .93, bottle: 0x14100c, foil: 0x5a0a14, ml: 110,
    line: "Красное бордо. В 1855 году, к Всемирной выставке в Париже, лучшие винодельни Медока разделили на пять классов — с тех пор этот список почти не менялся.",
    taste: "Чёрная смородина, кедр и табачный лист. Танины мягкие от долгой выдержки." },
  { id: "port", name: "Портвейн", label: "PORTO · DOURO", glass: "copita", col: 0x6e0f20, op: .95, bottle: 0x0e0a08, foil: 0x8a1018, ml: 60,
    line: "Портвейн из долины Дору. Брожение останавливают виноградным спиртом, поэтому вино остаётся сладким и крепким. Границы этого винодельческого края провели ещё в 1756 году — одни из первых в мире.",
    taste: "Изюм, слива, горький шоколад и тёплая пряность. Его пьют медленно." },
  { id: "sherry", name: "Херес", label: "JEREZ · FINO", glass: "copita", col: 0xe8d898, op: .6, bottle: 0x2a3a1a, foil: 0xe8dcc0, ml: 60,
    line: "Херес из Андалусии. Его выдерживают по системе солера: бочки стоят ярусами, вино понемногу переливают из молодых в старые, и в каждой бутылке встречаются урожаи многих лет.",
    taste: "Сухой фино: миндаль, солёный морской ветер и хлебная корочка." }
];
const WGLASS = {
  flute: { p: [[0, 0], [3.2, 0], [3.2, .3], [.5, .8], [.35, 9], [1.2, 9.6], [2.2, 12], [2.4, 17], [2.2, 21]], liq: [1.1, 2.2, 10.2, 19.5], cap: 150 },
  wine: { p: CUPS.wine.p, liq: CUPS.wine.liq, cap: 300 },
  copita: { p: [[0, 0], [2.8, 0], [2.8, .3], [.5, .8], [.35, 6.5], [2, 7.6], [2.9, 10], [2.4, 13]], liq: [1.8, 2.7, 7.8, 11], cap: 110 }
};
const wineLabel = w => canvasTex(512, 200, (g, W, H) => {
  g.fillStyle = "#efe6d2"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#8a6a3a"; g.lineWidth = 6; g.strokeRect(14, 14, W - 28, H - 28);
  g.fillStyle = "#3a1a10"; g.textAlign = "center"; g.textBaseline = "middle";
  const [a, b] = w.label.split(" · ");
  g.font = "400 58px Forum, serif"; g.fillText(a, W / 2, 80);
  g.font = "italic 400 30px Literata, serif"; g.fillText(b, W / 2, 140);
});
function wineBottle(w) {
  const g = new THREE.Group();
  const shape = w.id === "champagne" ? "round" : w.id === "port" ? "tall" : "bordeaux";
  const s = w.id === "champagne" ? 1.15 : 1;
  const b = new THREE.Mesh(BGEO[shape], std({ color: w.bottle, roughness: .08, metalness: .15, envMapIntensity: 2.2 }));
  b.scale.setScalar(s); g.add(b);
  const r = bodyR(shape) * s, top = neckTop(shape) * s;
  const lab = mesh(new THREE.CylinderGeometry(r * 1.015, r * 1.015, .085, 32, 1, true), std({ map: wineLabel(w), roughness: .8 }), 0, .1 * s, 0, g);
  lab.rotation.y = Math.PI;
  mesh(new THREE.CylinderGeometry(.016, .017, .07, 14), std({ color: w.foil, metalness: .6, roughness: .35 }), 0, top - .03, 0, g);
  g.userData = { top: top + .005, r, ing: null };
  world.add(g);
  return g;
}
const WB = WINES.map((w, i) => { const b = wineBottle(w); b.position.copy(CO(-.56 + i * .125, CEL.T.top, -.36)); b.userData.home = b.position.clone(); return b; });

/* ---------- свет: на время спуска переносим лампы из залов вниз ---------- */
const CLT = { saved: null };
function cellarLights(on) {
  const L = [LIGHTS.pendL, LIGHTS.pendC, LIGHTS.pendR, LIGHTS.lamp];
  if (on && !CLT.saved) {
    CLT.saved = L.map(l => ({ p: l.position.clone(), c: l.color.clone(), d: l.distance, b: l.userData.base }));
    const spots = [[CO(.45, 1.35, -.1), 0xffb060, 3.2, 5], [CO(-3.7, 1.95, 1.0), 0xff9a50, 2.4, 5.5], [CO(3.7, 1.95, .4), 0xff9a50, 2.2, 5.5], [CO(.3, 2.6, -2.6), 0xffa868, 2.0, 6]];
    L.forEach((l, i) => { const [p, c, b, d] = spots[i]; l.position.copy(p); l.color.setHex(c); l.distance = d; l.userData.base = b; l.intensity = b; });
    LIGHTS.lamp.userData.mul = 1;
  } else if (!on && CLT.saved) {
    L.forEach((l, i) => { const s = CLT.saved[i]; l.position.copy(s.p); l.color.copy(s.c); l.distance = s.d; l.userData.base = s.b; l.intensity = s.b; });
    LIGHTS.lamp.userData.mul = NOOK.candleOn ? 1 : .35;
    CLT.saved = null;
    applyTime();
  }
}
onTick((t, dt) => {
  // свечи погреба и хода дрожат
  if (CEL.on) {
    CEL.flames.forEach(([f, gl], i) => { const n = .85 + .15 * Math.sin(t * 13 + i * 2) + .08 * Math.sin(t * 29 + i); f.scale.set(1, n, 1); gl.material.opacity = .65 * n; });
    LIGHTS.pendC.intensity = 3.2 * (.9 + .08 * Math.sin(t * 11) + .05 * Math.sin(t * 23));
    if (Math.random() < dt * .25) drip();
  }
  if (CEL.passFlame) CEL.passFlame.scale.y = .85 + .15 * Math.sin(t * 12);
  // пузырьки в шампанском
  if (CEL.fizz && CEL.fizz.g.parent) {
    const F = CEL.fizz;
    F.pts.forEach(p => { p.position.y += dt * (.04 + p.userData.v); if (p.position.y > F.top) { p.position.y = F.y0; } });
  }
});

/* ---------- звуки погреба ---------- */
const CSND = {
  click: () => { noiseHit(0, .04, 2400, 6, .3); noiseHit(.06, .03, 1800, 6, .2); },
  rumble: dur => {
    const c = fx(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let v = 0; for (let i = 0; i < len; i++) { v = v * .97 + (Math.random() * 2 - 1) * .2; d[i] = v * Math.sin(Math.PI * i / len) * (1 + .5 * Math.sin(i / 900)); }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = "lowpass"; f.frequency.value = 320; g.gain.value = 1.6;
    s.connect(f).connect(g).connect(c.destination); s.start();
    for (let i = 0; i < dur * 3; i++) noiseHit(i / 3 + rr(0, .2), .12, rr(500, 900), 3, .12);
  },
  steps: n => { for (let i = 0; i < n; i++) { noiseHit(i * .42, .09, 260, 2, .5, "lowpass"); noiseHit(i * .42 + .02, .05, 1400, 3, .08); } },
  pop: () => { const c = fx(); if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(260, t + .08); g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.0001, t + .12); o.connect(g).connect(c.destination); o.start(t); o.stop(t + .15); noiseHit(.03, .5, 6000, .6, .08, "highpass"); }
};
function drip() {
  const c = fx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + R(0, .3), f = R(1300, 2100);
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + .05);
  g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + .2);
}

/* ---------- вход: книга, шкаф поворачивается, ход вниз ---------- */
async function bookcaseTo(open, dur = 2.4) {
  if (open) { CSND.click(); await tween(SDOOR2.lever.rotation, { z: -.38 }, .35, ease.out); await sleep(.25); CSND.rumble(dur); }
  const target = open ? Math.PI / 2 * .96 : 0;
  // пыль осыпается с верхней полки
  if (open && !STILL) for (let i = 0; i < 18; i++) {
    const s = glowSprite(0xd8c8b0, .03, SECRET.hx + R(.05, .3), R(2.6, 3.3), R(SECRET.a0, SECRET.a1), world, .5);
    tween(s.position, { y: R(.2, 1.5) }, R(1.2, 2.2), ease.in);
    tween(s.material, { opacity: 0 }, R(1.4, 2.4), ease.in).then(() => drop(s));
  }
  await tween(SDOOR2.g.rotation, { y: target }, STILL ? 0 : dur, ease.io);
  if (!open) SDOOR2.lever.rotation.z = 0;
  CEL.open = open ? 1 : 0;
}
async function enterCellar() {
  track("secret", "cellar");
  if (CEL.busy || busy) return;
  CEL.busy = true;
  hideTip();
  hintEl.textContent = "Кажется, эта книга ничего не весит…";
  await flyTo(framed({ pos: [-5.3, 1.55, .55], tgt: [-7.9, 1.35, -.32], span: 2.4, pull: .6 }), 1.4, .2);
  await bookcaseTo(true);
  hintEl.textContent = "За шкафом — ступени вниз.";
  await flyTo(framed({ pos: [-7.6, 1.6, -.3], tgt: [-10, 1.0, -.3], span: 1.6, pull: 0 }), 1.6, 0);
  CEL.busy = false;
  goZone(4);
}
/* переход между погребом и залами: через затемнение */
async function cellarCross(i) {
  CEL.busy = true;
  const into = i === 4;
  await fade(true, .7);
  if (into) {
    CSND.steps(6);
    CEL.on = true; SOM.off = false;
    cellarLights(true);
    LIGHTS.fill.intensity = LIGHTS.fill.userData.base * .22;
    // камера на верхней ступени, потом спускается к столу
    setCam(framed({ pos: [CO(3.3, 3.0, -3.0).x, 3.0, CO(0, 0, -3.0).z], tgt: [CO(.0, 0, 0).x, 1.0, CO(0, 0, .2).z], span: 4, pull: 0 }));
    await sleep(STILL ? 0 : .9);
    fade(false, 1.2);
    await flyTo(framed(4), STILL ? 0 : 3.2, .1);
    try { localStorage.setItem("hacheden-cellar", "1"); } catch (e) {}
    CEL.busy = false;
    greet();
  } else {
    endTasting();
    CEL.on = false; SOM.off = true;
    cellarLights(false);
    LIGHTS.fill.intensity = LIGHTS.fill.userData.base;
    setCam(framed(i));
    if (CEL.open) { SDOOR2.g.rotation.y = 0; SDOOR2.lever.rotation.z = 0; CEL.open = 0; }
    await sleep(STILL ? 0 : .3);
    await fade(false, .8);
    CEL.busy = false;
  }
}

/* ---------- дегустация ---------- */
function celAnswers(list) {
  talkEl.innerHTML = "";
  list.forEach(([label, fn, quiet], i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    if (quiet) b.className = "quiet";
    b.style.animationDelay = (i * .07) + "s";
    b.addEventListener("click", () => { if (CEL.on && !CEL.busy) fn(); });
    talkEl.appendChild(b);
  });
  talkEl.hidden = !list.length;
  app.classList.toggle("seated", !!list.length);
}
function menu() {
  const left = WINES.filter(w => !CEL.tasted.has(w.id));
  celAnswers([...WINES.map(w => [(CEL.tasted.has(w.id) ? "✓ " : "") + w.name, () => taste(w)]), ["Подняться наверх", () => goZone(0), true]]);
  if (!left.length) hintEl.textContent = "Все четыре вина погреба попробованы.";
}
async function greet() {
  somRest();
  SOM.look = camera.position;
  await sleep(.4);
  say(SOM, CEL.tasted.size ? "Снова к нам? Погреб всегда открыт для тех, кто нашёл книгу." : "Добро пожаловать в погреб. Немногие находят эту книгу. Что налить?", 6);
  menu();
}
function endTasting() {
  celAnswers([]);
  app.classList.remove("seated");
  if (CEL.glass) { drop(CEL.glass.g); CEL.glass = null; }
  if (CEL.fizz) { CEL.fizz.g.parent && CEL.fizz.g.parent.remove(CEL.fizz.g); CEL.fizz = null; }
  for (const a of [SOM.L, SOM.R]) { HANDS.delete(a); a.manual = false; a.snap = false; a.k = 9; }
  streamOff();
  WB.forEach(b => { b.position.copy(b.userData.home); b.quaternion.identity(); });
}
function somRest() {
  const T = CEL.T;
  handTo(SOM.L, CO(.2, T.top + .03, -.36), V3(-.3, -.1, 1), V3(0, -1, 0), "relax", .5, SOM).catch(() => {});
  handTo(SOM.R, CO(-.2, T.top + .03, -.36), V3(.3, -.1, 1), V3(0, -1, 0), "relax", .5, SOM).catch(() => {});
}
async function taste(w) {
  if (CEL.busy) return;
  CEL.busy = true;
  celAnswers([]);
  app.classList.add("seated");
  const T = CEL.T, R_ = SOM.R, L_ = SOM.L;
  // убрать прошлый бокал
  if (CEL.glass) { const old = CEL.glass; CEL.glass = null; tween(old.g.scale, { x: .001, y: .001, z: .001 }, .3).then(() => drop(old.g)); }
  if (CEL.fizz) { CEL.fizz.g.parent && CEL.fizz.g.parent.remove(CEL.fizz.g); CEL.fizz = null; }
  // новый бокал перед гостем
  const gd = WGLASS[w.glass];
  const G = vessel(gd.p.map(([r, y]) => [r / 100, y / 100]), MX.glass, [...gd.liq.map(v => v / 100), gd.cap], { scale: 1.2 });
  G.g.position.copy(CO(-.02, T.top, -.1)); G.g.visible = true;
  G.g.scale.setScalar(.001); tween(G.g.scale, { x: 1.2, y: 1.2, z: 1.2 }, .35, ease.out);
  CEL.glass = G;
  const shot = (pos, tgt, span, d = 1.1) => flyTo(framed({ pos, tgt, span, pull: 0 }), STILL ? 0 : d, 0);
  shot([CO(-.15, 0, 0).x, 1.22, CO(0, 0, .85).z], [CO(-.25, 0, 0).x, 1.0, CO(0, 0, -.3).z], 1.1);
  // бутылку — с края стола, этикеткой к гостю
  const b = WB[WINES.indexOf(w)], u = b.userData;
  SOM.look = b.position;
  await grip(R_, b, wrap(-1, V3(0, u.top * .42, 0), u.r, { F: SOM }), .5);
  await move(b, CO(-.3, T.top + .22, -.12), { q: Qe(0, Math.PI * .1, 0), dur: .6, arc: .05 });
  SOM.look = camera.position;
  say(SOM, w.name + ".", 1.6);
  await sleep(STILL ? 0 : 1.1);
  if (w.id === "champagne") {
    // пробка с тихим вздохом, как положено
    CSND.pop();
    const sm = glowSprite(0xe8e8e8, .06, 0, u.top + .01, 0, b, .5);
    tween(sm.scale, { x: .16, y: .16 }, .6); tween(sm.material, { opacity: 0 }, .6).then(() => b.remove(sm));
    await sleep(STILL ? 0 : .4);
  }
  // налить
  shot([CO(.25, 0, 0).x, 1.12, CO(0, 0, .55).z], [CO(-.05, 0, 0).x, .98, CO(0, 0, -.05).z], .55, .9);
  SOM.look = mouth(G);
  const col = new THREE.Color(w.col), m0 = 0;
  G.liq.material.opacity = w.op;
  G.col.copy(col);
  await pourFrom(b, V3(0, u.top, 0), () => surface(G), w.ml, col, { gap: rr(.05, .08), ang: -2.05, rate: w.bubbles ? .55 : .75, w: .9,
    fill: k => { G.ml = m0 + w.ml * k; setLevel(G); G.liq.material.opacity = w.op; } });
  // назад на стол
  await move(b, b.userData.home, { q: Qe(0, 0, 0), dur: .55, arc: .05 });
  letGo(R_);
  if (w.bubbles) {
    const fz = { g: new THREE.Group(), pts: [], y0: G.y0 + .01, top: G.y0 + (G.y1 - G.y0) * clamp(G.ml / G.cap, 0, .94) - .005 };
    for (let i = 0; i < 26; i++) { const p = mesh(new THREE.SphereGeometry(.0018, 6, 4), basic({ color: 0xfff6d8, transparent: true, opacity: .8 }), R(-.004, .004), R(fz.y0, fz.top), R(-.004, .004), fz.g); p.userData.v = R(0, .05); fz.pts.push(p); }
    G.g.add(fz.g); CEL.fizz = fz;
  }
  // сомелье берёт бокал за ножку, кружит вино и смотрит его на свет свечей
  await grip(L_, G.g, wrap(1, V3(0, .045, 0), .006, { pose: "pinch", along: .05, F: SOM }), .45);
  const p0 = G.g.position.clone();
  await move(G.g, p0.clone().add(V3(0, .04, 0)), { dur: .3 });
  await waitTicks(1.4, (k, t) => { const a = t * 11; G.g.position.set(p0.x + Math.cos(a) * .012, p0.y + .04, p0.z + Math.sin(a) * .012); G.liq.rotation.y = a; });
  const light = CO(.17, T.top + .3, .12);
  shot([CO(-.35, 0, 0).x, 1.3, CO(0, 0, .5).z], [CO(.1, 0, 0).x, 1.18, CO(0, 0, -.2).z], .7, 1.0);
  await move(G.g, light, { q: Qz(.25), dur: .7, arc: .03 });
  SOM.look = G.g.position;
  await sleep(STILL ? 0 : 1.2);
  await move(G.g, p0, { q: Qe(0, 0, 0), dur: .6, arc: .03 });
  letGo(L_);
  somRest();
  // история и вкус
  shot([CO(0, 0, 0).x, 1.25, CO(0, 0, 1.35).z], [CO(-.05, 0, 0).x, 1.15, CO(0, 0, -.5).z], 1.6, 1.0);
  SOM.look = camera.position;
  say(SOM, w.line, 11);
  await sleep(STILL ? 0 : 6.5);
  say(SOM, w.taste, 7);
  CEL.tasted.add(w.id);
  try { localStorage.setItem("hacheden-tasted", JSON.stringify([...CEL.tasted])); } catch (e) {}
  track("count", "wine");
  if (CEL.tasted.size === WINES.length) setTimeout(() => { if (CEL.on) say(SOM, "Вы попробовали все четыре. Теперь вы знаете погреб лучше многих завсегдатаев.", 6); }, 7000);
  CEL.busy = false;
  menu();
}
Object.assign(H3D, { cel: CEL, enterCellar });
