/* ================= глоток: гость сам берёт бокал, подносит к губам и ставит обратно ================= */
const SIP = { on: false, n: 0, gen: 0, pitch: 0, anim: null, glass: null, liq: null, frac: 1, P0: V3() };
const SIPS = 4;   // столько глотков в бокале
renderer.localClippingEnabled = true;
const sipPlane = new THREE.Plane(V3(0, -1, 0), 100);   // поверхность напитка: всё выше неё срезается

/* рука гостя: кисть с пальцами, белая манжета с латунной запонкой, рукав тёмного бархата */
const GUEST = (() => {
  const rig = new THREE.Group();
  rig.visible = false;
  world.add(rig);
  const wrist = group(0, 0, 0, rig);
  const arm = Object.assign(buildHand(-1, wrist, std({ color: 0xd8a585, roughness: .58 })), { side: -1, manual: true, hand: wrist });
  handPose(arm, "open");
  arm.fc = arm.ft.slice(); arm.tc = arm.tt; arm.ts = arm.tst;
  const fore = group(0, 0, 0, world);
  fore.visible = false;
  mesh(new THREE.CylinderGeometry(.036, .035, .034, 20).translate(0, .011, 0), std({ color: 0xf1ece2, roughness: .7 }), 0, 0, 0, fore);
  mesh(new RoundedBoxGeometry(.012, .016, .01, 2, .003), M.brass, .036, .012, 0, fore);
  const sleeve = mesh(new THREE.CylinderGeometry(.056, .041, 1, 22, 1, true).translate(0, .5, 0), std({ color: 0x1b1720, roughness: .92, side: THREE.DoubleSide }), 0, .026, 0, fore);
  return { rig, wrist, arm, fore, sleeve };
})();

/* куда смотрит камера: вперёд по горизонтали, вправо, вниз */
function camAxes() {
  const p = V3(CAM.px, CAM.py, CAM.pz), f = V3(CAM.tx - CAM.px, 0, CAM.tz - CAM.pz).normalize();
  return { p, f, r: V3(-f.z, 0, f.x) };
}
/* обхват: стебель берут щепотью, стакан — всей ладонью */
function gripFor(cupId) {
  const c = CUPS[cupId] || CUPS.rocks, p = c.p, S = 1.35 / 100;
  const stem = p.find(([r, y], i) => i > 1 && r < 1);
  if (stem) return { y: (stem[1] + 1.3) * S, r: .45 * S, pose: "stem", rimY: p[p.length - 1][1] * S, tilt: .62 };
  const top = p[p.length - 1], y = top[1] * .38;
  return { y: y * S, r: (p[2][0] + (top[0] - p[2][0]) * .38) * S, pose: null, rimY: top[1] * S, tilt: cupId === "highball" ? 1.05 : .9 };
}
/* уровень напитка: и у бокала из шоу, и у простого бокала */
function liquidOf(g) {
  if (servedV && servedV.g === g) {
    const V = servedV, full = V.ml;
    return { mesh: V.liq, y: f => V.y0 + f * (V.y1 - V.y0) * Math.min(.94, full / V.cap),
      set: f => { V.ml = full * f; setLevel(V); }, fullH: () => { V.liq.visible = true; V.liq.scale.y = .94 * (V.y1 - V.y0); } };
  }
  const L = g.userData.liq;
  if (!L) return null;
  const { mesh: m, y0, y1 } = L;
  return { mesh: m, y: f => y0 + f * (y1 - y0),
    set: f => { m.visible = f > .01; m.scale.y = Math.max(.001, f); m.position.y = y0 + (y1 - y0) * f / 2; },
    fullH: () => { m.visible = true; m.scale.y = 1; m.position.y = (y0 + y1) / 2; } };
}
/* заранее: срез по поверхности и двусторонний материал, чтобы шейдер собрался до движения */
function prepSip() {
  SIP.n = 0; SIP.frac = 1;
  SIP.glass = servedGlass;
  SIP.liq = servedGlass ? liquidOf(servedGlass) : null;
  if (!SIP.liq) return;
  const m = SIP.liq.mesh.material;
  m.clippingPlanes = [sipPlane]; m.side = THREE.DoubleSide; m.needsUpdate = true;
  sipPlane.constant = 100;
}

/* плавная анимация по кадрам */
function sipPlay(dur, fn, e = ease.io) {
  if (STILL) { fn(1); return Promise.resolve(); }
  return new Promise(res => { SIP.anim = { t0: NOW, dur: dur * 1000 * (SIP.slow || 1), fn, e, res }; });
}
const _sw = V3(), _se = V3(), _sx = V3(), _sy = V3(), _sz = V3(), _sm = new THREE.Matrix4();
onTick(() => {
  const A = SIP.anim;
  if (A) {
    const k = clamp((NOW - A.t0) / A.dur, 0, 1);
    A.fn(A.e(k));
    if (k >= 1) { SIP.anim = null; A.res(); }
  }
  if (!GUEST.rig.visible) return;
  poseFingers(GUEST.arm, 1 / 60);
  // предплечье: от запястья вниз-вправо, за край кадра
  const { p, f, r } = camAxes();
  GUEST.wrist.getWorldPosition(_sw);
  _se.copy(p).addScaledVector(r, .3).addScaledVector(f, .12); _se.y -= .62;
  _sy.subVectors(_se, _sw);
  const len = _sy.length();
  _sy.normalize();
  _sx.set(0, 1, 0).addScaledVector(_sy, -_sy.y).normalize();
  _sz.crossVectors(_sx, _sy);
  _sm.makeBasis(_sx, _sy, _sz);
  GUEST.fore.quaternion.setFromRotationMatrix(_sm);
  GUEST.fore.position.copy(_sw).addScaledVector(_sy, -.006);
  GUEST.sleeve.scale.y = len;
  // поверхность напитка всегда горизонтальна
  if (SIP.liq && SIP.glass && SIP.on) {
    SIP.glass.localToWorld(_sw.set(0, SIP.liq.y(SIP.frac), 0));
    sipPlane.constant = _sw.y;
  }
});

/* кисть в системе бокала: ладонь сбоку, пальцы обнимают его спереди */
function handAt(G, out = {}) {
  const n = V3(-1, 0, -.2).normalize(), fw = V3(.2, 0, -1).normalize();
  const Y = fw.clone().negate(), X = V3().crossVectors(Y, n);
  out.q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, n));
  out.p = V3(0, G.y, 0).addScaledVector(n, -(G.r + .016)).addScaledVector(fw, -.044);
  return out;
}
function sipReset() {
  SIP.anim = null;
  GUEST.rig.visible = GUEST.fore.visible = false;
  SIP.pitch = 0;
  if (SIP.glass && SIP.glass.parent === GUEST.rig) {
    world.attach(SIP.glass);
    SIP.glass.position.copy(SIP.P0); SIP.glass.quaternion.identity();
  }
  if (SIP.liq) { SIP.liq.set(SIP.frac); sipPlane.constant = 100; }
  SIP.on = false;
}
function abortSip() { if (SIP.on) { SIP.gen++; sipReset(); } }

async function takeSip(T = null) {
  const G0 = servedGlass;
  if ((SIP.on && !T) || !SEAT.on || !G0 || SHOW.on || SIP.frac <= .02) return;
  if (SIP.glass !== G0) prepSip();
  const c = pendingCocktail || SHOW.c;
  const G = gripFor(c ? c.cup : "rocks");
  SIP.on = true;
  const g = T ? SIP.gen : ++SIP.gen, sg = SEAT.gen;
  const alive = () => g === SIP.gen && sg === SEAT.gen;
  answers([]);
  quietBubble();
  const { p, f, r } = camAxes();
  // рука приходит из-за края кадра
  SIP.P0.copy(G0.position);
  const rig = GUEST.rig;
  rig.position.copy(SIP.P0); rig.quaternion.identity();
  const H = handAt(G);
  const from = H.p.clone().addScaledVector(r, .22).add(V3(0, -.2, 0)).addScaledVector(f, -.42);
  const W = GUEST.wrist, arm = GUEST.arm;
  W.position.copy(from); W.quaternion.copy(H.q);
  handPose(arm, "open");
  rig.visible = GUEST.fore.visible = true;
  await sipPlay(.85, k => W.position.lerpVectors(from, H.p, k), ease.out);
  if (!alive()) return;
  // ножку держат щепотью: большой, указательный и средний, безымянный и мизинец поджаты
  if (G.pose === "stem") { arm.ft = [.72, .8, .95, 1]; arm.tt = .55; arm.tst = .85; }
  else handPose(arm, G.pose, G.r);
  await sipPlay(.28, () => {});
  if (!alive()) return;
  SND.tick();
  // бокал поднимается к глазам — напиток на просвет, — затем к губам, голова чуть запрокидывается
  rig.attach(G0);
  const tilt = new THREE.Quaternion().setFromAxisAngle(r, G.tilt), q0 = new THREE.Quaternion();
  const look = p.clone().addScaledVector(f, .4).addScaledVector(r, .02); look.y -= .1 + G.rimY * .55;
  const mouthP = p.clone().addScaledVector(f, .12); mouthP.y -= .25;   // у губ бокал уже за краем кадра
  const P1 = mouthP.clone().sub(V3(0, G.rimY, 0).applyQuaternion(tilt));
  const lift = SIP.P0.clone().lerp(look, .5); lift.y += .05;
  const _a = V3(), _b = V3();
  let qs = q0;
  if (T) {
    // тост: бокал навстречу бокалу бармена, чуть наклонён к нему
    const lean = new THREE.Quaternion().setFromAxisAngle(f, -.06);
    await sipPlay(1.05, k => {
      rig.position.lerpVectors(SIP.P0, T.pre, k); rig.position.y += Math.sin(k * Math.PI) * .03;
      rig.quaternion.slerpQuaternions(q0, lean, k);
      SIP.pitch = -.02 * k;
    });
    if (!alive()) return;
    await T.ready;
    if (!alive()) return;
    await Promise.all([sipPlay(.5, k => rig.position.lerpVectors(T.pre, T.hit, k), ease.out), T.meet()]);
    if (!alive()) return;
    T.clink();
    await sipPlay(.4, k => rig.position.lerpVectors(T.hit, T.back, k), ease.out);
    if (!alive()) return;
    await sipPlay(.35, () => {});
    if (!alive()) return;
    look.copy(rig.position); qs = rig.quaternion.clone();
  } else {
  await sipPlay(1.1, k => {
    _a.lerpVectors(SIP.P0, lift, k); _b.lerpVectors(lift, look, k);
    rig.position.lerpVectors(_a, _b, k);
    SIP.pitch = -.03 * k;
  });
  if (!alive()) return;
  await sipPlay(.55, k => { rig.position.y = look.y + Math.sin(k * Math.PI) * .006; });
  if (!alive()) return;
  }
  await sipPlay(.8, k => {
    rig.position.lerpVectors(look, P1, k);
    rig.quaternion.slerpQuaternions(qs, tilt, k);
    SIP.pitch = lerp(T ? -.02 : -.03, .045, ease.io(k));
  });
  if (!alive()) return;
  // глоток: уровень опускается
  const f0 = SIP.frac, f1 = Math.max(0, f0 - 1 / SIPS - .001);
  const tiltMore = new THREE.Quaternion().setFromAxisAngle(r, G.tilt + .14);
  await sipPlay(.9, k => {
    SIP.frac = lerp(f0, f1, k);
    rig.quaternion.slerpQuaternions(tilt, tiltMore, Math.sin(k * Math.PI));
    SIP.pitch = .045 + .02 * Math.sin(k * Math.PI);
  });
  if (!alive()) return;
  // обратно на стойку
  const back = rig.position.clone(), qb = rig.quaternion.clone(), mid = look.clone().lerp(SIP.P0, .4);
  await sipPlay(1.1, k => {
    _a.lerpVectors(back, mid, k); _b.lerpVectors(mid, SIP.P0, k);
    rig.position.lerpVectors(_a, _b, k);
    rig.quaternion.slerpQuaternions(qb, q0, ease.io(clamp(k / .6, 0, 1)));
    SIP.pitch = .045 * (1 - ease.io(k));
  });
  if (!alive()) return;
  SND.tap();
  if (SIP.frac > .05 && ["rocks", "highball"].includes(c ? c.cup : "")) setTimeout(() => SND.clink(), 120);
  world.attach(G0);
  G0.position.copy(SIP.P0); G0.quaternion.identity();
  handPose(arm, "open");
  await sipPlay(.25, () => {});
  if (!alive()) return;
  const at = W.position.clone();
  await sipPlay(.75, k => W.position.lerpVectors(at, from, k), ease.io);
  if (!alive()) return;
  sipReset();
  SIP.n++;
  if (T) { await T.done; if (sg !== SEAT.gen) return; }
  // бармен отвечает взглядом и словом
  if (SIP.frac <= .02) {
    await btSay(choose(["Бокал пуст — значит, получилось. Повторим?", "До дна — лучший комплимент бармену. Ещё по одной?"]));
    if (sg !== SEAT.gen) return;
    answers([["Ещё по одной", oneMore], standBtn]);
    return;
  }
  if (SIP.n === 1 && !T) {
    bt.nod = .08; setTimeout(() => { bt.nod = 0; }, 450);
    await btSay(choose(["Ну как? По-моему, баланс что надо.", "Вижу, пришёлся по вкусу.", "Не спешите: такой напиток раскрывается постепенно."]));
    if (sg !== SEAT.gen) return;
  }
  seatAnswers();
}
function oneMore() { flyTo(seatShot(), 1, 0); btSay("С удовольствием. Какое теперь настроение?").then(askMood); answers([]); }
function seatAnswers() {
  const list = [["Сделать глоток", () => takeSip()]];
  if (SIP.frac > .02 && TOAST.glass !== servedGlass) list.push(["Чокнуться с барменом", () => toastBartender()]);
  list.push(["Ещё по одной", oneMore], ["Поговорить", () => talkMenu()], standBtn);
  answers(list);
}
Object.assign(H3D, { takeSip: () => takeSip(), SIP });
