/* ================= конец смены: последняя мелодия, гости расходятся, бармен убирает и гасит свет ================= */
const CLOSING = { on: false, gen: 0, skip: false };
const CLOSE_ABORT = { closing: true };
function cAlive(g) { if (g !== CLOSING.gen || CLOSING.skip) throw CLOSE_ABORT; }
async function cw(g, s) { await sleep(STILL ? 0 : s); cAlive(g); }
const peekBtn = document.getElementById("peek");

/* кнопка на закрытом экране: первые полчаса после трёх видно, как смена заканчивается; хозяину — всегда */
function updatePeek() {
  const h = hoursOf(nowDate());
  const justClosed = !isOpen() && h >= CLOSE_H && h < CLOSE_H + .5;
  peekBtn.hidden = !(justClosed || OWNER) || started || CLOSING.on;
  peekBtn.textContent = OWNER && !justClosed ? "Посмотреть, как закрывается смена" : "Заглянуть: смена закрывается";
}
updatePeek();
setInterval(updatePeek, 15000);
peekBtn.addEventListener("click", () => {
  if (started || CLOSING.on) return;
  started = true;
  closedNow = false;
  intro.classList.add("gone");
  peekBtn.hidden = true;
  renderer.toneMappingExposure = 1.2;
  if (!Music.on) setMusic(true);
  setCam(framed(1));
  renderZoneUI(1);
  playClosing();
});

function cCaption(t) { caption("", t); }
const CL_LINES = ["Спокойной ночи!", `До завтра, ${BAR_NAME}!`, "Лучший вечер за неделю.", "Ещё увидимся."];
async function playClosing() {
  track("secret", "closing");
  if (CLOSING.on) return;
  CLOSING.on = true; CLOSING.skip = false;
  const g = ++CLOSING.gen;
  // всё открытое закрываем, гостя поднимаем со стула
  if (dlg.open) dlg.close();
  if (mixDlg.open) mixDlg.close();
  if (Book.isOpen) document.getElementById("book").close();
  if (SHOW.on) { SHOW.fast = true; SHOW.gen++; }
  for (let i = 0; i < 60 && (SHOW.on || busy || CEL.busy); i++) await sleep(.1);
  busy = true;
  leaveSeat();
  talkEl.hidden = true;
  if (curZone === 4) { await goZone(1); }
  BT.busy = true;
  showUI.title.textContent = "Смена подходит к концу";
  showUI.root.classList.add("closing");
  showUI.root.hidden = false;
  app.classList.add("showing");
  try {
    // 1. последняя мелодия и поклон
    BAND_HERE = true;
    for (const F of Object.values(MUS)) F.root.visible = true;
    cCaption("Последняя мелодия этой ночи");
    await goZone(3, 2.2);
    cAlive(g);
    await cw(g, 4.5);
    if (Music.on) Music.stop();
    STG.bow = true;
    applause(2.8);
    cCaption("Музыканты кланяются");
    await cw(g, 2.6);
    STG.bow = false;
    // свет на сцене гаснет
    STG.beams.forEach(b => tween(b.material, { opacity: 0 }, 1.6));
    STG.dim = 1; tween(STG, { dim: .15 }, 1.6);
    await cw(g, 1.6);

    // 2. гости прощаются
    await goZone(1, 2.0);
    cAlive(g);
    cCaption("Гости допивают и прощаются");
    for (let i = 0; i < GUESTS.length; i++) { say(GUESTS[i].F, CL_LINES[i % CL_LINES.length], 2.4); if (i === 0) clink(); await cw(g, 1.5); }
    bt.look = camera.position;
    say(bt, "Спасибо, что были с нами!", 2.6);
    await cw(g, 2.4);
    // пока камера смотрит на бармена, гости уходят
    await flyTo(framed({ pos: [bt.x + .2, 1.55, -1.1], tgt: [bt.x, 1.35, -3.3], span: 1.8, pull: .5 }), STILL ? 0 : 1.6, 0);
    cAlive(g);
    GUESTS.forEach(G => { G.F.root.visible = false; G.F.off = true; });
    for (const F of [MUS.piano, MUS.sax, MUS.bass, MUS.drum]) F.root.visible = false;

    // 3. бармен собирает бокалы
    cCaption("Бармен собирает бокалы");
    BT.mode = "free";
    if (bt.held.some(h => h.obj === btGlass)) await stash();
    const glasses = GUESTS.map(G => G.glass).concat(servedGlass ? [servedGlass] : []);
    for (const gl of glasses) {
      if (!gl.parent) continue;
      const gx = clamp(gl.position.x + .08, -2.6, 2.6);
      flyTo(framed({ pos: [gx + .15, 1.6, -.7], tgt: [gx, 1.2, -2.7], span: 2.0, pull: .5 }), STILL ? 0 : 1.2, 0);
      await walkTo(gx, BT_Z + .12, 0);
      cAlive(g);
      const l = toFig(bt, gl.position);
      reach(bt.R, l.x, CT.top + .1, l.z - .02, V3(.1, -.4, 1), DIR.in(-1), .2);
      await cw(g, .45);
      bt.R.curlT = .85;
      const hand = bt.R.hand.getWorldPosition(V3());
      SND.clink();
      await tween(gl.position, { x: hand.x, y: CT.top + .12, z: hand.z }, STILL ? 0 : .3, ease.out);
      reach(bt.R, l.x, .9, -.05, DIR.down, DIR.in(-1), .8);
      await tween(gl.position, { y: .7, z: bt.z + .2 }, STILL ? 0 : .45, ease.in);
      gl.visible = false;
      bt.R.curlT = .2;
      await cw(g, .2);
    }
    if (servedGlass && !servedGlass.visible) { world.remove(servedGlass); servedGlass = null; }

    // 4. протирает стойку
    cCaption("Протирает стойку до блеска");
    await walkTo(.2, BT_Z, 0);
    cAlive(g);
    await flyTo(framed({ pos: [.6, 1.5, -1.0], tgt: [.2, 1.15, -2.6], span: 1.9, pull: .4 }), STILL ? 0 : 1.2, 0);
    reach(bt.R, 0, CT.top + .02, .5, V3(0, -.2, 1), DIR.down, .1);
    await cw(g, .3);
    const rag = grab(bt, bt.R, btRag, V3(0, -.07, .02), .25);
    rag.woff = V3(0, -.02, 0);
    BT.mode = "wipe";
    await cw(g, 3.6);
    BT.mode = "free";
    await putDown(bt, btRag, fromFig(bt, V3(-.12, CT.top + .004, .6)));
    bt.leanT = .07;
    armsDown();

    // 5. гасит свет: лампы по одной, потом неон
    cCaption("Гасит свет");
    await flyTo(framed({ pos: [0, 1.75, .9], tgt: [0, 1.6, -4.4], span: 6.2, pull: 1.6 }), STILL ? 0 : 1.6, 0);
    cAlive(g);
    for (const [k, idx] of [["pendR", 1], ["pendL", 0]]) {
      await walkTo(idx ? 1.7 : -1.7, BT_Z, 0);
      cAlive(g);
      reach(bt.R, -.05, 1.75, .25, V3(0, 1, .3), DIR.in(-1), .6);
      await cw(g, .45);
      switchClick();
      SHUT[k] = 0; LIGHTS[k].intensity = 0;
      pendants[idx].bulb.material.color.setHex(0x2a2018);
      pendants[idx].cone.visible = false;
      pendants[idx].glow.visible = false;
      armsDown();
      await cw(g, .6);
    }
    SHUT.pendC = 0; LIGHTS.pendC.intensity = 0;
    await cw(g, .4);
    // неон мигает и гаснет
    await walkTo(0, BT_Z, 0);
    bt.look = V3(0, 3.2, -4.9);
    for (const v of [.2, 1, .1, .6, 0]) { SHUT.neon = v; buzz(); await cw(g, .16); }
    SHUT.neon = 0;
    // подсветка полок гаснет последней
    switchClick();
    tween(SHUT, { back: 0 }, 1.4);
    tween(BACKLIT.panel.color, { r: .12, g: .08, b: .08 }, 1.4);
    tween(BACKLIT.led.color, { r: .15, g: .06, b: .07 }, 1.4);
    tween(SHUT, { fill: .28 }, 1.2);
    tween(LIGHTS.fill, { intensity: LIGHTS.fill.userData.base * .28 }, 1.2);
    await cw(g, 1.2);

    // 6. последний взгляд
    cCaption("Смена окончена");
    bt.look = camera.position;
    await flyTo(framed({ pos: [bt.x + .1, 1.55, -1.25], tgt: [bt.x, 1.5, -3.3], span: 1.6, pull: .4 }), STILL ? 0 : 1.6, 0);
    cAlive(g);
    say(bt, "Спокойной ночи. Ждём завтра в пять.", 3.2);
    bt.nod = .1;
    await cw(g, .6);
    bt.nod = 0;
    await cw(g, 2.4);
    bubbleEl.classList.remove("show");
    await walkTo(-2.7, BT_Z, 0);
    await fade(true, 1.0);
    cAlive(g);

    // 7. улица: окна гаснут, неон на фасаде тухнет
    street.visible = true;
    app.classList.add("street");
    streetLights(true);
    LIGHTS.fill.intensity = LIGHTS.fill.userData.base;
    SHUT.neon = 1;
    setCam(framed(SHOT.near));
    cCaption("До завтра. Открываемся в 17:00");
    await fade(false, 1.2);
    cAlive(g);
    await cw(g, 1.2);
    for (let i = 0; i < STREET.winGlow.length; i += 2) {
      tween(STREET.winGlow[i].material.color, { r: .08, g: .05, b: .05 }, .8);
      tween(STREET.winGlow[i + 1].material, { opacity: 0 }, .8);
      switchClick();
      await cw(g, 1.0);
    }
    for (const v of [.3, 1, .15, .7, .05, .4, 0]) { SHUT.neon = v; buzz(); await cw(g, .18); }
    SHUT.neon = 0;
    flyTo(framed(SHOT.wide), STILL ? 0 : 5, 0);
    await cw(g, 4.2);
  } catch (e) {
    if (e !== CLOSE_ABORT) console.error(e);
  }
  if (g === CLOSING.gen) finishClosing();
}
/* финал: закрытый экран; если бар ещё открыт (хозяин), всё возвращается как было */
function finishClosing() {
  showUI.root.hidden = true;
  showUI.root.classList.remove("closing");
  app.classList.remove("showing");
  bubbleEl.classList.remove("show");
  STG.bow = false;
  fade(false, .3);
  if (Music.on) Music.stop();
  started = false;
  busy = false;
  CLOSING.on = false;
  if (!isOpen()) {
    closedNow = true;
    visited = true;
    intro.dataset.after = "1";
    SHUT.neon = 0;
    showClosed(true);
  } else {
    restoreBar();
    showOpen();
  }
  intro.classList.remove("gone", "dive");
  updatePeek();
}
function restoreBar() {
  Object.assign(SHUT, { pendL: 1, pendC: 1, pendR: 1, fill: 1, neon: 1 });
  pendants.forEach(p => { p.bulb.material.color.setHex(0xfff0d0); p.cone.visible = true; p.glow.visible = true; });
  SHUT.back = 1; BACKLIT.panel.color.setHex(0xd8b0b0); BACKLIT.led.color.setHex(0xff5a70);
  applyTime();
  STG.dim = 1; STG.beams.forEach(b => { b.material.opacity = .13; });
  BAND_HERE = OWNER || BANDH >= 19 || BANDH < 3;
  for (const F of Object.values(MUS)) F.root.visible = BAND_HERE;
  GUESTS.forEach(G => { G.F.root.visible = true; G.F.off = false; G.glass.visible = true; });
  for (let i = 0; i < STREET.winGlow.length; i += 2) { STREET.winGlow[i].material.color.setHex(0xcc8866); STREET.winGlow[i + 1].material.opacity = .18; }
  app.classList.remove("street");
  streetLights(false);
  street.visible = false;
  BT.busy = false; BT.mode = "polish";
  holdTools();
  curZone = 1; cur = 1;
}
document.getElementById("show-skip").addEventListener("click", () => { if (CLOSING.on) CLOSING.skip = true; });
addEventListener("keydown", e => { if (e.key === "Escape" && CLOSING.on) CLOSING.skip = true; });

/* ---------- звуки: аплодисменты, щелчок выключателя, гудение неона ---------- */
function applause(dur) {
  const c = fx(); if (!c || STILL) return;
  for (let i = 0; i < dur * 40; i++) noiseHit(i / 40 + R(0, .03), .04, R(1200, 3000), 1.4, .07 * Math.sin(Math.PI * i / (dur * 40)));
}
function switchClick() { noiseHit(0, .03, 3000, 5, .3); noiseHit(.04, .02, 1500, 5, .15); }
function buzz() {
  const c = fx(); if (!c) return;
  const o = c.createOscillator(), gg = c.createGain(), t = c.currentTime;
  o.type = "sawtooth"; o.frequency.value = 100;
  gg.gain.setValueAtTime(.025, t); gg.gain.exponentialRampToValueAtTime(.0001, t + .12);
  o.connect(gg).connect(c.destination); o.start(t); o.stop(t + .14);
}
Object.assign(H3D, { closing: playClosing });
