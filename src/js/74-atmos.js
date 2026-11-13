/* ================= атмосфера залов, настройки графики, секреты и редкие события ================= */
const ROOMS = Object.assign({ lamp: "warm", rain: 1, fire: true, smoke: "warm", crackle: 1, lib: "warm" },
  (() => { try { return JSON.parse(localStorage.getItem("hacheden-rooms")) || {}; } catch (e) { return {}; } })());
const saveRooms = () => { try { localStorage.setItem("hacheden-rooms", JSON.stringify(ROOMS)); } catch (e) {} };
const LAMP_MUL = { bright: 1.45, warm: 1, dim: .45 }, FILL_MUL = { bright: 1.15, warm: 1, dim: .55 };

/* ---------- эффекты и качество из настроек ---------- */
function applyEffects() {
  const on = SET.effects && !SET.saver;
  DUST.p.visible = on;
  for (const s of haze) s.visible = on;
  for (const s of smoke) s.visible = on;
}
applyEffects();
onSetting(k => {
  if (k === "effects" || k === "saver") applyEffects();
  if (k === "quality" || k === "saver") { DPR = Math.min(devicePixelRatio || 1, dprCap()); renderer.setPixelRatio(DPR); resize(); }
  if (k === "quality" || k === "saver") { const t = SET.saver || SET.quality === "low" ? 0 : SET.quality === "high" ? 2 : SET.quality === "medium" ? 1 : QUALITY > 1 ? 2 : 1; POST.tier = Math.min(t, 2); bloom.enabled = t >= 1; }
  if (k === "mood") applyTime();
});

/* ---------- свет и звук комнат ---------- */
function applyRooms() {
  NOOK.lampMode = LAMP_MUL[ROOMS.lamp] || 1;
  if (NOOK.lampGlow) NOOK.lampGlow.material.opacity = .5 * Math.min(1.3, NOOK.lampMode);
  ZONE_LIGHT[0] = FILL_MUL[ROOMS.lib] || 1;
  ZONE_LIGHT[2] = ROOMS.smoke === "dim" ? .5 : 1;
  FIRE.on = ROOMS.fire;
  Music.mix({ rain: ROOMS.rain, fire: ROOMS.crackle * (ROOMS.fire ? 1 : .12) });
  const st = HOT.find(o => o.userData.hot.label === "Подбросить дров" || o.userData.hot.label === "Разжечь камин");
  if (st) { st.userData.hot.label = ROOMS.fire ? "Подбросить дров" : "Разжечь камин"; if (st.userData.chip) st.userData.chip.textContent = st.userData.hot.label; }
  applyTime();
}
/* камин: «Подбросить дров» разжигает погасший огонь */
{
  const st = HOT.find(o => o.userData.hot.label === "Подбросить дров");
  if (st) {
    const base = st.userData.hot.act;
    st.userData.hot.act = () => { if (!ROOMS.fire) { ROOMS.fire = true; saveRooms(); applyRooms(); FIRE.boost = 1.8; crackle(); toast("Камин разгорается", "Дрова потрескивают"); } else base(); };
  }
}

/* панель «Атмосфера» для читальни и курилки */
const atmoDlg = document.createElement("dialog");
atmoDlg.className = "atmo";
atmoDlg.setAttribute("aria-labelledby", "atmo-title");
document.body.appendChild(atmoDlg);
function renderAtmo() {
  const z = curZone;
  const segB = (key, v, t) => `<button class="chip" type="button" data-room="${key}:${v}" aria-pressed="${ROOMS[key] === v}">${t}</button>`;
  const rangeRow = (key, label) => `<div class="row slider"><label for="r-${key}">${label}</label><input class="rng" type="range" id="r-${key}" data-rr="${key}" min="0" max="100" value="${Math.round(ROOMS[key] * 100)}" style="--v:${Math.round(ROOMS[key] * 100)}%"><output>${Math.round(ROOMS[key] * 100)}%</output></div>`;
  let html = `<button class="close" type="button" aria-label="Закрыть" data-atmo-close>×</button>`;
  if (z === 0) {
    html += `<h2 id="atmo-title">Атмосфера читальни</h2>
      <div class="row" style="grid-template-columns:1fr"><span class="lbl">Настольная лампа</span><div class="seg">${segB("lamp", "bright", "Яркая")}${segB("lamp", "warm", "Тёплая")}${segB("lamp", "dim", "Приглушённая")}</div></div>
      <div class="row" style="grid-template-columns:1fr"><span class="lbl">Свет в комнате</span><div class="seg">${segB("lib", "bright", "Светлее")}${segB("lib", "warm", "Как обычно")}${segB("lib", "dim", "Полумрак")}</div></div>
      <div class="row"><span class="lbl">Свеча на столе</span><button class="make ghost" type="button" data-candle>${NOOK.candleOn ? "Задуть" : "Зажечь"}</button></div>
      ${rangeRow("rain", "Шум дождя")}
      <div class="acts"><button class="make" type="button" data-stories>Полка рассказов</button></div>`;
  } else {
    html += `<h2 id="atmo-title">Атмосфера курилки</h2>
      <div class="row"><span class="lbl">Камин</span><span class="sw"><input type="checkbox" data-fire aria-label="Камин горит"${ROOMS.fire ? " checked" : ""}><span></span></span></div>
      <div class="row" style="grid-template-columns:1fr"><span class="lbl">Свет</span><div class="seg">${segB("smoke", "warm", "Тёплый")}${segB("smoke", "dim", "Приглушённый")}</div></div>
      ${rangeRow("crackle", "Треск дров")}
      <div class="acts"><button class="make" type="button" data-player>Граммофон: выбрать музыку</button></div>`;
  }
  atmoDlg.innerHTML = html;
}
function openAtmo() {
  for (const o of document.querySelectorAll("dialog.sheet[open]")) o.close();
  renderAtmo();
  atmoDlg.show();
  uiSound("open");
  const f = atmoDlg.querySelector(".chip, .make, input"); if (f) f.focus({ preventScroll: true });
}
atmoDlg.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if ("atmoClose" in b.dataset) { atmoDlg.close(); return; }
  if (b.dataset.room) { const [k, v] = b.dataset.room.split(":"); ROOMS[k] = v; saveRooms(); applyRooms(); renderAtmo(); const f = atmoDlg.querySelector(`[data-room="${k}:${v}"]`); if (f) f.focus(); }
  else if ("candle" in b.dataset) { toggleCandle(); renderAtmo(); const f = atmoDlg.querySelector("[data-candle]"); if (f) f.focus(); }
  else if ("stories" in b.dataset) { atmoDlg.close(); openStories(); }
  else if ("player" in b.dataset) { atmoDlg.close(); openPlayer(); }
});
atmoDlg.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.rr) { ROOMS[t.dataset.rr] = +t.value / 100; t.style.setProperty("--v", t.value + "%"); t.nextElementSibling.textContent = t.value + "%"; saveRooms(); applyRooms(); Music.wake(); }
});
atmoDlg.addEventListener("change", e => { if ("fire" in e.target.dataset) { ROOMS.fire = e.target.checked; saveRooms(); applyRooms(); if (ROOMS.fire) { FIRE.boost = 1.6; crackle(); } } });
addEventListener("keydown", e => { if (e.key === "Escape" && atmoDlg.open) atmoDlg.close(); });
/* кнопки-«чипы» без предмета в зале */
function chipOnly(zone, label, act, x = 0, y = -5, z = 0) {
  const m = mesh(new THREE.BoxGeometry(.01, .01, .01), basic({ visible: false }), x, y, z);
  m.userData.noHit = true;
  return hot(m, zone, label, act, { grow: 0 });
}
chipOnly(0, "Атмосфера", openAtmo);
chipOnly(2, "Атмосфера", openAtmo);

/* ---------- читальня: стопка рассказов и книга, что светится без свечи ---------- */
const LIB = {};
{
  const dx = NOOK.lampGlow.position.x + .5, top = .785;   // стол писателя у окна
  const stack = group(dx - .64, top, -4.1);
  const covers = [0x5a1420, 0x1f3a2c, 0x2a2440];
  covers.forEach((c, i) => {
    const b = mesh(new THREE.BoxGeometry(.2 - i * .015, .035, .15 - i * .01), std({ color: c, roughness: .7 }), 0, .018 + i * .036, 0, stack);
    b.rotation.y = (i - 1) * .18;
    mesh(new THREE.BoxGeometry(.19 - i * .015, .028, .004), std({ color: 0xeee2c4, roughness: .9 }), 0, .018 + i * .036, (.15 - i * .01) / 2 - .001, stack).rotation.y = (i - 1) * .18;
  });
  hot(stack, 0, "Полка рассказов", () => openStories(), { grow: .08 });
  LIB.stack = stack;
  // книга без названия: днём обычная, без свечи на обложке проступают светящиеся строки
  const book = group(dx - .2, top + .186, -4.5);   // сверху на стопке книг
  book.rotation.y = .25;
  mesh(new THREE.BoxGeometry(.17, .03, .23), std({ color: 0x1a1210, roughness: .8 }), 0, .015, 0, book);
  LIB.glowMat = basic({ map: canvasTex(256, 340, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = "#bfe8ff"; c.fillStyle = "#bfe8ff"; c.lineWidth = 3;
    c.strokeRect(18, 18, w - 36, h - 36);
    c.textAlign = "center"; fitFont(c, BAR_SIGN, w - 60, 28, "Forum, Georgia, serif");
    c.fillText(BAR_SIGN, w / 2, 90);
    for (let i = 0; i < 7; i++) c.fillRect(48, 140 + i * 24, w - 96 - (i % 3) * 30, 3);
    c.beginPath(); c.arc(w / 2, 300, 12, 0, Math.PI * 2); c.stroke();
  }), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const face = mesh(new THREE.PlaneGeometry(.16, .22), LIB.glowMat, 0, .031, 0, book);
  face.rotation.x = -Math.PI / 2; face.userData.noHit = true;
  LIB.glow = glowSprite(0x9fd8ff, .5, 0, .06, 0, book, 0);
  LIB.book = book;
  hot(book, 0, "Книга без названия", () => {
    if (LIB.lit > .6) { track("secret", "glowbook"); openStories(SECRET_STORY.id); }
    else toast("Книга без названия", "На обложке ни слова, страницы пустые. Странно…");
  }, { grow: .06 });
  LIB.lit = 0;
  onTick((t, dt) => {
    const want = NOOK.candleOn || curZone !== 0 ? 0 : 1;
    LIB.lit += (want - LIB.lit) * Math.min(1, dt * (want ? .5 : 2));
    LIB.glowMat.opacity = LIB.lit * (.75 + .15 * Math.sin(t * 1.7));
    LIB.glow.material.opacity = LIB.lit * .35;
  });
}

/* ---------- кот: если гладить долго, он доверяет ---------- */
{
  const h = HOT.find(o => o.userData.hot.label === "Кот");
  if (h) {
    const base = h.userData.hot.act;
    let n = 0;
    h.userData.hot.act = () => {
      base();
      if (++n === 5) {
        const g = CAT.head.parent;
        tween(g.rotation, { z: .5 }, .6, ease.out).then(() => wait(2.2)).then(() => tween(g.rotation, { z: 0 }, .8));
        track("secret", "cat");
      }
    };
  }
}
/* ---------- дверь «Приват»: условный стук ---------- */
{
  const h = HOT.find(o => o.userData.hot.label === "Постучать в дверь" && o.userData.hot.zone === 2);
  if (h) {
    const base = h.userData.hot.act;
    let n = 0, t0 = 0;
    h.userData.hot.act = () => {
      const now = performance.now();
      if (now - t0 > 20000) n = 0;
      t0 = now;
      if (++n === 3) track("secret", "knock");
      base();
    };
  }
}
/* ---------- граммофон и сцена открывают плеер ---------- */
{
  const g = HOT.find(o => o.userData.hot.label === "Граммофон: музыка");
  if (g) { g.userData.hot.label = "Граммофон: плеер"; g.userData.hot.act = () => openPlayer(); }
  chipOnly(3, "Плеер: выбрать композицию", () => openPlayer());
}

/* ---------- редкое событие: кот приходит на стойку ---------- */
const CATV = { chance: QS.get("rare") === "cat" ? 1 : .2, done: false, on: false, since: 0 };
CATV.today = Math.random() < CATV.chance;
setInterval(() => {
  if (!CATV.today || CATV.done || CATV.on || !started || curZone !== 1 || busy || SEAT.on || modalOpen() || mixDlg.open || STREET.on) { CATV.since = 0; return; }
  CATV.since += 5;
  if (CATV.since < (QS.get("rare") === "cat" ? 5 : 75)) return;
  catVisit();
}, 5000);
function catVisit() {
  const g = CAT.head.parent, h = g.userData.hot;
  CATV.on = true;
  CATV.home = { p: g.position.clone(), r: g.rotation.y, act: h.act, label: h.label, zone: h.zone, y0: h.y0 };
  g.position.set(2.1, CT.top + .005, (CT.z0 + CT.z1) / 2 - .1);
  g.rotation.y = -2.1;
  h.zone = 1; h.label = "Кот на стойке"; h.y0 = g.position.y;
  h.act = () => { CATV.home.act(); track("secret", "catvisit"); hintEl.textContent = "Кот щурится и мурлычет. Бармен делает вид, что ничего не видит."; setTimeout(catHome, 25000); };
  renderZoneUI(1);
  hintEl.textContent = "На стойку запрыгнул кот из курилки. Бармен делает вид, что не замечает.";
  setTimeout(catHome, 120000);
}
function catHome() {
  if (!CATV.on) return;
  const g = CAT.head.parent, h = g.userData.hot, H = CATV.home;
  g.position.copy(H.p); g.rotation.y = H.r;
  Object.assign(h, { act: H.act, label: H.label, zone: H.zone, y0: H.y0 });
  CATV.on = false; CATV.done = true;
  renderZoneUI(curZone);
  if (curZone === 1 && !busy) hintEl.textContent = ZONES[1].hint;
}

applyRooms();
Object.assign(H3D, { rooms: ROOMS, applyRooms, lib: LIB, catVisit, atmo: openAtmo });
