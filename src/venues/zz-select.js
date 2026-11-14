/* ================= выбор заведения по адресу (?bar=<id>) и его оформление =================
   Собирается последним из src/venues: к этому моменту все бары уже в VENUES. */
  for (const p of VENUE_PATCHES) {
    if (!VENUE_ID_RE.test(p.id) || !VENUES[p.base]) { console.warn("venue: пропущен", p.id); continue; }
    VENUES[p.id] = Object.assign({}, VENUES[p.base], p.make(VENUES[p.base]), { id: p.id, scene: VENUES[p.base].scene || p.base });
  }
  const VENUE_ID = (() => { try { const b = new URLSearchParams(location.search).get("bar"); return b && VENUE_ID_RE.test(b) && VENUES[b] ? b : "hacheden"; } catch (e) { return "hacheden"; } })();
  const VENUE = VENUES[VENUE_ID];
  /* 3D-сцена: у флагмана встроена в страницу, у бара со своими залами — отдельный бандл (tools/build.py) */
  const VENUE_SCENE = SCENE_BUNDLES.includes(VENUE_ID) ? VENUE_ID : (VENUE.scene || VENUE_ID);   // свои залы важнее залов базового бара
  const SCENE_EXT = SCENE_BUNDLES.includes(VENUE_SCENE) ? `./venues/${VENUE_SCENE}.scene.js` : "";
  (() => {
    const r = document.documentElement.style;
    for (const [k, v] of Object.entries(VENUE.theme.vars)) r.setProperty(k, v);
    const f = VENUE.theme.fonts;
    if (f.display) r.setProperty("--font-display", `"${f.display}", "Palatino Linotype", Georgia, serif`);
    if (f.text) r.setProperty("--font-text", `"${f.text}", Georgia, "Times New Roman", serif`);
  })();
  /* ?demo=1 — показ на встрече: бронь и пропуск видны всем, заявки идут на тестовые контакты (DEMO_CONTACTS), в статистику не попадают */
  const DEMO_MODE = (() => { try { return new URLSearchParams(location.search).get("demo") === "1"; } catch (e) { return false; } })();
  if (DEMO_MODE) {
    const c = DEMO_CONTACTS.whatsapp || DEMO_CONTACTS.telegram ? DEMO_CONTACTS : VENUE.meta.contacts;
    VENUE.meta = Object.assign({}, VENUE.meta, { demo: true, contacts: Object.assign({}, c) });
  }
  /* возможности заведения (features в его файле); чего нет в файле — включено. Заглушка зала (src/stubs) выключает свой флаг сама:
     street — улица перед входом, nook — читальня, smoke — курилка, stage — сцена, cellar — погреб */
  const FEAT = Object.assign({ street: true, nook: true, smoke: true, cellar: true, stage: true, bartenderShow: true, booking: true, quests: true, liveBar: true }, VENUE.features || {});
  /* бронь и «код бармена» работают у заведения с настоящими контактами; у демо-профиля — для показа владельцам */
  const O2O = FEAT.booking && !!(VENUE.meta.contacts.whatsapp || VENUE.meta.contacts.telegram || VENUE.meta.demo);

  /* залы заведения → номера зон 3D-сцены (порядок кнопок: читальня, бар, курилка, сцена); у камерного бара может быть один «bar» */
  const ROOM_ZONE = { reading: 0, bar: 1, smoking: 2, stage: 3 };
  const venueRoom = z => VENUE.rooms.find((r, i) => (ROOM_ZONE[r.id] ?? i) === z);

  /* имя на вывесках: неон, сцена, табличка у двери, подставка, фото и сторис */
  const BAR_NAME = VENUE.meta.name;
  const BAR_SIGN = (VENUE.meta.sign || VENUE.meta.name).toUpperCase();
  /* надпись на холсте, ужатая по ширине: длинное название бара не вылезет за вывеску */
  function fitFont(g, text, maxW, px, family) {
    g.font = `${px}px ${family}`;
    const w = g.measureText(text).width;
    if (w > maxW) g.font = `${Math.floor(px * maxW / w)}px ${family}`;
  }
  if (VENUE_ID !== "hacheden") {
    document.title = BAR_NAME;
    const h1 = document.querySelector("#intro h1"); if (h1) h1.textContent = BAR_NAME;
    const it = document.getElementById("intro-text"); if (it && VENUE.meta.intro) it.textContent = VENUE.meta.intro;
    if (VENUE.meta.demo && h1) h1.insertAdjacentHTML("afterend", `<p class="demo-badge">Демо платформы · вымышленный бар · цены условные</p>`);
    const md = document.querySelector('meta[name="description"]'); if (md && VENUE.meta.slogan) md.content = `${BAR_NAME}: ${VENUE.meta.slogan}`;
  }
