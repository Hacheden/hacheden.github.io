/* ================= место у стойки: гость садится, бармен подбирает напиток под настроение ================= */
const SEAT_X = 1.25;   // этот табурет всегда свободен: напротив шейкера
const SEAT = { on: false, gen: 0, mood: null, strength: null, pickI: 0 };
const talkEl = document.getElementById("talk");

/* что посоветовать: настроение × крепость → коктейли и слова бармена (факты — как в книге рецептов) */
const ADVICE = {
  celebrate: {
    strong: [
      ["c-sidecar", "Тогда «Сайдкар»: коньяк, апельсиновый ликёр и лимон. Классика Парижа и Лондона, ровесница ревущих двадцатых."],
      ["c-manhattan", "«Манхэттен»: ржаной виски, красный вермут и вишня. Нью-Йорк конца XIX века — торжественно и без суеты."],
      ["c-hacheden", `Тогда наш фирменный «${BAR_NAME}»: горящий коньяк с вишней, огненная струя между двух кружек и цедра через пламя. Смотрите внимательно.`]
    ],
    light: [
      ["c-sunrise", "«Текила санрайз» — рассвет в стакане. Её прославили The Rolling Stones в американском туре 1972 года."],
      ["c-mojito", "«Мохито»: ром, лайм, мята и много льда. Праздник по-гавански."]
    ]
  },
  relax: {
    strong: [
      ["c-oldfashioned", "«Олд фэшн»: виски, капля сахара, биттер и большой кусок льда. Его пьют медленно — то, что нужно."],
      ["c-sour", "Виски сауэр: виски, лимон, сахар и белок — под шелковистой пеной с тремя каплями ангостуры. Рецепт есть ещё в книге Джерри Томаса 1862 года."]
    ],
    light: [
      ["c-pinacolada", "«Пина колада»: ром, ананас и кокос. С 1978 года — официальный напиток Пуэрто-Рико."],
      ["c-cubalibre", "«Куба либре»: ром, кола и лайм. Гавана, около 1900 года. Просто и без спешки."]
    ]
  },
  think: {
    strong: [
      ["c-negroni", "«Негрони»: джин, кампари и красный вермут поровну. Флоренция, около 1919 года. Горечь располагает к мыслям."],
      ["c-martini", "Сухой мартини: джин, немного вермута и оливка. Строгий напиток для неспешного вечера."]
    ],
    light: [
      ["c-gintonic", "Джин-тоник: горчинка хинина, лайм и пузырьки. Под него хорошо думается."],
      ["c-collins", "«Том Коллинз»: джин, лимон и содовая. Лёгкий, с пузырьками и с историей о розыгрыше 1874 года."]
    ]
  },
  fresh: {
    strong: [
      ["c-daiquiri", "«Дайкири»: ром, лайм и сахар, встряхнуть со льдом. Три ингредиента — и чистая свежесть."],
      ["c-margarita", "«Маргарита»: текила, апельсиновый ликёр и лайм. Свежо и с характером."],
      ["c-junglebird", "«Джангл бёрд»: тёмный ром, кампари, ананас и лайм. Куала-Лумпур, 1978 год — тропики с горчинкой, а сверху пенка от ананаса."],
      ["c-pisco", "«Писко сауэр»: перуанский виноградный бренди, лимон и белок. Лима, «Бар Морриса», 1920-е — свежо, с бархатной пеной и тремя каплями ангостуры."]
    ],
    light: [
      ["c-mojito", "«Мохито»: мята, лайм, ром и колотый лёд доверху. Освежает лучше всего."],
      ["c-gintonic", "Джин-тоник со льдом и лаймом. Холодный, сухой и звонкий."]
    ]
  },
  none: [
    ["c-nojito", "Тогда мохито без алкоголя: мята, лайм и содовая со льдом. Свежести не меньше, чем в оригинале."]
  ]
};
const MOODS = [["celebrate", "Есть что отметить"], ["relax", "Хочу расслабиться"], ["think", "Задумчивое"], ["fresh", "Освежиться бы"]];

/* кадр с табурета: глаза сидящего гостя, бармен напротив */
function seatShot(served = false) {
  const narrow = innerWidth / innerHeight < .8;
  return { px: SEAT_X, py: 1.5, pz: -1.32, tx: SEAT_X - .05, ty: served ? 1.2 : 1.38, tz: -3.4, fov: narrow ? 62 : 52 };
}
/* реплика бармена: облачко плавно сменяется */
function btSay(text) {
  bubbleEl.classList.remove("show");
  return new Promise(res => setTimeout(() => { say(bt, text, 900); res(); }, STILL ? 0 : 220));
}
function quietBubble() { if (bubble && bubble.F === bt) bubble.until = 0; }
/* варианты ответа под облачком */
function answers(list) {
  talkEl.innerHTML = "";
  list.forEach(([label, fn, quiet], i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    if (quiet) b.className = "quiet";
    b.style.animationDelay = (i * .07) + "s";
    b.addEventListener("click", () => { if (SEAT.on && !busy) fn(); });
    talkEl.appendChild(b);
  });
  talkEl.hidden = !list.length;
}
const standBtn = ["Встать из-за стойки", () => standUp(), true];

async function sitDown() {
  if (SEAT.on || busy || modalOpen() || mixDlg.open) return;
  SEAT.on = true;
  const g = ++SEAT.gen;
  hideTip();
  app.classList.add("seated");
  subEl.textContent = "Место у стойки, напротив бармена";
  answers([]);
  tween(LOOK, { yaw: 0, pitch: 0 }, 1.2);
  nudge = 0;
  const fly = flyTo(seatShot(), 2.4, .25);
  // бармен заканчивает своё дело и подходит
  for (let i = 0; i < 80 && (BT.busy || BT.mode !== "polish"); i++) await sleep(.1);
  if (g !== SEAT.gen) return;
  BT.busy = true;
  bt.look = null;
  await walkTo(SEAT_X + .04, BT_Z + .1, 0);
  await fly;
  if (g !== SEAT.gen) return;
  bt.look = camera.position;
  // напиток уже подан: бармен придвигает бокал к гостю и не спрашивает про настроение заново
  if (servedGlass && servedGlass.parent === world) {
    const fresh = SIP.glass !== servedGlass, full = fresh || SIP.frac > .02;
    const to = V3(SEAT_X + .06, CT.top, -2.14);
    const gp = servedGlass.position, dist = gp.distanceTo(to);
    if (dist > .04) {
      BT.mode = "free";
      if (Math.abs(gp.x - bt.x) > .45) await walkTo(gp.x + .2, BT_Z, 0);
      const handOn = () => { const l = toFig(bt, gp); reach(bt.R, l.x + .02, CT.top + .06, l.z - .05, V3(0, -.3, 1), DIR.in(-1), .3); };
      handOn();
      await sleep(STILL ? 0 : .45);
      if (g !== SEAT.gen) return;
      const walk = walkTo(SEAT_X + .04, BT_Z + .1, 0);
      let done = false;
      tween(gp, { x: to.x, y: to.y, z: to.z }, STILL ? .001 : clamp(dist * 1.1, .8, 2), ease.io).then(() => { done = true; });
      while (!done) { handOn(); await sleep(.05); }
      await walk;
      reach(bt.R, -.23, .92, .06, DIR.down, V3(1, 0, .3), .25);
      BT.mode = "polish";
      if (g !== SEAT.gen) return;
    }
    if (fresh) prepSip();
    if (full) {
      await btSay(choose(["С возвращением. Ваш бокал — я придвинул поближе.", "Присаживайтесь, ваш напиток вас дождался."]));
      if (g !== SEAT.gen) return;
      seatAnswers();
    } else {
      await btSay("Вижу, бокал уже пуст. Повторим?");
      if (g !== SEAT.gen) return;
      answers([["Ещё по одной", oneMore], standBtn]);
    }
    return;
  }
  await btSay("Добрый вечер! Присаживайтесь. Какое сегодня настроение?");
  await sleep(.5);
  if (g !== SEAT.gen) return;
  askMood();
}
function askMood() {
  answers([...MOODS.map(([id, label]) => [label, () => askStrength(id)]), standBtn]);
}
async function askStrength(mood) {
  SEAT.mood = mood;
  answers([]);
  bt.tilt = .08;
  await btSay(mood === "celebrate" ? "Прекрасный повод. Покрепче или полегче?" : mood === "relax" ? "Понимаю. Покрепче или полегче?"
    : mood === "think" ? "Хороший вечер для этого. Покрепче или полегче?" : "Сейчас освежим. Покрепче или полегче?");
  bt.tilt = 0;
  answers([["Покрепче", () => suggest("strong")], ["Полегче", () => suggest("light")], ["Без алкоголя", () => suggest("none")], standBtn]);
}
async function suggest(strength, next = false) {
  const g = SEAT.gen;
  SEAT.strength = strength;
  const list = strength === "none" ? ADVICE.none : ADVICE[SEAT.mood][strength];
  if (next) SEAT.pickI++; else SEAT.pickI = Math.floor(rng() * list.length);
  const [id, line] = list[SEAT.pickI % list.length];
  answers([]);
  // задумался на секунду: взгляд на полку с бутылками
  bt.look = V3(SEAT_X, 1.7, -4.2);
  await sleep(.7);
  if (g !== SEAT.gen) return;
  bt.look = camera.position;
  await btSay(next && list.length < 2 ? "Без алкоголя лучше него ничего не придумать. " + line : line);
  answers([["Готовьте!", () => order(id)], ["А что ещё?", () => suggest(strength, true)], ["Другое настроение", () => { answers([]); btSay("Тогда начнём сначала. Какое настроение?").then(askMood); }, true], standBtn]);
}
function order(id) {
  answers([]);
  quietBubble();
  BT.busy = false;   // дальше бармен работает по обычному сценарию коктейля
  makeCocktail(id);
}
/* после коктейля: бармен остаётся напротив */
async function afterServe() {
  if (!SEAT.on) return;
  const g = SEAT.gen;
  BT.busy = true;
  await walkTo(SEAT_X + .04, BT_Z + .1, 0);
  if (g !== SEAT.gen) return;
  bt.look = camera.position;
  prepSip();
  await btSay("Приятного вечера. Если что — я рядом.");
  if (g !== SEAT.gen) return;
  seatAnswers();
}
/* встать: чистим всё, что связано с местом у стойки (камеру двигает вызывающий) */
function leaveSeat() {
  if (!SEAT.on) return;
  SEAT.on = false;
  SEAT.gen++;
  abortSip();
  answers([]);
  quietBubble();
  app.classList.remove("seated");
  subEl.textContent = ZONES[1].sub;
  if (bt.look === camera.position) bt.look = null;
  bt.tilt = 0;
  if (!busy) BT.busy = false;
}
function standUp() { leaveSeat(); goZone(1, 1.6); }
addEventListener("keydown", e => { if (e.key === "Escape" && SEAT.on && !modalOpen() && !mixDlg.open && !busy) standUp(); });

/* невидимая зона над табуретом: на неё можно нажать */
{
  const hit = mesh(new THREE.CylinderGeometry(.24, .24, .5, 12), basic({ visible: false }), SEAT_X, .85, -1.5);
  hot(hit, 1, "Сесть за стойку", () => sitDown(), { grow: 0 });
  HOT.unshift(HOT.pop());   // первая кнопка в ряду: так её видно и на телефоне
}
Object.assign(H3D, { sit: () => sitDown() });
