/* ================= сосед по стойке: завсегдатай в шляпе сам заговаривает с сидящим гостем и чокается с ним ================= */
const NB = { G: GUESTS.find(g => g.x === 2.5) || null, gen: 0, on: false, tale: Math.floor(Math.random() * 4), tok: 0, timer: 0, glass: null, asked: -1 };
/* правдивые истории завсегдатая */
const NB_TALES = [
  "К концу двадцатых в одном Нью-Йорке, по оценкам полиции, работали десятки тысяч подпольных баров. Пить запретили, а люди просто научились стучать в правильные двери.",
  "В Новом Орлеане Генри Рамос в 1888 году придумал свой джин-физ со сливками и белком. Трясти его надо было так долго, что за стойкой стояла цепочка «шейкер-боев» — говорят, на карнавал 1915 года их было тридцать пять.",
  "В двадцатые «колени пчелы» значило «высший класс». Так назвали и коктейль: джин, мёд и лимон. Мёд заодно смягчал резкий подпольный джин.",
  "До сухого закона в салуны женщин почти не пускали. А в подпольных барах двадцатых им были рады — так бар и стал местом для всех."
];
const NB_TOASTS = ["За знакомство!", "За правильные двери!", "Ваше здоровье!"];
const NB_BYE = ["Приятно было познакомиться. Не буду отвлекать — бармен вас ждёт.", "Хорошего вечера. Если что — я тут, у края стойки."];

/* кадр: гость разворачивается на табурете к соседу */
function nbShot() {
  const narrow = innerWidth / innerHeight < .8;
  return narrow ? { px: SEAT_X - .3, py: 1.55, pz: -.62, tx: 2.12, ty: 1.42, tz: -1.82, fov: 66 }
    : { px: SEAT_X, py: 1.5, pz: -1.28, tx: 2.02, ty: 1.52, tz: -1.9, fov: 54 };
}
function nbAlive(g, sg) { return g === NB.gen && sg === SEAT.gen && SEAT.on; }
function nbQuiet() { if (bubble && NB.G && bubble.F === NB.G.F) bubble.until = 0; }
function nbSay(text) {
  bubbleEl.classList.remove("show");
  return new Promise(res => setTimeout(() => { say(NB.G.F, text, 900); res(); }, STILL ? 0 : 220));
}
/* сосед опять сам по себе: рука на стойке, взгляд вперёд */
function nbFree() {
  const G = NB.G;
  if (!G) return;
  nbQuiet();
  G.F.look = null; G.F.nod = 0; G.F.leanT = .12; G.F.twistT = 0;
  if (NB.glass) {
    release(G.F, G.glass);
    G.glass.position.copy(G.spot); G.glass.rotation.set(0, 0, 0);
    NB.glass = null;
  }
  G.F.L.curlT = .3;
  restHands(G);
  G.busy = false;
  NB.on = false;
}

/* заговорить: он поворачивается, гость — к нему */
async function nbStart() {
  const G = NB.G;
  if (!G || NB.on || !SEAT.on || SIP.on || TOAST.on || SHOW.on || busy || modalOpen()) return;
  NB.on = true;
  const g = ++NB.gen, sg = SEAT.gen;
  NB.asked = sg;
  clearTimeout(NB.timer);
  answers([]);
  quietBubble();
  for (let i = 0; i < 40 && G.busy; i++) await sleep(.1);
  if (!nbAlive(g, sg)) { if (g === NB.gen) nbFree(); return; }
  G.busy = true;
  if (bt.look === camera.position) bt.look = null;
  G.F.leanT = .06; G.F.twistT = -.18;
  G.F.look = camera.position;
  await flyTo(nbShot(), 1.5, 0);
  if (!nbAlive(g, sg)) { if (g === NB.gen) nbFree(); return; }
  const c = LAST_DRINK;
  await nbSay(`Простите, что вмешиваюсь. ${c && !c.custom ? `«${c.name}» — хороший выбор. ` : ""}Я здесь с самого открытия и люблю поговорить с новым человеком у стойки.`);
  if (!nbAlive(g, sg)) return;
  nbMenu();
}
function nbMenu() {
  const list = [];
  if (servedGlass && SIP.frac > .02 && NB_GLASS !== servedGlass) list.push(["Чокнуться с соседом", () => nbToast()]);
  list.push(["Расскажите что-нибудь", () => nbTale()], ["Вернуться к бармену", () => nbBack(), true]);
  answers(list);
}
let NB_GLASS = null;   // с этим бокалом гость уже чокался с соседом
async function nbTale() {
  const g = NB.gen, sg = SEAT.gen;
  answers([]);
  NB.tale = (NB.tale + 1) % NB_TALES.length;
  NB.G.F.tilt = .06;
  await nbSay(NB_TALES[NB.tale]);
  NB.G.F.tilt = 0;
  await sleep(.4);
  if (nbAlive(g, sg)) nbMenu();
}
async function nbBack(line) {
  const sg = SEAT.gen;
  answers([]);
  if (line) { await nbSay(line); await sleep(1.6); if (sg !== SEAT.gen) return; }
  NB.gen++;
  nbFree();
  bt.look = camera.position;
  await flyTo(seatShot(true), 1.4, 0);
  if (sg === SEAT.gen && SEAT.on) seatAnswers();
}

/* бокалы встречаются у самых ободков, между двумя табуретами */
function nbGeom(cup) {
  const p = (CUPS[cup] || CUPS.rocks).p, rim = p[p.length - 1][1], S = 1.35 / 100;
  const hc = rim - .4;
  let rgc = cupRadAt(p, hc);
  for (const [r, y] of p) if (y >= hc - 3 && y <= rim) rgc = Math.max(rgc, r);
  const hg = hc * S, rg = rgc * S;
  const hp = CUPS.highball.p, hb = (hp[hp.length - 1][1] - .4) * 1.25 / 100, rb = hp[hp.length - 1][0] * 1.25 / 100;
  const M = V3(1.9, CT.top + .3, -1.95), d = V3(1, 0, .12).normalize(), gap = .003;
  const hitOf = Mp => Mp.clone().addScaledVector(d, -(rg + gap)).add(V3(0, -hg, 0));
  return {
    M, d, hb, hitOf,
    nGlass: M.clone().addScaledVector(d, rb + gap).add(V3(0, -hb, 0)),
    gHit: hitOf(M), gPre: hitOf(M).addScaledVector(d, -.07).add(V3(0, -.015, .06)), gBack: hitOf(M).addScaledVector(d, -.03).add(V3(0, .01, .03))
  };
}
/* держать стакан соседа точно в нужной точке: цель руки подправляется по тому, где стакан оказался */
async function nbHold(G, want, steps = 3) {
  const F = G.F, _g = V3(), _h = V3();
  for (let i = 0; i < steps; i++) {
    await sleep(i ? .3 : .55);
    G.glass.getWorldPosition(_g);
    F.L.hand.getWorldPosition(_h);
    const t = want.clone().sub(_g).add(_h), m = toFig(F, t);
    reach(F.L, m.x, m.y, m.z);
  }
}

async function nbToast() {
  const G = NB.G, F = G.F;
  if (!G || !servedGlass || SIP.on || TOAST.on || SHOW.on || SIP.frac <= .02) return;
  if (SIP.glass !== servedGlass) prepSip();
  const g = NB.gen, sg = SEAT.gen;
  const alive = () => nbAlive(g, sg);
  NB_GLASS = servedGlass;
  answers([]);
  SIP.on = true;   // гость пока не пьёт сам
  const c = pendingCocktail || SHOW.c, Tg = nbGeom(c ? c.cup : "rocks");
  let ready, done, clinked = false;
  const pReady = new Promise(r => { ready = r; }), pDone = new Promise(r => { done = r; });
  try {
    // берёт свой хайбол левой рукой — она ближе к гостю
    const gl = toFig(F, G.glass.position);
    reach(F.L, gl.x + .045, CT.top + .07, gl.z - .02, V3(-.2, 0, 1), DIR.in(1), .2);
    F.look = G.glass.position.clone().add(V3(0, .1, 0));
    await sleep(.65); if (!alive()) throw ABORT;
    F.L.curlT = .8;
    const h = grab(F, F.L, G.glass, V3(0, -.05, .05), .2);
    h.woff = V3(0, -.07, 0);
    NB.glass = h;
    await sleep(.25); if (!alive()) throw ABORT;
    // поднимает навстречу и говорит тост
    const pre = Tg.nGlass.clone().addScaledVector(Tg.d, .06).add(V3(0, -.01, .05)), mp = toFig(F, pre);
    reach(F.L, mp.x, mp.y + .07, mp.z + .02, V3(-.5, .4, 1), DIR.in(1));
    F.look = camera.position;
    SIP.on = false;
    const T = {
      pre: Tg.gPre, hit: Tg.gHit, back: Tg.gBack,
      ready: pReady,
      meet: async () => { reach(F.L, F.L.tgt.x, F.L.tgt.y, F.L.tgt.z); await nbHold(G, Tg.nGlass, 2); },
      clink: () => {
        clinked = true;
        clink();
        const s = glowSprite(0xfff0d0, .07, Tg.M.x, Tg.M.y, Tg.M.z, world, .9);
        tween(s.material, { opacity: 0 }, .45, ease.out).then(() => { world.remove(s); s.material.dispose(); });
        tween(s.scale, { x: .13, y: .13 }, .45, ease.out);
        F.nod = .07; setTimeout(() => { F.nod = 0; }, 300);
      },
      done: pDone
    };
    const sipP = takeSip(T);
    await nbHold(G, pre, 3); if (!alive()) throw ABORT;
    await nbSay(choose(NB_TOASTS)); if (!alive()) throw ABORT;
    // к точке встречи: настоящее положение его стакана решает, куда прийти бокалу гостя
    await nbHold(G, Tg.nGlass, 3); if (!alive()) throw ABORT;
    const ng = G.glass.getWorldPosition(V3());
    const Mreal = ng.clone().addScaledVector(Tg.d, -(.041 + .003)).add(V3(0, Tg.hb, 0));
    Tg.M.copy(Mreal); T.hit = Tg.hitOf(Mreal);
    ready();
    while (!clinked && alive()) await sleep(.1);
    if (!alive()) throw ABORT;
    // пьёт сам
    await sleep(.35); if (!alive()) throw ABORT;
    nbQuiet();
    reach(F.L, .03, 1.5, .2, V3(-.4, .6, 1), DIR.in(1));
    await sleep(.6); if (!alive()) throw ABORT;
    tween(h, { tilt: -.75 }, .5); F.nod = -.12;
    await sleep(1.1); if (!alive()) throw ABORT;
    tween(h, { tilt: 0 }, .4); F.nod = 0;
    await sleep(.3); if (!alive()) throw ABORT;
    const sp = toFig(F, G.spot);
    reach(F.L, sp.x + .045, CT.top + .07, sp.z - .02, V3(-.2, 0, 1), DIR.in(1));
    await sleep(.6); if (!alive()) throw ABORT;
    await putDown(F, G.glass, G.spot, .15);
    G.glass.rotation.set(0, 0, 0);
    NB.glass = null;
    F.L.curlT = .3;
    restHands(G);
    F.look = camera.position;
    await sleep(.3); if (!alive()) throw ABORT;
    await nbSay(choose(NB_BYE)); if (!alive()) throw ABORT;
    await sleep(2.2); if (!alive()) throw ABORT;
    NB.gen++;
    nbFree();
    bt.look = camera.position;
    await flyTo(seatShot(true), 1.4, 0);
    done();
    void sipP;
  } catch (e) {
    if (e !== ABORT) console.error(e);
    if (!clinked && NB_GLASS === servedGlass) NB_GLASS = null;   // не успели чокнуться — можно ещё раз
    done();
    if (g === NB.gen) { NB.gen++; nbFree(); }
    if (sg === SEAT.gen && SEAT.on && !SIP.on) { flyTo(seatShot(true), 1.2, 0); seatAnswers(); }
  }
}

/* сам заговаривает: после первого глотка, если гость задумался над бокалом */
{
  const baseAnswers = answers;
  answers = function (list) { NB.tok++; clearTimeout(NB.timer); baseAnswers(list); };
  const baseSeat = seatAnswers;
  seatAnswers = function () {
    baseSeat();
    if (!NB.G || NB.asked === SEAT.gen || SIP.n < 1 || STILL) return;
    const tok = NB.tok, sg = SEAT.gen;
    const tryStart = () => {
      if (tok !== NB.tok || sg !== SEAT.gen || !SEAT.on) return;
      if (modalOpen()) { NB.timer = setTimeout(tryStart, 6000); return; }   // гость читает карточку — не перебивать
      if (NB.G.busy || SIP.on || TOAST.on || SHOW.on || busy) { NB.timer = setTimeout(tryStart, 1500); return; }
      nbStart();
    };
    NB.timer = setTimeout(tryStart, 9000);
  };
  const baseLeave = leaveSeat;
  leaveSeat = function () {
    clearTimeout(NB.timer);
    if (NB.on) { NB.gen++; nbFree(); }
    baseLeave();
  };
}
/* щелчок по соседу, когда сидишь за стойкой, — заговорить с ним */
if (NB.G) {
  const hd = NB.G.F.root.userData.hot, base = hd && hd.act;
  if (hd && base) hd.act = () => { if (SEAT.on && !NB.on) nbStart(); else if (!SEAT.on) base(); };
}
Object.assign(H3D, { nbStart: () => nbStart(), nbToast: () => nbToast(), NB });
