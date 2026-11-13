/* ================= фото на память: снимок зала в рамке Hacheden ================= */
const PHOTO = { style: "warm", raw: null, meta: null, url: null };
const PHOTO_STYLES = [["warm", "Тёплый", "sepia(.22) saturate(1.12) contrast(1.06)"], ["film", "Плёнка", "sepia(.7) contrast(1.12) brightness(.96) saturate(.9)"], ["bw", "Ч/Б", "grayscale(1) contrast(1.22) brightness(1.04)"], ["none", "Как есть", "none"]];
const flashEl = document.createElement("div"); flashEl.className = "flash"; document.body.appendChild(flashEl);
function shutter() {
  const c = uiAudio(); if (!c || AUDIO.level("ui") <= .001) return;
  const t = c.currentTime + .01, len = Math.floor(c.sampleRate * .09), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * (i < len * .4 || i > len * .55 ? 1 : .2);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = .7; g.gain.value = .5;
  s.connect(f).connect(g).connect(c.destination); s.start(t);
}
/* снимок: кадр 3D-сцены и имена посетителей рядом */
function capture() {
  POST.render(0);
  const src = renderer.domElement, W = src.width, H = src.height;
  const raw = document.createElement("canvas"); raw.width = W; raw.height = H;
  raw.getContext("2d").drawImage(src, 0, 0);
  const tags = [];
  if (typeof LIVE_SLOTS !== "undefined") for (const s of LIVE_SLOTS) {
    if (!s.uid || s.zone !== curZone || !s.F) continue;
    const p = s.F.head.getWorldPosition(V3()); p.y += .22; p.project(camera);
    if (p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1) tags.push({ x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, name: s.name });
  }
  const d = new Date();
  PHOTO.raw = raw;
  PHOTO.meta = { zone: curZone === 4 ? "Погреб" : ZONES[curZone].name, when: d, tags, wx: weatherLine(), people: tags.map(t => t.name) };
}
function compose() {
  const raw = PHOTO.raw, M = PHOTO.meta, W = raw.width, H = raw.height;
  const b = Math.round(Math.min(W, H) * .035), band = Math.round(Math.min(W, H) * .13);
  const cv = document.createElement("canvas"); cv.width = W + b * 2; cv.height = H + b * 2 + band;
  const g = cv.getContext("2d");
  g.fillStyle = "#14080a"; g.fillRect(0, 0, cv.width, cv.height);
  const st = PHOTO_STYLES.find(s => s[0] === PHOTO.style) || PHOTO_STYLES[0];
  const canFilter = "filter" in g;
  if (canFilter) g.filter = st[2];
  g.drawImage(raw, b, b);
  g.filter = "none";
  if (!canFilter && st[0] !== "none") {   // старые Safari: тонируем вручную
    const img = g.getImageData(b, b, W, H), px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], gg = px[i + 1], bb = px[i + 2], y = .3 * r + .59 * gg + .11 * bb;
      if (st[0] === "bw") px[i] = px[i + 1] = px[i + 2] = Math.min(255, (y - 128) * 1.2 + 132);
      else { const k = st[0] === "film" ? .7 : .22; px[i] = r + (Math.min(255, y * 1.07 + 30) - r) * k; px[i + 1] = gg + (Math.min(255, y * .95 + 12) - gg) * k; px[i + 2] = bb + (y * .78 - bb) * k; }
    }
    g.putImageData(img, b, b);
  }
  // виньетка и лёгкое зерно — как на старой фотографии
  const vg = g.createRadialGradient(b + W / 2, b + H / 2, Math.min(W, H) * .35, b + W / 2, b + H / 2, Math.max(W, H) * .72);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.45)");
  g.fillStyle = vg; g.fillRect(b, b, W, H);
  if (st[0] === "film" || st[0] === "bw") { g.globalAlpha = .05; for (let i = 0; i < W * H / 900; i++) { g.fillStyle = Math.random() < .5 ? "#fff" : "#000"; g.fillRect(b + Math.random() * W, b + Math.random() * H, 1.5, 1.5); } g.globalAlpha = 1; }
  // имена посетителей
  const fs = Math.round(H * .024);
  g.font = `${fs}px Literata, Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle";
  for (const t of M.tags) {
    const w = g.measureText(t.name).width + fs * 1.2, x = b + t.x, y = b + t.y - fs;
    g.fillStyle = "rgba(20,8,11,.8)"; g.strokeStyle = "rgba(214,170,92,.7)"; g.lineWidth = Math.max(1, fs * .08);
    g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - fs * .8, w, fs * 1.6, fs * .8) : g.rect(x - w / 2, y - fs * .8, w, fs * 1.6); g.fill(); g.stroke();
    g.fillStyle = "#ffe0b0"; g.fillText(t.name, x, y);
  }
  // рамка: латунная линия и подпись
  g.strokeStyle = "#c9944a"; g.lineWidth = Math.max(2, b * .12);
  g.strokeRect(b * .5, b * .5, cv.width - b, cv.height - b);
  const cy = H + b * 2 + band * .42;
  g.textBaseline = "alphabetic"; g.textAlign = "left";
  g.fillStyle = "#ff8aa0"; g.shadowColor = "#ff2a50"; g.shadowBlur = band * .15;
  g.font = `${Math.round(band * .42)}px Forum, Georgia, serif`;
  g.fillText(BAR_NAME, b * 1.4, cy);
  g.shadowBlur = 0;
  const date = M.when.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) + ", " + M.when.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  g.fillStyle = "#e8d8bc"; g.font = `${Math.round(band * .2)}px Literata, Georgia, serif`;
  g.fillText(`${M.zone} · ${date}`, b * 1.4, cy + band * .32);
  g.textAlign = "right"; g.fillStyle = "#c2a784";
  const right = M.people.length ? "Вместе с: " + M.people.slice(0, 4).join(", ") + (M.people.length > 4 ? " и др." : "") : M.wx || "Фото на память";
  g.fillText(right.slice(0, 70), cv.width - b * 1.4, cy + band * .32);
  if (M.people.length && M.wx) { g.fillText(M.wx, cv.width - b * 1.4, cy - band * .02); }
  return cv;
}
const phDlg = makeSheet("photo", "Фото на память", "wide");
function renderPhoto() {
  const cv = compose();
  PHOTO.url = cv.toDataURL("image/jpeg", .92);
  PHOTO.canvas = cv;
  phDlg.body.innerHTML = `<img class="photo-img" src="${PHOTO.url}" alt="Снимок: ${escH(PHOTO.meta.zone)}, ${escH(PHOTO.meta.when.toLocaleString("ru-RU"))}">
    <h3>Тон</h3>
    <div class="seg" role="group" aria-label="Тон снимка">${PHOTO_STYLES.map(([id, t]) => `<button class="chip" type="button" data-ph-style="${id}" aria-pressed="${PHOTO.style === id}">${t}</button>`).join("")}</div>
    <div class="acts"><button class="make" type="button" data-ph-save>Скачать</button>${navigator.canShare ? `<button class="make ghost" type="button" data-ph-share>Отправить…</button>` : ""}<button class="make ghost" type="button" data-ph-again>Ещё снимок</button></div>
    <p class="note">Снимок остаётся только у вас: на сервер ничего не отправляется.</p>`;
}
function fileName() { const d = PHOTO.meta.when, p = n => String(n).padStart(2, "0"); return `hacheden-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.jpg`; }
async function takePhoto() {
  if (!started || STREET.on) { toast("Фото можно сделать внутри бара"); return; }
  for (const o of document.querySelectorAll("dialog.sheet[open], dialog.atmo[open]")) o.close();
  if (mixDlg.open) mixDlg.close();
  await new Promise(r => requestAnimationFrame(() => r()));
  capture();
  shutter();
  flashEl.classList.remove("go"); void flashEl.offsetWidth; flashEl.classList.add("go");
  track("count", "photo");
  setTimeout(() => { renderPhoto(); openSheet(phDlg); }, STILL ? 0 : 450);
}
phDlg.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.phStyle) { PHOTO.style = b.dataset.phStyle; renderPhoto(); const f = phDlg.querySelector(`[data-ph-style="${PHOTO.style}"]`); if (f) f.focus(); }
  else if ("phSave" in b.dataset) { const a = document.createElement("a"); a.href = PHOTO.url; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove(); toast("Снимок сохранён", fileName()); }
  else if ("phShare" in b.dataset) {
    PHOTO.canvas.toBlob(async blob => {
      const file = new File([blob], fileName(), { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: BAR_NAME, text: `Вечер в баре ${BAR_NAME}` }); } catch (er) {} }
      else toast("Отправка недоступна", "Скачайте снимок и отправьте его сами");
    }, "image/jpeg", .92);
  } else if ("phAgain" in b.dataset) { phDlg.close(); setTimeout(takePhoto, 300); }
});
document.getElementById("t-photo").addEventListener("click", takePhoto);
Object.assign(H3D, { photo: takePhoto });
