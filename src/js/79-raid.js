/* ================= облава сухого закона: редкое событие =================
   В дверь колотит полиция, за секунды из задней стойки поднимаются фальш-панели «чайного клуба»,
   свет приглушают, музыка смолкает; полицейские уходят — всё возвращается. Проверить: ?rare=raid */
const RAID = { on: false, done: false, since: 0, chance: QS.get("rare") === "raid" ? 1 : .15, panels: [] };
RAID.today = Math.random() < RAID.chance;
{
  const bays = [[-3.135, -1.095], [-1.005, 1.005], [1.095, 3.135]];
  const wood = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#3a1c10"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${20 + Math.random() * 40},${8 + Math.random() * 14},4,.35)`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * .3, y + 6, w * .6, y - 6, w, y + 3); g.stroke(); }
    g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = "rgba(255,200,140,.12)"; g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
  });
  const sign = canvasTex(512, 300, (g, w, h) => {
    g.fillStyle = "#1a0e08"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#c9944a"; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#e8c890"; g.textAlign = "center";
    g.font = "40px Forum, Georgia, serif"; g.fillText("КЛУБ ЛЮБИТЕЛЕЙ ЧАЯ", w / 2, 92);
    g.font = "64px Forum, Georgia, serif"; g.fillText(`«${BAR_NAME}»`, w / 2, 170);
    g.font = "24px Literata, Georgia, serif"; g.globalAlpha = .8; g.fillText("основан в 1921 году · только для членов клуба", w / 2, 232);
  });
  const mat = std({ map: wood, roughness: .6 });
  bays.forEach(([x0, x1], i) => {
    const g = group((x0 + x1) / 2, 0, BB.z0 + .37);
    mesh(new THREE.BoxGeometry(x1 - x0, 1.72, .025), mat, 0, 0, 0, g);
    if (i === 1) mesh(new THREE.PlaneGeometry(1.25, .73), std({ map: sign, roughness: .4 }), 0, .2, .014, g);
    else for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(.045, .04, .07, 16), std({ color: 0xf2ece0, roughness: .25 }), -.55 + k * .55, -.38, .05, g);   // чайные чашки на выступе
    if (i !== 1) mesh(new THREE.BoxGeometry(x1 - x0 - .1, .02, .12), mat, 0, -.43, .05, g);
    g.userData.y0 = 1.0 - .86 - .03; g.userData.y1 = BB.top + .86;
    g.position.y = g.userData.y0;
    g.visible = false;
    RAID.panels.push(g);
  });
}
function whistle() {
  const c = fx(); if (!c) return;
  const t = c.currentTime + .05, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o.type = "triangle"; o.frequency.value = 2650; lfo.frequency.value = 28; lg.gain.value = 220;
  lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .05); g.gain.setValueAtTime(.08, t + .45); g.gain.linearRampToValueAtTime(0, t + .5);
  g.gain.setValueAtTime(0, t + .6); g.gain.linearRampToValueAtTime(.08, t + .65); g.gain.setValueAtTime(.08, t + 1.3); g.gain.linearRampToValueAtTime(0, t + 1.4);
  o.connect(g).connect(c.destination); o.start(t); lfo.start(t); o.stop(t + 1.5); lfo.stop(t + 1.5);
}
function steps(n = 6, away = true) {
  const c = fx(); if (!c) return;
  const t0 = c.currentTime + .05;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * .42, o = c.createOscillator(), g = c.createGain(), v = away ? .35 * (1 - i / n) : .3;
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + .08);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .12);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + .14);
  }
}
async function playRaid() {
  if (RAID.on) return;
  RAID.on = true;
  const musicWas = Music.on;
  hintEl.textContent = "Кто-то громко колотит во входную дверь…";
  knock(); await wait(1.1); knock();
  bt.look = V3(0, 1.6, 4);
  await wait(.9);
  say(bt, "Облава! Тихо, все. Сегодня мы — клуб любителей чая.", 4);
  if (musicWas) setMusic(false);
  // свет приглушают, подсветка гаснет, панели поднимаются из задней стойки
  const lights = ["pendL", "pendC", "pendR"].map(k => LIGHTS[k]);
  const was = lights.map(l => l.intensity);
  lights.forEach(l => tween(l, { intensity: l.intensity * .45 }, 1.2));
  tween(SHUT, { back: .1, neon: .15, pendL: .45, pendC: .45, pendR: .45 }, 1.2);
  RAID.panels.forEach((g, i) => { g.visible = true; tween(g.position, { y: g.userData.y1 }, STILL ? 0 : 1.6 + i * .25, ease.io); });
  await wait(2.4);
  whistle();
  hintEl.textContent = "— Полиция! Проверка заведения!";
  steps(5, false);
  await wait(3.2);
  say(bt, "Добрый вечер, офицер. Здесь только чай. Хотите чашечку?", 4);
  await wait(4.4);
  hintEl.textContent = "Шаги удаляются…";
  steps(7, true);
  await wait(3.4);
  say(bt, "Ушли. В двадцатые так и было: бутылки прятали за фальш-стенами, и бар за минуту становился чем угодно — хоть чайной.", 6);
  RAID.panels.forEach((g, i) => tween(g.position, { y: g.userData.y0 }, STILL ? 0 : 1.4 + i * .2, ease.io).then(() => { g.visible = false; }));
  lights.forEach((l, i) => tween(l, { intensity: was[i] }, 1.4));
  tween(SHUT, { back: 1, neon: 1, pendL: 1, pendC: 1, pendR: 1 }, 1.4);
  await wait(1.6);
  applyTime();
  if (musicWas) setMusic(true);
  hintEl.textContent = ZONES[curZone].hint;
  bt.look = null;
  track("secret", "raid");
  RAID.on = false; RAID.done = true;
}
setInterval(() => {
  if (!RAID.today || RAID.done || RAID.on || !started || curZone !== 1 || busy || SEAT.on || modalOpen() || mixDlg.open || STREET.on || CLOSING.on || BT.busy) { RAID.since = 0; return; }
  RAID.since += 5;
  if (RAID.since >= (QS.get("rare") === "raid" ? 5 : 240)) playRaid();
}, 5000);
Object.assign(H3D, { raid: playRaid });
