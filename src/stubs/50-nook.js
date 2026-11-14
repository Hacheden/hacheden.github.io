/* ================= заглушка читальни: у заведения нет зала с книгами и окном =================
   Подставляется сборкой вместо src/venues/<id>/rooms/50-nook.js, если такого файла нет.
   Погода и сезоны пишут в «окно», которого нет, — поэтому у rainMat любые uniforms существуют и молча
   принимают значения. Кнопка зала скрыта (FEAT.nook = false). */
FEAT.nook = false;
const NOOK = { flash: 0, lampMode: 1, candleOn: false, globeSpeed: 0 };
const WIN = { x: 0, sill: 0 };
const SECRET = {};
const rainMat = { uniforms: new Proxy({}, { get: (o, k) => o[k] || (o[k] = { value: 0 }) }) };
function lightning() {}
function toggleCandle() {}
