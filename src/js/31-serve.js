/* ================= подача: готовый коктейль встаёт на стойку перед гостем =================
   От залов заведения нужна стойка CT (top); от движка — makeGlass, SEAT, SEAT_X, BT. */
let servedGlass = null, servedV = null;
function placeServed(c) {
  abortSip();
  servedV = null;
  if (servedGlass) drop(servedGlass);
  servedGlass = makeGlass(c.cup, c.pour, { garnish: c.garnish, ice: c.cup === "rocks" || c.cup === "highball", op: c.pourOp || .88 });
  // сидящему гостю — прямо перед ним
  if (SEAT.on) servedGlass.position.set(SEAT_X + .08, CT.top, -2.12);
  else servedGlass.position.set(clamp(BT.x - .25, -2.6, 2.6), CT.top, -2.25);
  world.add(servedGlass);
  servedGlass.scale.setScalar(.001);
  tween(servedGlass.scale, { x: 1.35, y: 1.35, z: 1.35 }, .5, ease.out);
}
