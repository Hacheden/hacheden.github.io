/* ================= бармен: протирает бокал, ходит шагами, достаёт бутылки рукой ================= */
const BT_Z = -3.4;
const bt = makeFigure({ kind: "vest", body: "#2a0d13", shirt: "#e8e2d4", trousers: 0x121012, skin: 0xc28a68, hair: 0x140d09,
  hairStyle: "slick", mustache: true, bowtie: 0x7a0f22, rolled: true, fingers: true, garter: 0x5a0a18 });
placeFig(bt, .9, BT_Z, 0);
bt.maxSpeed = 1.35;
const BT = { busy: false, mode: "polish", get x() { return bt.x; } };
// фартук поверх брюк
(() => {
  const ap = new THREE.PlaneGeometry(.4, .62, 6, 1), p = ap.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.cos(p.getX(i) / .2 * 1.2) * .03);
  ap.computeVertexNormals();
  mesh(ap, std({ color: 0x0d0b0c, roughness: .9, side: THREE.DoubleSide }), 0, -.3, .1, bt.pelvis);
})();
// бокал и полотенце
const btGlass = mesh(lathe([[0, 0], [.038, 0], [.039, .006], [.042, .09], [.043, .092]], 24), std({ color: 0xf4f8ff, transparent: true, opacity: .38, roughness: .02, envMapIntensity: 3, side: THREE.DoubleSide, depthWrite: false }), 0, 0, 0);
btGlass.renderOrder = 5;
/* полотенце: смятый комок с висящим краем */
const ragGeo = (() => {
  const blob = new THREE.IcosahedronGeometry(.042, 2), p = blob.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(1 + Math.sin(v.x * 90) * .18 + Math.cos(v.y * 70 + v.z * 40) * .15); v.y *= .75; p.setXYZ(i, v.x, v.y, v.z); }
  const flap = new THREE.PlaneGeometry(.08, .12, 4, 6), q = flap.attributes.position;
  for (let i = 0; i < q.count; i++) q.setZ(i, Math.sin(q.getY(i) * 40) * .008 + Math.sin(q.getX(i) * 50) * .006);
  flap.translate(.01, -.07, .0);
  const g = mergeGeometries([(blob.index ? blob.toNonIndexed() : blob), (flap.index ? flap.toNonIndexed() : flap)]);
  g.computeVertexNormals();
  return g;
})();
const btRag = mesh(ragGeo, std({ color: 0xd8d2c4, roughness: 1, side: THREE.DoubleSide }), 0, 0, 0);
let glassHold = null, ragHold = null;
const GLASS_LOCAL = V3(.03, 1.18, .36);
function holdTools() {
  release(bt, btGlass); release(bt, btRag);
  glassHold = grab(bt, bt.L, btGlass, V3(0, -.055, .05), .35);
  glassHold.woff = V3(0, -.045, 0);
  ragHold = grab(bt, bt.R, btRag, V3(0, -.08, .03), .35);
}
holdTools();

/* поза «протираю бокал»: левая рука держит, правая с полотенцем ходит по кругу */
function polishTargets(t) {
  const g = GLASS_LOCAL;
  reach(bt.L, g.x + .055, g.y, g.z - .01, V3(-.5, 0, 1), DIR.in(1), .75);
  const a = t * 5.2;
  reach(bt.R, g.x - .01 + Math.cos(a) * .022, g.y + .1 + Math.sin(a * .5) * .01, g.z + Math.sin(a) * .022, V3(.2, -1, .3), V3(1, 0, .2), .55);
}
/* опустить руки вдоль тела */
function armsDown(curl = .25) {
  reach(bt.L, .23, .92, .06, DIR.down, V3(-1, 0, .3), curl);
  reach(bt.R, -.23, .92, .06, DIR.down, V3(1, 0, .3), curl);
}

/* каждый кадр — режимы, которые двигаются сами */
let wipePh = 0;
onTick((t, dt) => {
  if (BT.mode === "polish") { polishTargets(t); bt.leanT = .07; }
  else if (BT.mode === "inspect") {
    reach(bt.L, .06, 1.48, .34, V3(-.3, .3, 1), DIR.in(1), .75);
    reach(bt.R, -.2, 1.0, .2, DIR.down, V3(1, 0, .3), .4);
  } else if (BT.mode === "wipe") {
    wipePh += dt * 1.6;
    reach(bt.R, -.08 + Math.sin(wipePh) * .22, 1.135, .5 + Math.cos(wipePh * 2) * .05, V3(0, -.2, 1), DIR.down, .1);
    reach(bt.L, .25, 1.14, .42, V3(0, -.2, 1), DIR.down, .1);
    bt.leanT = .32;
  } else if (BT.mode === "lean") {
    reach(bt.L, .26, 1.14, .5, V3(0, -.3, 1), DIR.down, .3);
    reach(bt.R, -.26, 1.14, .5, V3(0, -.3, 1), DIR.down, .3);
    bt.leanT = .2;
  } else if (BT.mode === "shake") {
    const s = Math.sin(t * 16) * .06;
    reach(bt.R, -.14, 1.5 + s, .2 + s * .5, V3(0, 1, .3), DIR.in(-1), .9);
    reach(bt.L, .02, 1.38 + s, .24 + s * .5, V3(0, 1, .3), DIR.in(1), .9);
  }
  // кивает в такт музыке, когда отдыхает
  const beat = Music.beat();
  bt.nod = BT.nod && beat !== null ? Math.pow(Math.max(0, Math.cos(beat * Math.PI * 2)), 6) * .07 : 0;
});

/* ---------- инструменты ---------- */
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
async function walkTo(x, z = bt.tz, face = null) {
  bt.tx = clamp(x, -2.85, 2.85); bt.tz = z;
  if (face !== null) bt.tface = face;
  for (let i = 0; i < 80; i++) { if (Math.hypot(bt.tx - bt.x, bt.tz - bt.z) < .03 && bt.speed < .08) break; await sleep(.05); }
}
async function turnTo(face) {
  bt.tface = face;
  for (let i = 0; i < 40; i++) { if (Math.abs(Math.atan2(Math.sin(face - bt.face), Math.cos(face - bt.face))) < .08) break; await sleep(.05); }
}
function putDown(F, obj, worldPos, dur = .3) {
  release(F, obj);
  return tween(obj.position, { x: worldPos.x, y: worldPos.y, z: worldPos.z }, dur, ease.out);
}
async function stash() {
  BT.mode = "free";
  const gp = fromFig(bt, V3(.12, CT.top, .6)), rp = fromFig(bt, V3(-.12, CT.top + .004, .6));
  reach(bt.L, .14, CT.top + .1, .55, V3(0, -.6, 1), DIR.in(1), .75);
  reach(bt.R, -.12, CT.top + .07, .55, V3(0, -.8, 1), DIR.down, .55);
  await sleep(.45);
  if (bt.held.some(h => h.obj === btGlass)) putDown(bt, btGlass, gp);
  if (bt.held.some(h => h.obj === btRag)) putDown(bt, btRag, rp);
  btRag.rotation.set(-Math.PI / 2, 0, 0);
  reach(bt.L, .14, CT.top + .14, .5, V3(0, -.6, 1), DIR.in(1), .2);
  reach(bt.R, -.12, CT.top + .14, .5, V3(0, -.6, 1), DIR.down, .2);
  await sleep(.25);
  armsDown();
}
async function unstash() {
  const gx = btGlass.position.x;
  await walkTo(gx - .12, BT_Z, 0);
  reach(bt.L, .14, CT.top + .1, .55, V3(0, -.6, 1), DIR.in(1), .3);
  reach(bt.R, -.12, CT.top + .07, .55, V3(0, -.8, 1), DIR.down, .3);
  await sleep(.5);
  // захват берёт предмет из того места на стойке, где он лежит
  holdTools();
  btRag.rotation.set(0, 0, 0);
  await sleep(.3);
  BT.mode = "polish";
}

async function fetchBottle(h) {
  BT.busy = true;
  bt.look = null;
  await stash();
  const hb = h.root.position;
  await walkTo(hb.x - .2, -3.95, Math.PI);
  await turnTo(Math.PI);
  bt.look = V3(hb.x, hb.y + .2, hb.z);
  // тянется к бутылке
  const gp = V3(hb.x, hb.y + .17, hb.z + .02);
  const lp = toFig(bt, gp);
  reach(bt.R, lp.x, lp.y, lp.z - .02, V3(0, 0, 1), DIR.in(-1), .15);
  await sleep(.6);
  bt.R.curlT = .85;
  h.root.userData.out = true;
  const hold = grab(bt, bt.R, h.root, V3(0, -.04, .045), .25);
  hold.woff = V3(0, -.17, 0);
  await sleep(.3);
  reach(bt.R, -.18, 1.3, .38, V3(0, .2, 1), DIR.in(-1));
  await sleep(.3);
  bt.look = null;
  await walkTo(hb.x - .2, -3.3, 0);
  await turnTo(0);
  // ставит на стойку перед гостем
  const spot = V3(hb.x - .35, CT.top, -2.42);
  const sl = toFig(bt, spot);
  reach(bt.R, sl.x, CT.top + .2, sl.z - .03, V3(0, -.1, 1), DIR.in(-1), .85);
  await sleep(.55);
  await putDown(bt, h.root, spot, .2);
  bt.R.curlT = .1;
  reach(bt.R, sl.x * .5 - .05, 1.1, .36, V3(-.3, 0, 1), V3(.2, 1, 0), .1);
  reach(bt.L, .24, 1.0, .16, DIR.down, V3(-1, 0, .3), .3);
  bt.look = camera.position;
  await sleep(.5);
}
async function returnBottle(h) {
  bt.look = null;
  const p = h.root.position, lp = toFig(bt, V3(p.x, CT.top + .2, p.z));
  reach(bt.R, lp.x, lp.y, lp.z - .03, V3(0, -.1, 1), DIR.in(-1), .2);
  await sleep(.45);
  bt.R.curlT = .85;
  const hold = grab(bt, bt.R, h.root, V3(0, -.04, .045), .2);
  hold.woff = V3(0, -.17, 0);
  await sleep(.25);
  reach(bt.R, -.18, 1.3, .35, V3(0, .2, 1), DIR.in(-1));
  await walkTo(h.home.x - .2, -3.95, Math.PI);
  await turnTo(Math.PI);
  const hp = toFig(bt, V3(h.home.x, h.home.y + .17, h.home.z + .02));
  reach(bt.R, hp.x, hp.y, hp.z - .02, V3(0, 0, 1), DIR.in(-1), .85);
  await sleep(.55);
  await putDown(bt, h.root, h.home, .2);
  h.root.userData.out = false;
  bt.R.curlT = .15;
  reach(bt.R, -.2, 1.2, .25, V3(0, 0, 1), DIR.in(-1));
  await sleep(.25);
  armsDown();
  await unstash();
  BT.busy = false;
}
/* коктейль: идёт к шейкеру и трясёт его, пока камера смотрит крупным планом */
async function prepCocktail() {
  BT.busy = true;
  await stash();
  await walkTo(1.2, BT_Z, 0);
  BT.mode = "shake";
  bt.look = camera.position;
}
async function presentCocktail() {
  BT.mode = "free";
  const sp = servedGlass ? servedGlass.position : fromFig(bt, V3(-.2, CT.top, .9));
  await walkTo(sp.x + .2, BT_Z, 0);
  const l = toFig(bt, sp);
  reach(bt.R, l.x + .02, CT.top + .06, l.z - .05, V3(0, -.3, 1), DIR.in(-1), .3);
  reach(bt.L, .24, .95, .1, DIR.down, V3(-1, 0, .3), .3);
  bt.look = camera.position;
  await sleep(.6);
  reach(bt.R, l.x - .02, CT.top + .14, l.z - .2, V3(.2, -.2, 1), V3(.3, 1, 0), .1);
}
async function relax() {
  bt.look = null;
  await unstash();
  BT.busy = false;
}

/* ---------- сам по себе: протирает, разглядывает бокал на свет, вытирает стойку, болтает с гостями ---------- */
async function idleLife() {
  if (STILL) return;
  for (;;) {
    await sleep(R(3.5, 7));
    if (BT.busy || PAUSED) continue;
    const r = rng();
    if (r < .22) {
      await walkTo(clamp(bt.x + R(-1.6, 1.6), -2.2, 2.3), BT_Z, 0);
    } else if (r < .42) {
      bt.look = camera.position;
      await sleep(R(1.6, 2.6));
      if (!BT.busy) bt.look = null;
    } else if (r < .56) {
      BT.mode = "inspect";
      bt.look = fromFig(bt, V3(.06, 1.55, .34));
      await sleep(1.8);
      if (!BT.busy) { BT.mode = "polish"; bt.look = null; }
    } else if (r < .7 && typeof GUESTS !== "undefined" && GUESTS.length) {
      // подходит к гостю и перекидывается парой слов
      const g = pickOne(GUESTS);
      await walkTo(g.F.x + .05, BT_Z + .1, 0);
      if (BT.busy) continue;
      bt.look = V3(g.F.x, 1.45, g.F.z);
      bt.nod = 0;
      g.F.look = bt.head.getWorldPosition(V3());
      for (let i = 0; i < 3 && !BT.busy; i++) { bt.tilt = R(-.12, .12); await sleep(.9); }
      bt.tilt = 0;
      g.F.look = null;
      if (!BT.busy) bt.look = null;
    } else if (r < .82) {
      // вытирает стойку
      BT.mode = "free";
      await stash();
      if (BT.busy) continue;
      reach(bt.R, 0, CT.top + .02, .5, V3(0, -.2, 1), DIR.down, .1);
      await sleep(.3);
      const rag = grab(bt, bt.R, btRag, V3(0, -.07, .02), .25);
      rag.woff = V3(0, -.02, 0);
      BT.mode = "wipe";
      await sleep(4.5);
      if (BT.busy) continue;
      BT.mode = "free";
      await putDown(bt, btRag, fromFig(bt, V3(-.12, CT.top + .004, .6)));
      bt.leanT = .07;
      await unstash();
    } else {
      BT.nod = 1;
      await sleep(4);
      BT.nod = 0;
    }
  }
}
