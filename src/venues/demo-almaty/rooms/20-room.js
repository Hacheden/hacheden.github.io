/* ================= камерный зал: одна комната с барной стойкой =================
   Шаблон для настоящего заведения без улицы, читальни, курилки, сцены и погреба.
   Стойка — та же, что у Hacheden (use.txt → 30-bar.js); стены сдвинуты к стойке, свет — тот же набор
   источников (движок и прогрев шейдеров рассчитаны на него), но без «чужих» залов. */
const ROOM = { x0: -4.2, x1: 4.2, z0: -5, z1: 6, h: 3.6 };

/* пол */
const floorGeo = new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0);
const floor = mesh(floorGeo, M.floor, 0, 0, (ROOM.z0 + ROOM.z1) / 2);
floor.rotation.x = -Math.PI / 2;

/* стены: одни обои на весь зал (движок спрашивает W.nook / W.bar / W.smoke — пусть все три будут) */
const W = { bar: lam({ map: TEX.wallBar }) };
W.nook = W.smoke = W.bar;
const WALL_UV = .62;
box(ROOM.x0, ROOM.x1, 0, ROOM.h, -5.1, -5, W.bar, world, WALL_UV);
box(ROOM.x0 - .1, ROOM.x0, 0, ROOM.h, -5, 6, W.bar, world, WALL_UV);
box(ROOM.x1, ROOM.x1 + .1, 0, ROOM.h, -5, 6, W.bar, world, WALL_UV);
box(ROOM.x0, -.62, 0, ROOM.h, 6, 6.1, W.bar, world, WALL_UV);
box(.62, ROOM.x1, 0, ROOM.h, 6, 6.1, W.bar, world, WALL_UV);
box(-.62, .62, 2.42, ROOM.h, 6, 6.1, W.bar, world, WALL_UV);

/* деревянные панели снизу стен, плинтус и карниз */
(() => {
  const geos = [], rails = [];
  const run = (ax, a0, a1, fixed, side, h = 1.02) => {
    const t0 = fixed, t1 = fixed + side * .035;
    const B = (u0, u1, y0, y1, d0, d1) => ax === "x"
      ? boxAt(u0, u1, y0, y1, Math.min(d0, d1), Math.max(d0, d1), .8)
      : boxAt(Math.min(d0, d1), Math.max(d0, d1), y0, y1, u0, u1, .8);
    geos.push(B(a0, a1, 0, h, t0, t1));
    rails.push(B(a0, a1, h - .02, h + .05, t0, fixed + side * .065));
    rails.push(B(a0, a1, 0, .16, t0, fixed + side * .055));
    rails.push(B(a0, a1, ROOM.h - .14, ROOM.h, t0, fixed + side * .08));
    const n = Math.max(1, Math.round((a1 - a0) / .78)), pw = (a1 - a0) / n;
    for (let i = 0; i < n; i++) rails.push(B(a0 + i * pw + .09, a0 + (i + 1) * pw - .09, .26, h - .14, t1, fixed + side * .05));
  };
  run("x", ROOM.x0, ROOM.x1, -5, 1);
  run("z", -5, 6, ROOM.x0, 1); run("z", -5, 6, ROOM.x1, -1);
  run("x", ROOM.x0, -.75, 6, -1); run("x", .75, ROOM.x1, 6, -1);
  merged(geos, M.panel);
  merged(rails, M.darkwood);
})();

/* потолок с балками */
box(ROOM.x0, ROOM.x1, ROOM.h, ROOM.h + .1, -5, 6, M.ceiling, world, 0);
(() => {
  const geos = [];
  for (let x = -3; x <= 3; x += 2) geos.push(boxAt(x - .12, x + .12, ROOM.h - .26, ROOM.h, -5, 6, .8));
  geos.push(boxAt(ROOM.x0, ROOM.x1, ROOM.h - .2, ROOM.h, -2.5, -2.3, .8));
  merged(geos, M.beam);
})();

/* бра на боковых стенах: латунная чаша и тёплое пятно на обоях */
for (const sx of [-1, 1]) for (const z of [-2.9, .2, 3.2]) {
  const x = sx * (ROOM.x1 - .06);
  mesh(new THREE.CylinderGeometry(.09, .05, .1, 18, 1, true), M.brass, x - sx * .07, 2.25, z);
  mesh(new THREE.SphereGeometry(.035, 10, 8), basic({ color: 0xffe0b0, toneMapped: false }), x - sx * .08, 2.28, z);
  glowSprite(0xffb060, .8, x - sx * .1, 2.3, z, world, .35);
}

/* ---------- свет: тот же набор источников, что у Hacheden (pendL/C/R, red, fire, lamp, window, fill) ---------- */
point("pendL", 0xffb066, 3.4, 6.5, -1.7, 2.45, -2.35);
point("pendC", 0xffb066, 3.2, 6.5, 0, 2.45, -2.35);
point("pendR", 0xffb066, 3.4, 6.5, 1.7, 2.45, -2.35);
point("red", 0xff2238, 5, 5.5, 0, 1.95, -4.3);
point("fire", 0xff9a4a, 1.2, 5, 3.9, 2.3, .2);      // у бра справа; во время огненного шоу его берёт бармен
point("lamp", 0xffbe70, 1.2, 5, -3.9, 2.3, .2);     // у бра слева
point("window", 0x6f8cff, 0, 4, 0, 2.4, 5.6);       // окна нет — источник есть, но тёмный
point("fill", 0xffa070, 16, 10, 0, 2.5, .2);
const FILL_AT = [V3(0, 2.5, .2), V3(0, 2.5, .2), V3(0, 2.5, .2), V3(0, 2.5, .2), V3(0, 2.5, .2)];
/* наличник входной двери изнутри */
box(-.76, -.62, 0, 2.56, 5.94, 6.0, M.walnut, world, .8);
box(.62, .76, 0, 2.56, 5.94, 6.0, M.walnut, world, .8);
box(-.76, .76, 2.42, 2.56, 5.94, 6.0, M.walnut, world, .8);
