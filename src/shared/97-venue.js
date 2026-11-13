/* ================= платформа заведений: всё, что берётся из src/venues/<бар>.js =================
   Бронь места и барный пропуск (только у бара с настоящими контактами; хозяину — предпросмотр),
   карточка для сторис, «угостить друга» ссылкой, колода у камина, квест через три зала,
   спешл недели, домашний бар. Сервер не нужен: всё в адресе страницы и в этом браузере. */
  const VX = {
    preview: (() => { try { return localStorage.getItem("hacheden-o2o-preview") === "1"; } catch (e) { return false; } })(),
    quest: +keepGet("hacheden-quest", 0) || 0,    // 0 — ничего, 1 — прочитана пометка, 2 — угли показали рецепт, 3 — легенда найдена
    home: new Set(keepGet("hacheden-home", [])),
    bag: {}, mode: VENUE.deck ? VENUE.deck.modes[0].id : "",
    passFor: null, passCode: "", passOpen: false,
    treat: null, sheets: {}
  };
  const VX_SEATS = VENUE.rooms.flatMap((r, zone) => (r.seats || []).map(s => Object.assign({ zone, room: r.name }, s)));
  const vxO2O = () => O2O || (!!H3D.owner && VX.preview);   // бронь и пропуск видны
  const vxReal = !!(VENUE.meta.contacts.whatsapp || VENUE.meta.contacts.telegram);
  const vxDemo = () => !vxReal;                                // контактов нет: только предпросмотр, ничего не отправляется
  /* пометка над бронью и пропуском: у Hacheden — предпросмотр хозяина, у демо-профиля — пояснение для владельцев баров */
  function vxTag(kind) {
    const n = escH(VENUE.meta.name);
    if (VENUE.meta.demo) return vxReal
      ? (kind === "pass" ? "Демо: так выглядит пропуск в настоящем баре, этот код нигде не действует" : "Демо для владельцев заведений: заявка уйдёт на тестовый номер, а не в настоящий бар")
      : "Демо для владельцев заведений: впишите тестовые WhatsApp или Telegram в src/venues/demo-almaty.js, и кнопки заработают";
    if (!vxReal) return kind === "pass" ? `Предпросмотр: у ${n} нет настоящего зала, код не действует` : `Предпросмотр для хозяина: у ${n} нет настоящего зала, заявка никуда не уйдёт`;
    return "";
  }
  function vxSheet(id, title, extra) {
    if (!VX.sheets[id]) VX.sheets[id] = makeSheet(id, title, extra);
    const d = VX.sheets[id];
    d.querySelector(`#${id}-title`).textContent = title;
    return d;
  }
  const vxName = () => { try { const n = localStorage.getItem("hacheden-name"); return n && n !== "Гость" ? n : ""; } catch (e) { return ""; } };

  /* ---------- тактильные звуки: лёд, карта, угли (синтез, без файлов) ---------- */
  function vxSound(kind) {
    if (AUDIO.level("ui") <= .001) return;
    const c = uiAudio(); if (!c) return;
    const t0 = c.currentTime + .01;
    const ping = (f, at, dur, v) => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(f, t0 + at);
      g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(v, t0 + at + .002); g.gain.exponentialRampToValueAtTime(.0001, t0 + at + dur);
      o.connect(g).connect(c.destination); o.start(t0 + at); o.stop(t0 + at + dur + .02);
    };
    const noise = (at, dur, v, type, freq, q = .8) => {
      const len = Math.max(1, Math.floor(c.sampleRate * dur)), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let j = 0; j < len; j++) { const k = j / len; d[j] = (Math.random() * 2 - 1) * Math.pow(1 - k, 3); }
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = b; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = v;
      s.connect(f).connect(g).connect(c.destination); s.start(t0 + at);
    };
    if (kind === "ice") {
      // два-три кубика стукаются о стекло: высокие негармоничные призвуки и щелчок
      const n = 2 + (Math.random() < .5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const at = i * (.045 + Math.random() * .05), base = 2600 + Math.random() * 900;
        ping(base, at, .18, .02); ping(base * 2.76, at, .09, .009); ping(base * 5.4, at, .05, .005);
        noise(at, .02, .05, "highpass", 5000);
      }
    } else if (kind === "card") {
      noise(0, .06, .12, "bandpass", 2400, 1.2);
      noise(.05, .1, .07, "bandpass", 1600, .9);
    } else if (kind === "ember") {
      for (let i = 0; i < 7; i++) noise(i * .07 + Math.random() * .05, .03, .1, "bandpass", 1800 + Math.random() * 2400, 2);
      ping(220, 0, 1.2, .012);
    }
  }

  /* ---------- спешл недели: по номеру недели, меняется в понедельник ---------- */
  function vxSpecial(d = new Date()) {
    const pool = (VENUE.special || []).map(id => COCKTAIL_BY_ID[id]).filter(Boolean);
    if (!pool.length) return null;
    const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);   // 1 января 1970 — четверг
    const week = Math.floor((day + 3) / 7);                                                 // +3: неделя начинается с понедельника
    return pool[week % pool.length];
  }
  const vxWeekEnd = () => { const d = new Date(), k = (8 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + k); return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }); };

  /* ---------- квест через три зала ---------- */
  function vxQuestSet(n) { if (n <= VX.quest) return; VX.quest = n; keepSet("hacheden-quest", n); }
  function vxQuestNote() { if (VX.quest < 1) { vxQuestSet(1); toast("Пометка на полях", "Кто-то оставил подсказку. Похоже, речь о камине в курилке.", "secret"); } }
  function vxQuestEmber() {   // зовёт 3D-сцена, когда гость подбрасывает дров
    if (!FEAT.quests || VX.quest !== 1) return false;
    vxQuestSet(2);
    vxSound("ember");
    setTimeout(() => toast("Угли", VENUE.quest.ember, "secret"), 700);
    return true;
  }
  const vxQuestReady = () => VX.quest >= 2;
  function vxQuestDone() {
    const L = VENUE.legend;
    if (!L) return;
    const fresh = VX.quest < 3;
    vxQuestSet(3);
    addDrink(L);
    if (fresh) { track("count", "recipe"); setTimeout(() => { uiSound("chime"); toast("Легендарный рецепт", L.name, "secret"); }, 300); }
  }
  if (FEAT.quests && VENUE.legend && VX.quest >= 3) addDrink(VENUE.legend);
  function vxQuestBar() {      // гость пришёл к стойке после камина: бармен шёпотом называет состав
    if (!FEAT.quests || VX.quest !== 2 || VX.questTold) return "";
    VX.questTold = true;
    return VENUE.quest.bar;
  }

  /* ---------- барная карта: плашка спешла, цены, режим «Мой домашний бар» ---------- */
  (() => {
    const tabs = mixDlg.querySelector(".tabs");
    tabs.insertAdjacentHTML("beforeend", `<button class="tab" type="button" role="tab" id="tab-home" aria-controls="panel-home" aria-selected="false" data-tab="home">Мой бар дома</button>`);
    document.getElementById("panel-menu").insertAdjacentHTML("afterend", `<section id="panel-home" role="tabpanel" aria-labelledby="tab-home" hidden></section>`);
  })();
  setTab = function (name) {
    mixDlg.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    for (const k of ["mix", "menu", "home"]) document.getElementById("panel-" + k).hidden = name !== k;
    if (name === "home") renderHome();
  };
  function renderHome() {
    const p = document.getElementById("panel-home"), have = VX.home;
    const list = COCKTAILS.filter(c => !c.custom);
    const can = [], one = [];
    for (const c of list) {
      const miss = c.need.filter(i => !have.has(i));
      if (!miss.length) can.push(c); else if (miss.length === 1) one.push([c, miss[0]]);
    }
    p.innerHTML = `<p class="mix-note">Отметь, что есть у тебя дома, — бармен подскажет, что можно смешать прямо сейчас. Список хранится только в этом браузере.</p>
      ${have.size ? `<h3>Можно смешать сейчас${can.length ? ` · ${can.length}` : ""}</h3>${can.length
        ? `<ul class="drinks">${can.map(c => drinkRow(c, "", `<button class="make ghost" type="button" data-info="${c.id}">Рецепт</button>`)).join("")}</ul>`
        : `<p class="empty">Пока ни одного полного рецепта — посмотри, чего не хватает.</p>`}
      ${one.length ? `<h3>Не хватает одного ингредиента</h3><ul class="drinks">${one.map(([c, m]) => drinkRow(c, `<span class="miss">Не хватает: ${low(m)}</span>`,
          `<button class="make ghost" type="button" data-home="${m}" aria-label="Отметить: ${low(m)} есть дома">+ ${low(m)}</button>`)).join("")}</ul>` : ""}` : ""}
      <h3>Что есть дома</h3>
      ${ING.map(([title, items]) => `<h4 class="home-h">${title}</h4><div class="chips">${items.map(([id, name]) =>
        `<button class="chip" type="button" data-home="${id}" aria-pressed="${have.has(id)}">${name}</button>`).join("")}</div>`).join("")}
      ${have.size ? `<button class="clear" type="button" data-home-clear>Снять все отметки</button>` : ""}`;
  }
  mixDlg.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.home) {
      const id = b.dataset.home;
      VX.home.has(id) ? VX.home.delete(id) : (VX.home.add(id), vxSound("ice"));
      keepSet("hacheden-home", [...VX.home]);
      renderHome();
      const f = mixDlg.querySelector(`#panel-home [data-home="${id}"][aria-pressed]`); if (f) f.focus();
    } else if ("homeClear" in b.dataset) { VX.home.clear(); keepSet("hacheden-home", []); renderHome(); }
    else if (b.dataset.specialInfo) openCard(COCKTAIL_BY_ID[b.dataset.specialInfo], { info: true });
  });
  // звон льда, когда кладёшь ингредиент в шейкер
  const vxToggleIng = toggleIng;
  toggleIng = function (id) { const was = inShaker.has(id); vxToggleIng(id); if (!was && inShaker.has(id)) vxSound("ice"); };
  // меню: плашка «Спешл недели» сверху и цены, если они есть у заведения
  const vxRenderMenu = renderMenu;
  renderMenu = function () {
    vxRenderMenu();
    const list = document.getElementById("menu-list"), sp = vxSpecial();
    if (sp && MENU.cat === "all" && !MENU.q.trim()) {
      list.insertAdjacentHTML("afterbegin", `<div class="vx-special"><span class="vx-tag">Спешл недели · до ${vxWeekEnd()}</span>
        <div class="vx-sp-row">${glassSVG(sp, { pre: "spw-", still: true })}<div><b>${escH(sp.name)}</b><p>${sp.tagline}</p></div>
        <button class="make ghost" type="button" data-special-info="${sp.id}">Подробнее</button></div></div>`);
    }
    if (vxO2O()) list.querySelectorAll("[data-info]").forEach(b => {
      const c = COCKTAIL_BY_ID[b.dataset.info];
      if (c && c.price && !b.closest("li").querySelector(".vx-price")) b.closest("li").querySelector(".meta").insertAdjacentHTML("afterend", `<span class="vx-price">${c.price} ${VENUE.meta.currency}</span>`);
    });
  };

  /* ---------- карточка напитка: пропуск, сторис, «угостить» ---------- */
  const vxCardExtras = cardExtras;
  cardExtras = function (d, opt) {
    const base = vxCardExtras(d, opt);
    if (opt && opt.served) {
      VX.passOpen = true;
      if (VX.passFor !== d.id) { VX.passFor = d.id; VX.passCode = `${VENUE.meta.codePrefix}-${100 + Math.floor(Math.random() * 900)}`; }
      setTimeout(() => vxSound("ice"), 250);
    }
    let h = "";
    if (d.legend) h += `<p class="vx-legend">Легендарный рецепт · квест через три зала пройден</p>`;
    const crafted = d.signature || d.secret || d.custom;
    if (VX.passOpen && VX.passFor === d.id && crafted && vxO2O()) {
      h += `<div class="vx-pass" role="group" aria-label="Барный пропуск">
        ${vxTag("pass") ? `<span class="vx-demo-tag">${vxTag("pass")}</span>` : ""}
        <span class="vx-pass-h">Барный пропуск</span><b>${VX.passCode}</b><small>Покажите этот код бармену у стойки</small></div>`;
    }
    const sendable = !d.custom || d.ings || d.need;
    h += `<div class="card-acts vx-acts"><button class="make ghost" type="button" data-vx-story="${d.id}">Карточка для сторис</button>${sendable ? `<button class="make ghost" type="button" data-vx-treat="${d.id}">Угостить друга</button>` : ""}</div>`;
    return base.replace(`<p class="saved-note"`, h + `<p class="saved-note"`);
  };
  dlg.addEventListener("close", () => { VX.passOpen = false; });
  dlg.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    const id = b.dataset.vxStory || b.dataset.vxTreat;
    if (!id) return;
    const c = COCKTAIL_BY_ID[id] || (VENUE.legend && VENUE.legend.id === id ? VENUE.legend : null);
    if (!c) return;
    if (b.dataset.vxStory) vxStory(c);
    else vxTreatForm(c);
  });

  /* ---------- карточка для сторис: холст 1080×1920 ---------- */
  function vxWrap(g, text, maxW) {
    const words = String(text).split(/\s+/), lines = [];
    let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    return lines;
  }
  const vxPlain = s => String(s).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  async function vxStoryCanvas(c, code) {
    const W = 1080, H = 1920, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const F = VENUE.theme.fonts, css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const brass = css("--brass") || "#d6aa5c", cream = css("--cream") || "#f1e4cc", muted = css("--muted") || "#c2a784";
    try { await Promise.all([document.fonts.load(`100px "${F.display}"`), document.fonts.load(`36px "${F.text}"`), document.fonts.load(`italic 36px "${F.text}"`)]); } catch (e) {}
    // фон: тёплый полумрак и зерно плёнки
    const bg = g.createRadialGradient(W / 2, H * .36, 40, W / 2, H * .45, H * .78);
    bg.addColorStop(0, "#43141c"); bg.addColorStop(.42, "#1d070b"); bg.addColorStop(1, "#070304");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), px = img.data;
    for (let i = 0; i < px.length; i += 4) { const n = (Math.random() - .5) * 20; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
    g.putImageData(img, 0, 0);
    // двойная латунная рамка с ромбами по углам
    g.strokeStyle = brass; g.lineWidth = 4; g.strokeRect(48, 48, W - 96, H - 96);
    g.globalAlpha = .55; g.lineWidth = 1.5; g.strokeRect(66, 66, W - 132, H - 132); g.globalAlpha = 1;
    g.fillStyle = brass;
    for (const [x, y] of [[48, 48], [W - 48, 48], [48, H - 48], [W - 48, H - 48]]) { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-9, -9, 18, 18); g.restore(); }
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    // шапка
    g.fillStyle = brass; g.font = `92px "${F.display}"`;
    if ("letterSpacing" in g) g.letterSpacing = "14px";
    g.fillText(VENUE.meta.name.toUpperCase(), W / 2, 210);
    if ("letterSpacing" in g) g.letterSpacing = "0px";
    g.fillStyle = muted; g.font = `italic 34px "${F.text}"`;
    g.fillText(VENUE.meta.slogan, W / 2, 270);
    // свечение за бокалом и сам бокал
    const glow = g.createRadialGradient(W / 2, 720, 20, W / 2, 720, 420);
    glow.addColorStop(0, "rgba(255,176,96,.38)"); glow.addColorStop(1, "rgba(255,150,80,0)");
    g.fillStyle = glow; g.fillRect(0, 280, W, 900);
    const svg = glassSVG(c, { pre: "sty-", still: true }).replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="680" `);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      const im = new Image();
      await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = url; });
      g.save(); g.shadowColor = "rgba(255,170,90,.55)"; g.shadowBlur = 70; g.drawImage(im, (W - 480) / 2, 360, 480, 680); g.restore();
    } catch (e) {} finally { URL.revokeObjectURL(url); }
    // название, слоган напитка, состав
    let y = 1150, size = 104;
    g.fillStyle = cream; g.font = `${size}px "${F.display}"`;
    while (g.measureText(c.name).width > W - 220 && size > 56) { size -= 6; g.font = `${size}px "${F.display}"`; }
    g.fillText(c.name, W / 2, y);
    g.fillStyle = muted; g.font = `italic 36px "${F.text}"`;
    for (const l of vxWrap(g, vxPlain(c.tagline || ""), W - 260).slice(0, 2)) { y += 54; g.fillText(l, W / 2, y); }
    y += 46;
    g.strokeStyle = brass; g.globalAlpha = .6; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W / 2 - 120, y); g.lineTo(W / 2 + 120, y); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = cream; g.font = `34px "${F.text}"`;
    for (const [a, b] of (c.recipe || []).slice(0, 6)) { y += 52; g.fillText(`${vxPlain(a)} ${vxPlain(b)}`.slice(0, 48), W / 2, y); }
    // код для бармена
    if (code) {
      const by = Math.max(y + 60, 1560);
      g.strokeStyle = brass; g.lineWidth = 3; g.strokeRect(W / 2 - 300, by, 600, 170);
      g.fillStyle = muted; g.font = `28px "${F.text}"`; g.fillText("Покажите этот код бармену у стойки", W / 2, by + 50);
      g.fillStyle = brass; g.font = `80px "${F.display}"`; g.fillText(code, W / 2, by + 140);
    }
    // подвал
    g.fillStyle = brass; g.font = `38px "${F.display}"`;
    if ("letterSpacing" in g) g.letterSpacing = "4px";
    g.fillText(VENUE.meta.site, W / 2, H - 140);
    if ("letterSpacing" in g) g.letterSpacing = "0px";
    g.fillStyle = muted; g.font = `24px "${F.text}"`; g.fillText("18+ · виртуальный бар в браузере", W / 2, H - 96);
    return cv;
  }
  async function vxStory(c) {
    const d = vxSheet("vx-story", "Карточка для сторис", "wide");
    d.body.innerHTML = `<p class="note">Рисую карточку…</p>`;
    if (dlg.open) dlg.close();
    openSheet(d);
    const code = VX.passFor === c.id && vxO2O() && (c.signature || c.secret || c.custom) ? VX.passCode : "";
    const cv = await vxStoryCanvas(c, code);
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    if (!blob) { d.body.innerHTML = `<p class="note">Не получилось нарисовать карточку в этом браузере.</p>`; return; }
    const file = new File([blob], `${VENUE.id}-${c.id}.png`, { type: "image/png" }), url = URL.createObjectURL(blob);
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    d.body.innerHTML = `<img class="vx-story-img" src="${url}" alt="Карточка «${escH(c.name)}» для сторис">
      <div class="acts">${canShare ? `<button class="make" type="button" data-vx-share>Поделиться</button>` : ""}
        <a class="make${canShare ? " ghost" : ""}" href="${url}" download="${file.name}">Скачать картинку</a></div>
      <p class="note">${canShare ? "«Поделиться» откроет Instagram, Telegram и другие приложения." : "Картинка 1080×1920 — ровно в размер сторис."}</p>`;
    vxStat("story");
    const sb = d.querySelector("[data-vx-share]");
    if (sb) sb.addEventListener("click", () => { vxStat("story_save"); navigator.share({ files: [file], title: c.name }).catch(() => {}); });
    const dl = d.querySelector("a[download]");
    if (dl) dl.addEventListener("click", () => vxStat("story_save"));
    d.addEventListener("close", () => setTimeout(() => URL.revokeObjectURL(url), 1000), { once: true });
  }

  /* ---------- «угостить друга»: коктейль уезжает в ссылке, сервер не нужен ---------- */
  const vxB64 = {
    enc: s => { const b = new TextEncoder().encode(s); let t = ""; b.forEach(x => { t += String.fromCharCode(x); }); return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
    dec: s => { const t = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return new TextDecoder().decode(Uint8Array.from(t, ch => ch.charCodeAt(0))); }
  };
  const vxClean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  function vxTreatLink(c, from, note) {
    const known = !c.custom && !c.legend && (COCKTAIL_BY_ID[c.id] || SECRETS.includes(c));
    const o = { b: VENUE.id, n: c.name, i: c.ings || c.need, g: c.cup, m: note, f: from };
    if (known) o.c = c.id;
    const q = VENUE.id === "hacheden" ? "" : `?bar=${encodeURIComponent(VENUE.id)}`;
    return `${location.origin}${location.pathname}${q}#treat=${vxB64.enc(JSON.stringify(o))}`;
  }
  function vxTreatForm(c) {
    const d = vxSheet("vx-treat", "Угостить друга");
    if (dlg.open) dlg.close();
    d.body.innerHTML = `<div class="vx-treat-glass">${glassSVG(c, { pre: "tf-", still: true })}</div>
      <p class="note">Друг откроет ссылку и найдёт «${escH(c.name)}» на стойке — с вашей запиской.</p>
      <form class="vx-form" id="vx-treat-form">
        <label>От кого<input name="from" maxlength="32" autocomplete="nickname" value="${escH(vxName())}" placeholder="Ваше имя"></label>
        <label>Записка<textarea name="note" maxlength="140" rows="3" placeholder="Например: за пятницу, которую мы заслужили"></textarea></label>
        <button class="make" type="submit">Сделать ссылку</button>
      </form>
      <div class="vx-link" hidden></div>`;
    openSheet(d);
    d.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();
      const f = new FormData(e.target), from = vxClean(f.get("from"), 32), note = vxClean(f.get("note"), 140);
      const link = vxTreatLink(c, from, note), box = d.querySelector(".vx-link");
      box.hidden = false;
      box.innerHTML = `<input class="vx-url" readonly value="${escH(link)}" aria-label="Ссылка для друга">
        <div class="acts"><button class="make" type="button" data-vx-copy>Скопировать ссылку</button>${navigator.share ? `<button class="make ghost" type="button" data-vx-send>Отправить</button>` : ""}</div>
        <p class="saved-note" role="status"></p>`;
      box.querySelector("[data-vx-copy]").addEventListener("click", async () => {
        const inp = box.querySelector(".vx-url"), st = box.querySelector(".saved-note");
        try { await navigator.clipboard.writeText(link); st.textContent = "Ссылка скопирована."; } catch (er) { inp.select(); st.textContent = "Выделил ссылку — скопируйте её."; }
      });
      const sb = box.querySelector("[data-vx-send]");
      if (sb) sb.addEventListener("click", () => navigator.share({ title: `${VENUE.meta.name}: вас угостили`, text: `Оставил тебе «${c.name}» в ${VENUE.meta.name}`, url: link }).catch(() => {}));
    });
  }
  // разбираем ссылку: #treat=…
  (() => {
    const m = location.hash.match(/(?:^#|&)treat=([A-Za-z0-9_-]{8,3000})/);
    if (!m) return;
    try {
      const o = JSON.parse(vxB64.dec(m[1]));
      if (!o || typeof o !== "object") return;
      const ings = Array.isArray(o.i) ? [...new Set(o.i.filter(i => typeof i === "string" && ROLE[i]))].slice(0, 8) : [];
      VX.treat = { b: vxClean(o.b, 24), c: vxClean(o.c, 40), n: vxClean(o.n, 32), i: ings, g: GLASS_NAME[o.g] ? o.g : "auto", m: vxClean(o.m, 140), f: vxClean(o.f, 32) };
      if (!VX.treat.c && !ings.length) VX.treat = null;
    } catch (e) { VX.treat = null; }
  })();
  function vxTreatDrink(t) {
    let c = t.c && (COCKTAIL_BY_ID[t.c] || SECRETS.find(s => s.id === t.c));
    if (!c) {
      c = invent({ ings: t.i, cup: t.g, ice: "auto", method: "auto" });
      if (t.n) { c.name = t.n; c.glassLabel = escH(`${c.name}: ${GLASS_NAME[c.cup]}`); }
      COCKTAIL_BY_ID[c.id] = c;
    }
    return c;
  }
  function vxTreatArrive() {     // зовёт 3D-сцена, когда гость уже в баре
    const t = VX.treat;
    if (!t) return null;
    VX.treat = null;
    vxStat("treat");
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    const c = vxTreatDrink(t);
    const d = vxSheet("vx-gift", "Для вас оставили коктейль");
    d.body.innerHTML = `<div class="vx-treat-glass">${glassSVG(c, { pre: "tg-", still: true })}</div>
      <h3 class="vx-seat">${escH(c.name)}</h3>
      ${t.f ? `<p class="vx-from">От: ${escH(t.f)}</p>` : ""}
      ${t.m ? `<blockquote class="vx-note">«${escH(t.m)}»</blockquote>` : ""}
      <p class="note">${escH(c.tagline ? vxPlain(c.tagline) : "")}</p>
      <div class="acts"><button class="make" type="button" data-vx-try>Попробовать</button><button class="make ghost" type="button" data-vx-keep>Сохранить себе</button></div>
      <p class="saved-note" role="status"></p>`;
    d.querySelector("[data-vx-try]").addEventListener("click", () => {
      d.close();
      if (c.secret && !FOUND.has(c.id)) { if (revealSecret(c)) freshFind = c.id; }
      if (H3D.treatClear) H3D.treatClear();
      makeCocktail(c.id);
    });
    d.querySelector("[data-vx-keep]").addEventListener("click", () => {
      const st = d.querySelector(".saved-note");
      if (c.custom) {
        if (!c.saved) { c.saved = true; MINE.push(c); addDrink(c); saveMine(); track("count", "mine"); }
        st.textContent = "Сохранено в «Мои коктейли».";
      } else {
        if (c.secret && !FOUND.has(c.id)) revealSecret(c);
        if (!FAV.has(c.id)) toggleFav(c.id);
        st.textContent = "Добавлено в избранное барной карты.";
      }
    });
    openSheet(d);
    return c;
  }

  /* ---------- бронь места ---------- */
  function vxSeatMax(s) { const n = String(s.cap).match(/\d+/g); return n ? +n[n.length - 1] : 2; }
  function vxBook(id) {
    const s = VX_SEATS.find(x => x.id === id);
    if (!s || !vxO2O()) return;
    const M = VENUE.meta, d = vxSheet("vx-book", s.name);
    const pad = n => String(n).padStart(2, "0"), today = new Date(), iso = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
    vxStat("seat");
    d.body.innerHTML = `${vxTag("book") ? `<p class="vx-demo-tag">${vxTag("book")}</p>` : ""}
      <p class="vx-room">${escH(s.room)} · ${escH(s.cap)}</p>
      <p>${escH(s.mood)}</p>
      <div class="acts"><button class="make" type="button" data-vx-take>Занять это место</button></div>
      <form class="vx-form" id="vx-book-form" hidden>
        <div class="vx-two"><label>Дата<input type="date" name="date" required min="${iso(today)}" value="${iso(today)}"></label>
        <label>Время<input type="time" name="time" required value="20:00" step="900"></label></div>
        <div class="vx-two"><label>Гостей<select name="n">${Array.from({ length: vxSeatMax(s) }, (_, i) => `<option>${i + 1}</option>`).join("")}</select></label>
        <label>Имя<input name="name" maxlength="40" required autocomplete="name" value="${escH(vxName())}"></label></div>
        <p class="note">Открыто с ${M.hours.open} до ${M.hours.close}${M.address ? ` · ${escH(M.address)}` : ""}.</p>
        <button class="make" type="submit">Подготовить заявку</button>
        <div class="vx-out" hidden></div>
      </form>`;
    openSheet(d);
    d.querySelector("[data-vx-take]").addEventListener("click", e => { e.target.closest(".acts").hidden = true; const f = d.querySelector("form"); f.hidden = false; f.querySelector("input").focus(); });
    d.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();
      const f = new FormData(e.target), out = d.querySelector(".vx-out");
      const [hh, mm] = String(f.get("time")).split(":").map(Number), mins = hh * 60 + mm;
      const toM = t => { const [a, b] = t.split(":").map(Number); return a * 60 + b; };
      const open = toM(M.hours.open), close = toM(M.hours.close), inHours = close > open ? mins >= open && mins < close : mins >= open || mins < close;
      out.hidden = false;
      if (!inHours) { out.innerHTML = `<p class="vx-err">В это время бар закрыт: мы работаем с ${M.hours.open} до ${M.hours.close}.</p>`; return; }
      const date = new Date(f.get("date") + "T12:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
      vxStat("book");
      const text = `${M.demo ? "[Тест с демо-страницы] " : ""}Привет! Хочу забронировать «${s.name}» в баре ${M.name} на ${date}, ${f.get("time")}, гостей: ${f.get("n")}. Имя: ${vxClean(f.get("name"), 40)}.`;
      const wa = M.contacts.whatsapp ? `https://wa.me/${M.contacts.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : "";
      const tg = M.contacts.telegram ? `https://t.me/${M.contacts.telegram.replace(/^@/, "")}` : "";
      out.innerHTML = `<p class="vx-msg">${escH(text)}</p>
        <div class="acts">${vxDemo() ? `<button class="make" type="button" disabled>WhatsApp</button><button class="make ghost" type="button" disabled>Telegram</button>`
          : `${wa ? `<a class="make" href="${wa}" target="_blank" rel="noopener">Отправить в WhatsApp</a>` : ""}${tg ? `<a class="make ghost" href="${tg}" target="_blank" rel="noopener" data-vx-tg>Открыть Telegram</a>` : ""}`}</div>
        <p class="note">${vxDemo() ? (VENUE.meta.demo ? "Так заявка выглядит у гостя: с настоящими контактами кнопки откроют чат заведения." : "Кнопки заработают, когда в настройках заведения появятся настоящие WhatsApp и Telegram.") : tg ? "Telegram не умеет подставлять текст в чат: мы скопируем заявку, останется вставить её." : "Хостес подтвердит бронь в ответном сообщении."}</p>`;
      out.querySelectorAll("a.make").forEach(a => a.addEventListener("click", () => vxStat("send")));
      const tl = out.querySelector("[data-vx-tg]");
      if (tl) tl.addEventListener("click", () => { try { navigator.clipboard.writeText(text); } catch (er) {} });
    });
  }

  /* ---------- колода у камина ---------- */
  const vxDeckDlg = (() => {
    if (!VENUE.deck) return null;
    const d = document.createElement("dialog");
    d.className = "vx-deck"; d.id = "vx-deck"; d.setAttribute("aria-labelledby", "vx-deck-title");
    d.innerHTML = `<div class="vx-deck-in">
      <div class="vx-deck-top"><h2 id="vx-deck-title">${escH(VENUE.deck.title)}</h2><button class="close" type="button" aria-label="Закрыть колоду" data-vx-deck-close>×</button></div>
      <div class="chips" role="group" aria-label="Режим колоды">${VENUE.deck.modes.map(m => `<button class="chip" type="button" data-vx-mode="${m.id}">${escH(m.name)}</button>`).join("")}</div>
      <p class="vx-deck-note"></p>
      <div class="vx-card-wrap"><div class="vx-card" aria-live="polite">
        <div class="vx-face vx-back" aria-hidden="true"><span class="vx-mono"><i>${escH(VENUE.meta.name.charAt(0))}</i></span><span class="vx-back-name">${escH(VENUE.meta.name)}</span></div>
        <div class="vx-face vx-front"><span class="vx-front-mode"></span><p class="vx-q"></p></div>
      </div></div>
      <div class="acts"><button class="make" type="button" data-vx-draw>Вытянуть карту</button></div>
      <p class="vx-left"></p></div>`;
    document.body.appendChild(d);
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-vx-deck-close]")) { d.close(); return; }
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.vxMode) { VX.mode = b.dataset.vxMode; vxDeckRender(true); }
      else if ("vxDraw" in b.dataset) vxDraw();
    });
    return d;
  })();
  const vxMode = () => VENUE.deck.modes.find(m => m.id === VX.mode) || VENUE.deck.modes[0];
  function vxDeckRender(reset) {
    const d = vxDeckDlg, m = vxMode();
    d.querySelectorAll("[data-vx-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.vxMode === m.id)));
    d.querySelector(".vx-deck-note").textContent = m.note;
    if (reset) d.querySelector(".vx-card").classList.remove("flip");
    const bag = VX.bag[m.id];
    d.querySelector(".vx-left").textContent = bag ? `В колоде осталось ${bag.length} из ${m.cards.length}` : `${m.cards.length} карт · перемешаны`;
  }
  async function vxDraw() {
    const d = vxDeckDlg, m = vxMode(), card = d.querySelector(".vx-card"), btn = d.querySelector("[data-vx-draw]");
    if (!VX.bag[m.id] || !VX.bag[m.id].length) {
      const a = m.cards.map((_, i) => i);
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      if (VX.bag[m.id]) toast("Колода перемешана", m.name);
      VX.bag[m.id] = a;
    }
    const q = m.cards[VX.bag[m.id].pop()];
    btn.disabled = true;
    vxSound("card");
    const still = reduceMotion.matches;
    if (card.classList.contains("flip") && !still) { card.classList.remove("flip"); await new Promise(r => setTimeout(r, 380)); }
    d.querySelector(".vx-q").textContent = q;
    d.querySelector(".vx-front-mode").textContent = m.name;
    card.classList.add("flip");
    vxDeckRender(false);
    setTimeout(() => { btn.disabled = false; btn.textContent = "Следующая карта"; btn.focus({ preventScroll: true }); }, still ? 0 : 600);
  }
  function vxDeck() {
    if (!vxDeckDlg || vxDeckDlg.open) return;
    for (const o of document.querySelectorAll("dialog.sheet[open]")) o.close();
    vxDeckDlg.querySelector("[data-vx-draw]").textContent = "Вытянуть карту";
    vxDeckDlg.querySelector(".vx-card").classList.remove("flip");
    vxDeckRender(false);
    vxDeckDlg.showModal();
    uiSound("open");
    vxDeckDlg.querySelector("[data-vx-draw]").focus({ preventScroll: true });
  }

  /* ---------- предпросмотр брони для хозяина: кнопка в настройках «Демо» ---------- */
  function vxPreview(on) {
    VX.preview = on;
    try { on ? localStorage.setItem("hacheden-o2o-preview", "1") : localStorage.removeItem("hacheden-o2o-preview"); } catch (e) {}
    if (H3D.seats) H3D.seats();
  }
