/* ================= финал коктейля: подставка, запотевший бокал, эфирные масла цедры, круги от гарнира ================= */
const FIN = {};
FIN.coasterTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#efe4cc"; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#8a1428"; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 24, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#8a1428"; g.textAlign = "center"; g.textBaseline = "middle";
  fitFont(g, BAR_NAME, w - 70, 44, "Forum, Georgia, serif"); g.fillText(BAR_NAME, w / 2, h / 2 + 2);
  g.font = "16px Literata, Georgia, serif"; g.fillText("EST. 1921", w / 2, h / 2 + 40);
});
FIN.coasterMat = std({ map: FIN.coasterTex, roughness: .9 });
FIN.coasterGeo = new THREE.CylinderGeometry(.046, .046, .003, 36);
FIN.frostMat = std({ color: 0xf2f6fa, transparent: true, opacity: 0, roughness: .85, depthWrite: false, side: THREE.FrontSide });
FIN.mistTex = TEX.glow;
/* подставка ложится на стойку, бокал въезжает на неё и дальше они вместе */
{
  const base = STEP.serve;
  STEP.serve = async (st, c) => {
    const G = SHOW.glassV;
    if (!G) return base(st, c);
    const co = new THREE.Mesh(FIN.coasterGeo, FIN.coasterMat);
    co.position.copy(ST.serve).add(V3(0, .0016, 0));
    co.rotation.y = rr(0, 6);
    co.scale.setScalar(.01);
    co.userData.ing = true;
    world.add(co);
    tween(co.scale, { x: 1, y: 1, z: 1 }, SHOW.fast ? .001 : .25, ease.out);
    SND.tap();
    await base(st, c);
    if (co.parent === world) { co.userData.ing = false; G.g.attach(co); }
  };
}
/* запотевший бокал: коктейли «на ножке» подают ледяными — стекло покрывается испариной */
function frostGlass(G) {
  const glassMesh = G.body;
  if (!glassMesh || glassMesh.userData.frosted) return;
  glassMesh.userData.frosted = true;
  const f = new THREE.Mesh(glassMesh.geometry, FIN.frostMat.clone());
  f.scale.setScalar(1.012); f.renderOrder = 6;
  glassMesh.add(f);
  tween(f.material, { opacity: .28 }, SHOW.fast ? .001 : 2.2);
}
{
  const base = STEP.strain;
  STEP.strain = async (st, c) => {
    await base(st, c);
    if (SHOW.glassV && (c.cup === "coupe" || c.cup === "martini")) frostGlass(SHOW.glassV);
  };
}
/* эфирные масла: перед тем как положить цедру, бармен сжимает её над бокалом — облачко тончайших брызг */
function citrusMist(G, col) {
  if (SHOW.fast || reduceMotion.matches) return;
  const at = mouth(G, .05), N = 26, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) { pos.set([at.x, at.y, at.z], i * 3); vel.push(V3(rr(-.25, .25), rr(-.35, .05), rr(-.25, .25))); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, size: .006, map: FIN.mistTex, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }));
  world.add(pts);
  let t = 0;
  pts.userData.ing = true;
  const off = onTickTmp((tt, dt) => {
    t += dt;
    for (let i = 0; i < N; i++) { pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt; vel[i].y -= dt * .4; }
    geo.attributes.position.needsUpdate = true;
    pts.material.opacity = Math.max(0, .9 - t * 1.1);
    if (t > .9) { off(); world.remove(pts); geo.dispose(); pts.material.dispose(); }
  });
}
/* круги на поверхности, когда в бокал опускают оливку или вишню */
function ripple(G) {
  if (SHOW.fast) return;
  const s = surface(G);
  const r = mesh(new THREE.RingGeometry(.6, 1, 32), basic({ color: 0xffffff, transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }), s.x, s.y + .001, s.z);
  r.rotation.x = -Math.PI / 2; r.scale.setScalar(.004); r.userData.ing = true;
  tween(r.scale, { x: G.mouthR * G.scale * .9, y: G.mouthR * G.scale * .9, z: 1 }, .7, ease.out);
  tween(r.material, { opacity: 0 }, .8).then(() => { world.remove(r); r.geometry.dispose(); });
}
{
  const base = STEP.garnish;
  STEP.garnish = async (st, c) => {
    const G = SHOW.glassV;
    if (G && (c.garnish === "orange" || c.garnish === "lemon")) {
      shot("macro", mouth(G, .04));
      citrusMist(G, c.garnish === "orange" ? 0xffb04a : 0xfff07a);
      FSND.hiss && FSND.hiss();
      await ws(.5);
    }
    await base(st, c);
    if (G && (c.garnish === "olive" || c.garnish === "cherry")) ripple(G);
  };
}

/* гул зала зависит от того, сколько людей вокруг: к открытию тихо, ночью — полный зал */
Music.mix({ crowd: [0, .45, .7, 1][crowd] ?? .7 });
{
  const pc = playClosing;
  playClosing = async (...a) => { Music.mix({ crowd: 0 }); const r = await pc(...a); Music.mix({ crowd: [0, .45, .7, 1][crowd] ?? .7 }); return r; };
  const pr = playRaid;
  playRaid = async (...a) => { Music.mix({ crowd: .15 }); const r = await pr(...a); Music.mix({ crowd: [0, .45, .7, 1][crowd] ?? .7 }); return r; };
}
Object.assign(H3D, { closing: (...a) => playClosing(...a), raid: (...a) => playRaid(...a) });
