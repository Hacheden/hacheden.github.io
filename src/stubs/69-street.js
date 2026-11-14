/* ================= заглушка улицы: гость входит сразу в зал =================
   Подставляется сборкой вместо src/venues/<id>/rooms/69-street.js, если такого файла нет.
   «Войти» ведёт прямо к стойке: камера влетает из глубины зала. Закрытие смены
   заканчивается в том же зале (окна и вывеска улицы — пустые). FEAT.street = false. */
FEAT.street = false;
const STREET = { on: false, step: "inside", wrong: 0, winGlow: [], doorStreak: { material: { opacity: 0 } } };
const street = new THREE.Group(); street.visible = false;
const FZ = (typeof ROOM !== "undefined" ? ROOM.z1 : 6) + .1;
const SDOOR = { g: new THREE.Object3D(), eyes: new THREE.Object3D(), flap: new THREE.Object3D(), flapY: 0 };
const doorway = { material: { opacity: 0 } };
const PREC = { N: 0, snow: false, active: 0, RN: 0, g: { setDrawRange() {} }, lines: { material: { color: new THREE.Color(), opacity: 0 } }, rings: { count: 0 } };
/* «улица» без улицы: общий план зала от входа и чуть ближе */
const SHOT = {
  wide: { pos: [0, 2.2, FZ - 1.2], tgt: [0, 1.45, -4.6], span: 8.5, pull: 1 },
  near: { pos: [0, 2.05, FZ - 2.4], tgt: [0, 1.45, -4.6], span: 7.6, pull: 1 },
  door: { pos: [0, 2.05, FZ - 2.4], tgt: [0, 1.45, -4.6], span: 7.6, pull: 1 }
};
let greeted = false;
let GREET = () => "";
function streetLights() {}
function streetTalk() {}
async function streetIntro() {
  STREET.on = false; STREET.step = "inside";
  Music.room(1);
  hintEl.textContent = ZONES[1].hint;
  renderZoneUI(1);
  await flyTo(framed(1), STILL ? 0 : 3.2, 0);
}
