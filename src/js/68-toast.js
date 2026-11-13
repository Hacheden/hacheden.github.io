/* ================= чокнуться с барменом: он наливает себе на палец виски, бокалы встречаются над стойкой ================= */
const TOAST = { on: false, glass: null, gen: 0 };
const toastPlane = new THREE.Plane(V3(0, -1, 0), 100);   // поверхность виски в его стакане, когда он пьёт
/* его стакан: маленький олд фэшн, лежит под стойкой */
const TOAST_V = (() => {
  const cup = CUPS.rocks, V = vessel(cup.p.map(([r, y]) => [r / 100, y / 100]), MX.glass, [...cup.liq.map(v => v / 100), 90], { scale: .9 });
  const m = V.liq.material;
  m.clippingPlanes = [toastPlane]; m.side = THREE.DoubleSide;   // шейдер собирается заранее, при прогреве
  V.col.copy(liqOf("whisky"));
  return V;
})();
const TOAST_LINES = [
  ["С удовольствием. Себе — на палец виски.", "За этот вечер!"],
  ["Почту за честь. Мне — немного виски.", "За вас!"],
  ["Не откажусь. Капля виски — и я с вами.", `За тех, кто нашёл дорогу в ${BAR_NAME}!`]
];
/* радиус бокала на высоте y (профиль в сантиметрах, как в CUPS) */
function cupRadAt(p, y) {
  let r = p[p.length - 1][0];
  for (let i = 1; i < p.length; i++) {
    const [r0, y0] = p[i - 1], [r1, y1] = p[i];
    if (y >= y0 && y <= y1 && y1 > y0) r = r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return r;
}
/* где бокалы встречаются: край к краю — у самых ободков, где бокал шире всего, ниже ничего не выступает */
function toastGeom(cup) {
  const p = (CUPS[cup] || CUPS.rocks).p, rim = p[p.length - 1][1], S = 1.35 / 100;
  const hc = rim - .4;
  let rgc = cupRadAt(p, hc);
  for (const [r, y] of p) if (y >= hc - 3 && y <= rim) rgc = Math.max(rgc, r);
  const hg = hc * S, rg = rgc * S;
  const rp = CUPS.rocks.p, hb = (rp[rp.length - 1][1] - .4) * .9 / 100, rb = rp[rp.length - 1][0] * .9 / 100;
  const M = V3(SEAT_X + .03, TOP() + .1 + hg, -2.42), gap = .003;
  return {
    gHit: V3(M.x + rg + gap, M.y - hg, M.z), gPre: V3(M.x + rg + .07, M.y - hg - .015, M.z + .07), gBack: V3(M.x + rg + .03, M.y - hg + .01, M.z + .03),
    bHit: V3(M.x - rb - gap, M.y - hb, M.z), bPre: V3(M.x - rb - .07, M.y - hb - .01, M.z - .07), M
  };
}
function toastAbort() {
  TOAST.on = false;
  HANDS.delete(bt.L); HANDS.delete(bt.R);
  for (const a of [bt.L, bt.R]) { a.manual = false; a.snap = false; a.k = 9; }
  streamOff();
  for (const o of [...world.children]) if (o.userData && o.userData.ing) drop(o);
  TOAST_V.g.visible = false; toastPlane.constant = 100; TOAST.glass = null;
  bt.nod = 0; bt.leanT = .07;
  if (!bt.held.some(h => h.obj === btGlass)) unstash().then(() => { if (!SEAT.on && !busy) BT.busy = false; });
}

/* бармен: стакан из-под стойки, виски из бутылки, поднимает навстречу, пьёт и убирает стакан */
async function toastBt(Tg, line, alive, raised) {
  const V = TOAST_V, L = bt.L, Rh = bt.R, T = TOP();
  const ok = () => { if (!alive()) throw ABORT; };
  BT.busy = true;
  await btSay(line);
  BT.mode = "free";
  if (bt.held.some(h => h.obj === btGlass)) await stash();
  ok();
  station();
  // стакан берёт правой рукой с полки под стойкой и ставит на коврик
  const shelf = V3(SEAT_X - .1, T - .2, -2.9), mat = V3(SEAT_X - .12, T + .006, -2.62);
  V.ml = 0; setLevel(V); toastPlane.constant = 100;
  place(V.g, shelf, Qe());
  bt.look = mat.clone();
  await grip(Rh, V.g, wrap(-1, V3(0, .035, 0), .04), .45); ok();
  await move(V.g, V3(shelf.x, T + .05, shelf.z), { dur: .4, e: ease.out }); ok();
  await move(V.g, mat, { dur: .45, arc: .03 }); ok();
  SND.tap();
  letGo(Rh);
  // бутылка виски с рейки: показывает этикетку и наливает на палец
  const b = makeBottle("whisky"), u = b.userData;
  place(b, ST.rail, Qe());
  bt.look = b.position.clone().add(V3(0, .3, 0));
  await grip(Rh, b, wrap(-1, V3(0, u.top * .5, 0), u.r), .4); ok();
  await move(b, B(-.17, T + .1, .3), { q: Qe(0, .25, 0), dur: .5, arc: .04 }); ok();
  bt.look = mouth(V);
  const col = liqOf("whisky");
  await pourFrom(b, V3(0, u.top, 0), () => surface(V), 25, col, { gap: .09, rate: 1.3, ang: 2.25, fill: k => { V.ml = 25 * k; setLevel(V); } }); ok();
  await bottleDown(b); ok();
  reach(L, .24, 1.0, .12, DIR.down, V3(-1, 0, .3), .3);
  raised.start();   // гость уже тянется к своему бокалу
  // подходит к краю стойки и берёт стакан правой
  bt.look = camera.position;
  await walkTo(SEAT_X + .04, -3.06, 0); ok();
  bt.leanT = .16;
  await grip(Rh, V.g, wrap(-1, V3(0, .03, 0), .04), .4); ok();
  await move(V.g, Tg.bPre, { q: Qz(-.06), dur: 1.1, arc: .04 }); ok();
  bt.look = Tg.M;
  await btSay(raised.line); ok();
  await sleep(.25); ok();
  raised.meet = () => move(V.g, Tg.bHit, { dur: .5, e: ease.out });
  raised.ready();
}
async function toastDrink(Tg, alive) {
  const V = TOAST_V, Rh = bt.R, T = TOP();
  const ok = () => { if (!alive()) throw ABORT; };
  await move(V.g, Tg.bHit.clone().add(V3(-.03, .01, -.03)), { dur: .4, e: ease.out }); ok();
  quietBubble();
  bt.look = camera.position;
  await sleep(.3); ok();
  // к губам: край стакана у рта, стакан наклонён к нему; поверхность виски остаётся горизонтальной
  bt.head.updateMatrixWorld(true);
  const lips = bt.head.localToWorld(V3(0, .04, .1)), q = Qx(-.95);
  const rimLocal = V3(0, V.mouthY, -V.mouthR * .9);
  V.liq.visible = true; V.liq.scale.y = .94 * (V.y1 - V.y0);
  const f0 = V.ml / V.cap / .94;
  const lvl = f => V.g.localToWorld(V3(0, V.y0 + Math.max(0, f) * .94 * (V.y1 - V.y0), 0)).y;
  let fr = f0;
  V.g.updateMatrixWorld(true); toastPlane.constant = lvl(fr);
  const stop = onTickTmp(() => { V.g.updateMatrixWorld(true); toastPlane.constant = lvl(fr); V.liq.visible = fr > .01; });
  try {
    bt.nod = -.05;
    await move(V.g, posFor(V.g, rimLocal, lips.clone().add(V3(0, 0, .012)), Qx(-.55)), { q: Qx(-.55), dur: .75 }); ok();
    bt.nod = -.14;
    await tiltAbout(V.g, rimLocal, q, .55); ok();
    await waitTicks(.6, k => { fr = f0 * (1 - k); }); ok();
    fr = 0;
    bt.nod = 0;
    await tiltAbout(V.g, rimLocal, Qx(-.4), .35); ok();
  } finally { stop(); }
  V.ml = 0; setLevel(V); toastPlane.constant = 100;
  // ставит пустой стакан под стойку
  await move(V.g, V3(SEAT_X - .08, T + .1, -2.9), { q: Qe(), dur: .7, arc: .03 }); ok();
  await move(V.g, V3(SEAT_X - .1, T - .2, -2.9), { dur: .4, e: ease.in }); ok();
  V.g.visible = false;
  letGo(Rh); bt.leanT = .07;
  for (const a of [bt.L, bt.R]) { HANDS.delete(a); a.manual = false; a.snap = false; a.k = 9; }
  await walkTo(SEAT_X + .04, BT_Z + .1, 0); ok();
  await unstash(); ok();
  bt.look = camera.position;
}

async function toastBartender() {
  if (TOAST.on || SIP.on || !SEAT.on || !servedGlass || SHOW.on || busy || SIP.frac <= .02) return;
  if (SIP.glass !== servedGlass) prepSip();
  TOAST.on = true; TOAST.glass = servedGlass;
  SIP.on = true;   // гость пока не пьёт сам
  const g = ++SIP.gen, sg = SEAT.gen, tg = ++TOAST.gen;
  const alive = () => g === SIP.gen && sg === SEAT.gen && tg === TOAST.gen && SEAT.on;
  answers([]);
  quietBubble();
  const c = pendingCocktail || SHOW.c, Tg = toastGeom(c ? c.cup : "rocks");
  const [l1, l2] = choose(TOAST_LINES);
  let started, ready, done, clinked = false;
  const pStart = new Promise(r => { started = r; }), pReady = new Promise(r => { ready = r; }), pDone = new Promise(r => { done = r; });
  const raised = { start: started, ready, line: l2, meet: null };
  const bt1 = toastBt(Tg, l1, alive, raised);
  bt1.catch(() => {});
  try {
    // гость тянется к бокалу, когда бармен уже взял свой
    await Promise.race([pStart, bt1]);
    if (!alive()) throw ABORT;
    SIP.on = false;
    const T = {
      pre: Tg.gPre, hit: Tg.gHit, back: Tg.gBack,
      ready: Promise.race([pReady, bt1.then(() => {})]),
      meet: () => raised.meet ? raised.meet() : Promise.resolve(),
      clink: () => {
        clinked = true;
        clink();
        const s = glowSprite(0xfff0d0, .07, Tg.M.x, Tg.M.y, Tg.M.z, world, .9);
        tween(s.material, { opacity: 0 }, .45, ease.out).then(() => { world.remove(s); s.material.dispose(); });
        tween(s.scale, { x: .13, y: .13 }, .45, ease.out);
        bt.nod = .06; setTimeout(() => { bt.nod = 0; }, 300);
      },
      done: pDone
    };
    const sipP = takeSip(T);
    await bt1;
    while (!clinked && alive()) await sleep(.1);   // ждём, пока бокалы встретятся
    if (!alive()) throw ABORT;
    await toastDrink(Tg, alive);
    done();
    void sipP;
  } catch (e) {
    if (e !== ABORT) console.error(e);
    done();
    if (tg === TOAST.gen) toastAbort();
    return;
  }
  TOAST.on = false;
}
Object.assign(H3D, { clinkBt: () => toastBartender(), TOAST, TOAST_V });
