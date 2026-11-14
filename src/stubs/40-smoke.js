/* ================= заглушка курилки: у заведения нет зала с камином =================
   Подставляется сборкой вместо src/venues/<id>/rooms/40-smoke.js, если такого файла нет.
   Даёт движку те же имена, что и настоящая курилка, но пустые: атмосфера, сезоны и праздники
   пропускают камин, кота и гостей у огня; кнопка зала скрыта (FEAT.smoke = false). */
FEAT.smoke = false;
const FIRE = { boost: 1, lvl: 1, on: true, flames: [], candles: [] };
const FP = { x: 0, z: 0 };
const CAT = null;
const haze = [], smoke = [];
/* свет «камина» без камина: после огненного шоу бармена возвращается к своему уровню */
onTick(() => { LIGHTS.fire.intensity = LIGHTS.fire.userData.base * FIRE.boost * FIRE.lvl; });
