/* ================= воронка для заведения: сколько гостей дошли до каждого шага =================
   stats/<бар>/<гггг-мм-дд>/<событие>: n — счётчик, u/<анонимный id> — отметка, что этот браузер уже посчитан.
   Правила базы пропускают только «+1» вместе с новой отметкой: один браузер — один раз в день на событие.
   Личных данных нет: только анонимный id Firebase. Не считаются: хозяин, проверки (?time=, #test…), локальный запуск.
   События: menu_open — открыл барную карту, event_open — открыл афишу вечера, booking_click — начал бронь
   (место в 3D или «Занять стол на этот вечер»), booking_send — нажал WhatsApp или Telegram с готовой заявкой,
   story_share — поделился или скачал карточку для сторис, treat_open — открыл ссылку «угостить».
   Смотреть цифры: консоль Firebase → Realtime Database → stats. */
  const STAT_EVENTS = ["menu_open", "event_open", "booking_click", "booking_send", "story_share", "treat_open"];
  const STAT_OFF = (() => {
    try {
      const q = new URLSearchParams(location.search);
      return location.protocol !== "https:" || /^(localhost|127\.|\[::1\])/.test(location.hostname) || location.hash === "#test"
        || ["net", "time", "season", "wx", "rare", "holiday"].some(k => q.has(k));
    } catch (e) { return true; }
  })();
  const statDay = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  async function vxStat(ev) {
    if (!STAT_EVENTS.includes(ev) || STAT_OFF || (typeof H3D !== "undefined" && H3D.owner)) return;
    const key = `hacheden-stat-${VENUE_ID}-${ev}`;          // один раз за сессию — дальше даже не стучимся в базу
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) { return; }
    try {
      const { F, db, uid } = await fbOpen();
      const base = `stats/${VENUE_ID}/${statDay()}/${ev}`;
      await F.update(F.ref(db), { [`${base}/n`]: F.increment(1), [`${base}/u/${uid}`]: true });
    } catch (e) { /* этот браузер сегодня уже посчитан, или нет сети — гостю это не мешает */ }
  }
  /* барная карта открылась — откуда бы её ни открыли */
  (() => {
    const mix = document.getElementById("mix");
    if (mix) new MutationObserver(() => { if (mix.open) vxStat("menu_open"); }).observe(mix, { attributes: true, attributeFilter: ["open"] });
  })();
