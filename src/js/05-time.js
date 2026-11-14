/* ================= реальное время и сезоны ================= */
/* Бар живёт по часам того, кто зашёл: часы работы — из meta.hours заведения (у Hacheden с 17:00 до 3:00), сезон — по дате.
   Для проверки можно подменить: ?time=21:30&season=winter */
const QS = new URLSearchParams(location.search);
const hourOf = (t, def) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || "") || /^(\d{1,2}):(\d{2})$/.exec(def); return +m[1] + +m[2] / 60; };
const VH = VENUE.meta.hours || {};
const OPEN_H = hourOf(VH.open, "17:00"), CLOSE_H = hourOf(VH.close, "03:00"), LAST_CALL = hourOf(VH.last, "02:30");
/* часы для текстов: «17:00», «3:00» */
const HOURS_TXT = { open: (VH.open || "17:00").replace(/^0(?=\d:)/, ""), close: (VH.close || "03:00").replace(/^0(?=\d:)/, "") };
const T0 = Date.now();
let fakeBase = null;
if (/^\d{1,2}(:\d{2})?$/.test(QS.get("time") || "")) {
  const [h, m] = QS.get("time").split(":").map(Number);
  const d = new Date(); d.setHours(h, m || 0, 0, 0);
  fakeBase = d.getTime();
}
const nowDate = () => new Date(fakeBase != null ? fakeBase + (Date.now() - T0) : Date.now());
const hoursOf = d => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
const openByClock = (d = nowDate()) => { const h = hoursOf(d); return h >= OPEN_H || h < CLOSE_H; };

/* ---------- хозяин: по секретной ссылке ?key=… бар для него открыт всегда ----------
   В коде хранится только отпечаток ключа (SHA-256), сам ключ здесь не лежит.
   Ключ запоминается в этом браузере; ?key=off выключает режим. */
const OWNER_HASH = "1686acf455c86b54c038f99671ad5929f387fc9dd80815147edac6174314f3d5";
let OWNER = false;
try { OWNER = localStorage.getItem("hacheden-owner") === OWNER_HASH; } catch (e) {}
{
  const key = QS.get("key");
  if (key) {
    if (key === "off") {
      OWNER = false;
      try { localStorage.removeItem("hacheden-owner"); } catch (e) {}
    } else if (crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
      const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
      if (hex === OWNER_HASH) {
        OWNER = true;
        try { localStorage.setItem("hacheden-owner", OWNER_HASH); } catch (e) {}
      }
    }
    // убираем ключ из адресной строки, чтобы он не попал на скриншот или в историю
    QS.delete("key");
    const q = QS.toString();
    history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
  }
}
const isOpen = (d = nowDate()) => OWNER || openByClock(d);
/* хозяин в закрытые часы видит бар таким, каким он бывает в половине девятого вечера */
const sceneDate = () => {
  const d = nowDate();
  if (!OWNER || openByClock(d)) return d;
  const e = new Date(d); e.setHours(20, 30, 0, 0); return e;
};
function minutesUntil(target, d = nowDate()) { let diff = target - hoursOf(d); if (diff <= 0) diff += 24; return Math.ceil(diff * 60); }
function spell(min) {
  const h = Math.floor(min / 60), m = min % 60;
  const w = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c;
  const parts = [];
  if (h) parts.push(`${h} ${w(h, "час", "часа", "часов")}`);
  if (m || !h) parts.push(`${m} ${w(m, "минуту", "минуты", "минут")}`);
  return parts.join(" ");
}

const SEASONS = ["winter", "spring", "summer", "autumn"];
const seasonOf = d => { const m = d.getMonth(); return m === 11 || m < 2 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn"; };
const SEASON = SEASONS.includes(QS.get("season")) ? QS.get("season") : seasonOf(nowDate());
const FESTIVE = (() => {
  if (QS.get("season")) return SEASON === "winter";
  const d = nowDate();
  return d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= 14);
})();
/* когда садится солнце (примерно, для наших широт) */
const SUNSET = { winter: 17, spring: 19.4, summer: 21, autumn: 18.2 }[SEASON];
/* настоящий закат в Алматы приходит вместе с погодой (77-weather.js) */
const SUN = { set: null };
/* 1 — за окном ещё светлое вечернее небо, 0 — ночь */
function skyLight(d = nowDate()) {
  let h = hoursOf(d);
  if (h < 12) h += 24;
  return clamp(((SUN.set ?? SUNSET) + .9 - h) / 1.5, 0, 1);
}
/* после часа ночи свет потихоньку приглушают */
function lateness(d = nowDate()) { const h = hoursOf(d); return h < CLOSE_H ? clamp((h - 1) / 2, 0, 1) : 0; }

const SEASON_INFO = {
  winter: { name: "Зима", nook: "Книги до потолка, снег за окном, письмо на столе", line: "Зима: за окном метёт, в камине трещат дрова." },
  spring: { name: "Весна", nook: "Книги до потолка, весенний дождь, письмо на столе", line: "Весна: за окном тёплый дождь, на стойке свежие цветы." },
  summer: { name: "Лето", nook: "Книги до потолка, звёзды и сверчки за окном", line: "Лето: за окном звёзды и сверчки, в камине вместо огня свечи." },
  autumn: { name: "Осень", nook: "Книги до потолка, дождь и листопад за окном", line: "Осень: дождь с листопадом, тыквы на каминной полке." }
};
/* сезонный напиток на меловой доске у стойки */
const SEASON_DRINK = {
  winter: {
    name: "Глинтвейн", tagline: "Сезонное предложение: горячее вино со специями",
    facts: [["Сезон", "зима"], ["Подают", "горячим, 70–80 °C"]],
    sections: [
      ["История", "Горячее вино со специями пили ещё в Древнем Риме. Немецкое название Glühwein происходит от слова glühen — «пылать, раскаляться». Сегодня глинтвейн — главный напиток рождественских ярмарок Германии и Австрии."],
      ["Рецепт", "750 мл сухого красного вина, 1 апельсин дольками, 2 палочки корицы, 4–5 бутонов гвоздики, 1 звёздочка бадьяна, 2–3 столовые ложки сахара или мёда."],
      ["Как готовить", "Нагрейте вино со специями и апельсином на слабом огне до 70–80 °C, не доводя до кипения, иначе уйдёт аромат. Добавьте сахар или мёд, дайте настояться 10 минут и разлейте по кружкам."]
    ]
  },
  spring: {
    name: "Френч 75", tagline: "Сезонное предложение: джин, лимон и шампанское",
    facts: [["Сезон", "весна"], ["Бокал", "флюте"]],
    sections: [
      ["История", "Коктейль появился после Первой мировой войны и назван в честь французской 75-миллиметровой пушки: говорили, что он бьёт так же метко. Классический рецепт с джином, лимоном и шампанским вошёл в «Савойскую книгу коктейлей» 1930 года."],
      ["Рецепт", "30 мл джина, 15 мл лимонного сока, 15 мл сахарного сиропа, 60–90 мл холодного шампанского, спираль лимонной цедры."],
      ["Как готовить", "Встряхните джин, сок и сироп со льдом, процедите в бокал-флюте и долейте шампанским. Украсьте цедрой."]
    ]
  },
  summer: {
    name: "Апероль шприц", tagline: "Сезонное предложение: итальянский летний аперитив",
    facts: [["Сезон", "лето"], ["Бокал", "винный, со льдом"]],
    sections: [
      ["История", "Аперитив Aperol придумали братья Барбьери в Падуе и представили в 1919 году. Традиция «шприца» старше: по распространённой версии, австрийские солдаты в области Венето в XIX веке разбавляли местное вино водой, а название пришло от немецкого spritzen — «брызгать»."],
      ["Рецепт", "Правило 3–2–1: 90 мл просекко, 60 мл апероля, 30 мл содовой, много льда, долька апельсина."],
      ["Как готовить", "Наполните бокал льдом, налейте просекко, затем апероль и долейте содовой. Аккуратно размешайте и украсьте долькой апельсина."]
    ]
  },
  autumn: {
    name: "Горячий тодди", tagline: "Сезонное предложение: виски, мёд и лимон",
    facts: [["Сезон", "осень"], ["Подают", "горячим, в кружке"]],
    sections: [
      ["История", "Горячий тодди пьют в Шотландии и Ирландии холодными сырыми вечерами, а ещё им по старинке лечат простуду. По одной из версий, название пришло из Индии XVII века, где «тодди» называли напиток из сока пальмы."],
      ["Рецепт", "45 мл виски, 1 столовая ложка мёда, 15 мл лимонного сока, 120 мл горячей воды, палочка корицы или пара бутонов гвоздики."],
      ["Как готовить", "Подогрейте кружку кипятком. Положите мёд, влейте лимонный сок и виски, долейте горячей водой и размешайте до растворения мёда. Добавьте корицу."]
    ]
  }
};
