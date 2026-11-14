/* ================= камера и предметы: крупные планы, подсветка, понятное взаимодействие ================= */
/* крупный план: после нажатия камера мягко подъезжает к предмету, а потом возвращается на место */
const CLOSE = { on: false, until: 0, sawModal: false, root: null };
const NO_CLOSE = /^(Сесть за стойку|Барная карта|Атмосфера|Плеер|Бармен|Попросить сыграть|Сцена пока|Посетитель|Книга, которая торчит|Граммофон)/;
const _cb = new THREE.Box3(), _cc = V3(), _cs = V3(), _cray = new THREE.Raycaster();
const isIn = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
function closeupOf(root) {
  const h = root.userData.hot;
  if (NO_CLOSE.test(h.label) || DRINKS.some(d => d.name === h.label) || h.zone === 4 || h.zone === "street") return null;
  _cb.setFromObject(root);
  if (_cb.isEmpty()) return null;
  _cb.getCenter(_cc); _cb.getSize(_cs);
  const size = Math.max(_cs.x, _cs.y, _cs.z);
  if (size > 1.6 || size < .01 || _cc.y < -1) return null;
  // встаём между нынешней камерой и предметом: подходим, но не упираемся
  const from = V3(CAM.px, CAM.py, CAM.pz), dir = from.clone().sub(_cc);
  const dist = dir.length();
  let want = clamp(size * 2.6 + .55, .7, dist * .8);
  dir.normalize();
  // между предметом и камерой не должно быть кресел и стен: иначе подходим ближе или не подходим вовсе
  _cray.set(_cc, dir); _cray.far = want; _cray.near = size * .5; _cray.camera = camera;
  const hit = _cray.intersectObject(world, true).find(x => x.object.isMesh && x.object.visible && !x.object.material.transparent && !x.object.material.isMeshBasicMaterial && !isIn(x.object, root));
  if (hit) { if (hit.distance < .45) return null; want = hit.distance - .18; }
  const p = _cc.clone().addScaledVector(dir, want);
  p.y = lerp(p.y, _cc.y + .25, .5);
  return { px: p.x, py: p.y, pz: p.z, tx: _cc.x, ty: _cc.y, tz: _cc.z, fov: CAM.fov * .92, c: _cc.clone() };
}
function closeupEnd() {
  if (!CLOSE.on) return;
  CLOSE.on = false; LOOKAT.p = null;
  if (curZone !== 4 && !SEAT.on && !SHOW.on && !STREET.on && !flight) flyTo(framed(curZone, nudge), 1.4, 0);
}
{
  const base = activate;
  activate = async root => {
    const h = root.userData.hot;
    // нажатие: предмет чуть проседает и пружинит обратно
    if (h.grow && !h.noChip) { const s0 = h.base.clone(); root.scale.copy(s0).multiplyScalar(.93); tween(root.scale, { x: s0.x, y: s0.y, z: s0.z }, .35, ease.out); }
    pulseOf(root, 1);
    const sameZone = h.zone === curZone;
    await base(root);
    if (!sameZone || STILL || busy || SEAT.on || SHOW.on || STREET.on || (typeof CEL !== "undefined" && CEL.busy)) return;
    const s = closeupOf(root);
    if (!s) return;
    CLOSE.on = true; CLOSE.root = root; CLOSE.sawModal = false; CLOSE.until = NOW + 6500;
    LOOKAT.p = s.c;
    flyTo(s, 1.1, 0);
  };
}
onTick(() => {
  if (!CLOSE.on) return;
  const m = modalOpen() || document.querySelector("dialog.sheet[open]") || mixDlg.open;
  if (m) { CLOSE.sawModal = true; CLOSE.until = NOW + 900; return; }
  if (pointer && pointer.drag) { closeupEnd(); return; }
  if (NOW > CLOSE.until) closeupEnd();
});
{ const base = goZone; goZone = (...a) => { CLOSE.on = false; LOOKAT.p = null; return base(...a); }; }

/* подсветка: тёплое свечение у предмета под курсором, мягкий «пульс» доступных вещей, когда гость осматривается */
const GLOW = new Map();
function glowOf(root) {
  let g = GLOW.get(root);
  if (g) return g;
  const h = root.userData.hot;
  if (h.noChip || /^(Атмосфера|Плеер)/.test(h.label)) return null;
  _cb.setFromObject(root);
  if (_cb.isEmpty()) return null;
  _cb.getCenter(_cc); _cb.getSize(_cs);
  const size = Math.max(_cs.x, _cs.y, _cs.z);
  if (size > 2.2 || _cc.y < -1) return null;
  g = glowSprite(0xffc27a, Math.max(.25, size * 1.5), _cc.x, _cc.y, _cc.z, world, 0);
  g.material.depthTest = true; g.material.depthWrite = false;
  g.renderOrder = 3; g.userData.k = 0; g.userData.pulse = 0;
  GLOW.set(root, g);
  return g;
}
function pulseOf(root, v = .8) { const g = glowOf(root); if (g) g.userData.pulse = Math.max(g.userData.pulse, v); }
const IDLE = { t: 0, last: 0, mx: -1, my: -1 };
addEventListener("pointermove", e => { if (Math.abs(e.clientX - IDLE.mx) + Math.abs(e.clientY - IDLE.my) > 4) { IDLE.t = 0; IDLE.mx = e.clientX; IDLE.my = e.clientY; } }, { passive: true });
addEventListener("pointerdown", () => { IDLE.t = 0; }, { passive: true });
onTick((t, dt) => {
  if (!started || STREET.on || SHOW.on) { for (const g of GLOW.values()) g.material.opacity = 0; return; }
  // каждые ~14 секунд покоя — короткий пульс предметов этого зала (не чаще, чем нужно)
  IDLE.t += dt;
  if (IDLE.t > 14 && !SEAT.on && !modalOpen() && !mixDlg.open && !reduceMotion.matches) {
    IDLE.t = 0;
    let i = 0;
    for (const root of HOT) if (root.userData.hot.zone === curZone && !root.userData.hot.secret && root.visible !== false) { const g = glowOf(root); if (g) setTimeout(() => { g.userData.pulse = Math.max(g.userData.pulse, .55); }, (i++) * 120); }
  }
  for (const [root, g] of GLOW) {
    const d = root.userData.hot;
    const active = CLOSE.on && CLOSE.root === root;
    const want = d.zone !== curZone ? 0 : Math.max(d.h * .55, active ? .35 : 0, g.userData.pulse);
    g.userData.k += (want - g.userData.k) * Math.min(1, dt * 6);
    g.userData.pulse = Math.max(0, g.userData.pulse - dt * .9);
    g.material.opacity = g.userData.k * .5;
    g.visible = g.material.opacity > .004;
  }
});
/* на телефоне: короткое касание показывает название предмета рядом с пальцем */
canvas.addEventListener("pointerup", e => {
  if (e.pointerType === "mouse" || STREET.on) return;
  const root = pick(e.clientX, e.clientY);
  if (!root) return;
  tip.textContent = root.userData.hot.label;
  tip.style.transform = `translate(${Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8)}px, ${Math.max(8, e.clientY - 44)}px)`;
  tip.classList.add("show");
  setTimeout(() => tip.classList.remove("show"), 1300);
});
Object.assign(H3D, { close: CLOSE, closeupEnd });
