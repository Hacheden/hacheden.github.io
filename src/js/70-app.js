/* ================= камера по точкам, клики, интерфейс и главный цикл ================= */
const ZONES = [
  { name: "Читальня", sub: "Книги до потолка, дождь за окном, письмо на столе", pos: [-2.5, 1.6, 1.25], tgt: [-6.3, 1.3, -3.1], span: 5.4, pull: 2.6,
    hint: "Открой книгу рецептов на кафедре, прочти письмо или задуй свечу." },
  { name: "Бар", sub: "Бармен на месте, лёд уже в ведёрке", pos: [0, 1.95, 1.45], tgt: [0, 1.48, -4.6], span: 7.0, pull: 3.0,
    hint: "Нажми на бутылку или сядь за стойку: бармен подберёт коктейль под настроение." },
  { name: "Курилка", sub: "Камин, кожаные кресла и дверь, в которую лучше постучать", pos: [2.8, 1.6, 1.65], tgt: [7.3, 1.05, -1.9], span: 5.6, pull: 2.4,
    hint: "Постучи в дверь, заведи граммофон или подбрось дров в камин." },
  { name: "Сцена", sub: BAND_HERE ? "Джаз-бэнд: фортепиано, саксофон, контрабас и щётки" : "Музыканты выходят на сцену в 19:00", pos: [-2.7, 1.62, .55], tgt: [-4.85, 1.22, 5.0], span: 5.0, pull: 2.2,
    hint: "Каждая нота, которую ты слышишь, сыграна на сцене. Кликни по музыканту — он что-нибудь расскажет." },
  { name: "Погреб", sub: "Тайный погреб под читальней: бочки, свечи и сомелье", pos: [-26, 1.75, 2.3], tgt: [-26.1, .95, -1.2], span: 3.0, pull: 1.0,
    hint: "Выбери вино: сомелье нальёт и расскажет его историю." }
];
ZONES[0].sub = SEASON_INFO[SEASON].nook;
if (SEASON === "summer") ZONES[2].hint = "Постучи в дверь или заведи граммофон. Летом камин не топят: в нём горят свечи.";
const INTRO_CAM = { pos: [0, 1.8, 5.5], tgt: [0, 1.5, -4.6], span: 8, pull: 1 };
const TEST = location.hash.includes("test");
let curZone = 1, PAUSED = false, flight = null, nudge = 0;
const CAM = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, fov: 50 };
const LOOK = { yaw: 0, pitch: 0, py: 0, pp: 0 };

/* кадр для зоны с учётом экрана: на узком телефоне камера отходит и расширяет угол */
function framed(z, extra = 0) {
  const c = typeof z === "number" ? ZONES[z] : z;
  const aspect = innerWidth / innerHeight;
  const pos = V3(...c.pos), tgt = V3(...c.tgt);
  const dir = pos.clone().sub(tgt), dist = dir.length();
  dir.normalize();
  let vfov = 50;
  const hOf = v => 2 * Math.atan(Math.tan(v / 2 * D2R) * aspect);
  const span = (c.span || 6) * (aspect < .8 ? .8 : 1);   // на телефоне чуть ближе: остальное можно рассмотреть, проведя пальцем
  const need = 2 * Math.atan(span / 2 / dist);
  if (hOf(vfov) < need) vfov = Math.min(68, 2 * Math.atan(Math.tan(need / 2) / aspect) / D2R);
  let d2 = dist;
  if (hOf(vfov) < need) d2 = Math.min(dist + (c.pull || 0), (span / 2) / Math.tan(hOf(vfov) / 2));
  d2 -= extra;
  const p = tgt.clone().addScaledVector(dir, d2);
  return { px: p.x, py: p.y, pz: p.z, tx: tgt.x, ty: tgt.y, tz: tgt.z, fov: vfov };
}
function setCam(s) { Object.assign(CAM, s); }
/* перелёт по дуге: камера чуть отступает назад и плавно разворачивается */
function flyTo(s, dur = 1.8, back = .9) {
  if (STILL) { setCam(s); return Promise.resolve(); }
  return new Promise(res => {
    if (flight) flight.res();
    const A = Object.assign({}, CAM);
    const mid = V3((A.px + s.px) / 2, (A.py + s.py) / 2 + .12, (A.pz + s.pz) / 2 + back);
    flight = { A, B: s, mid, t0: NOW, dur: dur * 1000, res };
  });
}
function runFlight() {
  if (!flight) return;
  const f = flight, k = clamp((NOW - f.t0) / f.dur, 0, 1), e = ease.io(k), u = 1 - e;
  CAM.px = u * u * f.A.px + 2 * u * e * f.mid.x + e * e * f.B.px;
  CAM.py = u * u * f.A.py + 2 * u * e * f.mid.y + e * e * f.B.py;
  CAM.pz = u * u * f.A.pz + 2 * u * e * f.mid.z + e * e * f.B.pz;
  const et = ease.io(clamp(k * 1.08, 0, 1));
  for (const key of ["tx", "ty", "tz", "fov"]) CAM[key] = lerp(f.A[key], f.B[key], et);
  if (k >= 1) { flight = null; f.res(); }
}

/* ---------- интерфейс ---------- */
const navBtns = [...document.querySelectorAll("#nav button")];
const titleEl = document.getElementById("zone-title"), subEl = document.getElementById("zone-sub");
const spotsEl = document.getElementById("spots"), tip = document.getElementById("tip");
function renderZoneUI(i) {
  track("room", i);
  navBtns.forEach(b => b.setAttribute("aria-current", String(+b.dataset.zone === i)));
  titleEl.classList.add("swap");
  setTimeout(() => {
    titleEl.firstChild.textContent = ZONES[i].name;
    subEl.textContent = ZONES[i].sub;
    titleEl.classList.remove("swap");
  }, STILL ? 0 : 280);
  if (!mixDlg.open && !busy) hintEl.textContent = ZONES[i].hint;
  spotsEl.innerHTML = "";
  HOT.filter(h => h.userData.hot.zone === i && !h.userData.hot.noChip).forEach(h => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "spot"; b.textContent = h.userData.hot.label;
    b.addEventListener("click", () => activate(h));
    b.addEventListener("pointerenter", () => { chipHover = h; });
    b.addEventListener("pointerleave", () => { if (chipHover === h) chipHover = null; });
    b.addEventListener("focus", () => { chipHover = h; });
    b.addEventListener("blur", () => { if (chipHover === h) chipHover = null; });
    h.userData.chip = b;
    spotsEl.appendChild(b);
  });
}
function goZone(i, dur = 1.9) {
  i = clamp(i, 0, ZONES.length - 1);
  if (typeof CEL !== "undefined" && CEL.busy) return Promise.resolve();
  const cross = (curZone === 4) !== (i === 4);
  leaveSeat();
  const same = i === curZone;
  curZone = i; cur = i;
  applyTime();
  track("room", i);
  Music.room(i === 3 ? 4 : i === 4 ? 5 : i);
  if (mixDlg.open && i !== 1) mixDlg.close();
  renderZoneUI(i);
  tween(LIGHTS.fill.position, { x: FILL_AT[i].x, y: FILL_AT[i].y, z: FILL_AT[i].z }, same ? .1 : dur);
  tween(LOOK, { yaw: 0, pitch: 0 }, same ? .6 : dur * .8);
  nudge = 0;
  if (cross) return cellarCross(i);
  return flyTo(framed(i), same ? .8 : dur, same ? 0 : .9);
}
navBtns.forEach(b => b.addEventListener("click", () => { if (!busy) goZone(+b.dataset.zone); }));

/* ---------- клики и наведение ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let hovered = null, chipHover = null, pointer = null, mouseAt = null, needRay = false;
function pick(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(hotMeshes, false);
  // на улице кликается только своё, внутри — только бар
  const hit = hits.find(h => (h.object.userData.hotRoot.userData.hot.zone === "street") === STREET.on);
  return hit ? hit.object.userData.hotRoot : null;
}
const modalOpen = () => dlg.open || Book.isOpen || (typeof Closeup !== "undefined" && Closeup.active);
async function activate(root) {
  const h = root.userData.hot;
  if (modalOpen()) return;
  if (busy && h.zone !== 1) return;
  if (SEAT.on && !h.noChip) return;
  if (STREET.on || h.zone === "street") { if (STREET.on && h.zone === "street") h.act(); return; }   // сидя у стойки, можно только перекинуться словом с соседом
  if (h.zone !== curZone) await goZone(h.zone);
  h.act();
}
canvas.addEventListener("pointerdown", e => {
  if (!e.isPrimary) return;
  pointer = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, yaw: LOOK.yaw, pitch: LOOK.pitch, type: e.pointerType };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => {
  mouseAt = { x: e.clientX, y: e.clientY, type: e.pointerType };
  if (e.pointerType === "mouse") needRay = true;
  if (!pointer || pointer.id !== e.pointerId) return;
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  if (!pointer.drag && Math.hypot(dx, dy) > 7) { pointer.drag = true; app.classList.add("drag"); hideTip(); }
  if (pointer.drag) {
    const k = 1.25 / Math.max(innerWidth, 500);
    const lim = innerWidth / innerHeight < 1 ? .62 : .38;
    LOOK.yaw = clamp(pointer.yaw + dx * k * 1.6, -lim, lim);
    LOOK.pitch = clamp(pointer.pitch + dy * k, -.22, .22);
    for (const t of tweens) if (t.obj === LOOK) tweens.delete(t);
  }
});
canvas.addEventListener("pointerup", e => {
  if (!pointer || pointer.id !== e.pointerId) return;
  const p = pointer;
  pointer = null;
  app.classList.remove("drag");
  if (p.drag) return;
  const root = pick(e.clientX, e.clientY);
  if (root) activate(root);
});
canvas.addEventListener("pointercancel", () => { pointer = null; app.classList.remove("drag"); });
canvas.addEventListener("pointerleave", () => { if (!pointer) { mouseAt = null; needRay = true; } });
function hideTip() { tip.classList.remove("show"); }
addEventListener("keydown", e => {
  if (modalOpen() || mixDlg.open || busy || STREET.on) return;
  if (e.target.closest && e.target.closest("input, textarea")) return;
  if (curZone === 4) return;
  if (e.key === "ArrowLeft") { e.preventDefault(); goZone(Math.max(0, curZone - 1)); }
  if (e.key === "ArrowRight") { e.preventDefault(); goZone(Math.min(3, curZone + 1)); }
});

/* ---------- бутылки, коктейли и связь с барной картой ---------- */
/* кадр на бармена с бутылкой: на компьютере бутылка слева от карточки, на телефоне — над ней */
function serveShot(hx) {
  const wide = innerWidth / innerHeight > 1.05;
  const bx = hx - .45;
  const s = framed({ pos: [bx * .7 + (wide ? .55 : 0), 1.62, -.15], tgt: [bx + (wide ? .75 : 0), wide ? 1.4 : 1.12, -3.6], span: 2.6, pull: 1.6 });
  return s;
}
let pendingCocktail = null;
H3D.bottle = async id => {
  if (mixDlg.open) { toggleIng(id); return; }
  if (busy || BT.busy) return;
  const h = heroes[id];
  if (STILL) { openCard(h.d); return; }
  busy = true;
  hideTip();
  nudge = .55;
  flyTo(serveShot(h.home.x), 1.4, 0);
  await fetchBottle(h);
  busy = false;
  openCard(h.d);
  dlg.addEventListener("close", () => {
    nudge = 0;
    flyTo(framed(1), 1.2, 0);
    returnBottle(h);
  }, { once: true });
};
const baseMake = window.makeCocktail;
window.makeCocktail = async id => {
  if (busy || BT.busy) return;
  if (curZone !== 1) await goZone(1);
  pendingCocktail = COCKTAIL_BY_ID[id];
  await baseMake(id);
};
H3D.prep = () => { if (!STILL) BT.busy = true; };
H3D.done = () => {
  if (pendingCocktail && !SHOW.served) placeServed(pendingCocktail);
  const showed = SHOW.served;
  SHOW.served = false;
  if (STILL) return;
  if (!showed) presentCocktail();
  dlg.addEventListener("close", () => {
    if (SEAT.on) { flyTo(seatShot(true), 1.3, 0); relax().then(afterServe); }
    else { flyTo(framed(1), 1.3, 0); relax(); }
  }, { once: true });
};
H3D.pause = on => { PAUSED = on; };
H3D.go = i => goZone(i);

/* ---------- пыль в свете ламп ---------- */
const DUST = (() => {
  const N = QUALITY > 1 ? 160 : 80, pos = new Float32Array(N * 3), base = [];
  for (let i = 0; i < N; i++) base.push([R(-3, 3), R(1.15, 2.6), R(-3.4, -1.4), R(0, 6.3), R(.02, .06)]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffc890, size: .012, map: TEX.glow, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  world.add(p);
  return { N, pos, base, g, p };
})();

/* ---------- окружение для отражений: снимок самой комнаты ---------- */
function bakeEnvironment() {
  const pm = new THREE.PMREMGenerator(renderer);
  world.position.set(0, -1.6, 1.8);
  const rt = pm.fromScene(scene, .03, .1, 40);
  world.position.set(0, 0, 0);
  scene.environment = rt.texture;
  pm.dispose();
}

/* ---------- главный цикл ---------- */
let last = performance.now(), frames = 0, slowAcc = 0, slowN = 0, slowHits = 0, startedAt = 0, neonT = 6 + Math.random() * 6, flashT = 6 + Math.random() * 8;
const _p = V3(), _t = V3(), _d = V3();
function tick(now) {
  requestAnimationFrame(tick);
  // 30 кадров в секунду в режиме экономии: пропускаем каждый второй кадр
  if ((SET.fps === "30" || SET.saver) && now - last < 30) return;
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (PAUSED || document.hidden || (closedNow && !started)) return;
  NOW = now;
  const t = now / 1000;
  runTweens();
  runFlight();
  // камера: положение, взгляд, лёгкое «дыхание» и параллакс мыши
  _p.set(CAM.px, CAM.py, CAM.pz);
  _t.set(CAM.tx, CAM.ty, CAM.tz);
  _d.subVectors(_t, _p);
  const len = _d.length();
  let yaw = Math.atan2(_d.x, _d.z), pitch = Math.asin(clamp(_d.y / len, -1, 1));
  if (mouseAt && mouseAt.type === "mouse" && !pointer && !STILL) {
    LOOK.py = lerp(LOOK.py, -(mouseAt.x / innerWidth - .5) * .07, .05);
    LOOK.pp = lerp(LOOK.pp, -(mouseAt.y / innerHeight - .5) * .04, .05);
  } else { LOOK.py = lerp(LOOK.py, 0, .03); LOOK.pp = lerp(LOOK.pp, 0, .03); }
  yaw += LOOK.yaw + LOOK.py; pitch += LOOK.pitch + LOOK.pp + SIP.pitch;
  if (!STILL) { _p.y += Math.sin(t * .8) * .006; _p.x += Math.sin(t * .37) * .008; }
  camera.position.copy(_p);
  camera.lookAt(_p.x + Math.sin(yaw) * Math.cos(pitch), _p.y + Math.sin(pitch), _p.z + Math.cos(yaw) * Math.cos(pitch));
  if (Math.abs(camera.fov - CAM.fov) > .01) { camera.fov = CAM.fov; camera.updateProjectionMatrix(); }

  // наведение
  if (needRay && mouseAt && !pointer && !modalOpen()) {
    needRay = false;
    hovered = mouseAt.type === "mouse" ? pick(mouseAt.x, mouseAt.y) : null;
  } else if (!mouseAt || modalOpen()) hovered = null;
  const lit = hovered || chipHover;
  app.classList.toggle("hover", !!hovered);
  if (hovered && mouseAt) {
    tip.textContent = hovered.userData.hot.label;
    tip.style.transform = `translate(${Math.min(mouseAt.x + 16, innerWidth - tip.offsetWidth - 8)}px, ${mouseAt.y + 18}px)`;
    tip.classList.add("show");
  } else hideTip();
  for (const h of HOT) {
    const d = h.userData.hot, want = h === lit ? 1 : 0;
    d.h += (want - d.h) * Math.min(1, dt * 10);
    if (d.grow) h.scale.copy(d.base).multiplyScalar(1 + d.grow * d.h);
    if (d.lift && !h.userData.out) h.position.y = d.y0 + d.lift * d.h;
    if (h.userData.chip) h.userData.chip.classList.toggle("lit", want === 1);
  }
  // бутылки в шейкере светятся золотом
  for (const id in heroes) {
    const hr = heroes[id], inS = mixDlg.open && inShaker.has(id);
    const target = mixDlg.open ? (inS ? 1 : .4) : .2 + hr.root.userData.hot.h * .4;
    hr.halo.material.opacity += (target - hr.halo.material.opacity) * Math.min(1, dt * 6);
    hr.halo.material.color.setHex(inS ? 0xffd27a : 0xffb070);
    if (hr.root.userData.chip) hr.root.userData.chip.classList.toggle("in", inS);
  }

  updateFigures(t, dt);
  // камин
  FIRE.boost += (1 - FIRE.boost) * dt * .5;
  const fl = .78 + .14 * Math.sin(t * 7.3) + .1 * Math.sin(t * 13.1 + 1) + .06 * Math.sin(t * 23.7);
  FIRE.lvl += ((FIRE.on ? 1 : .1) - FIRE.lvl) * Math.min(1, dt * 1.2);
  LIGHTS.fire.intensity = LIGHTS.fire.userData.base * fl * FIRE.boost * FIRE.lvl;
  for (const f of FIRE.flames) { f.visible = FIRE.lvl > .25; f.scale.y = Math.max(.05, Math.min(1, (FIRE.lvl - .2) * 1.3)); }
  for (const m of flameMats) { m.uniforms.uTime.value = t; m.uniforms.uBoost.value = Math.min(1.35, FIRE.boost); }
  FIRE.logMat.emissiveIntensity = .3 + .12 * Math.sin(t * 2.1) * fl;
  FIRE.glow.material.opacity = .38 * fl * FIRE.boost * (.25 + .75 * FIRE.lvl);
  FIRE.embers.pts.visible = FIRE.lvl > .4 && SET.effects && !SET.saver;
  {
    const e = FIRE.embers;
    for (let i = 0; i < e.N; i++) {
      e.life[i] += dt * (.35 + (i % 5) * .06) * (FIRE.boost > 1.1 ? 1.8 : 1);
      if (e.life[i] > 1) e.life[i] -= 1;
      const k = e.life[i];
      e.pos[i * 3] = 7.82 - k * .25 + Math.sin(i * 7 + t * 2) * .04;
      e.pos[i * 3 + 1] = .18 + k * 1.1;
      e.pos[i * 3 + 2] = FP.z + Math.sin(i * 3.1 + t * 1.3) * (.1 + k * .15);
    }
    e.eg.attributes.position.needsUpdate = true;
  }
  for (const c of FIRE.candles) c.material.opacity = .62 + .12 * Math.sin(t * 9 + c.position.z * 3);
  // часы
  {
    const d = new Date(), h = d.getHours() % 12, m = d.getMinutes() + d.getSeconds() / 60;
    FIRE.hour.rotation.x = -(h + m / 60) / 12 * Math.PI * 2;
    FIRE.min.rotation.x = -m / 60 * Math.PI * 2;
  }
  // дым сигары
  for (const s of smoke) {
    s.userData.t += dt * .09;
    if (s.userData.t > 1) s.userData.t -= 1;
    const k = s.userData.t;
    s.position.set(FIRE.smokeFrom.x + Math.sin(k * 9 + s.id) * .05 * k, FIRE.smokeFrom.y + k * 1.5, FIRE.smokeFrom.z + Math.cos(k * 7 + s.id) * .05 * k);
    const sc = .06 + k * .5;
    s.scale.set(sc, sc, 1);
    s.material.opacity = Math.sin(Math.PI * Math.min(1, k * 1.4)) * .32 * (1 - k);
    s.material.rotation = k * 2 + s.id;
  }
  FIRE.cigarTip.material.color.setHSL(.05, 1, .45 + .1 * Math.sin(t * 1.3));
  for (const s of haze) { s.position.x += Math.sin(t * .1 + s.userData.ph) * .0015; s.material.opacity = .1 + .05 * Math.sin(t * .2 + s.userData.ph); }
  if (Music.on) GR.disc.rotation.y -= dt * 3.4;
  CAT.body.scale.y = .5 + .025 * Math.sin(t * 1.9);
  // читальня
  rainMat.uniforms.uTime.value = t;
  NOOK.flash = Math.max(0, NOOK.flash - dt * 2.2);
  rainMat.uniforms.uFlash.value = NOOK.flash;
  const sky = rainMat.uniforms.uSky.value;
  if (!STREET.on) LIGHTS.window.intensity = LIGHTS.window.userData.base * (1 + sky * 2.5) + NOOK.flash * 30;
  LIGHTS.lamp.intensity = LIGHTS.lamp.userData.base * LIGHTS.lamp.userData.mul * (NOOK.lampMode || 1) * (NOOK.candleOn ? 1 + .04 * Math.sin(t * 11) : 1);
  NOOK.globeSpeed += (.25 - NOOK.globeSpeed) * dt * .45;
  NOOK.globe.rotation.y += NOOK.globeSpeed * dt;
  if (NOOK.candleOn) { NOOK.flame.scale.set(1, 1 + .15 * Math.sin(t * 13), 1); NOOK.flameGlow.material.opacity = .7 + .1 * Math.sin(t * 9); }
  moth.position.set(-6.5 + Math.cos(t * 2.4) * .16, 1.13 + Math.sin(t * 3.1) * .05, -4.3 + Math.sin(t * 2.4) * .16);
  moth.rotation.y = -t * 2.4; moth.scale.x = .6 + .4 * Math.abs(Math.sin(t * 30));
  flashT -= dt;
  if (flashT < 0) { flashT = 9 + Math.random() * 12; if (curZone === 0 && WEATHER.storm) lightning(); }
  // неон иногда мигает
  neonT -= dt;
  let nb = 1;
  if (neonT < 0 && neonT > -.5) nb = .35 + .65 * (Math.sin(-neonT * 60) > 0 ? 1 : 0);
  else if (neonT <= -.5) neonT = 7 + Math.random() * 9;
  nb *= SHUT.neon;
  neonMat.opacity = nb; neonGlow.material.opacity = .35 * nb;
  LIGHTS.red.intensity = LIGHTS.red.userData.base * (.8 + .2 * nb) * (.08 + .92 * SHUT.back);
  // пыль
  if (DUST.p.visible) for (let i = 0; i < DUST.N; i++) {
    const b = DUST.base[i];
    DUST.pos[i * 3] = b[0] + Math.sin(t * .2 + b[3]) * .3;
    DUST.pos[i * 3 + 1] = b[1] + Math.sin(t * b[4] * 4 + b[3]) * .2;
    DUST.pos[i * 3 + 2] = b[2] + Math.cos(t * .17 + b[3]) * .2;
  }
  if (DUST.p.visible) DUST.g.attributes.position.needsUpdate = true;
  for (const fn of tickers) fn(t, dt);

  if (!TEST) POST.render(dt);
  // если тормозит: уменьшаем разрешение
  if (started) {
    frames++;
    slowAcc += dt; slowN++;
    if (slowN >= 90) {
      const fps = slowN / slowAcc;
      // сначала упрощаем эффекты, потом уменьшаем разрешение; первые секунды после входа и разовые подвисания не считаем
      slowHits = fps < 40 && NOW - startedAt > 5000 ? slowHits + 1 : 0;
      if (slowHits >= 2) { slowHits = 0; if (!POST.degrade() && DPR > .85) { DPR = Math.max(.85, DPR - .25); renderer.setPixelRatio(DPR); POST.setSize(); } }
      slowAcc = 0; slowN = 0;
    }
  }
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  POST.setSize();
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  if (started && !flight) setCam(SEAT.on ? seatShot() : framed(curZone, nudge));
}
addEventListener("resize", resize);

/* ---------- вход ---------- */
let started = false;
const intro = document.getElementById("intro"), enter = document.getElementById("enter");
resize();
setCam(framed(SHOT.wide));
CAM.fov = framed(1).fov;
progress(.7);
bakeEnvironment();
renderer.compile(scene, camera);
POST.render();
progress(.86);
H3D.ready = true;
H3D.bt = bt; H3D.figs = FIGS; H3D.BT = BT;
H3D.cam = (p, t, fov = 40) => { flight = null; setCam({ px: p[0], py: p[1], pz: p[2], tx: t[0], ty: t[1], tz: t[2], fov }); };
H3D.render = () => POST.render();
H3D.post = POST;
H3D.info = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, dpr: DPR, zone: curZone, busy, btBusy: BT.busy });
renderZoneUI(1);
requestAnimationFrame(tick);
/* ---------- часы работы: открыто с 17:00 до 3:00 ---------- */
const introText = document.getElementById("intro-text"), statusEl = document.getElementById("status"), introTitle = intro.querySelector("h1");
const ownerOut = document.getElementById("owner-out");
ownerOut.addEventListener("click", () => {
  try { localStorage.removeItem("hacheden-owner"); } catch (e) {}
  location.reload();
});
const BAR_COLD = new THREE.Color(0x7d9cff), BAR_WARM = new THREE.Color(0xffb27a);
/* конец смены: лампы и неон гаснут по одной (1 — горит, 0 — погашено) */
const SHUT = { pendL: 1, pendC: 1, pendR: 1, fill: 1, neon: 1, back: 1 };
/* атмосфера: по часам или вручную — вечер, полночь, поздняя ночь */
function moodDate() {
  const m = SET.mood;
  if (m === "auto") return sceneDate();
  const e = new Date(sceneDate());
  if (m === "evening") { const h = Math.max(17, SUNSET - .35); e.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0); }
  else if (m === "midnight") e.setHours(0, 0, 0, 0);
  else e.setHours(2, 30, 0, 0);
  return e;
}
const ZONE_LIGHT = [1, 1, 1, 1, 1];
/* свет меняется плавно: смена атмосферы, зала или времени суток идёт за пару секунд, а не рывком */
let atFirst = true;
const _wc = new THREE.Color();
function applyTime() {
  const d = moodDate(), sky = skyLight(d), late = lateness(d);
  const soft = (obj, key, v, dur = 2.2) => { if (atFirst || STILL) obj[key] = v; else if (Math.abs(obj[key] - v) > 1e-3) tween(obj, { [key]: v }, dur); };
  soft(hemi, "intensity", 1.6 * (1 + .1 * sky - .18 * late));
  soft(rainMat.uniforms.uSky, "value", sky, 3);
  if (!STREET.on) { _wc.copy(BAR_COLD).lerp(BAR_WARM, sky); if (atFirst) LIGHTS.window.color.copy(_wc); else tween(LIGHTS.window.color, { r: _wc.r, g: _wc.g, b: _wc.b }, 3); }
  for (const k of ["pendL", "pendC", "pendR", "fill"]) soft(LIGHTS[k], "intensity", LIGHTS[k].userData.base * (1 - .3 * late) * SHUT[k] * (k === "fill" ? ZONE_LIGHT[curZone] ?? 1 : 1), k === "fill" ? 1.2 : 2.2);
  atFirst = false;
}
function showClosed(afterVisit) {
  intro.classList.add("closed");
  const min = minutesUntil(OPEN_H);
  introTitle.classList.add("off");
  introText.textContent = afterVisit || intro.dataset.after
    ? "Бар закрылся. Спасибо, что заглянул! Ждём тебя снова."
    : "Сейчас закрыто. Бар открывается каждый день в 17:00 и работает до 3:00 ночи.";
  statusEl.textContent = `Откроемся в 17:00, через ${spell(min)}`;
  statusEl.hidden = false;
  enter.hidden = true;
}
function showOpen() {
  intro.classList.remove("closed");
  introTitle.classList.remove("off");
  const left = minutesUntil(CLOSE_H);
  introText.textContent = `${SEASON_INFO[SEASON].line} Стойка, курилка у камина и читальня ждут.`;
  statusEl.textContent = OWNER
    ? (openByClock() ? "Режим хозяина. Для гостей открыто до 3:00" : "Режим хозяина: для тебя открыто. Гостей ждём с 17:00")
    : left <= 30 ? `Последний заказ: закрываемся через ${spell(left)}` : "Открыто до 3:00";
  ownerOut.hidden = !OWNER;
  statusEl.hidden = false;
  enter.hidden = false;
  enter.disabled = !WARM_DONE;
}
let closedNow = !isOpen();
if (closedNow) showClosed(false); else showOpen();
applyTime();
if (!closedNow) enter.focus({ preventScroll: true });
let lastCallShown = false, visited = false;
setInterval(() => {
  const open = isOpen();
  applyTime();
  if (!started) {
    if (open && closedNow) { closedNow = false; showOpen(); introTitle.style.animation = "none"; void introTitle.offsetWidth; introTitle.style.animation = ""; }
    else if (!open) { closedNow = true; showClosed(visited); }
    else showOpen();
    return;
  }
  const h = hoursOf(nowDate());
  if (!OWNER && open && h >= LAST_CALL && h < CLOSE_H && !lastCallShown) {
    lastCallShown = true;
    ZONES.forEach(z => { z.hint = `Последний заказ: в 3:00 бар закрывается. ${z.hint}`; });
    if (!busy && !mixDlg.open) hintEl.textContent = ZONES[curZone].hint;
  }
  if (!open && !CLOSING.on) playClosing();
}, 15000);
function closeBar() {
  if (closedNow) return;
  closedNow = true;
  if (dlg.open) dlg.close();
  if (mixDlg.open) mixDlg.close();
  if (Book.isOpen) document.getElementById("book").close();
  if (Music.on) Music.stop();
  started = false;
  visited = true;
  showClosed(true);
  intro.classList.remove("gone", "dive");
}
enter.addEventListener("click", async () => {
  if (started || !isOpen()) return;
  started = true;
  startedAt = performance.now();
  intro.classList.add("gone");
  let pref = null;
  try { pref = localStorage.getItem("hacheden-music"); } catch (e) {}
  if (pref !== "off" && !Music.on) setMusic(true);
  renderer.toneMappingExposure = STILL ? 1.2 : .15;
  if (!STILL) tween(renderer, { toneMappingExposure: 1.2 }, 2.2, ease.out);
  if (!idleStarted) { idleStarted = true; idleLife(); companyLife(); }
  streetIntro();
  if (!idleStarted) { idleStarted = true; idleLife(); companyLife(); }
});
let idleStarted = false;
