/* ================= заглушка погреба: у заведения нет тайного погреба =================
   Подставляется сборкой вместо src/venues/<id>/rooms/67-cellar.js, если такого файла нет.
   Движок проверяет CEL.on / CEL.busy, переход в погреб не случается (FEAT.cellar = false). */
FEAT.cellar = false;
const CEL = { on: false, busy: false };
const SOM = { head: new THREE.Object3D() };
async function cellarCross() {}
