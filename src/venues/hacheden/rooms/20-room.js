/* ================= комната: пол, стены, потолок, свет ================= */
const ROOM = { x0: -8, x1: 8, z0: -5, z1: 6, h: 3.8 };

/* пол */
const floorGeo = new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0);
const floor = mesh(floorGeo, M.floor, 0, 0, (ROOM.z0 + ROOM.z1) / 2);
floor.rotation.x = -Math.PI / 2;

/* стены: по зонам свои обои */
const W = {
  nook: lam({ map: TEX.wallNook }),
  bar: lam({ map: TEX.wallBar }),
  smoke: lam({ map: TEX.wallSmoke })
};
const WALL_UV = .62;
box(-8, -3.8, 0, ROOM.h, -5.1, -5, W.nook, world, WALL_UV);
box(-3.8, 3.8, 0, ROOM.h, -5.1, -5, W.bar, world, WALL_UV);
box(3.8, 8, 0, ROOM.h, -5.1, -5, W.smoke, world, WALL_UV);
// в левой стене — проём за шкафом-дверью (тайный ход в погреб)
box(-8.1, -8, 0, ROOM.h, -5, -.84, W.nook, world, WALL_UV);
box(-8.1, -8, 0, ROOM.h, .31, 6, W.nook, world, WALL_UV);
box(-8.1, -8, 3.48, ROOM.h, -.84, .31, W.nook, world, WALL_UV);
box(8, 8.1, 0, ROOM.h, -5, 6, W.smoke, world, WALL_UV);
/* передняя стена с проёмом входной двери */
box(-8, -.62, 0, ROOM.h, 6, 6.1, W.bar, world, WALL_UV);
box(.62, 8, 0, ROOM.h, 6, 6.1, W.bar, world, WALL_UV);
box(-.62, .62, 2.42, ROOM.h, 6, 6.1, W.bar, world, WALL_UV);

/* деревянные панели снизу стен, плинтус и карниз */
(() => {
  const geos = [], rails = [];
  const run = (ax, a0, a1, fixed, side, h = 1.02) => {
    // ax: "x" — стена вдоль x на z=fixed; "z" — вдоль z на x=fixed; side: куда смотрит (+1/-1)
    const t0 = fixed, t1 = fixed + side * .035;
    const B = (u0, u1, y0, y1, d0, d1) => ax === "x"
      ? boxAt(u0, u1, y0, y1, Math.min(d0, d1), Math.max(d0, d1), .8)
      : boxAt(Math.min(d0, d1), Math.max(d0, d1), y0, y1, u0, u1, .8);
    geos.push(B(a0, a1, 0, h, t0, t1));
    rails.push(B(a0, a1, h - .02, h + .05, t0, fixed + side * .065));
    rails.push(B(a0, a1, 0, .16, t0, fixed + side * .055));
    rails.push(B(a0, a1, ROOM.h - .14, ROOM.h, t0, fixed + side * .08));
    const n = Math.max(1, Math.round((a1 - a0) / .78));
    const pw = (a1 - a0) / n;
    for (let i = 0; i < n; i++) {
      const u0 = a0 + i * pw + .09, u1 = a0 + (i + 1) * pw - .09;
      rails.push(B(u0, u1, .26, h - .14, t1, fixed + side * .05));
    }
  };
  run("x", -8, -3.8, -5, 1); run("x", 3.8, 8, -5, 1); run("x", -3.8, 3.8, -5, 1);
  run("z", -5, -.84, -8, 1); run("z", .31, 6, -8, 1); run("z", -5, 6, 8, -1);
  run("x", -8, -.75, 6, -1); run("x", .75, 8, 6, -1);
  merged(geos, M.panel);
  merged(rails, M.darkwood);
})();

/* потолок с балками */
box(-8, 8, ROOM.h, ROOM.h + .1, -5, 6, M.ceiling, world, 0);
(() => {
  const geos = [];
  for (let x = -7; x <= 7; x += 2) geos.push(boxAt(x - .12, x + .12, ROOM.h - .26, ROOM.h, -5, 6, .8));
  geos.push(boxAt(-8, 8, ROOM.h - .2, ROOM.h, -2.5, -2.3, .8));
  merged(geos, M.beam);
})();

/* перегородки-колонны между залами */
for (const sx of [-1, 1]) {
  const x = sx * 3.8;
  box(x - .18, x + .18, 0, ROOM.h, -5, -2.7, M.darkwood, world, .8);
  box(x - .22, x + .22, 0, .2, -5, -2.66, M.black, world, 0);
  box(x - .22, x + .22, 3.48, 3.62, -5, -2.66, M.walnut, world, .8);
  // панели на торце колонны
  box(x - .14, x + .14, .4, 3.2, -2.69, -2.66, M.walnut, world, .8);
}

/* ---------- свет залов Hacheden (point и LIGHTS — в 19-kit.js) ---------- */
point("pendL", 0xffb066, 3.4, 6.5, -1.7, 2.45, -2.35);
point("pendC", 0xffb066, 3.2, 6.5, 0, 2.45, -2.35);
point("pendR", 0xffb066, 3.4, 6.5, 1.7, 2.45, -2.35);
point("red", 0xff2238, 5, 5.5, 0, 1.95, -4.3);
point("fire", 0xff7426, 13, 9, 7.3, .6, -1.7);
point("lamp", 0xffbe70, 4, 6, -6.4, 1.15, -4.1);
point("window", 0x6f8cff, 1.2, 6.5, -6, 2, -4.3);
point("fill", 0xffa070, 16, 10, 0, 2.5, .2);
/* заполняющий свет переезжает в ту зону, где сейчас камера */
const FILL_AT = [V3(-4.6, 2.7, -1.6), V3(0, 2.5, .2), V3(5.0, 2.7, -2.4), V3(-4.6, 3.0, 2.4), V3(-26, 3.0, 1.8)];
/* наличник входной двери изнутри */
box(-.76, -.62, 0, 2.56, 5.94, 6.0, M.walnut, world, .8);
box(.62, .76, 0, 2.56, 5.94, 6.0, M.walnut, world, .8);
box(-.76, .76, 2.42, 2.56, 5.94, 6.0, M.walnut, world, .8);
