/* ================= панели: общий каркас и настройки ================= */
  /* боковая панель (на телефоне — шторка снизу) с заголовком и крестиком */
  function makeSheet(id, title, extra = "") {
    const d = document.createElement("dialog");
    d.className = "sheet" + (extra ? " " + extra : "");
    d.id = id;
    d.setAttribute("aria-labelledby", id + "-title");
    d.innerHTML = `<div class="sheet-in"><div class="sheet-top"><h2 id="${id}-title">${title}</h2>
      <button class="close" type="button" aria-label="Закрыть" data-sheet-close>×</button></div><div class="sheet-body"></div></div>`;
    document.body.appendChild(d);
    d.addEventListener("click", e => {
      if (e.target === d || e.target.closest("[data-sheet-close]")) d.close();
    });
    d.body = d.querySelector(".sheet-body");
    return d;
  }
  function openSheet(d) {
    if (d.open) return;
    for (const o of document.querySelectorAll("dialog.sheet[open], dialog.atmo[open]")) o.close();
    if (typeof mixDlg !== "undefined" && mixDlg.open) mixDlg.close();
    d.showModal();
    uiSound("open");
    const f = d.querySelector(".sheet-body button, .sheet-body input, .sheet-body select");
    (f || d.querySelector(".close")).focus({ preventScroll: true });
  }
  const pct = v => Math.round(v * 100) + "%";
  const rngRow = (key, label, hint = "") => `<div class="row slider"><label for="s-${key}">${label}${hint ? `<small>${hint}</small>` : ""}</label>
    <input class="rng" type="range" id="s-${key}" data-set="${key}" min="0" max="100" step="1" value="${Math.round(SET[key] * 100)}" style="--v:${pct(SET[key])}">
    <output for="s-${key}">${pct(SET[key])}</output></div>`;
  const swRow = (key, label, hint = "", invert = false) => `<div class="row"><label for="s-${key}">${label}${hint ? `<small>${hint}</small>` : ""}</label>
    <span class="sw"><input type="checkbox" id="s-${key}" data-set="${key}"${(invert ? !SET[key] : SET[key]) ? " checked" : ""}><span></span></span></div>`;
  const segRow = (key, label, opts) => `<div class="row" style="grid-template-columns:1fr"><span class="lbl">${label}</span>
    <div class="seg" role="group" aria-label="${label}">${opts.map(([v, t]) => `<button class="chip" type="button" data-seg="${key}:${v}" aria-pressed="${String(SET[key]) === v}">${t}</button>`).join("")}</div></div>`;

  const setDlg = makeSheet("settings", "Настройки");
  let needReload = false, resetArm = false;
  function renderSettings() {
    setDlg.body.innerHTML = `
      <h3>Звук</h3>
      ${rngRow("master", "Общая громкость")}
      ${rngRow("music", "Музыка", "джаз-бэнд и граммофон")}
      ${rngRow("ambient", "Окружение", "дождь, камин, звуки бара")}
      ${rngRow("ui", "Интерфейс", "щелчки кнопок, находки")}
      ${swRow("mute", "Без звука", "всё сразу, громкости сохранятся")}
      <div class="acts"><button class="make ghost" type="button" data-open-player>Музыкальный плеер</button></div>
      <h3>Атмосфера</h3>
      ${segRow("mood", "Время в баре", [["auto", "По часам"], ["evening", "Вечер"], ["midnight", "Полночь"], ["late", "Поздняя ночь"]])}
      <p class="note">Меняет свет и оттенки зала. Открыт бар всё равно по настоящим часам: с ${VENUE.meta.hours.open.replace(/^0(?=\d:)/, "")} до ${VENUE.meta.hours.close.replace(/^0(?=\d:)/, "")}.</p>
      <h3>Графика и движение</h3>
      ${segRow("quality", "Качество картинки", [["auto", "Авто"], ["high", "Высокое"], ["medium", "Среднее"], ["low", "Низкое"]])}
      ${segRow("fps", "Плавность анимации", [["60", "60 кадров"], ["30", "30 кадров"]])}
      ${swRow("effects", "Визуальные эффекты", "пыль в свете ламп, дымка, искры")}
      ${segRow("motion", "Меньше движения", [["auto", "Как в системе"], ["reduce", "Включено"], ["full", "Выключено"]])}
      ${swRow("saver", "Режим экономии", "для слабых телефонов: проще картинка, 30 кадров, без эффектов")}
      <p class="note" id="set-reload"${needReload ? "" : " hidden"}>Часть изменений полностью применится после перезагрузки страницы.
        <button class="clear" type="button" data-reload>Перезагрузить</button></p>
      ${H3D.owner ? (() => {
        const qs = new URLSearchParams(location.search), t = qs.get("time") || "", s = qs.get("season") || "";
        const tb = (v, l) => `<button class="chip" type="button" data-demo-time="${v}" aria-pressed="${t === v}">${l}</button>`;
        const sb = (v, l) => `<button class="chip" type="button" data-demo-season="${v}" aria-pressed="${s === v}">${l}</button>`;
        return `<h3>Демо (только хозяину)</h3>
        <p class="note">Посмотреть бар в любое время суток и сезон. Гости этого не видят: для них бар живёт по настоящим часам.</p>
        <div class="row" style="grid-template-columns:1fr"><span class="lbl">Время</span><div class="seg">${tb("", "Сейчас")}${tb("17:30", "17:30 открытие")}${tb("20:30", "20:30")}${tb("23:30", "23:30")}${tb("01:30", "01:30")}${tb("02:58", "02:58 закрытие")}</div></div>
        <div class="row" style="grid-template-columns:1fr"><span class="lbl">Сезон</span><div class="seg">${sb("", "Как сейчас")}${sb("winter", "Зима")}${sb("spring", "Весна")}${sb("summer", "Лето")}${sb("autumn", "Осень")}</div></div>
        <div class="acts"><button class="make ghost" type="button" data-demo-coach>Показать знакомство с управлением</button></div>
        <p class="note">Барный пропуск с комплиментом и кнопка «Загляну сегодня» включатся у всех гостей, когда у заведения появится привилегия (meta.privilege в src/venues). Здесь можно посмотреть их заранее.</p>
        <div class="acts"><button class="make ghost" type="button" data-demo-o2o aria-pressed="${VX.preview}">${VX.preview ? "Скрыть барный пропуск" : "Показать барный пропуск"}</button></div>`;
      })() : ""}
      <div class="acts"><button class="make ghost${resetArm ? " warn" : ""}" type="button" data-reset>${resetArm ? "Точно сбросить? Нажмите ещё раз" : "Сбросить настройки"}</button></div>
      <p class="note">Настройки хранятся только в этом браузере.</p>`;
  }
  setDlg.addEventListener("input", e => {
    const t = e.target;
    if (t.type !== "range") return;
    const v = +t.value / 100;
    t.style.setProperty("--v", t.value + "%");
    t.nextElementSibling.textContent = t.value + "%";
    setSetting(t.dataset.set, v);
    if (t.dataset.set === "ambient" || t.dataset.set === "master") Music.wake();
  });
  setDlg.addEventListener("change", e => {
    const t = e.target;
    if (t.type === "range") uiSound("soft");
    if (t.type !== "checkbox") return;
    setSetting(t.dataset.set, t.checked);
    if (t.dataset.set === "saver") { needReload = true; renderSettings(); }
  });
  setDlg.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.seg) {
      const [k, v] = b.dataset.seg.split(":");
      setSetting(k, v);
      if (k === "quality" || k === "motion") needReload = true;
      renderSettings();
      const f = setDlg.querySelector(`[data-seg="${k}:${v}"]`); if (f) f.focus();
    } else if ("reset" in b.dataset) {
      if (!resetArm) { resetArm = true; renderSettings(); setDlg.querySelector("[data-reset]").focus(); return; }
      resetArm = false;
      const q = SET.quality, m = SET.motion;
      Object.keys(SET_DEFAULT).forEach(k => setSetting(k, SET_DEFAULT[k]));
      if (q !== SET.quality || m !== SET.motion) needReload = true;
      renderSettings();
      toast("Настройки сброшены", "Вернули всё как было по умолчанию");
    } else if (b.dataset.demoTime != null || b.dataset.demoSeason != null) {
      const u = new URL(location.href);
      const k = b.dataset.demoTime != null ? "time" : "season", v = b.dataset.demoTime ?? b.dataset.demoSeason;
      if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
      location.href = u.toString();
    } else if ("demoCoach" in b.dataset) { setDlg.close(); if (H3D.coach) H3D.coach(); }
    else if ("demoO2o" in b.dataset) { vxPreview(!VX.preview); b.setAttribute("aria-pressed", String(VX.preview)); b.textContent = VX.preview ? "Скрыть барный пропуск" : "Показать барный пропуск"; }
    else if ("reload" in b.dataset) location.reload();
    else if ("openPlayer" in b.dataset) { setDlg.close(); openPlayer(); }
  });
  setDlg.addEventListener("close", () => { resetArm = false; });
  function openSettings() { renderSettings(); openSheet(setDlg); }
  document.getElementById("t-settings").addEventListener("click", openSettings);
