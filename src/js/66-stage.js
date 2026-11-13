/* ================= сцена: джаз-бэнд играет ровно те ноты, что звучат ================= */
const STG = { x0: -7.6, x1: -2.0, z0: 3.85, z1: 5.95, h: .3, active: false };
const BANDH = hoursOf(sceneDate());
let BAND_HERE = OWNER || BANDH >= 19 || BANDH < 3;

/* ---------- подмостки, занавес, вывеска, свет ---------- */
const STAGE_M = {
  lacquer: std({ color: 0x07060a, roughness: .12, metalness: .1, envMapIntensity: 1.4 }),
  keyW: std({ color: 0xf2ece0, roughness: .35 }),
  keyB: std({ color: 0x0c0b0c, roughness: .3 }),
  gold: std({ color: 0xc89a4a, metalness: 1, roughness: .35, envMapIntensity: 1.2 }),
  bassWood: std({ color: 0x7a3414, roughness: .35, envMapIntensity: 1 }),
  ebony: std({ color: 0x0e0a08, roughness: .4 }),
  string: new THREE.MeshBasicMaterial({ color: 0xd8c8a0 }),
  head: std({ color: 0xece4d2, roughness: .7 }),
  cymbal: std({ color: 0xc8963a, metalness: 1, roughness: .32, envMapIntensity: 1.3 }),
  drum: std({ color: 0x5a0a14, roughness: .3, envMapIntensity: .9 }),
  velvet: std({ map: TEX.velvet, color: 0x6a0c18, roughness: .85 })
};
(() => {
  const { x0, x1, z0, z1, h } = STG;
  // подмостки с латунной кромкой
  box(x0, x1, 0, h, z0, z1, M.walnutGloss, world, .8);
  box(x0, x1, h - .02, h + .006, z0 - .02, z0 + .02, M.brass, world, 0);
  box(x0 + .01, x1 - .01, .02, h - .03, z0 - .015, z0, M.darkwood, world, .8);
  // ступенька
  box(x1 - 1.0, x1 - .3, 0, .14, z0 - .32, z0, M.walnutGloss, world, .8);
  // занавес: складки бархата во всю ширину сцены
  const W = x1 - x0, cg = new THREE.PlaneGeometry(W, 3.3, 160, 1), cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) { const x = cp.getX(i); cp.setZ(i, Math.sin(x * 15) * .045 + Math.sin(x * 37) * .012); }
  cg.computeVertexNormals();
  const cur = mesh(cg, STAGE_M.velvet, (x0 + x1) / 2, h + 1.65, 5.86);
  cur.rotation.y = Math.PI;
  // ламбрекен сверху
  const vg = new THREE.PlaneGeometry(W + .2, .42, 120, 4), vp = vg.attributes.position;
  for (let i = 0; i < vp.count; i++) { const x = vp.getX(i), y = vp.getY(i); vp.setZ(i, Math.sin(x * 9) * .03 + (y < 0 ? Math.cos(x * 9) * .04 : 0)); vp.setY(i, y - (y < 0 ? Math.abs(Math.sin(x * 4.5)) * .1 : 0)); }
  vg.computeVertexNormals();
  const val = mesh(vg, STAGE_M.velvet, (x0 + x1) / 2, 3.5, 5.78);
  val.rotation.y = Math.PI;
  box(x0 - .05, x1 + .05, 3.68, 3.72, 5.7, 5.9, M.brass, world, 0);
  // вывеска с лампочками
  const sign = group((x0 + x1) / 2, 2.86, 5.7);
  sign.rotation.y = Math.PI;
  const tex = canvasTex(1024, 256, (g, w, hh) => {
    g.fillStyle = "#120608"; g.fillRect(0, 0, w, hh);
    g.strokeStyle = "#c9944a"; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, hh - 20);
    g.fillStyle = "#ffd9a0"; g.textAlign = "center"; g.textBaseline = "middle";
    fitFont(g, `${BAR_SIGN}  JAZZ`, w - 80, 112, "Forum, serif"); g.fillText(`${BAR_SIGN}  JAZZ`, w / 2, hh / 2 + 6);
  });
  mesh(new THREE.PlaneGeometry(1.9, .46), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), 0, 0, 0, sign);
  const bulbs = [];
  for (let i = 0; i < 26; i++) {
    const k = i / 26, per = 2 * (1.9 + .46);
    let d = k * per, x, y;
    if (d < 1.9) { x = -.95 + d; y = .26; } else if ((d -= 1.9) < .46) { x = .95; y = .26 - d; } else if ((d -= .46) < 1.9) { x = .95 - d; y = -.26; } else { d -= 1.9; x = -.95; y = -.26 + d; }
    bulbs.push(mesh(new THREE.SphereGeometry(.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd28a, toneMapped: false }), x, y, .01, sign));
  }
  STG.bulbs = bulbs;
  glowSprite(0xffb060, 2.6, 0, 0, .1, sign, .22);
  // рампа: маленькие лампы по краю сцены
  for (let i = 0; i < 9; i++) {
    const x = x0 + .35 + i * (W - .7) / 8;
    mesh(new THREE.CylinderGeometry(.03, .045, .05, 12, 1, true), M.brass, x, h + .025, z0 + .06);
    glowSprite(0xffc070, .3, x, h + .06, z0 + .06, world, .55);
  }
  // лучи прожекторов в дымке
  const beamTex = canvasTex(32, 128, (g, w, hh) => { const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, "rgba(255,215,160,.0)"); gr.addColorStop(.25, "rgba(255,215,160,.55)"); gr.addColorStop(1, "rgba(255,200,140,.0)"); g.fillStyle = gr; g.fillRect(0, 0, w, hh); });
  beamTex.wrapS = beamTex.wrapT = THREE.ClampToEdgeWrapping;
  STG.beams = [];
  for (const [x, z] of [[-6.75, 5.2], [-5.55, 4.95], [-4.75, 4.45], [-3.2, 5.0]]) {
    const b = mesh(new THREE.CylinderGeometry(.04, .55, 3.3, 24, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: .13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), x, h + 1.65, z);
    b.renderOrder = 9; STG.beams.push(b);
    const pool = mesh(new THREE.CircleGeometry(.6, 32), new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffc890, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), x, h + .004, z);
    pool.rotation.x = -Math.PI / 2;
  }
})();

/* ---------- рояль: корпус по кривой, открытая крышка, клавиши, которые нажимаются ---------- */
const PIANO = { ky: .72 + STG.h, keys: [] };
(() => {
  const L = 1.6, Wd = 1.38, top = .92, base = .64;
  // в плане: x — от клавиатуры (0) к хвосту (−L), z — от прямого борта (0) к изогнутому (−Wd)
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(-L, 0);
  sh.bezierCurveTo(-L - .12, 0, -L - .12, -.42, -L + .1, -.5);
  sh.bezierCurveTo(-1.05, -.64, -.82, -1.0, -.52, -Wd);
  sh.lineTo(0, -Wd); sh.lineTo(0, 0);
  const caseG = new THREE.ExtrudeGeometry(sh, { depth: top - base, bevelEnabled: true, bevelThickness: .01, bevelSize: .012, bevelSegments: 2, curveSegments: 24 });
  caseG.rotateX(Math.PI / 2); caseG.translate(0, top, 0);
  const g = group(-2.62, STG.h, 5.72);
  mesh(caseG, STAGE_M.lacquer, 0, 0, 0, g);
  // золотая дека со струнами внутри
  const plate = mesh(new THREE.ShapeGeometry(sh, 24), STAGE_M.gold, 0, top - .03, 0, g);
  plate.rotation.x = Math.PI / 2; plate.scale.set(.94, .94, 1); plate.position.set(-.04, top - .035, -.04);
  const strings = [];
  for (let i = 0; i < 30; i++) { const z = -.08 - i * .042; const len = (1.5 - i * .03); const s = new THREE.BoxGeometry(len, .002, .002); s.translate(-.1 - len / 2, top - .028, z); strings.push(s); }
  merged(strings, STAGE_M.string, g);
  // крышка поднята на подпорке, открыта к залу
  const lid = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .018, bevelEnabled: false, curveSegments: 24 }), STAGE_M.lacquer);
  lid.geometry.rotateX(Math.PI / 2);
  const hinge = group(0, top + .01, 0, g);
  hinge.add(lid); lid.position.set(0, .018, 0);
  hinge.rotation.x = .62;
  const prop = mesh(new THREE.CylinderGeometry(.007, .007, .62, 6), STAGE_M.lacquer, -.9, top + .27, -.95, g);
  prop.rotation.x = -.35;
  // ножки
  for (const [x, z] of [[-.15, -.12], [-.15, -1.25], [-1.55, -.25]]) {
    mesh(new THREE.CylinderGeometry(.05, .04, top - .26, 12), STAGE_M.lacquer, x, (top - .26) / 2, z, g);
    mesh(new THREE.CylinderGeometry(.03, .03, .03, 10), M.brass, x, .015, z, g);
  }
  // клавиатура: 52 белых и 36 чёрных, у каждой свой наклон при нажатии
  const kb = group(0, 0, 0, g);
  mesh(new THREE.BoxGeometry(.2, .1, Wd + .06), STAGE_M.lacquer, .1, PIANO.ky - .1 - STG.h, -Wd / 2, kb);
  const nW = 52, kw = (Wd - .16) / nW;
  const white = new THREE.InstancedMesh(new THREE.BoxGeometry(.15, .022, kw * .92), STAGE_M.keyW, nW);
  const black = new THREE.InstancedMesh(new THREE.BoxGeometry(.095, .026, kw * .55), STAGE_M.keyB, 36);
  kb.add(white); kb.add(black);
  const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
  // клавиши идут от прямого борта (басы, слева от пианиста) к изгибу (верха, ближе к залу)
  let wi = 0, bi = 0;
  for (let m = 21; m <= 108; m++) {
    const k = { m, black: isBlack(m), press: 0 };
    if (!k.black) { k.z = -.08 - (wi + .5) * kw; k.idx = wi++; k.inst = white; }
    else { k.z = -.08 - wi * kw; k.idx = bi++; k.inst = black; }
    PIANO.keys[m] = k;
  }
  PIANO.kw = kw; PIANO.white = white; PIANO.black = black; PIANO.g = g;
  PIANO.setKey = (k, d) => {
    const x = k.black ? .05 : .075, y = PIANO.ky - STG.h + (k.black ? .02 : 0) - d * .008;
    _m4.compose(V3(x, y, k.z), _q4.setFromEuler(_e4.set(0, 0, -d * .06)), V3(1, 1, 1));
    k.inst.setMatrixAt(k.idx, _m4); k.inst.instanceMatrix.needsUpdate = true;
  };
  // нотная подставка с листом
  const st = group(-.18, top + .05, -Wd * .55, g);
  mesh(new THREE.BoxGeometry(.012, .22, .55), STAGE_M.lacquer, 0, .11, 0, st).rotation.z = -.25;
  mesh(new THREE.PlaneGeometry(.21, .3), std({ map: TEX.page, roughness: .9 }), .015, .12, -.08, st).rotation.set(0, Math.PI / 2, .25);
  mesh(new THREE.PlaneGeometry(.21, .3), std({ map: TEX.page, roughness: .9 }), .015, .12, .1, st).rotation.set(0, Math.PI / 2, .25);
  // банкетка
  box(-2.42 + .12, -2.42 + .48, .42 + STG.h, .5 + STG.h, 4.78, 5.42, M.leatherRed, world, 0);
  for (const [dx, dz] of [[.15, 4.82], [.45, 4.82], [.15, 5.38], [.45, 5.38]]) box(-2.42 + dx - .02, -2.42 + dx + .02, STG.h, .42 + STG.h, dz - .02, dz + .02, STAGE_M.lacquer, world, 0);
})();
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler();
for (let m = 21; m <= 108; m++) PIANO.setKey(PIANO.keys[m], 0);
/* мировая точка клавиши */
const keyAt = (m, dx = 0) => PIANO.g.localToWorld(V3(.13 + dx, PIANO.ky - STG.h + .02, PIANO.keys[clamp(Math.round(m), 21, 108)].z));

/* ---------- контрабас ---------- */
const BASS = {};
(() => {
  const g = group(-5.76, STG.h, 4.86);
  g.rotation.set(.1, Math.PI - .35, .08);
  g.scale.setScalar(.85);
  // корпус: контур с «талией», выдавленный в толщину
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(.36, 0, .36, .42, .2, .5);
  s.bezierCurveTo(.15, .54, .15, .6, .2, .64);
  s.bezierCurveTo(.3, .72, .28, 1.0, .12, 1.06);
  s.bezierCurveTo(.06, 1.08, -.06, 1.08, -.12, 1.06);
  s.bezierCurveTo(-.28, 1.0, -.3, .72, -.2, .64);
  s.bezierCurveTo(-.15, .6, -.15, .54, -.2, .5);
  s.bezierCurveTo(-.36, .42, -.36, 0, 0, 0);
  const body = new THREE.ExtrudeGeometry(s, { depth: .14, bevelEnabled: true, bevelThickness: .04, bevelSize: .03, bevelSegments: 4, curveSegments: 28 });
  body.translate(0, .18, -.07);
  mesh(body, STAGE_M.bassWood, 0, 0, 0, g);
  // эфы, гриф, шейка, завиток, подставка, струнодержатель, шпиль
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(.012, .2, .01), STAGE_M.ebony, sx * .11, .78, .085, g).rotation.z = sx * .15;
  const neckG = new THREE.BoxGeometry(.05, .72, .045); neckG.translate(0, 1.24 + .36, .03);
  mesh(neckG, STAGE_M.bassWood, 0, 0, 0, g);
  const fb = new THREE.BoxGeometry(.055, .82, .012); fb.translate(0, 1.18 + .41, .062);
  mesh(fb, STAGE_M.ebony, 0, 0, 0, g);
  mesh(new THREE.TorusGeometry(.035, .016, 8, 16), STAGE_M.bassWood, 0, 2.02, .03, g).rotation.y = Math.PI / 2;
  mesh(new THREE.BoxGeometry(.12, .045, .012), std({ color: 0xd8c09a, roughness: .6 }), 0, .66, .1, g);
  mesh(new THREE.BoxGeometry(.08, .24, .014), STAGE_M.ebony, 0, .38, .1, g);
  mesh(new THREE.CylinderGeometry(.006, .003, .2, 6), M.chrome, 0, .08, 0, g);
  // струны: от струнодержателя к колкам
  BASS.strings = [];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * .012;
    const sm = mesh(new THREE.CylinderGeometry(.0016, .0016, 1.5, 4), STAGE_M.string, x, .5 + .75, .1 + .015, g);
    sm.rotation.x = -.015;
    BASS.strings.push({ m: sm, x, a: 0 });
  }
  BASS.g = g;
  BASS.nut = V3(0, 1.98, .075); BASS.low = V3(0, 1.3, .08); BASS.pluck = V3(0, 1.08, .09);
})();

/* ---------- ударные: бочка с вывеской, малый барабан, хай-хэт, райд, щётки ---------- */
const KIT = {};
(() => {
  const x = -6.7, z = 5.0, y0 = STG.h;
  const g = group(x, y0, z);
  g.rotation.y = .25;
  const kick = group(0, .26, -.02, g);
  mesh(new THREE.CylinderGeometry(.27, .27, .36, 32, 1, true), STAGE_M.drum, 0, 0, 0, kick).rotation.x = Math.PI / 2;
  for (const sz of [-1, 1]) mesh(new THREE.TorusGeometry(.272, .012, 6, 32), M.chrome, 0, 0, sz * .18, kick);
  const logo = canvasTex(256, 256, (c, w, h) => { c.fillStyle = "#efe6d2"; c.beginPath(); c.arc(128, 128, 126, 0, 7); c.fill(); c.fillStyle = "#6a0c18"; c.textAlign = "center"; c.textBaseline = "middle"; fitFont(c, BAR_SIGN, 210, 40, "Forum, serif"); c.fillText(BAR_SIGN, 128, 118); c.font = "400 22px Literata, serif"; c.fillText("JAZZ · 1924", 128, 158); c.strokeStyle = "#c9944a"; c.lineWidth = 5; c.beginPath(); c.arc(128, 128, 112, 0, 7); c.stroke(); });
  KIT.head = mesh(new THREE.CircleGeometry(.268, 32), std({ map: logo, roughness: .7 }), 0, 0, -.182, kick);
  KIT.head.rotation.y = Math.PI;
  KIT.kick = kick;
  const stand = (sx, sz, hh) => { mesh(new THREE.CylinderGeometry(.008, .008, hh, 6), M.chrome, sx, hh / 2, sz, g); for (let i = 0; i < 3; i++) { const a = i * 2.1; const l = mesh(new THREE.CylinderGeometry(.005, .005, .3, 4), M.chrome, sx + Math.cos(a) * .1, .06, sz + Math.sin(a) * .1, g); l.rotation.set(Math.sin(a) * .9, 0, -Math.cos(a) * .9); } };
  // малый барабан между коленями
  KIT.snare = group(.0, .62, .32, g);
  mesh(new THREE.CylinderGeometry(.18, .18, .13, 32), STAGE_M.drum, 0, 0, 0, KIT.snare);
  mesh(new THREE.CylinderGeometry(.181, .181, .004, 32), STAGE_M.head, 0, .066, 0, KIT.snare);
  stand(0, .32, .56);
  // хай-хэт слева от барабанщика (его левая — −x мира после поворота)
  KIT.hat = group(-.42, .88, .28, g);
  KIT.hatTop = mesh(new THREE.CylinderGeometry(.17, .17, .006, 32), STAGE_M.cymbal, 0, .02, 0, KIT.hat);
  mesh(new THREE.CylinderGeometry(.17, .17, .006, 32), STAGE_M.cymbal, 0, -.01, 0, KIT.hat);
  stand(-.42, .28, .88);
  // райд справа
  KIT.ride = group(.48, .9, .2, g);
  const rg = new THREE.ConeGeometry(.28, .04, 36, 1, true); rg.rotateX(Math.PI);
  mesh(new THREE.ConeGeometry(.28, .035, 36, 1, true), STAGE_M.cymbal, 0, 0, 0, KIT.ride).rotation.x = Math.PI;
  KIT.ride.rotation.z = -.2;
  stand(.48, .2, .88);
  // стул барабанщика
  mesh(new THREE.CylinderGeometry(.17, .17, .07, 20), M.leatherRed, 0, .5, .72, g);
  mesh(new THREE.CylinderGeometry(.02, .02, .46, 8), M.chrome, 0, .23, .72, g);
  KIT.g = g;
})();

/* ---------- тенор-саксофон: изогнутая конусная трубка, раструб, клапаны ---------- */
function taperTube(curve, n, r0, r1, radial = 14) {
  const fr = curve.computeFrenetFrames(n, false), pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPointAt(t), r = r0 + (r1 - r0) * Math.pow(t, 1.4);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, nn = fr.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[i], Math.sin(a));
      pos.push(p.x + nn.x * r, p.y + nn.y * r, p.z + nn.z * r);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const SAX = {};
(() => {
  // координаты — в системе груди музыканта: x — его левая рука, z — вперёд
  const curve = new THREE.CatmullRomCurve3([V3(0, .575, .1), V3(.0, .55, .19), V3(-.01, .5, .23), V3(-.03, .3, .24), V3(-.055, .1, .23), V3(-.075, -.03, .2), V3(-.12, -.04, .19), V3(-.15, .05, .19), V3(-.165, .17, .2)], false, "catmullrom", .3);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(taperTube(curve, 90, .008, .036), M.brass));
  // мундштук и раструб
  const mp = new THREE.Mesh(new THREE.CylinderGeometry(.006, .009, .05, 10), STAGE_M.ebony);
  mp.position.set(0, .585, .085); mp.rotation.x = .9; g.add(mp);
  const bell = new THREE.Mesh(lathe([[.036, 0], [.045, .03], [.06, .055], [.075, .065]], 28), M.brass);
  bell.material = M.brass;
  bell.position.copy(curve.getPointAt(1)); bell.lookAt(bell.position.clone().add(curve.getTangentAt(1)));
  bell.rotateX(Math.PI / 2);
  g.add(bell);
  // клапаны-перламутры спереди трубки
  const pearl = std({ color: 0xf2ece4, roughness: .3 });
  SAX.keys = [];
  for (let i = 0; i < 6; i++) {
    const p = curve.getPointAt(.3 + i * .065);
    const k = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .004, 12), pearl);
    k.position.copy(p).add(V3(0, 0, .03)); k.rotation.x = Math.PI / 2; g.add(k); SAX.keys.push(k);
  }
  SAX.g = g; SAX.curve = curve;
  SAX.lh = curve.getPointAt(.33).add(V3(.0, 0, .03)); SAX.rh = curve.getPointAt(.52).add(V3(-.005, 0, .03));
})();

/* ---------- музыка: стойка микрофона у сцены ---------- */
const MIC = group(-4.75, STG.h, 4.12);
(() => {
  mesh(new THREE.CylinderGeometry(.12, .14, .02, 24), M.chrome, 0, .01, 0, MIC);
  mesh(new THREE.CylinderGeometry(.008, .008, 1.5, 8), M.chrome, 0, .75, 0, MIC);
  const head = group(0, 1.52, 0, MIC);
  mesh(new RoundedBoxGeometry(.07, .12, .05, 3, .02), M.chrome, 0, 0, 0, head);
  mesh(new THREE.BoxGeometry(.074, .09, .052), std({ color: 0x1a1816, roughness: .9 }), 0, 0, 0, head);
  head.rotation.x = .25;
})();

/* ---------- музыканты ---------- */
const MUS = {};
(() => {
  MUS.piano = makeFigure({ kind: "suit", body: "#16161c", shirt: "#ece6d8", tie: "#6a0f1e", skin: 0x9a6448, hair: 0x0e0a08, hairStyle: "short", seated: true, hipY: .5, fingers: true });
  placeFig(MUS.piano, -2.1, 5.1, -Math.PI / 2);
  MUS.bass = makeFigure({ kind: "vest", body: "#3a2416", shirt: "#e4dccb", skin: 0xc48c6a, hair: 0x3a2414, hairStyle: "short", mustache: true, rolled: true, fingers: true, bowtie: 0x1a1a1a });
  placeFig(MUS.bass, -5.6, 5.16, Math.PI - .35);
  MUS.drum = makeFigure({ kind: "vest", body: "#141418", shirt: "#d8d0c0", skin: 0xb07a58, hair: 0x120c08, hairStyle: "slick", seated: true, hipY: .54, fingers: true, rolled: true, garter: 0x5a0a18 });
  placeFig(MUS.drum, -6.7 + Math.sin(.25) * .72, 5.0 + Math.cos(.25) * .72, Math.PI + .25);
  MUS.sax = makeFigure({ kind: "suit", body: "#2a1a24", shirt: "#ece6d8", tie: "#c9944a", skin: 0xc49070, hair: 0x1a110b, hairStyle: "slick", hat: 0x1a1414, fingers: true });
  placeFig(MUS.sax, -4.75, 4.5, Math.PI);
  for (const F of Object.values(MUS)) { F.y0 = STG.h; F.legsFixed = true; F.legs.forEach(lg => { lg.tgt.set(lg.side * .1, .075, .02); lg.cur.copy(lg.tgt); }); }
  MUS.sax.spine.add(SAX.g);
  // ноги сидящих: на полу сцены, у барабанщика правая — на педали
  for (const F of [MUS.piano, MUS.drum]) { F.legsFixed = true; F.legs.forEach(lg => { lg.tgt.set(lg.side * .13, .08, .36); lg.cur.copy(lg.tgt); }); }
  for (const F of Object.values(MUS)) { F.root.visible = BAND_HERE; F.off = true; }
})();

/* ---------- ноты из музыки → движения ---------- */
const NOTEQ = [];
Music.onNote(e => { if (STG.active) NOTEQ.push(e); });
const PL = { lz: 5.4, rz: 4.8, lDip: 0, rDip: 0, keysDown: [] };
const BS = { u: .1, pl: 0 };
const DR = { kick: 0, acc: 0, ride: 0, hat: 0 };
const SX2 = { m: 64, on: 0, breath: 0, last: 0 };
function bandEvent(e) {
  const now = Music.time();
  if (e.i === "piano") {
    const lo = e.notes.filter(m => m < 58), hi = e.notes.filter(m => m >= 58);
    const Z0 = PIANO.g.position.z;
    if (lo.length) { PL.lz = Z0 + lo.reduce((a, m) => a + PIANO.keys[m].z, 0) / lo.length; PL.lDip = 1; }
    if (hi.length) { PL.rz = Z0 + hi.reduce((a, m) => a + PIANO.keys[m].z, 0) / hi.length; PL.rDip = 1; }
    for (const m of e.notes) { const k = PIANO.keys[m]; if (k) { k.press = 1; k.until = now + Math.min(.6, e.dur * .5); PL.keysDown.push(k); } }
  } else if (e.i === "bass") { BS.u = clamp((e.m - 34) / 16, 0, 1); BS.pl = 1; BASS.strings[clamp(Math.floor((e.m - 28) / 5), 0, 3)].a = 1; }
  else if (e.i === "kick") DR.kick = 1;
  else if (e.i === "brush") { if (e.v > .03) { DR.acc = 1; DR.hat = 1; } else DR.ride = Math.max(DR.ride, .5); }
  else if (e.i === "sax") { if (e.kind === "breath") SX2.breath = 1; else { SX2.m = e.m; SX2.on = 1; SX2.last = now + e.dur; } }
}
const _w = V3(), _sq = new THREE.Quaternion();
function reachW(F, arm, p, f, n, k = 22) {
  const l = toFig(F, p);
  arm.manual = true; arm.k = k;
  const c = Math.cos(-F.face), s = Math.sin(-F.face), d = v => V3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
  reach(arm, l.x, l.y, l.z, d(f), d(n));
}
onTick((t, dt) => {
  const vis = BAND_HERE && (curZone === 3 || (flight && flight.B && flight.B.tx < -3 && flight.B.tz > 3));
  if (vis !== STG.active) { STG.active = vis; for (const F of Object.values(MUS)) F.off = !vis; NOTEQ.length = 0; }
  // лампочки вывески бегут по кругу
  if (STG.bulbs && vis) STG.bulbs.forEach((b, i) => { const v = (Math.sin(t * 3 - i * .7) > 0 ? 1 : .45) * (STG.dim ?? 1); b.material.color.setRGB(v, .82 * v, .54 * v); });
  if (!vis) return;
  const playing = Music.on;
  const now = Music.time();
  while (NOTEQ.length && NOTEQ[0].t <= now + .01) bandEvent(NOTEQ.shift());
  NOTEQ.sort((a, b) => a.t - b.t);
  const beat = Music.beat(), bob = beat === null ? 0 : Math.pow(Math.max(0, Math.cos(beat * Math.PI * 2)), 4);
  const k = smoothK(14, dt);
  // клавиши отпускаются
  PL.keysDown = PL.keysDown.filter(kk => { if (now > kk.until) kk.press = Math.max(0, kk.press - dt * 12); PIANO.setKey(kk, kk.press); return kk.press > 0; });

  // пианист: левая рука в басах, правая в верхах, кисть ныряет на каждой ноте
  {
    const F = MUS.piano;
    PL.lDip = Math.max(0, PL.lDip - dt * 7); PL.rDip = Math.max(0, PL.rDip - dt * 7);
    const yL = PIANO.ky + .055 - PL.lDip * .025, yR = PIANO.ky + .055 - PL.rDip * .025;
    const kx = PIANO.g.position.x + .1;
    // руки не перекрещиваются: левая всегда ближе к басам (больший z)
    const lz = Math.max(PL.lz, PL.rz + .14), rz = Math.min(PL.rz, PL.lz - .14);
    reachW(F, F.L, V3(kx + .1, yL, playing ? lz : 5.25), V3(-1, -.45, 0), V3(0, -1, 0));
    reachW(F, F.R, V3(kx + .1, yR, playing ? rz : 4.95), V3(-1, -.45, 0), V3(0, -1, 0));
    const c = playing ? .5 + .2 * PL.rDip : .25;
    F.R.ft = [c, c + .05, c + .1, c + .15]; F.L.ft = [c, c + .05, c + .1, c + .15];
    F.R.tt = F.L.tt = .2; F.R.tst = F.L.tst = .25;
    F.leanT = .12 + bob * .03; F.twistT = clamp(((PL.lz + PL.rz) / 2 - 5.1) * .5, -.25, .25);
    F.nod = playing ? bob * .06 : 0;
    F.look = V3(PIANO.g.position.x + .05, PIANO.ky, (PL.lz + PL.rz) / 2);
  }
  // контрабасист: левая рука скользит по грифу к ноте, правая щиплет струну
  {
    const F = MUS.bass, g = BASS.g;
    BS.pl = Math.max(0, BS.pl - dt * 9);
    g.updateMatrixWorld(true);
    const along = BASS.nut.clone().lerp(BASS.low, playing ? BS.u : .4);
    const lp = g.localToWorld(along.clone().add(V3(.02, 0, -.045)));
    reachW(F, F.L, lp, V3(-.6, .2, .7).normalize(), V3(.2, 0, 1).normalize());
    F.L.ft = [.75, .78, .8, .82]; F.L.tt = .55; F.L.tst = .6;
    const pp = g.localToWorld(BASS.pluck.clone().add(V3(.04 - BS.pl * .08, -BS.pl * .03, .07)));
    reachW(F, F.R, pp, V3(-.8, -.4, -.2).normalize(), V3(0, 0, -1));
    F.R.ft = [.15, .45, .7, .8]; F.R.tt = .3; F.R.tst = .4;
    for (const s of BASS.strings) { s.a = Math.max(0, s.a - dt * 3); s.m.position.x = s.x + Math.sin(t * 90) * .0015 * s.a; }
    F.nod = playing ? bob * .08 : 0; F.leanT = .06 + (playing ? bob * .02 : 0); F.look = g.localToWorld(along.clone());
    F.twistT = .1;
  }
  // барабанщик: левая щётка кругами по малому, правая — акценты на 2 и 4, нога на бочке
  {
    const F = MUS.drum, sn = KIT.snare;
    DR.kick = Math.max(0, DR.kick - dt * 8); DR.acc = Math.max(0, DR.acc - dt * 6); DR.ride = Math.max(0, DR.ride - dt * 8); DR.hat = Math.max(0, DR.hat - dt * 6);
    sn.updateMatrixWorld(true);
    const a = (beat === null ? t : (t * .2 + beat)) * Math.PI * 2;
    const lc = sn.localToWorld(V3(Math.cos(a) * .06 - .03, .1, Math.sin(a) * .05));
    reachW(F, F.L, lc, V3(.3, -.6, -.7).normalize(), V3(0, -1, 0));
    const rr_ = playing ? (DR.acc > 0 ? sn.localToWorld(V3(.05, .1 + (1 - DR.acc) * 0 + Math.pow(1 - DR.acc, 3) * .12, .02)) : KIT.ride.localToWorld(V3(-.12, .06 + DR.ride * -.03 + .05, .05))) : sn.localToWorld(V3(.1, .12, .05));
    reachW(F, F.R, rr_, V3(-.3, -.5, -.8).normalize(), V3(0, -1, 0));
    F.L.ft = F.R.ft = [.85, .9, .95, 1]; F.L.tt = F.R.tt = .7;
    KIT.kick.scale.setScalar(1 + DR.kick * .015);
    KIT.ride.rotation.x = Math.sin(t * 20) * .03 * DR.ride;
    KIT.hatTop.position.y = .02 - DR.hat * .012;
    F.legs[1].tgt.y = .08 + (1 - DR.kick) * .03;
    F.nod = playing ? bob * .1 : 0; F.leanT = .14;
    F.look = playing && Math.sin(t * .3) > .6 ? MUS.sax.head.getWorldPosition(_w) : sn.localToWorld(V3(0, 0, 0));
  }
  // саксофонист: пальцы закрывают клапаны по высоте ноты, на длинных нотах раструб поднимается
  {
    const F = MUS.sax;
    const sounding = playing && now < SX2.last;
    SX2.on += ((sounding ? 1 : 0) - SX2.on) * smoothK(6, dt);
    SX2.breath = Math.max(0, SX2.breath - dt * 2.5);
    const closed = clamp(Math.round((74 - SX2.m) / 2.6), 0, 6);
    // кисти обнимают трубку: левая сверху, правая снизу, пальцы ложатся на клапаны спереди
    SAX.g.updateMatrixWorld(true);
    SAX.g.getWorldQuaternion(_sq);
    const hand = (arm, at, f, n) => {
      const fw = f.clone().normalize().applyQuaternion(_sq), nw = n.clone().normalize().applyQuaternion(_sq);
      const kp = SAX.g.localToWorld(at.clone());
      reachW(F, arm, kp.addScaledVector(fw, -.065).addScaledVector(nw, -.035), fw, nw, 30);
    };
    hand(F.L, SAX.lh, V3(-.75, -.45, -.45), V3(-.2, -.1, -.97));
    hand(F.R, SAX.rh, V3(.75, -.45, -.45), V3(.2, -.1, -.97));
    const fl = i => (i < closed ? .95 : .62);
    F.L.ft = [fl(0), fl(1), fl(2), .25]; F.R.ft = [fl(3), fl(4), fl(5), .25];
    F.L.tt = F.R.tt = .5; F.L.tst = F.R.tst = .85;
    SAX.keys.forEach((kk, i) => { kk.position.z = SAX.curve.getPointAt(.3 + i * .065).z + .03 - (i < closed ? .004 : 0); });
    // играя, чуть откидывается и раскачивается; в паузе — кивает в такт
    F.leanT = -.06 * SX2.on + .03 + SX2.breath * .03;
    F.sway = Math.sin(t * 1.3) * .04 * SX2.on;
    F.nod = playing ? (sounding ? -.05 - (SX2.m - 64) * .004 : bob * .07) : 0;
    F.look = null;
  }
  // финальный поклон в конце смены
  if (STG.bow) for (const F of Object.values(MUS)) { F.leanT = .5; F.nod = .25; F.twistT = 0; F.sway = 0; F.look = null; }
});

/* ---------- реплики музыкантов и просьба сыграть ---------- */
MUS.piano.lines = ["Все наши темы — по кругу «два — пять — один»: самый главный оборот в джазе.", "Слушайте левую руку: аккорд на первую долю и тихий ответ в конце такта.", "Каждые восемь тактов отдаю соло саксофону, потом забираю обратно."];
MUS.sax.lines = ["Тенор в джазе прославил Коулмен Хокинс: в 1939-м его «Body and Soul» знала вся Америка.", "Ноты сам не знаю заранее: импровизирую по аккордам, как пианист подскажет.", "Самое трудное в соло — вовремя замолчать."];
MUS.bass.lines = ["Контрабас в джазе почти всегда щиплют, без смычка: на нём держится весь ритм.", "Я играю основной тон аккорда, а на третью долю — квинту или октаву."];
MUS.drum.lines = ["Щётками играют тихо: чтобы за столиками было слышно друг друга.", "Бочка на раз, щётка с акцентом на два и четыре — и ноги сами стучат."];
for (const [F, label] of [[MUS.piano, "Пианист"], [MUS.sax, "Саксофонист"], [MUS.bass, "Контрабасист"], [MUS.drum, "Барабанщик"]]) {
  if (BAND_HERE) hot(F.root, 3, label, () => say(F, lineOf(F)), { grow: 0 });
}
hot(MIC, 3, BAND_HERE ? "Попросить сыграть" : "Сцена пока пустая", () => {
  if (!BAND_HERE) { hintEl.textContent = "Музыканты выходят на сцену в 19:00. Загляни вечером."; return; }
  const btn = document.getElementById("music");
  if (!Music.on && btn) btn.click();
  say(MUS.sax, Music.on ? "Для вас — ещё квадрат!" : "Раз, два, раз-два-три-четыре!", 3);
}, { grow: .03 });
Object.assign(H3D, { stage: { PL, BS, DR, SX2, NOTEQ, STG } });
