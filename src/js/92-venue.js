/* ================= платформа заведений в 3D: места для брони, колода у камина, спешл недели на стойке,
   строчка в углях для квеста, бокал «для вас» от друга. Данные — src/venues/<бар>.js, интерфейс — src/shared/97-venue.js ================= */

/* квест идёт через читальню (пометка в книге) и камин (строчка в углях): без этих залов его не пройти — выключаем */
if (!FEAT.nook || !FEAT.smoke) FEAT.quests = false;

/* ---------- маркеры мест: латунное кольцо на сиденье и ромбик над ним ---------- */
const SEAT_MARKS = [];
(() => {
  const ringMat = std({ color: 0xd6aa5c, metalness: 1, roughness: .3, emissive: 0x6a4010, emissiveIntensity: .6 });
  const gemMat = std({ color: 0xffd8a0, metalness: .6, roughness: .25, emissive: 0xd6902a, emissiveIntensity: 1.1 });
  for (const s of VX_SEATS) {
    const g = group(s.pos[0], s.pos[1], s.pos[2]);
    const ring = mesh(new THREE.TorusGeometry(.15, .007, 8, 40), ringMat, 0, .01, 0, g);
    ring.rotation.x = Math.PI / 2;
    const gem = mesh(new THREE.OctahedronGeometry(.032, 0), gemMat, 0, .34, 0, g);
    gem.scale.set(1, 1.5, 1);
    glowSprite(0xffb060, .32, 0, .34, 0, g, .5);
    // невидимая колонна побольше, чтобы попасть пальцем
    mesh(new THREE.CylinderGeometry(.17, .17, .45, 10), basic({ visible: false }), 0, .2, 0, g);
    g.userData.gem = gem; g.userData.ph = R(0, 6);
    g.visible = false;
    hot(g, s.zone, `Бронь: ${s.name}`, () => vxBook(s.id), { grow: .12 });
    SEAT_MARKS.push(g);
  }
  onTick((t, dt) => {
    for (const g of SEAT_MARKS) if (g.visible && !STILL) { const k = g.userData.gem; k.position.y = .34 + Math.sin(t * 1.6 + g.userData.ph) * .02; k.rotation.y += dt * .8; }
  });
})();
H3D.seats = () => {
  const on = vxO2O();
  for (const g of SEAT_MARKS) { g.visible = on; g.userData.hot.hidden = !on; }   // без брони у гостя нет и кнопок «Бронь: …» внизу
  if (typeof renderZoneUI === "function" && started) renderZoneUI(curZone);
};
H3D.seats();

/* ---------- афиша вечера: латунный стенд с ближайшим событием (VENUE.events) ----------
   Место задаёт зал заведения: rooms[i].eventStand = { pos: [x, z], rot, kind } (или VENUE.eventStand с zone); kind: "counter" — рама на стойке (по умолчанию,
   видна и на телефоне), "floor" — напольный мольберт для зала, где у входа есть место. */
const EVENT_STAND = (() => {
  const ev = vxNextEvent();
  if (!ev) return null;
  // место стенда — в зале (rooms[].eventStand, зона берётся из зала) или общим полем VENUE.eventStand
  const room = VENUE.rooms.find(r => r.eventStand);
  const S = Object.assign({ pos: [-.85, -2.25], rot: .14, zone: 1, kind: "counter" },
    room ? Object.assign({ zone: ROOM_ZONE[room.id] ?? 1 }, room.eventStand) : VENUE.eventStand || {});
  const ac = vxAccent(ev), F = VENUE.theme.fonts;
  const poster = canvasTex(512, 720, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#2a0c12"); bg.addColorStop(1, "#0e0406");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = ac; g.lineWidth = 6; g.strokeRect(16, 16, w - 32, h - 32);
    g.globalAlpha = .5; g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60); g.globalAlpha = 1;
    g.textAlign = "center";
    g.fillStyle = "#c2a784"; g.font = `italic 26px ${F.text}, Georgia, serif`; g.fillText("АФИША ВЕЧЕРА", w / 2, 96);
    g.fillStyle = ac; g.font = `34px ${F.display}, Georgia, serif`; g.fillText(vxEventDay(ev), w / 2, 168);
    g.font = `96px ${F.display}, Georgia, serif`; g.fillText(ev.time, w / 2, 280);
    g.fillStyle = "#f1e4cc";
    let size = 64; g.font = `${size}px ${F.display}, Georgia, serif`;
    let lines = vxWrap(g, ev.title, w - 80);
    while (lines.length > 3 && size > 36) { size -= 6; g.font = `${size}px ${F.display}, Georgia, serif`; lines = vxWrap(g, ev.title, w - 80); }
    let y = 380;
    lines.slice(0, 3).forEach(l => { g.fillText(l, w / 2, y); y += size * 1.1; });
    if (ev.lineup) { g.fillStyle = "#d6aa5c"; g.font = `italic 26px ${F.text}, Georgia, serif`; vxWrap(g, ev.lineup, w - 90).slice(0, 3).forEach(l => { y += 36; g.fillText(l, w / 2, y); }); }
    g.fillStyle = "#c2a784"; g.font = `22px ${F.text}, Georgia, serif`; g.fillText("нажмите, чтобы занять стол", w / 2, h - 58);
  });
  const onBar = S.kind !== "floor";
  const g = group(S.pos[0], onBar ? CT.top : 0, S.pos[1]);
  g.rotation.y = S.rot;
  if (onBar) {
    // настольная рама на стойке: латунь, наклон назад, опора сзади
    const frame = group(0, .235, 0, g);
    frame.rotation.x = -.16;
    box(-.175, .175, -.235, .235, -.01, 0, M.brass, frame, 0);
    mesh(new THREE.PlaneGeometry(.32, .45), basic({ map: poster }), 0, 0, .002, frame);
    const leg = mesh(new THREE.BoxGeometry(.02, .42, .008), M.brass, 0, .2, -.07, g);
    leg.rotation.x = .3;
    box(-.18, .18, 0, .012, -.03, .03, M.brass, g, 0);
    glowSprite(0xffc890, .55, 0, .26, .08, g, .1);
  } else {
    // напольный мольберт: три латунные ножки, полка и рама с афишей
    const leg = (x, z, rx, rz) => { const m = mesh(new THREE.CylinderGeometry(.011, .014, 1.72, 8), M.brass, x, .84, z, g); m.rotation.set(rx, 0, rz); };
    leg(-.3, .02, -.1, -.1); leg(.3, .02, -.1, .1); leg(0, -.3, .32, 0);
    box(-.36, .36, .9, .93, -.02, .07, M.brass, g, 0);
    const frame = group(0, 1.29, .02, g);
    frame.rotation.x = -.1;
    box(-.3, .3, -.4, .4, -.012, 0, M.brass, frame, 0);
    mesh(new THREE.PlaneGeometry(.54, .76), basic({ map: poster }), 0, 0, .002, frame);
    glowSprite(0xffc890, .9, 0, 1.34, .14, g, .12);
  }
  hot(g, S.zone, `Афиша: ${ev.title}`, () => vxEvent(ev), { grow: .04 });
  return { g, ev };
})();

/* ---------- колода вопросов на столике у камина ---------- */
(() => {
  if (!VENUE.deck) return;
  const back = canvasTex(256, 352, (g, w, h) => {
    g.fillStyle = "#3a0e16"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#d6aa5c"; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24);
    g.lineWidth = 2; g.strokeRect(26, 26, w - 52, h - 52);
    g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4); g.strokeRect(-44, -44, 88, 88); g.restore();
    g.fillStyle = "#d6aa5c"; g.font = "86px Forum, Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(VENUE.meta.name.charAt(0), w / 2, h / 2 + 4);
  });
  // столик курилки (центр в 6.05, край у кресел); нет курилки — колода лежит на стойке
  const deck = FEAT.smoke ? group(FP.x - 1.93 - .17, .481, FP.z + .06) : group(1.82, CT.top, -2.22);
  deck.rotation.y = FEAT.smoke ? .5 : -.35;
  const edge = std({ color: 0xe9dfcb, roughness: .8 });
  mesh(new THREE.BoxGeometry(.066, .024, .092), [edge, edge, std({ map: back, roughness: .55 }), edge, edge, edge], 0, .012, 0, deck);
  // верхняя карта чуть сдвинута — видно, что это колода
  const top = mesh(new THREE.PlaneGeometry(.066, .092), std({ map: back, roughness: .55 }), .006, .0255, -.004, deck);
  top.rotation.set(-Math.PI / 2, 0, .08);
  hot(deck, FEAT.smoke ? 2 : 1, "Колода вопросов", () => vxDeck(), { grow: .12 });
})();

/* ---------- спешл недели: табличка-домик на стойке ---------- */
(() => {
  const sp = vxSpecial();
  if (!sp) return;
  const tex = canvasTex(320, 220, (g, w, h) => {
    g.fillStyle = "#1c070b"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#d6aa5c"; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 1.5; g.strokeRect(18, 18, w - 36, h - 36);
    g.textAlign = "center"; g.fillStyle = "#c2a784"; g.font = "italic 24px Literata, Georgia, serif";
    g.fillText("Спешл недели", w / 2, 62);
    g.fillStyle = "#f1e4cc";
    let size = 54; g.font = `${size}px Forum, Georgia, serif`;
    while (g.measureText(sp.name).width > w - 50 && size > 28) { size -= 4; g.font = `${size}px Forum, Georgia, serif`; }
    g.fillText(sp.name, w / 2, 130);
    g.fillStyle = "#d6aa5c"; g.fillRect(w / 2 - 40, 156, 80, 2);
    g.fillStyle = "#c2a784"; g.font = "20px Literata, Georgia, serif"; g.fillText("спросите у бармена", w / 2, 188);
  });
  // если на этом месте стоит рама с афишей (по умолчанию так), табличка спешла отходит левее
  const st = (VENUE.rooms.find(r => r.eventStand) || {}).eventStand || VENUE.eventStand;
  const tent = group(vxNextEvent() && !(st && st.kind === "floor") ? -1.55 : -.82, CT.top, -2.17);
  tent.rotation.y = .22;
  const face = std({ map: tex, roughness: .6 }), backMat = std({ color: 0x1c070b, roughness: .7 });
  for (const s of [1, -1]) {
    const p = mesh(new THREE.PlaneGeometry(.16, .11), s > 0 ? face : backMat, 0, .052, s * .018, tent);
    p.rotation.x = -s * .33;
    if (s < 0) p.rotation.y = Math.PI;
  }
  mesh(new THREE.BoxGeometry(.16, .004, .004), M.brass, 0, .104, 0, tent);
  hot(tent, 1, `Спешл недели: ${sp.name}`, () => openCard(sp, { info: true }), { grow: .1 });
})();

/* ---------- квест: камин показывает рецепт строчкой в углях ---------- */
const EMBER_WORDS = (() => {
  const tex = canvasTex(512, 96, (g, w, h) => {
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = "italic 40px Literata, Georgia, serif";
    g.shadowColor = "#ff7a20"; g.shadowBlur = 18; g.fillStyle = "#ffcf8a";
    g.fillText("джин · вермут · вишня · горечь", w / 2, h / 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.position.set(FP.x - .55, .62, FP.z);
  s.scale.set(.9, .17, 1);
  s.visible = false;
  world.add(s);
  return { s, t: -1 };
})();
onTick((t, dt) => {
  const E = EMBER_WORDS;
  if (E.t < 0) return;
  E.t += dt;
  E.s.material.opacity = clamp(Math.min(E.t / 1.2, (7 - E.t) / 1.5), 0, .95) * (.85 + Math.sin(E.t * 9) * .08);
  if (E.t > 7) { E.t = -1; E.s.visible = false; }
});
(() => {
  const fp = FEAT.smoke && HOT.find(h => h.userData.hot.zone === 2 && (h.userData.hot.label === "Подбросить дров" || h.userData.hot.label === "Свечи в камине"));
  if (!fp) return;
  const act = fp.userData.hot.act;
  fp.userData.hot.act = () => {
    act();
    if (vxQuestEmber()) { FIRE.boost = 2.2; EMBER_WORDS.s.visible = true; EMBER_WORDS.t = 0; }
  };
})();

/* ---------- бокал от друга: стоит у свободного табурета с табличкой «Для вас» ---------- */
const TREAT = { glass: null, card: null, armed: !!VX.treat, wait: 0 };
function treatClear() {
  for (const o of [TREAT.glass, TREAT.card]) if (o) drop(o);
  TREAT.glass = TREAT.card = null;
}
H3D.treatClear = treatClear;
onTick((t, dt) => {
  // бармен шепчет состав легенды, когда гость после камина приходит к стойке
  if (curZone === 1 && VX.quest === 2 && !VX.questTold && !busy && !BT.busy && !STREET.on && started) {
    const line = vxQuestBar();
    if (line) btLine(line, 8, true);
  }
  if (!TREAT.armed) return;
  const intro = document.querySelector(".intro");
  if (!started || STREET.on || busy || BT.busy || (intro && !intro.classList.contains("gone"))) return;
  TREAT.wait += dt;
  if (TREAT.wait < 1.2) return;
  TREAT.armed = false;
  (curZone === 1 ? Promise.resolve() : goZone(1)).then(() => {
    const c = vxTreatArrive();
    if (!c) return;
    treatClear();
    const x = SEAT_X + .1, z = -2.15;
    TREAT.glass = makeGlass(c.cup, c.pour, { garnish: c.garnish, ice: c.cup === "rocks" || c.cup === "highball", op: c.pourOp || .88 });
    TREAT.glass.position.set(x, CT.top, z);
    TREAT.glass.scale.setScalar(1.35);
    world.add(TREAT.glass);
    const tex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = "#efe4cc"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#a07a3a"; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = "#4a1a12"; g.textAlign = "center"; g.font = "italic 34px Literata, Georgia, serif"; g.fillText("Для вас", w / 2, 60);
      g.font = "20px Literata, Georgia, serif"; g.fillStyle = "#6a4a3a"; g.fillText("оставили коктейль", w / 2, 96);
    });
    TREAT.card = group(x + .2, CT.top, z + .02);
    TREAT.card.rotation.y = -.3;
    const p = mesh(new THREE.PlaneGeometry(.12, .06), std({ map: tex, roughness: .8 }), 0, .03, 0, TREAT.card);
    p.rotation.x = -.35;
  });
});

/* ---------- наклон телефона: лёгкий параллакс без разрешений (Android и браузеры, где датчик открыт) ---------- */
(() => {
  if (STILL || !("DeviceOrientationEvent" in window) || typeof DeviceOrientationEvent.requestPermission === "function") return;
  let b0 = null, g0 = null;
  addEventListener("deviceorientation", e => {
    if (e.beta == null || e.gamma == null || reduceMotion.matches || SET.saver) { GYRO.on = false; return; }
    if (b0 == null) { b0 = e.beta; g0 = e.gamma; }
    b0 += (e.beta - b0) * .004; g0 += (e.gamma - g0) * .004;   // со временем «ноль» подстраивается под то, как держат телефон
    GYRO.x = clamp((e.gamma - g0) / 25, -1, 1);
    GYRO.y = clamp((e.beta - b0) / 25, -1, 1);
    GYRO.on = true;
  }, { passive: true });
})();

/* ---------- для проверок: нажать предмет зала по подписи, узнать состояние маркеров и углей ---------- */
H3D.press = (zone, re) => { const h = HOT.find(o => o.userData.hot.zone === zone && new RegExp(re, "i").test(o.userData.hot.label)); if (h) h.userData.hot.act(); return h ? h.userData.hot.label : null; };
H3D.venue = () => ({ seats: SEAT_MARKS.filter(g => g.visible).length, ember: EMBER_WORDS.s.visible, treat: !!TREAT.glass });
