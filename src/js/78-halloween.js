/* ================= Хэллоуин: бар украшен на одну ночь (31 октября, до 3:00 1 ноября) =================
   Проверить в другой день: ?holiday=halloween */
const HALLOWEEN = (() => {
  if (QS.get("holiday") === "halloween") return true;
  if (QS.get("holiday") === "off") return false;
  const d = nowDate();
  return (d.getMonth() === 9 && d.getDate() === 31) || (d.getMonth() === 10 && d.getDate() === 1 && d.getHours() < 3);
})();
const HW = { lanterns: [], bats: [] };
const HALLOWEEN_STORY = {
  name: "Хэллоуин", tagline: "Ночь, когда в Hacheden горят тыквы",
  facts: [["Дата", "ночь на 1 ноября"], ["Корни", "кельтский праздник Самайн"]],
  sections: [
    ["Откуда праздник", "Корни Хэллоуина — в кельтском празднике Самайн: так отмечали конец урожая и начало зимы. Верили, что в эту ночь граница между миром живых и миром духов становится тоньше. Само слово Halloween — сокращение от All Hallows' Eve, «канун Дня всех святых», который празднуют 1 ноября."],
    ["Почему тыква", "В Ирландии и Шотландии фонари с лицами вырезали из репы. По легенде, их носил с собой Скупой Джек, который обманул дьявола и был обречён скитаться с угольком в выдолбленной репе. Ирландские переселенцы в Америке в XIX веке взяли вместо репы тыкву — она больше и её легче вырезать."],
    ["В баре этой ночью", "Бармен советует что-нибудь тёмно-красное: горький «Негрони» или наш огненный «Hacheden». А тем, кто ищет тайное меню, он шепнёт: скотч, вишня, вермут и апельсин — коктейль с подходящим названием."]
  ]
};
if (HALLOWEEN) {
  /* резная тыква: рёбра, хвостик, светящееся лицо и мерцающий отблеск свечи внутри */
  const faceTex = canvasTex(256, 200, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 130);
    g.addColorStop(0, "#fff2a0"); g.addColorStop(.55, "#ffb030"); g.addColorStop(1, "#ff6a00");
    c.fillStyle = g;
    const tri = (pts) => { c.beginPath(); c.moveTo(...pts[0]); for (const p of pts.slice(1)) c.lineTo(...p); c.closePath(); c.fill(); };
    tri([[58, 78], [98, 78], [80, 42]]);
    tri([[158, 78], [198, 78], [176, 42]]);
    tri([[118, 112], [138, 112], [128, 94]]);
    c.beginPath(); c.moveTo(40, 128);
    const teeth = [[64, 150], [84, 136], [104, 156], [128, 138], [152, 156], [172, 136], [192, 150], [216, 128]];
    for (const [x, y] of teeth) c.lineTo(x, y);
    c.quadraticCurveTo(128, 196, 40, 128); c.fill();
  });
  const faceMat = basic({ map: faceTex, transparent: true, toneMapped: false, depthWrite: false });
  function lantern(x, y, z, s, rot, parent = world, label = null, act = null) {
    const g = group(x, y, z, parent); g.scale.setScalar(s); g.rotation.y = rot;
    const m = std({ color: 0xd8701a, roughness: .55, emissive: 0x3a1000, emissiveIntensity: .6 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; const p = mesh(new THREE.SphereGeometry(.06, 14, 10), m, Math.cos(a) * .045, .055, Math.sin(a) * .045, g); p.scale.set(.75, .9, .75); }
    mesh(new THREE.CylinderGeometry(.008, .012, .04, 6), std({ color: 0x3a3012 }), 0, .12, 0, g).rotation.z = .3;
    const f = mesh(new THREE.PlaneGeometry(.1, .078), faceMat, 0, .058, .092, g);
    f.userData.noHit = true;
    const glow = glowSprite(0xff8a20, .36, 0, .06, .11, g, .5);
    HW.lanterns.push({ g, glow, ph: Math.random() * 6 });
    if (label) hot(g, curZoneOf(x, z), label, act, { grow: .08 });
    return g;
  }
  const curZoneOf = (x, z) => x > 4 ? 2 : x < -4.5 && z < 0 ? 0 : z > 3 ? 3 : 1;
  // бар: на концах стойки
  lantern(-2.05, CT.top, -2.2, 1.9, .15, world, "Тыква: Хэллоуин", () => openCard(HALLOWEEN_STORY));
  lantern(2.35, CT.top, -2.25, 1.5, -.2);
  lantern(-2.35, CT.top, -2.3, 1.0, .4);
  // курилка: у камина
  if (FEAT.smoke) {
    lantern(7.45, .04, FP.z + 1.15, 1.5, -Math.PI / 2);
    lantern(7.7, 1.32, FP.z + .05, .7, -Math.PI / 2);
  }
  // читальня: на подоконнике
  if (FEAT.nook) {
    lantern(WIN.x - .55, WIN.sill + .005, -4.82, .9, 0);
    lantern(WIN.x + .58, WIN.sill + .005, -4.82, .7, -.15);
  }
  // сцена: по краям рампы
  if (FEAT.stage) {
    lantern(STG.x0 + .45, STG.h, STG.z0 + .18, 1.1, Math.PI);
    lantern(STG.x1 - .45, STG.h, STG.z0 + .18, 1.1, Math.PI);
  }
  // улица: у двери
  if (FEAT.street) {
    lantern(-1.45, 0, FZ + .6, 3.2, .1, street);
    lantern(.3, 0, FZ + .6, 2.6, -.15, street);
    lantern(-1.0, 0, FZ + .75, 1.7, .3, street);
  }

  /* летучие мыши: за окном читальни и над входом с улицы */
  const batMat = basic({ color: 0x050304, side: THREE.DoubleSide });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); wingShape.lineTo(.5, .32); wingShape.lineTo(1, .18);
  wingShape.quadraticCurveTo(.86, .02, .74, -.02); wingShape.quadraticCurveTo(.62, .1, .5, -.04); wingShape.quadraticCurveTo(.36, .08, .22, -.08); wingShape.lineTo(0, -.06);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  function bat(parent, s) {
    const g = new THREE.Group(); parent.add(g); g.scale.setScalar(s);
    const body = mesh(new THREE.SphereGeometry(.09, 10, 8), batMat, 0, 0, 0, g); body.scale.set(.8, 1.3, .5);
    for (const sd of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(.03, .08, 4), batMat, sd * .04, .13, 0, g); }
    const L = mesh(wingGeo, batMat, 0, .02, 0, g); L.scale.x = -1;
    const R2 = mesh(wingGeo, batMat, 0, .02, 0, g);
    g.userData.w = [L, R2];
    return g;
  }
  if (FEAT.nook) for (let i = 0; i < 4; i++) HW.bats.push({ g: bat(world, .11), kind: "win", ph: i * 1.7, sp: .35 + i * .07, fl: 9 + i });
  if (FEAT.street) for (let i = 0; i < 5; i++) HW.bats.push({ g: bat(street, .16), kind: "street", ph: i * 1.25, sp: .45 + i * .05, fl: 8 + i * .7 });
  onTick((t) => {
    for (const L of HW.lanterns) {
      const k = .78 + .12 * Math.sin(t * 9 + L.ph) + .08 * Math.sin(t * 23 + L.ph * 2);
      L.glow.material.opacity = .5 * k;
    }
    for (const B of HW.bats) {
      const a = t * B.sp + B.ph, fl = Math.sin(t * B.fl + B.ph);
      if (B.kind === "win") {
        if (curZone !== 0 && !flight) { B.g.visible = false; continue; }
        B.g.visible = true;
        // в пределах арочного окна, сразу за стеклом
        B.g.position.set(WIN.x + Math.sin(a * 1.3) * .55, WIN.sill + .85 + Math.sin(a * 2.1) * .35 + Math.cos(a * .7) * .2, -4.985);
        B.g.rotation.z = Math.sin(a * 1.3 + 1) * .25;
      } else {
        B.g.position.set(-.5 + Math.cos(a) * (1.7 + .3 * Math.sin(a * 2)), 2.75 + Math.sin(a * 1.7) * .4, FZ + 1.6 + Math.sin(a) * 1.0);
        B.g.rotation.y = -a + Math.PI / 2;
      }
      B.g.userData.w[0].rotation.y = fl * .9; B.g.userData.w[1].rotation.y = -fl * .9;
    }
  });
  /* реплики: бармен, швейцар, гости */
  BT_RANDOM.push("Счастливого Хэллоуина! Тыквы сегодня горят до самого закрытия.", "Говорят, в эту ночь даже кот из курилки ходит тише.", "Сегодня советую что-нибудь тёмно-красное. Например, «Негрони».");
  {
    const base = GREET;
    GREET = () => OWNER ? "Хозяин! Счастливого Хэллоуина, тыквы уже горят." : pickOne(["Счастливого Хэллоуина! Проходите, тыквы уже горят.", "Добрый вечер. В такую ночь у нас особенно уютно — проходите.", "Сладость или гадость? Шучу. Проходите, вас ждут."]);
    void base;
  }
  let shown = false;
  const showToast = () => { if (shown || !started || STREET.on) return; shown = true; toast("Сегодня Хэллоуин", "Бар украшен только на одну ночь. Нажмите на тыкву у стойки."); };
  setInterval(showToast, 2000);
}
Object.assign(H3D, { hw: HW, halloween: HALLOWEEN });
