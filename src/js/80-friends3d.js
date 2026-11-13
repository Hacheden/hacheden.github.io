/* ================= живой бар: другие посетители сайта в залах ================= */
const LIVE_LOOKS = [
  { kind: "suit", body: "#3a2a4a", tie: "#c9944a", skin: 0xd0a07e, hair: 0x2a1a10 },
  { kind: "dress", body: "#6a1424", skin: 0xe0b090, hair: 0x5a2e14, hairStyle: "bob", lady: true },
  { kind: "suit", body: "#1f3a2c", tie: "#8a1428", skin: 0xa8704e, hair: 0x0c0806, mustache: true },
  { kind: "dress", body: "#1c2a4a", skin: 0xc89070, hair: 0x140c08, hairStyle: "bob", lady: true },
  { kind: "suit", body: "#4a3020", tie: "#1f3a5a", skin: 0xe2b896, hair: 0x6a4a2a, hat: 0x1c1a18 },
  { kind: "cardigan", body: "#5a4a30", shirt: "#e2d8c4", skin: 0x8a5a40, hair: 0x101010 }
];
const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
/* места: табуреты у стойки (ваш — 1.25 — свободен), стоячие места в каждом зале */
const LIVE_SLOTS = [
  ...[-1.25, -2.5, 2.5, 0].map(x => ({ zone: 1, x, z: -1.5, face: Math.PI, seated: true })),
  ...[[-1.9, -.65], [1.9, -.65], [-.65, -.45], [.65, -.45]].map(([x, z]) => ({ zone: 1, x, z, face: Math.PI })),
  ...[[-3.9, -1.7], [-5.2, -.2], [-3.5, -.3]].map(([x, z]) => ({ zone: 0, x, z, face: faceTo(x, z, -4.6, -2.6) + .5 })),
  ...[[4.7, -1.1], [5.5, .3], [4.4, -2.7]].map(([x, z]) => ({ zone: 2, x, z, face: faceTo(x, z, 7.2, -1.6) - .3 })),
  ...[[-3.7, 2.7], [-4.7, 3.0], [-5.7, 2.7], [-3.2, 2.0]].map(([x, z]) => ({ zone: 3, x, z, face: faceTo(x, z, -4.8, 5.2) }))
];
const LIVE = { peers: {}, figs: new Map(), on: false, greeted: new Set() };
LIVE_SLOTS.forEach((s, i) => {
  s.i = i; s.uid = null; s.F = null; s.glass = null; s.drinkId = null;
  s.tag = document.createElement("div"); s.tag.className = "nametag"; s.tag.hidden = true; app.appendChild(s.tag);
  s.bub = document.createElement("div"); s.bub.className = "fbubble"; app.appendChild(s.bub);
  s.bubUntil = 0;
  s.spot = null;
});
function liveFigure(s, look) {
  const key = s.i + ":" + look;
  let F = LIVE.figs.get(key);
  if (F) return F;
  F = makeFigure(Object.assign(s.seated ? { seated: true, hipY: .93 } : {}, LIVE_LOOKS[look % LIVE_LOOKS.length]));
  placeFig(F, s.x, s.z, s.face);
  if (s.seated) {
    F.legsFixed = true;
    F.legs.forEach(lg => { lg.tgt.set(lg.side * .1, .33, .14); lg.cur.copy(lg.tgt); });
    F.leanT = .12;
    reach(F.L, .15, 1.15, .6, V3(-.3, -.15, 1), DIR.down, .35);
    reach(F.R, -.13, 1.15, .58, V3(.3, -.15, 1), DIR.down, .35);
  }
  F.root.visible = false;
  hot(F.root, s.zone, "Посетитель", () => { if (s.uid) FRIENDS.open(); }, { grow: 0, noChip: true });
  LIVE.figs.set(key, F);
  return F;
}
function liveGlass(s, d) {
  const id = d && s.seated ? d.id + d.pour : null;
  if (id === s.drinkId) return;
  s.drinkId = id;
  if (s.glass) { drop(s.glass); s.glass = null; }
  if (!id) return;
  s.spot = s.spot || fromFig(s.F, V3(-.1, CT.top, .62));
  s.glass = makeGlass(d.cup || "rocks", d.pour || "#c27a1a", { garnish: d.garnish || null, ice: !!d.ice, op: .85 });
  s.glass.position.copy(s.spot); s.glass.scale.setScalar(1.25);
  world.add(s.glass);
}
function liveSync(peers) {
  LIVE.peers = peers;
  const byZone = {};
  for (const [uid, u] of Object.entries(peers)) (byZone[u.zone ?? 1] = byZone[u.zone ?? 1] || []).push([uid, u]);
  const used = new Set();
  for (const z of Object.keys(byZone)) {
    const list = byZone[z].sort((a, b) => a[0] < b[0] ? -1 : 1);
    const slots = LIVE_SLOTS.filter(s => s.zone === +z);
    // кто уже сидит — остаётся на своём месте
    for (const [uid] of list) { const s = slots.find(x => x.uid === uid); if (s) used.add(s); }
    for (const [uid] of list) {
      if (slots.some(x => x.uid === uid)) continue;
      const free = slots.find(x => !used.has(x) && !Object.prototype.hasOwnProperty.call(peers, x.uid || "-"));
      if (!free) break;
      free.uid = uid; used.add(free);
    }
  }
  for (const s of LIVE_SLOTS) {
    const u = s.uid && peers[s.uid];
    if (!u || u.zone !== s.zone || !used.has(s)) {
      if (s.F) s.F.root.visible = false;
      if (s.glass) s.glass.visible = false;
      s.uid = null; s.tag.hidden = true; s.bub.classList.remove("show");
      continue;
    }
    const F = liveFigure(s, u.look || 0);
    if (s.F && s.F !== F) s.F.root.visible = false;
    s.F = F; F.root.visible = true;
    s.name = u.name;
    s.tag.textContent = u.name;
    liveGlass(s, u.drink);
    if (s.glass) s.glass.visible = true;
    if (!LIVE.greeted.has(s.uid) && s.zone === 1 && curZone === 1 && started && !busy && !SEAT.on) { LIVE.greeted.add(s.uid); say(bt, `${u.name}, добрый вечер! Проходите.`, 4); }
  }
  // настоящие посетители за стойкой — нарисованные гости уступают им табуреты
  const atBar = LIVE_SLOTS.some(s => s.zone === 1 && s.seated && s.uid);
  if (atBar !== LIVE.atBar) { LIVE.atBar = atBar; for (const G of GUESTS) { G.F.root.visible = !atBar; if (G.glass) G.glass.visible = !atBar; G.busy = atBar; } }
  LIVE.on = Object.keys(peers).length > 0;
}
function liveSlotOf(uid) { return LIVE_SLOTS.find(s => s.uid === uid); }
function liveEvent(uid, p, text) {
  const s = liveSlotOf(uid); if (!s) return;
  s.bub.textContent = text;
  s.bubUntil = NOW + 4500;
  if (s.zone === curZone && (p === "cheers")) clink();
  if (s.zone === curZone && (p === "laugh" || p === "hi") && s.F && !STILL) { s.F.nod = -.1; setTimeout(() => { if (s.F) s.F.nod = 0; }, 600); }
}
function liveCheers() {
  clink();
  for (const s of LIVE_SLOTS) if (s.uid && s.zone === curZone && s.glass && s.F) { s.bub.textContent = "🥂"; s.bubUntil = NOW + 2500; }
}
const _lt = V3();
onTick(() => {
  if (!LIVE.on) return;
  for (const s of LIVE_SLOTS) {
    const vis = s.uid && s.zone === curZone && !STREET.on && !SHOW.on && !CLOSING.on;
    if (!vis) { s.tag.hidden = true; s.bub.classList.remove("show"); continue; }
    s.F.head.getWorldPosition(_lt); _lt.y += .22;
    const p = _lt.project(camera);
    const ok = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
    s.tag.hidden = !ok;
    if (!ok) { s.bub.classList.remove("show"); continue; }
    const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight;
    s.tag.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    const talk = NOW < s.bubUntil;
    s.bub.classList.toggle("show", talk);
    if (talk) { const half = s.bub.offsetWidth / 2 + 8; s.bub.style.transform = `translate(${clamp(x, half, innerWidth - half)}px, ${Math.max(s.bub.offsetHeight + 8, y - 28)}px) translate(-50%, -100%)`; }
  }
});
H3D.friends = { sync: liveSync, event: liveEvent, cheers: liveCheers, slots: LIVE_SLOTS };
/* как только гость вошёл в бар — он в живом зале (если не выбрал невидимку) */
{
  const t = setInterval(() => {
    if (!started || STREET.on) return;
    clearInterval(t);
    FRIENDS.live();
  }, 1500);
}
