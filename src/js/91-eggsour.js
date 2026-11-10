/* ================= виски сауэр на белке: яйцо, сухой шейк, белая пена и три капли ангостуры =================
   Бармен берёт яйцо из латунной подставки, дважды стукает о край шейкера, разламывает скорлупу
   над ним и переливает желток из половинки в половинку — белок стекает в шейкер. Сухой шейк без льда
   взбивает белок, второй шейк со льдом охлаждает. Пена поднимается над напитком, на неё ложатся
   три капли ангостуры, а вишня садится на пену позади них. Пена, капли и вишня опускаются
   вместе с напитком при каждом глотке. */
const EGG = { H: .056, R: .0205, S: .028, parts: [] };
EGG.shell = std({ color: 0xf2e7d2, roughness: .62, side: THREE.DoubleSide });
EGG.inner = std({ color: 0xfbf7ee, roughness: .8, side: THREE.BackSide });
EGG.yolk = std({ color: 0xf3a21a, roughness: .22, emissive: 0x3a1c00 });
EGG.crackM = std({ color: 0x9a8a6c, roughness: .9 });
EGG.cupM = std({ color: 0xc9944a, metalness: 1, roughness: .28, envMapIntensity: 1.4, side: THREE.DoubleSide });
// профиль яйца: шире снизу, острее сверху; t от 0 (низ) до π (верх)
const eggPt = (t, k = 1) => [EGG.R * Math.sin(t) * (1 + .12 * Math.cos(t)) * k, EGG.H / 2 * (1 - Math.cos(t))];
function eggHalf(t0, t1) {
  const out = [], inn = [];
  for (let i = 0; i <= 12; i++) { const t = t0 + (t1 - t0) * i / 12; out.push(eggPt(t)); inn.push(eggPt(t, .93)); }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe(out.map(([r, y]) => [Math.max(r, 1e-4), y]), 28), EGG.shell));
  const yc = EGG.H / 2;
  g.add(new THREE.Mesh(lathe(inn.map(([r, y]) => [Math.max(r, 1e-4), yc + (y - yc) * .97]), 24), EGG.inner));
  return g;
}
EGG.cupGeo = lathe([[0, 0], [.017, 0], [.0175, .003], [.007, .008], [.006, .015], [.012, .019], [.0172, .027], [.0186, .035], [.0178, .0355]], 28);
function makeEgg() {
  const b = eggHalf(0, Math.PI / 2), t = eggHalf(Math.PI / 2, Math.PI);
  b.add(t);
  const yolk = mesh(new THREE.SphereGeometry(.0105, 18, 12), EGG.yolk, 0, .012, 0, b);
  yolk.scale.set(1, .86, 1);
  const crack = new THREE.Mesh(new THREE.TorusGeometry(EGG.R * 1.002, .00032, 4, 40), EGG.crackM);
  crack.rotation.x = Math.PI / 2; crack.position.y = EGG.S; crack.visible = false;
  b.add(crack);
  world.add(b);
  return { b, t, yolk, crack };
}
EGG.proto = makeEgg(); EGG.proto.b.position.y = -10; EGG.proto.b.visible = false;
EGG.protoCup = mesh(EGG.cupGeo, EGG.cupM, 0, -10, 0); EGG.protoCup.visible = false;

/* капля ангостуры на пене: тёмная середина, мягкий край */
EGG.dropTex = canvasTex(64, 64, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, "rgba(86,20,12,1)"); r.addColorStop(.55, "rgba(102,28,16,.96)");
  r.addColorStop(.8, "rgba(128,46,26,.6)"); r.addColorStop(1, "rgba(150,70,40,0)");
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
EGG.dropM = std({ map: EGG.dropTex, transparent: true, depthWrite: false, roughness: .3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
EGG.dropGeo = new THREE.CircleGeometry(1, 28); EGG.dropGeo.rotateX(-Math.PI / 2);
EGG.protoDrop = mesh(EGG.dropGeo, EGG.dropM, 0, -10, 0); EGG.protoDrop.visible = false;
const DROP_X = [-.3, 0, .3];
/* foam — купол пены (масштаб r по сторонам), x — место по линии через центр, worldR — радиус капли */
function addDrop(foam, x, gs, spread = 0) {
  const d = mesh(EGG.dropGeo, EGG.dropM, x, 1 - .08 * Math.abs(x) + .03, 0, foam);
  d.renderOrder = 5;
  const s = .005 / (foam.scale.x * gs), sz = s * rr(.9, 1);
  d.rotation.y = rr(0, Math.PI);
  if (spread > 0 && !SHOW.fast) { d.scale.set(s * .35, 1, sz * .35); tween(d.scale, { x: s, z: sz }, spread, ease.out); }
  else d.scale.set(s, 1, sz);
  return d;
}

/* звуки: скорлупа о металл и глухой сухой шейк без льда */
SND.crack = loud => { if (SHOW.fast) return; noiseHit(0, .035, 2400, 4, loud ? .32 : .2); noiseHit(.012, .05, 5200, 2, loud ? .14 : .07, "highpass"); };
SND.slosh = (dur, hz) => { if (SHOW.fast) return; for (let i = 0; i < dur * hz * 2; i++) noiseHit(i / (hz * 2), .09, rr(420, 760), 2, .1); };

/* подставка для яйца ставится вместе с остальным реквизитом */
const EGGS = { cup: null, e: null };
function eggClear() {
  if (EGGS.cup) world.remove(EGGS.cup);
  if (EGGS.e) { world.remove(EGGS.e.b); world.remove(EGGS.e.t); world.remove(EGGS.e.yolk); }
  EGGS.cup = EGGS.e = null;
}
{
  const base = setupStation;
  setupStation = async c => {
    eggClear();
    if (eggy(c)) {
      station();
      const at = B(-.17, TOP(), .57);
      EGGS.cup = mesh(EGG.cupGeo, EGG.cupM, at.x, at.y, at.z);
      EGGS.e = makeEgg();
      EGGS.e.b.position.copy(at).add(V3(0, .028, 0));
      EGGS.e.b.scale.setScalar(1.25);
      EGGS.e.b.rotation.y = .4;
      for (const o of [EGGS.cup, EGGS.e.b]) { const y = o.position.y; o.position.y += .03; tween(o.position, { y }, SHOW.fast ? .001 : .35, ease.out); }
    }
    return base(c);
  };
}
{
  const base = cleanup;
  cleanup = (c, aborted) => { eggClear(); base(c, aborted); };
}

/* ---------- шаг: яйцо ---------- */
/* кисть держит половинку за торец: ладонь на конце яйца, пальцы вперёд — трещина посередине остаётся на виду */
const EGG_GRIP = (p, n) => ({ p, r: .028, f: V3(0, 0, 1), n, pose: "grip", along: .04 });
async function stepEgg(st) {
  const V = P.tin, R = bt.R, L = bt.L, E = EGGS.e;
  await jiggerPark();
  if (!E) return;
  const PIV = V3(0, EGG.S, 0);
  shot(choose(["macro", "low"]), EGGS.cup.position.clone().add(V3(0, .07, 0)));
  bt.look = EGGS.cup.position;
  await grip(R, E.b, EGG_GRIP(V3(0, .002, 0), V3(0, 1, 0)), .42);
  // поднимает яйцо и укладывает набок: острый конец — к левой руке
  const qH = Qz(-Math.PI / 2);
  await move(E.b, EGGS.cup.position.clone().add(V3(.03, .13, -.02)), { q: qH, dur: .55, arc: .03 });
  shot("top", mouth(V, .05), 1);
  follow(mouth(V, .04));
  bt.look = mouth(V);
  // два коротких удара экватором о дальний край шейкера
  const rim = mouth(V).add(V3(0, 0, V.mouthR * V.scale));
  const hit = V3(EGG.R, EGG.S, 0);
  const at = dy => posFor(E.b, hit, rim.clone().add(V3(0, dy, 0)), qH);
  await move(E.b, at(.04), { dur: .4, arc: .02 });
  for (let i = 0; i < 2; i++) {
    await move(E.b, at(.0015), { dur: .09, e: ease.in });
    SND.crack(i === 1);
    if (i === 1) E.crack.visible = true;
    await move(E.b, at(.028), { dur: .18, e: ease.out });
  }
  // над серединой шейкера: левая рука берёт верхнюю половинку
  const C = mouth(V, .085);
  await move(E.b, posFor(E.b, PIV, C, qH), { dur: .35, arc: .015 });
  await grip(L, E.t, EGG_GRIP(V3(0, EGG.H - .002, 0), V3(0, -1, 0)), .38);
  follow(C.clone().add(V3(0, -.01, 0)));
  world.attach(E.t);
  E.crack.visible = false;
  // скорлупа раскрывается, как книжка: обе половинки чашечками вверх
  const qB = Qz(-.22), qT = Qz(Math.PI + .22), cB = C.clone().add(V3(-.026, .004, 0)), cT = C.clone().add(V3(.026, .004, 0));
  const white = new THREE.Color(0xeeeedd);
  const from = V3(), mid = () => from.copy(cB).lerp(cT, .5).add(V3(0, -.004, 0));
  const opening = Promise.all([move(E.b, posFor(E.b, PIV, cB, qB), { q: qB, dur: .45 }), move(E.t, posFor(E.t, PIV, cT, qT), { q: qT, dur: .45 })]);
  await ws(.12);
  streamOn(v => v.copy(mid()), v => v.copy(surface(V)), white, .85);
  SND.pour(.7);
  await opening;
  await ws(.25);
  // желток переходит из половинки в половинку, белок стекает вниз
  for (let pass = 0; pass < 2; pass++) {
    const src = pass ? E.t : E.b, dst = pass ? E.b : E.t, cs = pass ? cT : cB;
    const qTip = pass ? Qz(Math.PI + .22 + .95) : Qz(-.22 - .95), qBack = pass ? qT : qB;
    await tiltAbout(src, PIV, qTip, .32);
    world.attach(E.yolk);
    const end = dst.localToWorld(V3(0, pass ? .012 : .043, 0)), p0 = E.yolk.position.clone();
    await waitTicks(.32, k => { E.yolk.position.lerpVectors(p0, end, ease.io(k)); E.yolk.position.y += Math.sin(Math.PI * k) * .012; });
    dst.attach(E.yolk);
    SND.plop();
    streamOn(v => v.copy(src.localToWorld(V3(pass ? -EGG.R * .9 : EGG.R * .9, EGG.S, 0))), v => v.copy(surface(V)), white, .6);
    await ws(.3);
    await tiltAbout(src, PIV, qBack, .28);
    streamOn(v => v.copy(mid()), v => v.copy(surface(V)), white, .5);
    await ws(.15);
  }
  streamOff();
  V.ml += st[1] || 20;
  // скорлупу — вниз, под стойку
  bt.look = null;
  await Promise.all([
    move(E.b, B(-.12, TOP() - .3, .16), { dur: .5, e: ease.in, arc: .02 }),
    move(E.t, B(.12, TOP() - .3, .16), { dur: .5, e: ease.in, arc: .02 })
  ]);
  letGo(R); letGo(L);
  world.remove(E.b); world.remove(E.t);
  EGGS.e = null;
  await Promise.all([rest(R), rest(L)]);
}

/* ---------- шаг: капли ангостуры на пену ---------- */
async function stepDrops(st) {
  const G = SHOW.glassV, n = st[1] || 3;
  await jiggerPark();
  if (!G || !G.foam) return;
  const F = G.foam;
  shot("top", mouth(G, -.01), 1);
  const b = await bottleUp("bitters", `${n} капли на пену`);
  const top = V3(0, b.userData.top, 0), q = Qz(-2.4);
  follow(mouth(G, -.01));
  bt.look = mouth(G);
  const spots = DROP_X.slice(0, n);
  for (let i = 0; i < spots.length; i++) {
    F.updateMatrixWorld(true);
    const land = F.localToWorld(V3(spots[i], 1, 0));
    const over = posFor(b, top, land.clone().add(V3(0, .075, 0)), q);
    await move(b, over, { q, dur: i ? .26 : .45, arc: i ? 0 : .03 });
    await ws(.12);
    await move(b, over.clone().add(V3(0, -.012, 0)), { dur: .08, e: ease.in });
    const d = mesh(new THREE.SphereGeometry(.0028, 10, 8), EGG.dropM.clone(), 0, 0, 0);
    d.material.map = null; d.material.color.set(0x5a160c); d.material.transparent = false; d.material.depthWrite = true;
    b.localToWorld(d.position.copy(top));
    tween(d.position, { x: land.x, y: land.y, z: land.z }, SHOW.fast ? .001 : .2, ease.in).then(() => { world.remove(d); (F.userData.drops = F.userData.drops || []).push(addDrop(F, spots[i], G.scale, .6)); });
    await move(b, over, { dur: .14, e: ease.out });
    await ws(.18);
  }
  cardLayer(new THREE.Color(0x5a1a0c), 4);
  await ws(.35);
  await bottleDown(b);
  await ws(.35);
}

/* ---------- вишня садится на пену позади капель ---------- */
{
  const base = stepGarnish;
  stepGarnish = async c => {
    const G = SHOW.glassV;
    if (!G || !G.foam || !eggy(c) || c.garnish !== "cherry") return base(c);
    const R = bt.R, F = G.foam;
    shot(choose(["macro", "low"]), mouth(G, .06));
    bt.look = ST.tray;
    const gm = garnishMesh("cherry");
    place(gm, ST.tray.clone().add(V3(.03, .02, 0)));
    await grip(R, gm, PINCH(V3(0, .012, 0)), .42);
    const m = mouth(G);
    await move(gm, m.clone().add(V3(0, .2, 0)), { dur: .55, arc: .04 });
    bt.look = camera.position;
    follow(m.clone().add(V3(0, .1, 0)));
    await ws(rr(.5, .7));
    bt.look = m;
    F.updateMatrixWorld(true);
    const seat = F.localToWorld(V3(0, .96, -.56)).add(V3(0, .011 * .55, 0));
    await move(gm, seat.clone().add(V3(0, .05, 0)), { q: Qz(.12), dur: .45, e: ease.io });
    await move(gm, seat, { dur: .5, e: ease.out });
    SND.plop();
    letGo(R, "open");
    G.g.attach(gm);
    const t = F.scale.y, top = F.position.y + t * .3;
    gm.userData.dy = gm.position.y - (top + t * .7);
    (G.ride = G.ride || []).push(gm);
    await ws(.3);
    await rest(R);
  };
}

/* если шоу пропустили: капли на пене, вишня поверх пены */
function eggFinish(glass, foam, topY, r, c) {
  const hearts = !!c && (PROGS()[c.id] || []).some(st => st[0] === "hearts");
  DROP_X.forEach(x => { const d = addDrop(foam, x, 1.35); if (hearts) toHeart(d, 0); });
  const ch = glass.children.find(o => o.geometry && o.geometry.type === "SphereGeometry" && Math.abs((o.geometry.parameters.radius || 0) - .012) < 1e-6);
  if (ch) ch.position.set(0, topY + .012 * .45, -.56 * r);
}

/* шаги в общей программе, подписи и строки карточки */
/* ---------- шаг: шпажкой через капли — три сердечка ----------
   Бармен ведёт тонкую деревянную шпажку одной линией через середины капель: каждая капля
   вытягивается хвостиком по ходу шпажки и становится сердечком. */
EGG.heartTex = canvasTex(128, 128, (g, w, h) => {
  // сердечко остриём вправо (+x): лопасти слева, хвостик справа
  g.save(); g.translate(w / 2, h / 2);
  g.shadowColor = "rgba(120,40,22,.55)"; g.shadowBlur = 7;
  g.beginPath();
  for (let i = 0; i <= 96; i++) {
    const t = i / 96 * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const X = -y * 2.9 + 4, Y = x * 2.9;
    i ? g.lineTo(X, Y) : g.moveTo(X, Y);
  }
  g.closePath();
  const r = g.createRadialGradient(-12, 0, 0, -6, 0, 54);
  r.addColorStop(0, "rgba(84,18,10,1)"); r.addColorStop(.7, "rgba(100,26,14,.97)"); r.addColorStop(1, "rgba(130,44,24,.9)");
  g.fillStyle = r; g.fill();
  g.restore();
});
EGG.heartM = std({ map: EGG.heartTex, transparent: true, depthWrite: false, roughness: .3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
EGG.protoHeart = mesh(EGG.dropGeo, EGG.heartM, 0, -10, 0); EGG.protoHeart.visible = false;
EGG.pickM = std({ color: 0xd9bf8e, roughness: .6 });
/* капля превращается в сердечко: вытягивается по линии шпажки */
function toHeart(d, dur = .28) {
  const s = d.scale.z;
  d.material = EGG.heartM;
  d.rotation.y = 0;
  if (dur <= 0 || SHOW.fast) { d.scale.set(s * 2, 1, s * 1.7); return; }
  d.scale.set(s * 1.05, 1, s);
  tween(d.scale, { x: s * 2, z: s * 1.7 }, dur, ease.out);
}
async function stepHearts() {
  const G = SHOW.glassV, R = bt.R;
  await jiggerPark();
  if (!G || !G.foam || !(G.foam.userData.drops || []).length) return;
  const F = G.foam, drops = F.userData.drops.slice().sort((a, b) => a.position.x - b.position.x);
  // шпажка: тонкая палочка, остриё в начале координат
  const pick = new THREE.Group();
  const geo = new THREE.CylinderGeometry(.0015, .0003, .085, 6); geo.translate(0, .0425, 0);
  mesh(geo, EGG.pickM, 0, 0, 0, pick);
  world.add(pick);
  const q = Qz(.42);
  place(pick, ST.tray.clone().add(V3(.02, .03, 0)), q);
  shot("top", mouth(G, -.01), 1);
  bt.look = ST.tray;
  await grip(R, pick, PINCH(V3(0, .062, 0)), .4);
  F.updateMatrixWorld(true);
  const at = x => F.localToWorld(V3(x, 1 - .08 * Math.abs(x) + .02, 0));
  follow(mouth(G, -.01));
  bt.look = mouth(G);
  await move(pick, posFor(pick, V3(), at(-.62).add(V3(0, .04, 0)), q), { dur: .6, arc: .03 });
  await ws(.15);
  await move(pick, posFor(pick, V3(), at(-.62), q), { dur: .22, e: ease.out });
  // одна ровная линия через все капли
  const done = new Set();
  await waitTicks(2, k => {
    const x = -.62 + 1.24 * ease.io(k);
    F.updateMatrixWorld(true);
    pick.position.copy(posFor(pick, V3(), at(x), q));
    for (const d of drops) if (!done.has(d) && x > d.position.x - .06) { done.add(d); toHeart(d); }
  });
  for (const d of drops) if (!done.has(d)) toHeart(d, 0);
  await move(pick, posFor(pick, V3(), at(.62).add(V3(0, .05, 0)), q), { dur: .25, e: ease.out });
  bt.look = null;
  await move(pick, B(.14, TOP() - .3, .16), { dur: .5, e: ease.in, arc: .02 });
  letGo(R);
  world.remove(pick);
  await rest(R);
  await ws(.4);
}
Object.assign(STEP, { egg: stepEgg, drops: stepDrops, hearts: stepHearts });
{
  const base = stepCaption;
  stepCaption = (st, c) => {
    if (st[0] === "egg") return "Яичный белок: желток остаётся в скорлупе";
    if (st[0] === "shake" && st[1] === "dry") return "Сухой шейк без льда — белок взбивается в пену";
    if (st[0] === "ice" && st[1] === "tin" && eggy(c)) return "Теперь лёд — и второй шейк, чтобы охладить";
    if (st[0] === "drops") return "Три капли ангостуры на белую пену";
    if (st[0] === "hearts") return "Шпажкой одной линией через капли — три сердечка";
    if (st[0] === "garnish" && eggy(c) && c.garnish === "cherry") return "Вишня ложится на пену";
    return base(st, c);
  };
}
{
  const base = cardRow;
  cardRow = (st, c) => {
    if (st[0] === "egg") return { name: "Яичный белок", amt: `${st[1] || 20} мл`, col: "#f1ecd8" };
    if (st[0] === "shake" && st[1] === "dry") return { name: "Сухой шейк", amt: "без льда", tech: true };
    if (st[0] === "hearts") return { name: "Сердечки", amt: "шпажкой", tech: true };
    if (st[0] === "drops") return { name: NOM.bitters, amt: `${st[1] || 3} капли на пену`, col: "#" + liqOf("bitters").getHexString() };
    return base(st, c);
  };
}
Object.assign(H3D, { served: () => servedGlass });
