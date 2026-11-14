/* ================= живая компания: гости у стойки, в курилке и в читальне ================= */
const GUESTS = [];
const bubbleEl = document.getElementById("bubble");
let bubble = null;
function say(F, text, dur = 5) {
  bubble = { F, until: NOW + dur * 1000 };
  bubbleEl.textContent = text;
  F.look = camera.position;
  clearTimeout(F._sayT);
  F._sayT = setTimeout(() => { if (F.look === camera.position) F.look = null; }, dur * 1000);
}
const _hp = V3();
onTick(() => {
  if (!bubble) return;
  if (NOW > bubble.until || modalOpen()) { bubbleEl.classList.remove("show"); bubble = null; return; }
  // облачко видно, только пока голова говорящего в кадре: отвернулся — реплика прячется
  bubble.F.head.getWorldPosition(_hp);
  _hp.y += .12;
  const h = _hp.clone().project(camera);
  const inView = h.z < 1 && Math.abs(h.x) < .98 && h.y > -.95 && h.y < 1.02;
  bubbleEl.classList.toggle("show", inView);
  if (!inView) return;
  const p = _hp.add(_w0.set(0, .14, 0)).project(camera);
  const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight;
  const half = bubbleEl.offsetWidth / 2 + 8;
  bubbleEl.style.transform = `translate(${clamp(x, half, innerWidth - half)}px, ${clamp(y, bubbleEl.offsetHeight + 12, innerHeight - 160)}px) translate(-50%, -100%)`;
});
const lineOf = F => { F._li = ((F._li ?? -1) + 1) % F.lines.length; return F.lines[F._li]; };

/* звон бокалов */
function clink() {
  const c = fx(); if (!c) return;
  const t = c.currentTime + .01;
  for (const [f, v] of [[2650, .14], [3970, .08], [5210, .05]]) {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f + R(-40, 40);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .9);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 1);
  }
}

/* сколько гостей сейчас: к открытию один, вечером и ночью полный зал, под утро двое */
const GUEST_H = hoursOf(sceneDate());
const crowd = GUEST_H >= 17 && GUEST_H < 19 ? 1 : GUEST_H >= 1 && GUEST_H < 3 ? 2 : 3;

/* ---------- гости за стойкой ---------- */
function barGuest(x, look, drink, lines) {
  const F = makeFigure(Object.assign({ seated: true, hipY: .93 }, look));
  placeFig(F, x, -1.5, Math.PI);
  F.legsFixed = true;
  F.legs.forEach(lg => { lg.tgt.set(lg.side * .1, .33, .14); lg.cur.copy(lg.tgt); });
  F.leanT = .12;
  const glass = makeGlass(drink.cup, drink.color, { garnish: drink.garnish, ice: drink.ice, op: .85 });
  const spot = fromFig(F, V3(-.1, CT.top, .62));
  glass.position.copy(spot);
  glass.scale.setScalar(1.25);
  world.add(glass);
  const G = { F, glass, spot, busy: false, x };
  F.lines = lines;
  restHands(G);
  hot(F.root, 1, look.label, () => say(F, lineOf(F)), { grow: 0, noChip: true });
  GUESTS.push(G);
  return G;
}
function restHands(G) {
  const F = G.F;
  reach(F.L, .15, 1.15, .6, V3(-.3, -.15, 1), DIR.down, .35);
  reach(F.R, -.13, 1.15, .58, V3(.3, -.15, 1), DIR.down, .35);
}
async function sip(G) {
  const F = G.F, gl = toFig(F, G.glass.position);
  G.busy = true;
  reach(F.R, gl.x - .045, CT.top + .07, gl.z - .02, V3(.2, 0, 1), DIR.in(-1), .2);
  await sleep(.6);
  F.R.curlT = .8;
  const h = grab(F, F.R, G.glass, V3(0, -.05, .05), .2);
  h.woff = V3(0, -.07, 0);
  await sleep(.25);
  reach(F.R, -.03, 1.5, .2, V3(.4, .6, 1), DIR.in(-1));
  F.look = null;
  await sleep(.7);
  tween(h, { tilt: -.75 }, .5);
  F.nod = -.12;
  await sleep(1.1);
  tween(h, { tilt: 0 }, .4);
  F.nod = 0;
  await sleep(.3);
  reach(F.R, gl.x - .045, CT.top + .07, gl.z - .02, V3(.2, 0, 1), DIR.in(-1));
  await sleep(.6);
  await putDown(F, G.glass, G.spot, .15);
  G.glass.rotation.set(0, 0, 0);
  F.R.curlT = .3;
  restHands(G);
  G.busy = false;
}
async function gesture(G, other) {
  const F = G.F;
  G.busy = true;
  if (other) F.look = other.F.head.getWorldPosition(V3());
  for (let i = 0; i < 4; i++) {
    reach(F.L, .12 + R(-.04, .06), 1.28 + R(-.04, .08), .4 + R(-.04, .06), V3(.4, .5, 1), V3(-.3, .8, .2), .3);
    F.tilt = R(-.1, .1);
    await sleep(R(.5, .8));
  }
  F.tilt = 0;
  restHands(G);
  G.busy = false;
}
async function laugh(G) {
  const F = G.F;
  for (let i = 0; i < 10; i++) { F.sway = Math.sin(i * 2.1) * .03; F.nod = -.14 + Math.sin(i * 1.7) * .05; F.leanT = -.02; await sleep(.12); }
  F.sway = 0; F.nod = 0; F.leanT = .12;
}
async function clinkToast(A, B) {
  if (A.busy || B.busy) return;
  A.busy = B.busy = true;
  const mid = V3((A.F.x + B.F.x) / 2, 1.42, -1.82);
  const holds = [];
  for (const G of [A, B]) {
    const F = G.F, gl = toFig(F, G.glass.position);
    reach(F.R, gl.x - .045, CT.top + .07, gl.z - .02, V3(.2, 0, 1), DIR.in(-1), .2);
    F.look = mid;
  }
  await sleep(.6);
  for (const G of [A, B]) { G.F.R.curlT = .8; const h = grab(G.F, G.F.R, G.glass, V3(0, -.05, .05), .2); h.woff = V3(0, -.07, 0); holds.push(h); }
  await sleep(.3);
  for (const G of [A, B]) {
    const s = G === A ? 1 : -1, m = toFig(G.F, V3(mid.x + s * .07, mid.y, mid.z));
    reach(G.F.R, m.x, m.y, m.z, V3(0, .3, 1), DIR.in(-1));
  }
  await sleep(.75);
  clink();
  for (const G of [A, B]) G.F.look = (G === A ? B : A).F.head.getWorldPosition(V3());
  await sleep(.5);
  for (const G of [A, B]) { G.F.busy = true; }
  await Promise.all([A, B].map(async (G, i) => {
    const h = holds[i];
    reach(G.F.R, -.03, 1.5, .2, V3(.4, .6, 1), DIR.in(-1));
    await sleep(.6);
    tween(h, { tilt: -.7 }, .5); G.F.nod = -.12;
    await sleep(1);
    tween(h, { tilt: 0 }, .4); G.F.nod = 0;
    await sleep(.3);
    const gl = toFig(G.F, G.spot);
    reach(G.F.R, gl.x - .045, CT.top + .07, gl.z - .02, V3(.2, 0, 1), DIR.in(-1));
    await sleep(.6);
    await putDown(G.F, G.glass, G.spot, .15);
    G.glass.rotation.set(0, 0, 0);
    G.F.look = null;
    restHands(G);
  }));
  A.busy = B.busy = false;
}

const LADY = { kind: "dress", body: "#1f4a3a", skin: 0xd6a088, hair: 0x0e0a08, hairStyle: "bob", lady: true, label: "Гостья в зелёном" };
const GENT = { kind: "suit", body: "#2c2c32", tie: "#7a1424", skin: 0xc8946e, hair: 0x4a2e1a, mustache: false, label: "Гость в сером костюме" };
const SOLO = { kind: "suit", body: "#4a3626", tie: "#1f3a5a", skin: 0xb88262, hair: 0x2a2a2a, hat: 0x1c1a18, mustache: true, label: "Завсегдатай в шляпе" };
const pair = [];
if (crowd >= 2) {
  pair.push(barGuest(-2.5, LADY, { cup: "martini", color: "#e8e4c8", garnish: "olive" }, [
    "Говорят, «Негрони» придумали во Флоренции: граф Негрони попросил сделать его американо покрепче.",
    "Мартини — только сухой и с оливкой. Остальное — разговоры.",
    "Граммофон в курилке играет лучше любого оркестра."
  ]));
  pair.push(barGuest(-1.25, GENT, { cup: "rocks", color: "#c27a1a", ice: true }, [
    "В сухой закон коктейли спасали положение: плохой подпольный алкоголь прятали за соками и сиропами.",
    "Бармен здесь трясёт шейкер так, будто внутри гроза.",
    "Пароль от этого бара я тебе не скажу. Ты и так уже внутри."
  ]));
}
if (crowd !== 2) barGuest(2.5, SOLO, { cup: "highball", color: "#cfe6ea", garnish: "wheel", ice: true }, [
  "Я тут с самого открытия. Лучшее время: бармен ещё никуда не спешит.",
  "Джин с тоником придумали британцы в Индии: хинный тоник пили от малярии.",
  "Загляни в курилку и постучи в дверь. Только тихо."
]);

/* распорядок гостей: разговоры, глоток, смех, тост */
async function guestLife() {
  if (STILL) return;
  for (;;) {
    await sleep(R(2.5, 5));
    if (PAUSED || curZone !== 1) continue;
    const free = GUESTS.filter(g => !g.busy);
    if (!free.length) continue;
    const r = rng();
    if (pair.length === 2 && r < .12) clinkToast(pair[0], pair[1]);
    else if (pair.length === 2 && r < .55) {
      const [a, b] = rng() < .5 ? pair : [pair[1], pair[0]];
      if (!a.busy) { b.F.look = a.F.head.getWorldPosition(V3()); gesture(a, b).then(() => { if (rng() < .4) laugh(b); setTimeout(() => { if (!b.busy) b.F.look = null; }, 1500); }); }
    } else if (r < .8) { const g = pickOne(free); sip(g); }
    else { const g = pickOne(free); g.F.look = rng() < .5 ? bt.head.getWorldPosition(V3()) : camera.position; setTimeout(() => { g.F.look = null; }, 2200); }
  }
}

/* ---------- курилка: гость с газетой и курильщик с сигарой ---------- */
function seatIn(F, x, z, face, back = .05) {
  placeFig(F, x - Math.sin(face) * back, z - Math.cos(face) * back, face);
  F.legsFixed = true;
  F.legs.forEach(lg => { lg.tgt.set(lg.side * .13, .075, .5); lg.cur.copy(lg.tgt); });
}
const reader = makeFigure({ kind: "suit", body: "#2a2420", tie: "#5a1a1a", skin: 0xc49272, hair: 0x3a3430, mustache: true, hat: 0x1c1a18, seated: true, hipY: .52 });
seatIn(reader, 6.75, -.15, 2.69);
reader.leanT = -.08;
const NEWS = group(0, 1.0, .4, reader.root);
NEWS.rotation.x = -.35;
const newsMat = std({ map: TEX.news, roughness: .9, side: THREE.DoubleSide });
const newsL = group(0, 0, 0, NEWS), newsR = group(0, 0, 0, NEWS);
mesh(new THREE.PlaneGeometry(.3, .4), newsMat, -.15, 0, 0, newsL);
mesh(new THREE.PlaneGeometry(.3, .4), newsMat, .15, 0, 0, newsR);
newsL.rotation.y = .25; newsR.rotation.y = -.25;
const newsHands = () => {
  reach(reader.L, .27, .98, .35, V3(0, 1, -.2), DIR.in(1), .7);
  reach(reader.R, -.27, .98, .35, V3(0, 1, -.2), DIR.in(-1), .7);
};
newsHands();
reader.look = fromFig(reader, V3(0, .95, .45));
hot(reader.root, 2, "Газета: сухой закон", () => openCard(STORY), { grow: 0, noChip: true });
async function readerLife() {
  if (STILL) return;
  for (;;) {
    await sleep(R(9, 16));
    if (PAUSED) continue;
    // перелистывает: правая половина уходит влево
    reach(reader.R, .05, 1.05, .42, V3(0, 1, -.2), DIR.in(-1), .6);
    await tween(newsR.rotation, { y: -Math.PI + .3 }, .6);
    newsR.rotation.y = -.25;
    newsHands();
    if (rng() < .4) { reader.look = camera.position; await sleep(1.5); reader.look = fromFig(reader, V3(0, .95, .45)); }
  }
}

const SMOKE_ON = GUEST_H >= 19 || GUEST_H < 3;
let smoker = null;
const puffs = [];
if (SMOKE_ON) {
  smoker = makeFigure({ kind: "suit", body: "#1e1a20", tie: "#8a6a2a", skin: 0xb07a5a, hair: 0x6a6a6a, mustache: true, seated: true, hipY: .52 });
  seatIn(smoker, 6.75, -3.25, .45);
  smoker.lines = ["Хорошая сигара не терпит спешки.", "Камин, кресло и тишина. Что ещё нужно?", "В этом клубе не спрашивают, кто ты. Только пароль."];
  smoker.leanT = -.1;
  const cig = mesh(new THREE.CylinderGeometry(.009, .009, .13, 10), std({ color: 0x4a2a14, roughness: .8 }), 0, 0, 0);
  cig.rotation.z = Math.PI / 2;
  const tipC = mesh(new THREE.SphereGeometry(.0095, 8, 6), basic({ color: 0xff6a20, toneMapped: false }), .066, 0, 0, cig);
  const ch = grab(smoker, smoker.R, cig, V3(0, -.07, .03), 0);
  ch.k = 1; ch.tilt = undefined;
  smoker.cig = cig;
  reach(smoker.R, -.34, .8, .12, V3(0, -.3, 1), DIR.in(-1), .6);
  reach(smoker.L, .34, .78, .1, V3(0, -.3, 1), DIR.down, .3);
  hot(smoker.root, 2, "Курильщик", () => say(smoker, lineOf(smoker)), { grow: 0, noChip: true });
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.puff, color: 0xd8c8c0, transparent: true, opacity: 0, depthWrite: false }));
    s.userData.t = 1; world.add(s); puffs.push(s);
  }
}
onTick((t, dt) => {
  if (!smoker) return;
  smoker.cig.rotation.set(0, smoker.face + .4, Math.PI / 2 - .2);
  for (const s of puffs) {
    if (s.userData.t >= 1) { s.material.opacity = 0; continue; }
    s.userData.t += dt * .35;
    const k = s.userData.t;
    s.position.copy(s.userData.o).addScaledVector(s.userData.v, k).add(_w0.set(0, k * .5, 0));
    const sc = .08 + k * .45; s.scale.set(sc, sc, 1);
    s.material.opacity = (1 - k) * .4;
  }
});
async function smokerLife() {
  if (STILL || !smoker) return;
  for (;;) {
    await sleep(R(7, 12));
    if (PAUSED) continue;
    reach(smoker.R, -.04, 1.13, .2, V3(.3, .8, .5), DIR.in(-1));
    await sleep(1.6);
    reach(smoker.R, -.34, .8, .12, V3(0, -.3, 1), DIR.in(-1));
    await sleep(.5);
    // выдыхает дым
    const mouth = smoker.head.localToWorld(V3(0, .05, .12));
    const fwd = fromFig(smoker, V3(0, 0, .5)).sub(V3(smoker.x, 0, smoker.z));
    puffs.forEach((s, i) => setTimeout(() => { s.userData.t = 0; s.userData.o = mouth.clone(); s.userData.v = fwd.clone().multiplyScalar(R(.5, .9)); }, i * 90));
    smoker.nod = -.15; await sleep(1.2); smoker.nod = 0;
  }
}

/* ---------- читальня: писатель за столом и читательница в кресле ---------- */
const writer = makeFigure({ kind: "cardigan", body: "#4a3a28", shirt: "#e2d8c4", trousers: 0x1e1a16, skin: 0xd09a7a, hair: 0x5a3a22, seated: true, hipY: .56 });
placeFig(writer, WIN.x, -3.62, Math.PI);
writer.legsFixed = true;
writer.legs.forEach(lg => { lg.tgt.set(lg.side * .13, .075, .42); lg.cur.copy(lg.tgt); });
writer.lines = ["Пишу роман о баре, где время идёт по-настоящему.", "Не мешай, муза только что зашла.", "Осталось придумать последнюю главу. Может, ты подскажешь?"];
const pen = mesh(new THREE.CylinderGeometry(.004, .002, .14, 6), std({ color: 0x1a1210, roughness: .3 }), 0, 0, 0);
const penH = grab(writer, writer.R, pen, V3(0, -.07, .03), 0); penH.k = 1; penH.tilt = .5;
writer.mode = "write";
hot(writer.root, 0, "Писатель", () => say(writer, lineOf(writer)), { grow: 0, noChip: true });
onTick(t => {
  if (writer.mode === "write") {
    writer.leanT = .32;
    reach(writer.R, -.1 + Math.sin(t * 1.3) * .05 + Math.sin(t * 9) * .008, .815 + Math.max(0, Math.sin(t * 9)) * .006, .5 + Math.cos(t * 9) * .006, V3(.3, -.4, 1), DIR.down, .6);
    reach(writer.L, .17, .8, .48, V3(-.3, -.2, 1), DIR.down, .25);
    if (writer.look !== camera.position) writer.look = fromFig(writer, V3(-.08, .79, .52));
  } else if (writer.mode === "think") {
    writer.leanT = -.05;
    reach(writer.L, .02, 1.13, .14, V3(0, 1, .3), V3(-.2, 0, 1), .7);
    reach(writer.R, -.15, .82, .4, V3(.3, -.4, 1), DIR.down, .6);
  }
});
async function writerLife() {
  if (STILL) return;
  for (;;) {
    await sleep(R(10, 18));
    if (PAUSED) continue;
    writer.mode = "think";
    writer.look = V3(WIN.x + .3, 2.3, -5);
    await sleep(R(3, 5));
    writer.mode = "write";
  }
}

let lady = null;
if (GUEST_H >= 18 || GUEST_H < 1) {
  lady = makeFigure({ kind: "dress", body: "#5a1a2a", skin: 0xe0ac92, hair: 0x6a3a1a, hairStyle: "bob", lady: true, seated: true, hipY: .6 });
  seatIn(lady, -6.85, -1.25, .95, .02);
  lady.leanT = -.1;
  lady.lines = ["Тсс... я на самом интересном месте.", "«Великий Гэтсби». Перечитываю каждую осень, но и зимой хорошо.", "Попробуй открыть книгу рецептов на кафедре. Там все шестнадцать коктейлей."];
  const book = group(0, .96, .32, lady.root);
  book.rotation.x = -.7;
  mesh(new THREE.BoxGeometry(.3, .21, .02), std({ color: 0x3a1a10 }), 0, 0, -.012, book);
  const pg = std({ map: TEX.page, roughness: .95, side: THREE.DoubleSide });
  mesh(new THREE.PlaneGeometry(.14, .2), pg, -.072, 0, .001, book).rotation.y = .12;
  const leafG = group(0, 0, .002, book);
  mesh(new THREE.PlaneGeometry(.14, .2), pg, .072, 0, 0, leafG);
  leafG.rotation.y = -.12;
  lady.leaf = leafG;
  reach(lady.L, .16, .9, .3, V3(0, .6, .3), DIR.in(1), .6);
  reach(lady.R, -.16, .9, .3, V3(0, .6, .3), DIR.in(-1), .6);
  lady.look = fromFig(lady, V3(0, .92, .36));
  hot(lady.root, 0, "Читательница", () => say(lady, lineOf(lady)), { grow: 0, noChip: true });
}
async function ladyLife() {
  if (STILL || !lady) return;
  for (;;) {
    await sleep(R(8, 14));
    if (PAUSED) continue;
    await tween(lady.leaf.rotation, { y: -Math.PI + .12 }, .7);
    lady.leaf.rotation.y = -.12;
    if (rng() < .35) { lady.look = camera.position; await sleep(1.6); lady.look = fromFig(lady, V3(0, .92, .36)); }
  }
}
/* у заведения без курилки или читальни (заглушки залов) их гостей нет */
for (const [on, F] of [[FEAT.smoke, reader], [FEAT.smoke, smoker], [FEAT.nook, writer], [FEAT.nook, lady]]) if (!on && F) { F.off = true; F.root.visible = false; }
function companyLife() { guestLife(); readerLife(); smokerLife(); writerLife(); ladyLife(); }
Object.assign(H3D, { toast: () => pair.length === 2 && clinkToast(pair[0], pair[1]), sip: i => GUESTS[i] && sip(GUESTS[i]), guests: GUESTS });
