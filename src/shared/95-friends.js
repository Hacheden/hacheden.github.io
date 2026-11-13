/* ================= живой бар: все посетители сайта видят друг друга =================
   Каждый, кто сейчас в баре, — фигура в том зале, где он находится, с именем над головой.
   С незнакомцами общаются готовыми фразами (свободный текст не показывается — так никто не испортит вечер).
   Связь — Firebase Realtime Database (бесплатный тариф, до 100 одновременных подключений).
   Ключи ниже не секретные; защиту дают правила базы (docs/firebase-rules.json).
   Проверка без сервера: ?net=local — вкладки одного браузера видят друг друга. */
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAGn2L_2GiVGIADqtomVD14jTVZlQlP4Dc",
    authDomain: "hacheden-9946b.firebaseapp.com",
    databaseURL: "https://hacheden-9946b-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "hacheden-9946b",
    appId: "1:774316675789:web:9347526f7df621d2d34f84"
  };
  const FB_VER = "10.12.2";
  /* одно подключение к Firebase на страницу: им пользуются и живой бар, и счётчик воронки (95-stats.js) */
  let FB_CONN = null;
  function fbOpen() {
    return FB_CONN || (FB_CONN = (async () => {
      const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
      const [app, auth, rdb] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-database.js")]);
      const a = app.initializeApp(FIREBASE_CONFIG);
      const cred = await auth.signInAnonymously(auth.getAuth(a));
      return { F: rdb, db: rdb.getDatabase(a), uid: cred.user.uid };
    })().catch(e => { FB_CONN = null; throw e; }));
  }
  const PUBLIC_ROOM = VENUE_ID;   // у каждого заведения своя общая комната: гости разных баров не смешиваются
  /* готовые фразы: показываются только они, что бы ни пришло из сети */
  const PHRASES = [
    ["hi", "Добрый вечер!"], ["cheers", "За вас! 🥂"], ["music", "Отличная музыка"], ["advice", "Что посоветуете выпить?"],
    ["wow", "Красиво здесь"], ["thanks", "Спасибо!"], ["laugh", "Ха-ха!"], ["bye", "Мне пора. Хорошего вечера!"]
  ];
  const PHRASE = Object.fromEntries(PHRASES);
  const QS_FR = new URLSearchParams(location.search);
  const FR = { me: null, uid: null, peers: {}, log: [], net: null, on: false, connecting: false, lastSay: 0, failed: false,
    hidden: new Set((() => { try { return JSON.parse(localStorage.getItem("hacheden-muted") || "[]"); } catch (e) { return []; } })()),
    invisible: (() => { try { return localStorage.getItem("hacheden-invisible") === "1"; } catch (e) { return false; } })() };
  /* простой фильтр имён: грубые корни заменяются на «Гость» */
  const BAD = /х[уy][йиеёяю]|п[иi]зд|[её]б[аеиуы]|бл[яэ]|сук[аи]|муда|пид[оа]р|шлюх|гандон|залуп|f+u+c+k|sh[i1]t|b[i1]tch|n[i1]gg|c[u]nt|wh[o0]re|fag/i;
  const cleanName = s => { s = String(s || "").replace(/[<>{}\[\]\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 20); return !s || BAD.test(s.replace(/[\s._\-*0-9]/g, "")) ? "Гость" : s; };
  const myName = () => { try { return cleanName(localStorage.getItem("hacheden-name") || "Гость"); } catch (e) { return "Гость"; } };
  const ZONE_WORD = ["в читальне", "за стойкой", "в курилке", "у сцены", "в погребе"];

  /* транспорт: Firebase или (для проверки) BroadcastChannel между вкладками */
  function localNet() {
    const ch = new BroadcastChannel("hacheden-live"), H = {}, users = {};
    const uid = "u" + Math.random().toString(36).slice(2, 10);
    let timer = 0;
    const emit = (e, d) => (H[e] || []).forEach(f => f(d));
    ch.onmessage = e => {
      const m = e.data;
      if (m.type === "user") { if (m.data) users[m.uid] = m.data; else delete users[m.uid]; emit("peers", Object.assign({}, users)); }
      else if (m.type === "hello" && users[uid]) ch.postMessage({ type: "user", uid, data: users[uid] });
      else if (m.type === "msg") emit("msg", m.data);
    };
    return {
      uid,
      on(e, f) { (H[e] = H[e] || []).push(f); },
      async join(me) {
        users[uid] = Object.assign({}, me, { seat: 0, seen: Date.now() });
        ch.postMessage({ type: "hello" }); ch.postMessage({ type: "user", uid, data: users[uid] });
        emit("peers", Object.assign({}, users));
        addEventListener("pagehide", () => ch.postMessage({ type: "user", uid, data: null }));
        timer = setInterval(() => { users[uid].seen = Date.now(); ch.postMessage({ type: "user", uid, data: users[uid] }); }, 15000);
      },
      update(p) { if (!users[uid]) return; Object.assign(users[uid], p); ch.postMessage({ type: "user", uid, data: users[uid] }); emit("peers", Object.assign({}, users)); },
      send(m) { const d = Object.assign({ uid, t: Date.now() }, m); ch.postMessage({ type: "msg", data: d }); emit("msg", d); },
      leave() { clearInterval(timer); ch.postMessage({ type: "user", uid, data: null }); delete users[uid]; emit("peers", Object.assign({}, users)); }
    };
  }
  function firebaseNet() {
    const H = {}, emit = (e, d) => (H[e] || []).forEach(f => f(d));
    let F = null, db = null, meRef = null, offs = [], hb = 0;
    const api = {
      uid: null,
      on(e, f) { (H[e] = H[e] || []).push(f); },
      async join(me) {
        if (!F) { const c = await fbOpen(); api.uid = c.uid; db = c.db; F = c.F; }
        const usersRef = F.ref(db, `rooms/${PUBLIC_ROOM}/users`);
        meRef = F.ref(db, `rooms/${PUBLIC_ROOM}/users/${api.uid}`);
        await F.onDisconnect(meRef).remove();
        await F.set(meRef, Object.assign({}, me, { seat: 0, seen: Date.now() }));
        const since = Date.now();
        offs.push(F.onValue(usersRef, sn => {
          const all = sn.val() || {}, t = Date.now(), out = {};
          for (const [k, u] of Object.entries(all)) if (u && (k === api.uid || t - (u.seen || 0) < 150000)) out[k] = u;
          emit("peers", out);
        }));
        const q = F.query(F.ref(db, `rooms/${PUBLIC_ROOM}/chat`), F.orderByChild("t"), F.startAt(since - 5000));
        offs.push(F.onChildAdded(q, sn => emit("msg", sn.val())));
        hb = setInterval(() => { if (meRef) F.update(meRef, { seen: Date.now() }); }, 45000);
      },
      update(p) { if (meRef) F.update(meRef, Object.assign({}, p, { seen: Date.now() })); },
      send(m) { if (meRef) F.push(F.ref(db, `rooms/${PUBLIC_ROOM}/chat`), Object.assign({ uid: api.uid, t: F.serverTimestamp() }, m)); },
      leave() { clearInterval(hb); offs.forEach(f => f()); offs = []; if (meRef) { F.onDisconnect(meRef).cancel(); F.remove(meRef); } meRef = null; emit("peers", {}); }
    };
    return api;
  }

  /* ---------- присутствие ---------- */
  /* напиток в руке — только в том виде, который пропускают правила базы (docs/firebase-rules.json) */
  const FR_CUPS = ["coupe", "highball", "martini", "rocks", "shot", "snifter", "wine"];
  function drinkInfo(c) {
    if (!c) return null;
    const id = String(c.id || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || "drink";
    const name = String(c.name || "").replace(/[<>{}\[\]\\]/g, "").slice(0, 32) || "Коктейль";
    return { id, name, cup: FR_CUPS.includes(c.cup) ? c.cup : "rocks", pour: /^#[0-9a-f]{6}$/i.test(c.pour) ? c.pour : "#6b1228",
      garnish: /^[a-z]{1,16}$/.test(c.garnish || "") ? c.garnish : "", ice: !!c.ice };
  }
  function mySnapshot() { return { name: myName(), look: FR.look, zone: typeof cur === "number" ? cur : 1, drink: drinkInfo(LAST_DRINK) }; }
  FR.look = (() => { try { let v = localStorage.getItem("hacheden-look"); if (v == null) { v = String(Math.floor(Math.random() * 6)); localStorage.setItem("hacheden-look", v); } return +v; } catch (e) { return 0; } })();
  async function goLive() {
    if (!FEAT.liveBar || FR.on || FR.connecting || FR.invisible) return;
    FR.connecting = true;
    try {
      FR.net = FR.net || (QS_FR.get("net") === "local" ? localNet() : firebaseNet());
      if (!FR.bound) {
        FR.bound = true;
        FR.net.on("peers", p => { FR.uid = FR.net.uid; FR.peers = p; pushScene(); renderLive(true); });
        FR.net.on("msg", onMsg);
      }
      await FR.net.join(mySnapshot());
      FR.uid = FR.net.uid; FR.on = true; FR.failed = false;
    } catch (e) {
      console.warn("live bar:", e && e.message);
      FR.failed = true;
    }
    FR.connecting = false;
    renderLive();
  }
  function goQuiet() { if (!FR.on) return; FR.net.leave(); FR.on = false; FR.peers = {}; pushScene(); renderLive(); }
  function pushScene() {
    const shown = {};
    for (const [k, u] of Object.entries(FR.peers)) if (k !== FR.uid && !FR.hidden.has(k)) shown[k] = Object.assign({}, u, { name: cleanName(u.name) });
    if (H3D.friends) H3D.friends.sync(shown);
    const n = Object.keys(shown).length, badge = document.getElementById("t-friends-n");
    if (badge) { badge.hidden = n < 1; badge.textContent = n; }
  }
  function onMsg(m) {
    if (!m || !m.uid || FR.hidden.has(m.uid)) return;
    const text = PHRASE[m.p];
    if (!text) return;   // только готовые фразы
    const u = FR.peers[m.uid] || {}, who = cleanName(u.name), mine = m.uid === FR.uid;
    const zone = mine ? (typeof cur === "number" ? cur : 1) : u.zone;
    FR.log.push({ who, mine, text, zone, t: Date.now() });
    if (FR.log.length > 30) FR.log.shift();
    if (!mine && H3D.friends) H3D.friends.event(m.uid, m.p, text);
    renderLog();
  }
  function sayPhrase(p) {
    if (!FR.on || !PHRASE[p] || Date.now() - FR.lastSay < 1500) return;
    FR.lastSay = Date.now();
    FR.net.send({ kind: p === "cheers" ? "cheers" : "say", p });   // только код фразы: свободный текст база не принимает
    if (p === "cheers" && H3D.friends) H3D.friends.cheers();
  }
  onProgress(ev => { if (FR.on && (ev === "drink" || ev === "room")) FR.net.update({ drink: drinkInfo(LAST_DRINK), zone: cur }); });

  /* ---------- панель «Кто в баре» ---------- */
  const frDlg = makeSheet("friends", "Кто в баре");
  function renderLog() {
    const box = frDlg.querySelector("#fr-log"); if (!box) return;
    const here = typeof cur === "number" ? cur : 1, items = FR.log.filter(l => l.zone === here || l.mine).slice(-12);
    box.innerHTML = items.length ? items.map(l => `<p class="${l.mine ? "me" : ""}"><b>${escH(l.mine ? "Вы" : l.who)}</b>: ${escH(l.text)}</p>`).join("") : `<p class="note">Здесь появится то, что говорят рядом с вами.</p>`;
    box.scrollTop = box.scrollHeight;
  }
  function peopleHTML() {
    const list = Object.entries(FR.peers).filter(([k]) => k !== FR.uid);
    if (!list.length) return `<li class="note" style="list-style:none">Кроме вас пока никого. Как только кто-то зайдёт на сайт, он появится в зале — и здесь.</li>`;
    return list.map(([k, u]) => `<li class="jitem${FR.hidden.has(k) ? " locked" : ""}"><span class="ji" aria-hidden="true">☺</span><div><b>${escH(cleanName(u.name))}</b><span>${ZONE_WORD[u.zone] || "в баре"}${u.drink ? " · пьёт «" + escH(u.drink.name) + "»" : ""}</span>
      <button class="clear" type="button" data-fr-mute="${escH(k)}">${FR.hidden.has(k) ? "Показать" : "Скрыть у себя"}</button></div></li>`).join("");
  }
  function renderLive(soft) {
    if (soft && frDlg.open && FR.on) { const pl = frDlg.querySelector("#fr-people"); if (pl) { pl.innerHTML = peopleHTML(); const c = frDlg.querySelector("#fr-count"); if (c) c.textContent = Object.keys(FR.peers).length; return; } }
    if (!frDlg.open && soft) return;
    const n = Object.keys(FR.peers).length;
    frDlg.body.innerHTML = `
      <p class="note">${FR.invisible ? "Вы невидимка: вас никто не видит, и вы не видите других." : FR.on ? `Сейчас на сайте: <b id="fr-count">${n}</b>. Все посетители видят друг друга в том зале, где находятся.` : FR.failed ? "Не получилось подключиться к живому бару. Проверьте интернет — попробуем ещё раз." : "Подключаемся к живому бару…"}</p>
      <div class="row" style="grid-template-columns:1fr"><label for="fr-name">Ваше имя над головой</label>
        <div class="fr-row" style="margin-top:6px"><input class="fr-in" id="fr-name" maxlength="20" autocomplete="nickname" value="${escH(myName())}"><button class="make" type="button" data-fr-name>Сохранить</button></div></div>
      ${swRow("frVisible", "Меня видят другие", "выключите, чтобы сидеть невидимкой")}
      ${FR.on ? `<h3>Сказать тем, кто рядом</h3>
      <div class="seg" role="group" aria-label="Готовые фразы">${PHRASES.map(([id, t]) => `<button class="chip" type="button" data-fr-say="${id}">${t}</button>`).join("")}</div>
      <div class="fr-log" id="fr-log" aria-live="polite" style="margin-top:12px"></div>
      <h3>Посетители</h3><ul class="jlist" id="fr-people">${peopleHTML()}</ul>
      <p class="note">С незнакомцами общаются только готовыми фразами — так вечер никому не испортят. Любого посетителя можно скрыть у себя.</p>` : FR.failed ? `<div class="acts"><button class="make" type="button" data-fr-retry>Подключиться снова</button></div>` : ""}`;
    const sw = frDlg.querySelector("#s-frVisible"); if (sw) sw.checked = !FR.invisible;
    renderLog();
  }
  frDlg.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.frSay) sayPhrase(b.dataset.frSay);
    else if ("frName" in b.dataset) {
      const v = cleanName(frDlg.querySelector("#fr-name").value);
      try { localStorage.setItem("hacheden-name", v); } catch (er) {}
      frDlg.querySelector("#fr-name").value = v;
      if (FR.on) FR.net.update({ name: v });
      toast("Имя сохранено", v === "Гость" ? "Над вами будет написано «Гость»" : `Над вами будет написано «${v}»`);
    } else if (b.dataset.frMute) {
      const k = b.dataset.frMute;
      FR.hidden.has(k) ? FR.hidden.delete(k) : FR.hidden.add(k);
      try { localStorage.setItem("hacheden-muted", JSON.stringify([...FR.hidden])); } catch (er) {}
      pushScene(); renderLive(true);
    } else if ("frRetry" in b.dataset) { FR.failed = false; renderLive(); goLive(); }
  });
  frDlg.addEventListener("change", e => {
    if (e.target.id !== "s-frVisible") return;
    FR.invisible = !e.target.checked;
    try { localStorage.setItem("hacheden-invisible", FR.invisible ? "1" : "0"); } catch (er) {}
    if (FR.invisible) goQuiet(); else goLive().then(() => renderLive());
    renderLive();
  });
  frDlg.addEventListener("keydown", e => { if (e.target.id === "fr-name" && e.key === "Enter") { e.preventDefault(); frDlg.querySelector("[data-fr-name]").click(); } });
  function openLive() { renderLive(); openSheet(frDlg); }
  document.getElementById("t-friends").addEventListener("click", openLive);
  const FRIENDS = { get on() { return FR.on; }, get uid() { return FR.uid; }, get peers() { return FR.peers; }, open: openLive, live: goLive, quiet: goQuiet, say: sayPhrase };
  if (!FEAT.liveBar) { const b = document.getElementById("t-friends"); if (b) b.hidden = true; }   // у заведения нет живого бара
