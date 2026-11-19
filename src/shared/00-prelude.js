/* ================= настройки гостя, звуковые каналы, уведомления, прогресс =================
   Всё хранится только в этом браузере (localStorage), без регистрации и без сервера. */
  const SET_DEFAULT = { master: .8, music: .7, ambient: .6, ui: .45, mute: false, quality: "auto", fps: "60", effects: true, motion: "auto", saver: false, mood: "auto" };
  const SET = Object.assign({}, SET_DEFAULT, (() => { try { return JSON.parse(localStorage.getItem("hacheden-settings")) || {}; } catch (e) { return {}; } })());
  const SET_LISTEN = [];
  function saveSettings() { try { localStorage.setItem("hacheden-settings", JSON.stringify(SET)); } catch (e) {} }
  function setSetting(k, v) { SET[k] = v; saveSettings(); SET_LISTEN.forEach(f => { try { f(k, v); } catch (e) { console.warn(e); } }); }
  const onSetting = f => SET_LISTEN.push(f);
  /* «меньше движения»: по системе или вручную */
  const reduceMotionMQ = matchMedia("(prefers-reduced-motion: reduce)");
  const reduceMotion = { get matches() { return SET.motion === "reduce" || (SET.motion === "auto" && reduceMotionMQ.matches); } };

  /* каналы звука: музыка, окружение (дождь, камин, звуки бара), интерфейс */
  const AUDIO = {
    routes: [],
    level(ch) { return SET.mute ? 0 : SET.master * (ch === "music" ? SET.music : ch === "ambient" ? SET.ambient : SET.ui); },
    // любой звуковой контекст подключаем через свой регулятор громкости
    route(ctx, ch) {
      if (!ctx || ctx._hRoute) return ctx;
      const real = ctx.destination, g = ctx.createGain();
      g.gain.value = AUDIO.level(ch);
      g.connect(real);
      try { Object.defineProperty(ctx, "destination", { value: g, configurable: true }); } catch (e) { return ctx; }
      ctx._hRoute = true;
      AUDIO.routes.push([ctx, g, ch]);
      return ctx;
    },
    apply() {
      for (const [ctx, g, ch] of AUDIO.routes) g.gain.setTargetAtTime(AUDIO.level(ch), ctx.currentTime, .12);
      if (typeof Music !== "undefined") Music.levels();
    }
  };
  onSetting(k => { if (["master", "music", "ambient", "ui", "mute"].includes(k)) AUDIO.apply(); });

  /* звуки интерфейса: тихий щелчок кнопки, мягкий звонок для находок */
  let uiCtx = null;
  function uiAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!uiCtx) { try { uiCtx = AUDIO.route(new AC(), "ui"); } catch (e) { return null; } }
    if (uiCtx.state === "suspended") uiCtx.resume();
    return uiCtx;
  }
  function uiSound(kind = "tick") {
    if (AUDIO.level("ui") <= .001) return;
    const c = uiAudio(); if (!c) return;
    const t = c.currentTime + .01;
    const tone = (f, at, dur, v, type = "sine") => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t + at);
      g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(v, t + at + .006); g.gain.exponentialRampToValueAtTime(.0001, t + at + dur);
      o.connect(g).connect(c.destination); o.start(t + at); o.stop(t + at + dur + .02);
    };
    if (kind === "tick") tone(2100, 0, .045, .035, "triangle");
    else if (kind === "soft") tone(1300, 0, .07, .03);
    else if (kind === "open") { tone(660, 0, .16, .03); tone(990, .05, .2, .022); }
    else if (kind === "stamp") { tone(150, 0, .16, .09); tone(96, .005, .22, .07); tone(2400, 0, .018, .012, "triangle"); }
    else if (kind === "chime") { tone(1318.5, 0, .9, .045); tone(1760, .11, 1.1, .04); tone(2637, .22, .9, .015); }
  }
  document.addEventListener("pointerdown", e => {
    const b = e.target.closest && e.target.closest("button, [role=tab], select, summary");
    if (b && !b.disabled) uiSound(b.classList.contains("make") || b.classList.contains("enter") ? "soft" : "tick");
  }, true);

  /* аккуратные уведомления в углу: секреты, достижения, сохранения */
  let toastBox = null;
  function toast(title, text = "", kind = "") {
    if (!toastBox) {
      toastBox = document.createElement("div");
      toastBox.className = "toasts"; toastBox.setAttribute("role", "status"); toastBox.setAttribute("aria-live", "polite");
      document.body.appendChild(toastBox);
    }
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    const icon = kind === "secret" ? "✦" : kind === "ach" ? "★" : "•";
    el.innerHTML = `<span class="t-ic" aria-hidden="true">${icon}</span><span class="t-tx"><b></b><span></span></span>`;
    el.querySelector("b").textContent = title;
    el.querySelector(".t-tx span").textContent = text;
    toastBox.appendChild(el);
    while (toastBox.children.length > 3) toastBox.firstChild.remove();
    const bye = () => { el.classList.add("out"); setTimeout(() => el.remove(), 400); };
    el.addEventListener("click", bye);
    setTimeout(bye, kind ? 6000 : 4200);
  }

  /* прогресс гостя: где был, что пил, что нашёл */
  const PROG = Object.assign({ rooms: [], secrets: {}, ach: {}, drinks: {}, tried: {}, stamped: [], tracks: [], favTracks: [], stories: [], visits: 0, first: 0, counters: {} },
    (() => { try { return JSON.parse(localStorage.getItem("hacheden-progress")) || {}; } catch (e) { return {}; } })());
  function saveProgress() { try { localStorage.setItem("hacheden-progress", JSON.stringify(PROG)); } catch (e) {} }
  const PROG_LISTEN = [];
  /* событие: track("room", 2), track("drink", "c-mojito"), track("secret", "cellar") … */
  function track(ev, v) {
    let changed = false;
    const addTo = (arr, x) => { if (!arr.includes(x)) { arr.push(x); changed = true; } };
    if (ev === "room") addTo(PROG.rooms, v);
    else if (ev === "drink") { PROG.drinks[v] = (PROG.drinks[v] || 0) + 1; if (!(v in PROG.tried)) PROG.tried[v] = Date.now(); changed = true; }
    else if (ev === "track") addTo(PROG.tracks, v);
    else if (ev === "story") addTo(PROG.stories, v);
    else if (ev === "count") { PROG.counters[v] = (PROG.counters[v] || 0) + 1; changed = true; }
    else if (ev === "secret") {
      if (!PROG.secrets[v]) {
        PROG.secrets[v] = Date.now(); changed = true;
        const s = typeof SECRET_INFO !== "undefined" && SECRET_INFO[v];
        setTimeout(() => { uiSound("chime"); toast("Найден секрет", s ? s.name : "", "secret"); }, 400);
      }
    }
    if (!changed) return;
    saveProgress();
    PROG_LISTEN.forEach(f => { try { f(ev, v); } catch (e) { console.warn(e); } });
  }
  const onProgress = f => PROG_LISTEN.push(f);
  if (!PROG.first) PROG.first = Date.now();
  // печати книги рецептов: у старых заказов даты первой пробы нет — печать без даты, уже «поставлена»
  for (const id in PROG.drinks) if (!(id in PROG.tried)) { PROG.tried[id] = 0; if (!PROG.stamped.includes(id)) PROG.stamped.push(id); }
  PROG.visits++;
  saveProgress();
