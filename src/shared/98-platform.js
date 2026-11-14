/* ================= платформа: афиша вечера и бары сети =================
   Афиша — VENUE.events: [{ title, date: "гггг-мм-дд", time: "чч:мм", lineup, desc, accent: "#rrggbb" }].
   В 3D-зале стоит латунный стенд с ближайшим событием (src/js/92-venue.js); по нажатию — карточка события:
   «Загляну на этот вечер» (пропуск с комплиментом), «Позвать друзей» (ссылка на бар) и «Карточка в сторис» (1080×1920).
   Брони нет: гости в барах приходят спонтанно — бар узнаёт пришедших с сайта по коду пропуска.
   Бары сети — VENUE.network: [{ id, name, tagline, district }]: футляр со спичечными коробками, переход в один клик
   (?bar=<id>); имя гостя живёт в этом браузере и переходит вместе с ним. Нет сети — нет и кнопки. */
  const VX_EVENTS = (VENUE.events || []).filter(e => e && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && /^\d{2}:\d{2}$/.test(e.time || ""));
  const vxISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  /* ближайшее событие: сегодняшнее остаётся в афише до закрытия бара */
  function vxNextEvent(now = new Date()) {
    const today = vxISO(now.getHours() < 5 ? new Date(now - 864e5) : now);
    return VX_EVENTS.filter(e => e.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] || null;
  }
  const vxAccent = e => /^#[0-9a-f]{6}$/i.test(e.accent || "") ? e.accent : (getComputedStyle(document.documentElement).getPropertyValue("--brass").trim() || "#d6aa5c");
  const vxEventDay = e => {
    const d = new Date(e.date + "T12:00"), s = d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  function vxEvent(e = vxNextEvent()) {
    if (!e) return;
    const d = vxSheet("vx-event", "Афиша вечера");
    vxStat("event_open");
    d.body.innerHTML = `<article class="vx-ev" style="--ev:${vxAccent(e)}">
        <p class="vx-ev-when">${escH(vxEventDay(e))} · ${escH(e.time)}</p>
        <h3 class="vx-ev-title">${escH(e.title)}</h3>
        ${e.lineup ? `<p class="vx-ev-line">${escH(e.lineup)}</p>` : ""}
        ${e.desc ? `<p>${escH(e.desc)}</p>` : ""}
      </article>
      <div class="acts">${vxPassOn() ? `<button class="make" type="button" data-ev-visit>Загляну на этот вечер</button>` : ""}
        <button class="make ghost" type="button" data-ev-invite>Позвать друзей</button>
        <button class="make ghost" type="button" data-ev-story>Карточка в сторис</button></div>
      ${vxPassOn() ? `<p class="note">По барному пропуску: ${escH(vxPrivilege())}</p>` : ""}`;
    openSheet(d);
    const vb = d.querySelector("[data-ev-visit]");
    if (vb) vb.addEventListener("click", () => { d.close(); vxVisit(e); });
    d.querySelector("[data-ev-invite]").addEventListener("click", ev => vxInvite(ev.currentTarget, e));
    d.querySelector("[data-ev-story]").addEventListener("click", () => vxEventStory(e));
  }

  /* ---------- «Позвать друзей»: ссылка на бар (и на событие) — через меню «Поделиться» или в буфер ---------- */
  const vxBarURL = () => { const u = new URL(location.href), q = new URLSearchParams(); if (VENUE_ID !== "hacheden") q.set("bar", VENUE_ID); u.search = q.toString(); u.hash = ""; return u.href; };
  async function vxInvite(btn, e) {
    const url = vxBarURL();
    const text = e ? `${e.title} — ${vxEventDay(e).toLowerCase()}, ${e.time}, ${VENUE.meta.name}. Пойдём?` : `Загляну сегодня в ${VENUE.meta.name}. Пойдём со мной?`;
    vxStat("invite_share");
    if (navigator.share) { try { await navigator.share({ title: VENUE.meta.name, text, url }); return; } catch (er) { if (er && er.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(`${text} ${url}`); if (btn) { const t = btn.textContent; btn.textContent = "Ссылка скопирована"; setTimeout(() => { btn.textContent = t; }, 1800); } }
    catch (er) { toast("Ссылка на бар", url); }
  }

  /* ---------- «Загляну сегодня»: спонтанный визит без брони ----------
     Гость получает код пропуска и привилегию, видит часы и адрес, строит маршрут в 2ГИС и может написать бару.
     Адрес — meta.address, точная ссылка на карточку в 2ГИС — meta.gis (иначе поиск по названию и адресу). */
  function vxHoursLine(now = new Date()) {
    const H = VENUE.meta.hours, toM = t => { const [a, b] = t.split(":").map(Number); return a * 60 + b; };
    const open = toM(H.open), close = toM(H.close), cur = now.getHours() * 60 + now.getMinutes();
    const isOpen = close > open ? cur >= open && cur < close : cur >= open || cur < close;
    const t = s => s.replace(/^0(?=\d:)/, "");
    if (isOpen) return `Сейчас открыто до ${t(H.close)}${H.last ? ` · последний заказ в ${t(H.last)}` : ""}`;
    return `Сегодня открываемся в ${t(H.open)} и работаем до ${t(H.close)}`;
  }
  function vxGisURL() {
    const M = VENUE.meta;
    if (/^https:\/\/(go\.)?2gis\.(kz|ru|com)\//.test(M.gis || "")) return M.gis;
    return M.address ? `https://2gis.kz/${M.city === "Астана" ? "astana" : "almaty"}/search/${encodeURIComponent(`${M.name} ${M.address}`)}` : "";
  }
  function vxVisit(e) {
    if (!vxPassOn()) return;
    const M = VENUE.meta, code = vxPassCode(), d = vxSheet("vx-visit", e ? "Загляну на этот вечер" : "Загляну сегодня");
    const when = e ? `${vxEventDay(e)}, ${e.time} — «${e.title}»` : vxHoursLine();
    const msg = `${M.demo ? "[Тест с демо-страницы] " : ""}Привет! ${e ? `Загляну на «${e.title}» (${vxEventDay(e).toLowerCase()}, ${e.time})` : "Загляну сегодня вечером"}. Мой код пропуска: ${code}.`;
    const wa = M.contacts.whatsapp ? `https://wa.me/${M.contacts.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : "";
    const tg = M.contacts.telegram ? `https://t.me/${M.contacts.telegram.replace(/^@/, "")}` : "";
    const gis = vxGisURL();
    vxStat("pass_issued");
    d.body.innerHTML = `<p class="vx-room">${escH(when)}</p>
      ${M.address ? `<p>${escH(M.address)}${M.district && M.district !== M.city ? ` · ${escH(M.district)}` : ""}</p>` : ""}
      <p>Без брони: приходите, когда захочется. Покажите код у стойки — бармен отметит визит.</p>
      ${vxPassHTML(code, "Покажите этот код бармену или хостес")}
      <div class="acts">${gis ? `<a class="make" href="${escH(gis)}" target="_blank" rel="noopener" data-vx-gis>Маршрут в 2ГИС</a>` : ""}
        ${wa ? `<a class="make ghost" href="${escH(wa)}" target="_blank" rel="noopener" data-vx-msg>Написать бару</a>` : tg ? `<a class="make ghost" href="${escH(tg)}" target="_blank" rel="noopener" data-vx-msg data-vx-tg>Написать бару</a>` : `<button class="make ghost" type="button" disabled>Написать бару</button>`}
        <button class="make ghost" type="button" data-vx-invite>Позвать друзей</button></div>
      ${vxTag("visit") ? `<p class="note">${vxTag("visit")}</p>` : ""}`;
    openSheet(d);
    const tl = d.querySelector("[data-vx-tg]");
    if (tl) tl.addEventListener("click", () => { try { navigator.clipboard.writeText(msg); } catch (er) {} });
    d.querySelector("[data-vx-invite]").addEventListener("click", ev => vxInvite(ev.currentTarget, e));
  }
  /* анонс события для сторис: дата, название, состав, ссылка на бар */
  async function vxEventStoryCanvas(e) {
    const B = await vxCanvasBase(), { cv, g, W, H, F, cream, muted } = B, ac = vxAccent(e);
    const glow = g.createRadialGradient(W / 2, 860, 20, W / 2, 860, 560);
    glow.addColorStop(0, ac + "55"); glow.addColorStop(1, ac + "00");
    g.fillStyle = glow; g.fillRect(0, 320, W, 1100);
    g.fillStyle = muted; g.font = `italic 40px "${F.text}"`;
    if ("letterSpacing" in g) g.letterSpacing = "10px";
    g.fillText("АФИША ВЕЧЕРА", W / 2, 560);
    if ("letterSpacing" in g) g.letterSpacing = "0px";
    g.fillStyle = ac; g.font = `56px "${F.display}"`;
    g.fillText(vxEventDay(e), W / 2, 690);
    g.font = `150px "${F.display}"`; g.fillText(e.time, W / 2, 860);
    let y = 1060, size = 104;
    g.fillStyle = cream; g.font = `${size}px "${F.display}"`;
    let lines = vxWrap(g, e.title, W - 220);
    while (lines.length > 2 && size > 64) { size -= 8; g.font = `${size}px "${F.display}"`; lines = vxWrap(g, e.title, W - 220); }
    lines.slice(0, 3).forEach(l => { g.fillText(l, W / 2, y); y += size * 1.08; });
    y += 10;
    g.strokeStyle = ac; g.globalAlpha = .7; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 - 140, y); g.lineTo(W / 2 + 140, y); g.stroke(); g.globalAlpha = 1;
    if (e.lineup) { g.fillStyle = cream; g.font = `40px "${F.text}"`; vxWrap(g, e.lineup, W - 240).slice(0, 2).forEach(l => { y += 64; g.fillText(l, W / 2, y); }); }
    if (e.desc) { g.fillStyle = muted; g.font = `italic 34px "${F.text}"`; y += 20; vxWrap(g, e.desc, W - 260).slice(0, 3).forEach(l => { y += 50; g.fillText(l, W / 2, y); }); }
    g.fillStyle = cream; g.font = `32px "${F.text}"`;
    g.fillText(PASS ? `Комплимент по барному пропуску — на сайте бара` : "Заглядывайте", W / 2, H - 220);
    vxCanvasFoot(B, `18+ · ${VENUE.meta.city || ""}`.replace(/ · $/, ""));
    return cv;
  }
  async function vxEventStory(e) {
    const d = vxSheet("vx-story", "Карточка в сторис", "wide");
    d.body.innerHTML = `<p class="note">Рисую анонс…</p>`;
    const ev = document.getElementById("vx-event");
    if (ev && ev.open) ev.close();
    openSheet(d);
    const cv = await vxEventStoryCanvas(e);
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    if (!blob) { d.body.innerHTML = `<p class="note">Не получилось нарисовать карточку в этом браузере.</p>`; return; }
    const file = new File([blob], `${VENUE.id}-${e.date}.png`, { type: "image/png" }), url = URL.createObjectURL(blob);
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    d.body.innerHTML = `<img class="vx-story-img" src="${url}" alt="Анонс «${escH(e.title)}» для сторис">
      <div class="acts">${canShare ? `<button class="make" type="button" data-vx-share>Поделиться</button>` : ""}
        <a class="make${canShare ? " ghost" : ""}" href="${url}" download="${file.name}">Скачать картинку</a></div>
      <p class="note">${canShare ? "«Поделиться» откроет Instagram, Telegram и другие приложения." : "Картинка 1080×1920 — ровно в размер сторис."} Ссылка на бар — внизу карточки.</p>`;
    const sb = d.querySelector("[data-vx-share]");
    if (sb) sb.addEventListener("click", () => { vxStat("story_share"); navigator.share({ files: [file], title: e.title, url: `https://${VENUE.meta.site}` }).catch(() => {}); });
    const dl = d.querySelector("a[download]");
    if (dl) dl.addEventListener("click", () => vxStat("story_share"));
    d.addEventListener("close", () => setTimeout(() => URL.revokeObjectURL(url), 1000), { once: true });
  }

  /* ---------- бары сети: футляр со спичечными коробками ---------- */
  const VX_NET = (VENUE.network || []).filter(n => n && VENUE_ID_RE.test(n.id) && n.id !== VENUE_ID && n.name);
  const vxHopURL = id => {
    const u = new URL(location.href), q = new URLSearchParams();
    if (id !== "hacheden") q.set("bar", id);
    q.set("via", VENUE_ID);
    u.search = q.toString(); u.hash = "";
    return u.pathname + u.search;
  };
  function vxNetwork() {
    if (!VX_NET.length) return;
    const d = vxSheet("vx-net", "Бары сети", "wide");
    const name = vxName();
    const box = (n, i, here) => `<${here ? "div" : "a"} class="vx-match${here ? " here" : ""}" ${here ? "" : `href="${escH(vxHopURL(n.id))}" data-hop="${escH(n.id)}"`} style="--m:${i % 5}">
        <span class="vx-strike" aria-hidden="true"></span>
        <span class="vx-match-in"><b>${escH(n.name)}</b>${n.tagline ? `<i>${escH(n.tagline)}</i>` : ""}${n.district ? `<small>${escH(n.district)}</small>` : ""}
        ${here ? `<em>Вы здесь</em>` : ""}</span></${here ? "div" : "a"}>`;
    d.body.innerHTML = `<p class="note">Спичечный коробок — пропуск в соседний бар сети: один клик, и вы там${name ? `, ${escH(name)}. Имя пойдёт с вами` : ". Имя, которое вы назвали бармену, пойдёт с вами"}.</p>
      <div class="vx-case" role="list">${box({ name: VENUE.meta.name, tagline: VENUE.meta.slogan, district: VENUE.meta.district || VENUE.meta.city }, 0, true)}${VX_NET.map((n, i) => box(n, i + 1, false)).join("")}</div>`;
    openSheet(d);
    d.querySelectorAll("[data-hop]").forEach(a => a.addEventListener("click", () => vxSound && vxSound("card")));
  }
  (() => {
    const b = document.getElementById("t-hop");
    if (!b) return;
    b.hidden = !VX_NET.length;
    b.addEventListener("click", vxNetwork);
  })();
  /* гость пришёл из другого бара сети: короткое приветствие после входа */
  (() => {
    let via = "";
    try { via = new URLSearchParams(location.search).get("via") || ""; } catch (e) {}
    if (!VENUE_ID_RE.test(via) || via === VENUE_ID) return;
    const from = (VENUE.network || []).find(n => n.id === via);
    const greet = () => { const n = vxName(); toast(`${n ? n + ", д" : "Д"}обро пожаловать в ${VENUE.meta.name}`, from ? `Вас прислали из «${from.name}»` : "Вы пришли из бара сети"); };
    document.getElementById("enter").addEventListener("click", () => setTimeout(greet, 4500), { once: true });
  })();
