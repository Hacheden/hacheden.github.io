/* ================= пенка от ананаса и долька ананаса на ободке =================
   Ананасовый сок, встряхнутый со льдом, даёт густую шелковистую пенку: после процеживания
   она поднимается над напитком и дальше держится на поверхности, опускаясь вместе с ней
   при каждом глотке. Гарнир — настоящая долька ананаса с коркой и листьями. */
const FOAM = { T: .0085 };
FOAM.tex = canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = "#f6ead4"; g.fillRect(0, 0, w, h);
  // пузырьки разного размера: тень по нижнему краю, блик сверху
  for (let i = 0; i < 1400; i++) {
    const x = rng() * w, y = rng() * h, r = rng() < .85 ? R(.8, 2.2) : R(2.6, 4.6);
    g.globalAlpha = R(.25, .5);
    g.strokeStyle = "#b89a74"; g.lineWidth = .9; g.beginPath(); g.arc(x, y + r * .15, r, .2, 2.9); g.stroke();
    g.globalAlpha = R(.5, .9);
    g.strokeStyle = "#ffffff"; g.lineWidth = .8; g.beginPath(); g.arc(x, y - r * .1, r * .75, 3.5, 5.9); g.stroke();
  }
  g.globalAlpha = 1;
}, { repeat: [4, 1] });
// купол: плоское дно, мягко скруглённый край и чуть выпуклая середина
FOAM.geo = lathe([[0, 0], [1, 0], [1, .38], [.95, .66], [.8, .85], [.5, .96], [0, 1]], 40);
FOAM.mat = std({ map: FOAM.tex, bumpMap: FOAM.tex, bumpScale: 1.2, roughness: .85 });
FOAM.proto = mesh(FOAM.geo, FOAM.mat, 0, -10, 0);   // для прогрева шейдера
FOAM.proto.visible = false;

const eggy = c => !!c && (PROGS()[c.id] || []).some(s => s[0] === "egg");
const foamy = c => !!c && (eggy(c) || c.need && c.need.includes("pineapple") && (PROGS()[c.id] || []).some(s => s[0] === "shake"));
// белковая пена почти белая и толще ананасовой
function foamColor(c) { return eggy(c) ? new THREE.Color(0xfbf6ea) : new THREE.Color(c.pour).lerp(new THREE.Color(0xfff6e6), .72); }
const foamT = c => eggy(c) ? .0125 : FOAM.T;
function addFoam(V, c) {
  if (V.foam) return V.foam;
  const m = new THREE.Mesh(FOAM.geo, FOAM.mat.clone());
  m.material.color.copy(foamColor(c));
  m.material.emissive.copy(m.material.color).multiplyScalar(.06);
  m.renderOrder = 4;
  m.visible = false;
  m.userData.k = 0;
  m.userData.T = foamT(c);
  V.g.add(m);
  V.foam = m;
  placeFoam(V);
  return m;
}
/* пенка всегда лежит на поверхности: толщина по готовности, к концу бокала тает */
function placeFoam(V) {
  const m = V.foam;
  if (!m) return;
  const f = clamp(V.ml / V.cap, 0, .94);
  const k = m.userData.k * clamp((f - .03) / .12, 0, 1);
  m.visible = V.liq.visible && k > .02;
  if (!m.visible) return;
  const top = V.y0 + f * (V.y1 - V.y0), t = (m.userData.T || FOAM.T) * k, r = V.r1 * .985;
  m.position.y = top - t * .3;
  m.scale.set(r, t, r);
  if (V.ride) for (const o of V.ride) o.position.y = top + t * .7 + o.userData.dy;
}
{
  const base = setLevel;
  setLevel = V => { base(V); if (V.foam) placeFoam(V); };
}
/* во время процеживания пенка набирается, после — поднимается и успокаивается */
{
  const base = STEP.strain;
  STEP.strain = async (st, c) => {
    const G = SHOW.glassV;
    if (!G || !foamy(c)) return base(st, c);
    const m = addFoam(G, c);
    const m0 = G.ml;
    const off = onTickTmp(() => { m.userData.k = Math.min(.4, Math.max(m.userData.k, (G.ml - m0) / G.cap)); placeFoam(G); });
    await base(st, c);
    off();
    if (SHOW.fast || reduceMotion.matches) { m.userData.k = 1; placeFoam(G); return; }
    // пена поднимается с лёгким «вздохом» и чуть оседает
    follow(mouth(G, .02));
    const done = onTickTmp(() => placeFoam(G));
    await tween(m.userData, { k: 1.12 }, 1.1, ease.out);
    await tween(m.userData, { k: 1 }, .5, ease.sine);
    done();
    placeFoam(G);
  };
}
/* если шоу пропустили целиком — у поданного бокала тоже есть пенка */
{
  const base = placeServed;
  placeServed = c => {
    base(c);
    if (!servedGlass || !foamy(c)) return;
    const L = servedGlass.userData.liq;
    if (!L) return;
    const r = L.mesh.geometry.parameters.radiusTop * .985;
    const m = new THREE.Mesh(FOAM.geo, FOAM.mat.clone());
    m.material.color.copy(foamColor(c));
    m.material.emissive.copy(m.material.color).multiplyScalar(.06);
    const T = foamT(c);
    m.position.y = L.y1 - T * .3;
    m.scale.set(r, T, r);
    servedGlass.add(m);
    if (typeof eggFinish === "function" && eggy(c)) eggFinish(servedGlass, m, L.y1 + T * .7, r, c);
  };
}

/* долька ананаса: сектор мякоти с коркой, надрез садится на ободок, листья веером */
const PINE = {
  flesh: std({ color: 0xf8e47e, roughness: .38, emissive: 0x4a4208 }),
  core: std({ color: 0xfbf0bc, roughness: .5, emissive: 0x262408 }),
  rind: std({ color: 0x7a5e22, roughness: .85, emissive: 0x100a02 }),
  leaf: std({ color: 0x3f7a2c, roughness: .55, emissive: 0x081a06, side: THREE.DoubleSide })
};
PINE.R = .034; PINE.A = .78; PINE.H = .011;
function pineWedge() {
  const g = new THREE.Group(), w = new THREE.Group();
  const R = PINE.R, A = PINE.A, H = PINE.H;
  // сектор в плоскости YZ: острие в начале координат, корка в сторону +z
  const sector = (r, h, mat) => {
    const geo = new THREE.CylinderGeometry(r, r, h, 16, 1, false, -A / 2, A);
    geo.rotateZ(Math.PI / 2);
    return mesh(geo, mat, 0, 0, 0, w);
  };
  sector(R, H * .94, PINE.rind);
  sector(R * .9, H, PINE.flesh);
  sector(R * .3, H * 1.04, PINE.core);
  // листья: тонкие заострённые пластинки из корки вверх и наружу
  for (let i = 0; i < 3; i++) {
    const lg = new THREE.ConeGeometry(.0042, .052 - i * .008, 4, 1);
    lg.translate(0, (.052 - i * .008) / 2, 0); lg.scale(1, 1, .22);
    const l = mesh(lg, PINE.leaf, 0, R * Math.sin(A * .22), R * .97, w);
    l.rotation.set(.35 + (i - 1) * .32, 0, (i - 1) * .12);
  }
  // наклон: мякоть смотрит внутрь бокала, корка — наружу и вверх; надрез на ободке
  w.rotation.x = -.55;
  w.position.set(0, -.006, -.016);
  g.add(w);
  world.add(g);
  return g;
}
{
  const base = garnishMesh;
  garnishMesh = kind => kind === "pineapple" ? pineWedge() : base(kind);
}
PINE.proto = pineWedge(); PINE.proto.position.y = -10; PINE.proto.visible = false;
