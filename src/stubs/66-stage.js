/* ================= заглушка сцены: у заведения нет зала с джаз-бэндом =================
   Подставляется сборкой (tools/build.py) вместо src/venues/<id>/rooms/66-stage.js, если такого файла нет.
   Даёт движку те же имена, что и настоящая сцена, но пустые: закрытие смены, бармен и праздники
   не падают, а кнопка «Сцена» скрыта (FEAT.stage = false). */
FEAT.stage = false;
const BANDH = new Date().getHours();
let BAND_HERE = false;
const MUS = {};
const STG = { bow: false, beams: [], dim: 1, x0: 0, x1: 0, z0: 0, z1: 0, h: 0 };
