/* собрано tools/build.py — не править руками; исходники: src/js и src/venues/demo-almaty/rooms */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/* ================= ядро: рендер, помощники, анимации ================= */
const canvas = document.getElementById("gl");
const loadBar = document.getElementById("load");
const progress = p => { loadBar.style.width = Math.round(p * 100) + "%"; };
progress(.08);

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const STILL = reduceMotion.matches;
/* шейдеры прогреваются заранее (99-warm.js): пока не готово, кнопка «Войти» ждёт */
let WARM_DONE = false;
const COARSE = matchMedia("(pointer: coarse)").matches;
const SMALL = Math.min(innerWidth, innerHeight) < 620;
/* 1 — телефон, 2 — компьютер; гость может выбрать сам в настройках */
const LOWQ = SET.saver || SET.quality === "low";
let QUALITY = LOWQ ? 1 : SET.quality === "high" || SET.quality === "medium" ? 2 : (COARSE || SMALL ? 1 : 2);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY > 1, powerPreference: "high-performance" });
} catch (e) {
  noGL();
  throw e;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const dprCap = () => SET.saver || SET.quality === "low" ? 1 : SET.quality === "medium" ? 1.25 : SET.quality === "high" ? 2 : QUALITY > 1 ? 1.75 : 1.5;
let DPR = Math.min(devicePixelRatio || 1, dprCap());
renderer.setPixelRatio(DPR);
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060203);
scene.fog = new THREE.FogExp2(0x0a0405, .028);
const world = new THREE.Group();
/* ---------- уборка: убрать объект насовсем и освободить его геометрию и материалы в видеокарте ----------
   Общие детали (всё, что построено при загрузке, — KEEP) и то, чем ещё пользуются другие объекты сцены, не трогаются.
   Для переноса объекта в другую группу — обычный remove/attach, не drop. */
const KEEP = new WeakSet();
const mats = m => m ? (Array.isArray(m) ? m : [m]) : [];
function keepAll() { scene.traverse(x => { if (x.geometry) KEEP.add(x.geometry); mats(x.material).forEach(m => KEEP.add(m)); }); }
function drop(o) {
  if (!o) return;
  if (o.parent) o.parent.remove(o);
  const gs = new Set(), ms = new Set();
  o.traverse(x => { if (x.geometry && !KEEP.has(x.geometry)) gs.add(x.geometry); mats(x.material).forEach(m => { if (!KEEP.has(m)) ms.add(m); }); });
  if (!gs.size && !ms.size) return;
  scene.traverse(x => { if (x.geometry) gs.delete(x.geometry); mats(x.material).forEach(m => ms.delete(m)); });
  gs.forEach(g => g.dispose()); ms.forEach(m => m.dispose());
}
scene.add(world);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .05, 60);

/* детерминированный случайный генератор: комната каждый раз одинаковая */
let seed = 20240611;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R = (a, b) => a + rng() * (b - a);
const pickOne = arr => arr[Math.floor(rng() * arr.length)];

/* ---------- материалы и меши ---------- */
const std = (o = {}) => new THREE.MeshStandardMaterial(Object.assign({ roughness: .7, metalness: 0 }, o));
const lam = (o = {}) => new THREE.MeshLambertMaterial(o);
const basic = (o = {}) => new THREE.MeshBasicMaterial(o);
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = world) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}
const group = (x = 0, y = 0, z = 0, parent = world) => { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; };

/* коробка по границам: x0..x1, y0..y1, z0..z1, текстура ложится в метрах */
function boxGeo(w, h, d, uvScale = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (uvScale) worldUV(g, w, h, d, uvScale);
  return g;
}
function worldUV(g, w, h, d, s) {
  const uv = g.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * faces[f][0] / s, uv.getY(i) * faces[f][1] / s);
  }
}
function box(x0, x1, y0, y1, z0, z1, mat, parent = world, uvScale = 1) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  return mesh(boxGeo(w, h, d, uvScale), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent);
}
/* геометрия коробки, сдвинутая в мировые координаты: для склейки в один меш */
function boxAt(x0, x1, y0, y1, z0, z1, uvScale = 1) {
  const g = boxGeo(x1 - x0, y1 - y0, z1 - z0, uvScale);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
function merged(geos, mat, parent = world) {
  const g = mergeGeometries(geos.map(x => x.index ? x.toNonIndexed() : x), false);
  geos.forEach(x => x.dispose());
  return mesh(g, mat, 0, 0, 0, parent);
}
const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/* ---------- анимации: твины на любых числовых полях ---------- */
const tweens = new Set();
const ease = {
  io: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  sine: k => -(Math.cos(Math.PI * k) - 1) / 2,
  lin: k => k
};
let NOW = performance.now();
function tween(obj, to, dur, e = ease.io) {
  return new Promise(res => {
    for (const t of tweens) if (t.obj === obj) for (const k in to) delete t.to[k];
    const from = {};
    for (const k in to) from[k] = obj[k];
    if (STILL || dur <= 0) { Object.assign(obj, to); res(); return; }
    tweens.add({ obj, from, to, dur: dur * 1000, t0: NOW, e, res });
  });
}
function runTweens() {
  for (const t of tweens) {
    const k = clamp((NOW - t.t0) / t.dur, 0, 1), v = t.e(k);
    for (const key in t.to) t.obj[key] = t.from[key] + (t.to[key] - t.from[key]) * v;
    if (k >= 1) { tweens.delete(t); t.res(); }
  }
}
const wait = s => new Promise(r => STILL ? r() : setTimeout(r, s * 1000));
/* каждый кадр: обработчики живой сцены */
const tickers = [];
const onTick = fn => tickers.push(fn);

/* ---------- предметы, на которые можно нажать ---------- */
const HOT = [], hotMeshes = [];
function hot(root, zone, label, act, opt = {}) {
  root.userData.hot = Object.assign({ zone, label, act, h: 0, grow: .03, lift: 0, base: root.scale.clone(), y0: root.position.y }, opt);
  root.traverse(o => { if (o.isMesh && !o.userData.noHit) { o.userData.hotRoot = root; hotMeshes.push(o); } });
  HOT.push(root);
  return root;
}
/* шрифт для неона и надписей на этикетках */
await Promise.race([
  Promise.all([document.fonts.load("120px Forum"), document.fonts.load("20px Literata")]),
  new Promise(r => setTimeout(r, 2500))
]).catch(() => {});

/* ================= реальное время и сезоны ================= */
/* Бар живёт по часам того, кто зашёл: открыт с 17:00 до 3:00, сезон — по дате.
   Для проверки можно подменить: ?time=21:30&season=winter */
const QS = new URLSearchParams(location.search);
const OPEN_H = 17, CLOSE_H = 3, LAST_CALL = 2.5;
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


/* ================= кинематографичная картинка: постобработка =================
   Высокое: сглаживание, мягкое свечение ламп и неона, глубина резкости на крупных планах, плёночное зерно.
   Среднее (телефон): свечение и цветокоррекция. Низкое / экономия: только цветокоррекция без лишних проходов.
   Если кадров мало — эффекты отключаются по одному, начиная с самых дорогих. */
const POST = { tier: 0, dof: null, dofOn: false, focusD: 3, focusWant: 3, apWant: 0, ap: 0, t: 0, drops: 0 };
POST.tier = SET.saver || SET.quality === "low" ? 0 : SET.quality === "high" ? 2 : SET.quality === "medium" ? 1 : QUALITY > 1 ? 2 : 1;
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: .035 }, uVig: { value: .42 }, uWarm: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVig, uWarm; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(.2126, .7152, .0722));
      // тени чуть в тёплый коричневый, света в янтарь — единый тон заведения
      vec3 sh = vec3(.045, .022, .018), hi = vec3(1.03, .985, .93);
      col = mix(col + sh * (1. - smoothstep(0., .35, l)) * uWarm, col * hi, smoothstep(.45, 1., l) * uWarm);
      // мягкая S-кривая
      col = mix(col, col * col * (3. - 2. * col), .22);
      // виньетка
      vec2 q = vUv - .5; q.x *= uRes.x / uRes.y;
      col *= 1. - uVig * smoothstep(.35, 1.05, length(q));
      // плёночное зерно, сильнее в тенях
      float g = h(vUv * uRes + fract(uTime * 7.31) * 113.) - .5;
      col += g * uGrain * (1.15 - l);
      gl_FragColor = vec4(col, c.a);
    }`
};
const postRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: POST.tier === 2 ? 4 : 0 });
const composer = new EffectComposer(renderer, postRT);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bokeh = new BokehPass(scene, camera, { focus: 3, aperture: 0, maxblur: .007 });
bokeh.enabled = false;
composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .3, .5, .86);
bloom.enabled = POST.tier >= 1;
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass(GRADE);
composer.addPass(grade);
POST.composer = composer; POST.bloom = bloom; POST.bokeh = bokeh; POST.grade = grade;
POST.setSize = () => {
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  // свечение считаем в половинном разрешении: мягче и дешевле
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  grade.uniforms.uRes.value.set(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
};
/* глубина резкости: фокус на точке; null — выключить (плавно) */
POST.focus = (p, aperture = .0018) => {
  if (!p || POST.tier < 2) { POST.apWant = 0; return; }
  POST.target = p; POST.apWant = aperture;
};
const _pf = new THREE.Vector3();
POST.render = (dt = .016) => {
  POST.t += dt;
  grade.uniforms.uTime.value = reduceMotion.matches ? 0 : POST.t;
  grade.uniforms.uGrain.value = POST.tier === 2 && SET.effects && !SET.saver ? .035 : .018;
  if (POST.tier === 0) { renderer.render(scene, camera); return; }
  // плавное появление и уход размытия
  POST.ap += (POST.apWant - POST.ap) * Math.min(1, dt * 3);
  if (POST.target) {
    camera.getWorldDirection(_pf);
    const want = Math.max(.15, _pf.dot(POST.target.clone().sub(camera.position)));
    POST.focusD += (want - POST.focusD) * Math.min(1, dt * 5);
  }
  bokeh.enabled = POST.ap > .00005;
  bokeh.uniforms.focus.value = POST.focusD;
  bokeh.uniforms.aperture.value = POST.ap;
  composer.render(dt);
};
/* если тормозит: сначала уходит глубина резкости, потом сглаживание и свечение */
POST.degrade = () => {
  POST.drops++;
  if (POST.tier === 2) { POST.tier = 1; postRT.samples = 0; POST.apWant = 0; return true; }
  if (POST.tier === 1 && bloom.enabled) { bloom.enabled = false; return true; }
  if (POST.tier === 1) { POST.tier = 0; return true; }
  return false;
};

/* ================= текстуры: всё рисуется в браузере, без чужих картинок ================= */
function canvasTex(w, h, draw, { color = true, repeat = null } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = ANISO;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}
function speckle(g, w, h, n, alpha, light = "#fff", dark = "#000") {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = R(0, alpha);
    g.fillStyle = rng() < .5 ? light : dark;
    const s = R(1, 3);
    g.fillRect(rng() * w, rng() * h, s, s);
  }
  g.globalAlpha = 1;
}
/* волокна дерева: волнистые линии, повторяются по горизонтали без шва */
function grain(g, x, y, w, h, dark, light, n) {
  for (let i = 0; i < n; i++) {
    const yy = y + rng() * h, amp = R(1, h / 14), f = Math.ceil(R(.5, 3)), ph = R(0, 6.3);
    g.globalAlpha = R(.06, .3);
    g.strokeStyle = rng() < .65 ? dark : light;
    g.lineWidth = R(.6, 2.6);
    g.beginPath();
    for (let xx = 0; xx <= w; xx += 6) {
      const v = yy + Math.sin(xx / w * Math.PI * 2 * f + ph) * amp;
      xx ? g.lineTo(x + xx, v) : g.moveTo(x, v);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}
function woodTex(base, dark, light) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    grain(g, 0, 0, w, h, dark, light, 140);
    speckle(g, w, h, 900, .08);
  });
}
const TEX = {};
TEX.walnut = woodTex("#4a2a18", "#1a0b05", "#7a4a2a");
TEX.darkwood = woodTex("#2a170d", "#0c0503", "#5a3520");
TEX.oak = woodTex("#6a4426", "#2a170a", "#9a6a3e");

/* паркет: доски разной длины и оттенка */
TEX.floor = canvasTex(1024, 1024, (g, w, h) => {
  const rows = 8, rh = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -R(0, 400);
    while (x < w) {
      const len = R(260, 620), l = R(20, 34), hue = R(16, 26);
      g.fillStyle = `hsl(${hue} 45% ${l * .55}%)`;
      g.fillRect(x, r * rh, len, rh);
      g.save(); g.beginPath(); g.rect(x, r * rh, len, rh); g.clip();
      grain(g, x, r * rh, len, rh, "#0a0402", "#8a5a34", 26);
      g.restore();
      g.fillStyle = "rgba(0,0,0,.75)";
      g.fillRect(x, r * rh, 3, rh);
      x += len;
    }
    g.fillStyle = "rgba(0,0,0,.8)";
    g.fillRect(0, r * rh, w, 3);
  }
  speckle(g, w, h, 3000, .06);
}, { repeat: [7, 5] });

/* обои с дамасским узором */
function damask(base, ink, hi) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1400, .05);
    const motif = (cx, cy, s) => {
      g.save(); g.translate(cx, cy); g.scale(s, s);
      for (const m of [1, -1]) {
        g.save(); g.scale(m, 1);
        g.fillStyle = ink;
        g.beginPath();
        g.moveTo(0, -70); g.bezierCurveTo(34, -58, 46, -22, 16, -4);
        g.bezierCurveTo(46, 4, 52, 36, 22, 50); g.bezierCurveTo(10, 56, 4, 62, 0, 74); g.closePath(); g.fill();
        g.fillStyle = base;
        g.beginPath(); g.moveTo(0, -46); g.bezierCurveTo(18, -38, 22, -18, 6, -8); g.bezierCurveTo(22, 4, 26, 26, 8, 34); g.lineTo(0, 46); g.closePath(); g.fill();
        g.fillStyle = ink;
        g.beginPath(); g.ellipse(34, -34, 7, 15, -.6, 0, 7); g.fill();
        g.beginPath(); g.ellipse(38, 30, 6, 12, .6, 0, 7); g.fill();
        g.restore();
      }
      g.fillStyle = hi;
      g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill();
      g.restore();
    };
    motif(128, 128, .9);
    for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256]]) motif(x, y, .9);
  });
}
TEX.wallBar = damask("#3a0d14", "#4f141d", "#6a2028");
TEX.wallNook = damask("#132119", "#1c3024", "#2a4232");
TEX.wallSmoke = damask("#2a1410", "#3a1c15", "#523022");

/* кожа и бархат */
TEX.leather = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#d4d4d4"; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 5000, .12);
  // стёжка честерфилда: ромбы с пуговицами
  g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 3;
  for (let i = -1; i < 3; i++) {
    g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128 + 128, 128); g.lineTo(i * 128, 256); g.stroke();
    g.beginPath(); g.moveTo(i * 128 + 128, 0); g.lineTo(i * 128, 128); g.lineTo(i * 128 + 128, 256); g.stroke();
  }
  g.fillStyle = "rgba(0,0,0,.6)";
  for (const [x, y] of [[0, 0], [128, 128], [256, 0], [0, 256], [256, 256], [128, 0], [0, 128], [256, 128], [128, 256]]) {
    if ((x + y) % 256 !== 0 && !(x === 128 && y === 128)) continue;
    g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
  }
});
TEX.velvet = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = "#d8d8d8"; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 3000, .1);
});

/* персидский ковёр */
function rugTex(base, border, accent, gold) {
  return canvasTex(512, 768, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const band = (m, c, wd) => { g.strokeStyle = c; g.lineWidth = wd; g.strokeRect(m, m, w - 2 * m, h - 2 * m); };
    band(18, border, 34); band(40, gold, 4); band(58, accent, 10); band(74, gold, 3);
    // мотивы на кайме
    g.fillStyle = gold;
    for (let x = 30; x < w - 20; x += 26) { g.beginPath(); g.arc(x, 18, 5, 0, 7); g.arc(x, h - 18, 5, 0, 7); g.fill(); }
    for (let y = 30; y < h - 20; y += 26) { g.beginPath(); g.arc(18, y, 5, 0, 7); g.arc(w - 18, y, 5, 0, 7); g.fill(); }
    // медальон
    g.save(); g.translate(w / 2, h / 2);
    for (const [s, c] of [[1, border], [.78, gold], [.7, accent], [.45, gold], [.38, base], [.2, border]]) {
      g.fillStyle = c; g.beginPath();
      g.moveTo(0, -200 * s); g.lineTo(130 * s, 0); g.lineTo(0, 200 * s); g.lineTo(-130 * s, 0); g.closePath(); g.fill();
    }
    g.restore();
    // мелкий узор поля
    g.fillStyle = accent; g.globalAlpha = .5;
    for (let y = 110; y < h - 100; y += 44) for (let x = 110; x < w - 100; x += 44) {
      if (Math.abs(x - w / 2) / 130 + Math.abs(y - h / 2) / 200 < 1.1) continue;
      g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 8, y); g.lineTo(x, y + 8); g.lineTo(x - 8, y); g.fill();
    }
    g.globalAlpha = 1;
    speckle(g, w, h, 9000, .14);
  });
}
TEX.rugRed = rugTex("#5a1016", "#1d1b3a", "#8a2a1e", "#c49a52");
TEX.rugGreen = rugTex("#1b3326", "#3a1012", "#2f5a3c", "#b8924c");

/* мягкое свечение для спрайтов */
TEX.glow = canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.25, "rgba(255,255,255,.45)");
  r.addColorStop(.6, "rgba(255,255,255,.1)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
TEX.puff = canvasTex(128, 128, (g, w, h) => {
  for (let i = 0; i < 18; i++) {
    const x = 64 + R(-22, 22), y = 64 + R(-22, 22), rr = R(18, 40);
    const r = g.createRadialGradient(x, y, 0, x, y, rr);
    r.addColorStop(0, "rgba(255,255,255,.18)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }
});
const glowSprite = (color, size, x, y, z, parent = world, op = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color, transparent: true, opacity: op,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  s.scale.set(size, size, 1);
  s.position.set(x, y, z);
  parent.add(s);
  return s;
};

/* корешки книг: светлая основа, её окрашивает цвет каждой книги */
TEX.spine = canvasTex(64, 256, (g, w, h) => {
  g.fillStyle = "#d8d8d8"; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 600, .15);
  g.fillStyle = "rgba(0,0,0,.45)";
  g.fillRect(0, 22, w, 10); g.fillRect(0, h - 40, w, 10);
  g.fillStyle = "rgba(255,240,200,.9)";
  g.fillRect(0, 34, w, 3); g.fillRect(0, 18, w, 2); g.fillRect(0, h - 28, w, 3);
  g.fillRect(w * .3, 80, w * .4, 60);
  g.fillStyle = "rgba(0,0,0,.25)";
  g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
});

/* картина над камином: ночная гавань маслом */
TEX.painting = canvasTex(512, 384, (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h * .6);
  sky.addColorStop(0, "#0d1428"); sky.addColorStop(1, "#3a2a3a");
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const moon = g.createRadialGradient(360, 90, 4, 360, 90, 120);
  moon.addColorStop(0, "rgba(255,236,190,1)"); moon.addColorStop(.12, "rgba(255,220,160,.8)"); moon.addColorStop(1, "rgba(255,200,140,0)");
  g.fillStyle = moon; g.fillRect(0, 0, w, h);
  const sea = g.createLinearGradient(0, h * .6, 0, h);
  sea.addColorStop(0, "#1a1a2a"); sea.addColorStop(1, "#05070d");
  g.fillStyle = sea; g.fillRect(0, h * .6, w, h * .4);
  g.strokeStyle = "rgba(255,220,160,.5)";
  for (let i = 0; i < 40; i++) { const y = h * .62 + i * 3.4, x = 360 + R(-30, 30); g.lineWidth = R(1, 2.5); g.beginPath(); g.moveTo(x - R(10, 40), y); g.lineTo(x + R(10, 40), y); g.stroke(); }
  g.fillStyle = "#06070b";
  g.beginPath(); g.moveTo(90, h * .6); g.lineTo(230, h * .6); g.lineTo(212, h * .66); g.lineTo(104, h * .66); g.fill();
  g.fillRect(150, h * .2, 4, h * .4); g.fillRect(120, h * .3, 3, h * .3);
  g.beginPath(); g.moveTo(154, h * .22); g.lineTo(210, h * .55); g.lineTo(154, h * .55); g.fill();
  g.fillStyle = "#ffcc7a"; g.fillRect(180, h * .62, 3, 3);
  g.fillStyle = "#07080c"; g.beginPath(); g.moveTo(0, h * .6); g.lineTo(0, h * .48); g.lineTo(40, h * .52); g.lineTo(70, h * .45); g.lineTo(80, h * .6); g.fill();
  // мазки
  for (let i = 0; i < 2200; i++) { g.globalAlpha = R(0, .07); g.fillStyle = rng() < .5 ? "#fff" : "#000"; g.fillRect(rng() * w, rng() * h, R(2, 9), R(1, 3)); }
  g.globalAlpha = 1;
  const vg = g.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, w * .7);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.6)");
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
});

/* циферблат */
TEX.clock = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#efe2c4"; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
  g.strokeStyle = "#3a2410"; g.lineWidth = 4; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
  g.fillStyle = "#2a1a10"; g.font = "28px Forum, Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
  const rom = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  rom.forEach((t, i) => { const a = i / 12 * Math.PI * 2; g.fillText(t, 128 + Math.sin(a) * 88, 128 - Math.cos(a) * 88); });
});

/* глобус: старинная карта сепией */
TEX.globe = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = "#b8a072"; g.fillRect(0, 0, w, h);
  const blobs = [[80, 70, 60, 40], [120, 160, 40, 60], [250, 80, 70, 40], [270, 150, 40, 50], [380, 80, 90, 45], [420, 170, 40, 25], [300, 220, 120, 14]];
  g.fillStyle = "#6e5432";
  for (const [x, y, rx, ry] of blobs) for (let k = 0; k < 26; k++) {
    g.beginPath(); g.ellipse(x + R(-rx, rx) * .7, y + R(-ry, ry) * .7, R(rx * .2, rx * .5), R(ry * .2, ry * .5), R(0, 3), 0, 7); g.fill();
  }
  g.strokeStyle = "rgba(60,40,20,.45)"; g.lineWidth = 1;
  for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo(i * w / 12, 0); g.lineTo(i * w / 12, h); g.stroke(); }
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, i * h / 6); g.lineTo(w, i * h / 6); g.stroke(); }
  speckle(g, w, h, 4000, .12);
});

/* бумага с рукописными строками */
function paperTex(lines = 14, title = "") {
  return canvasTex(256, 340, (g, w, h) => {
    g.fillStyle = "#ece0c2"; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1600, .08);
    if (title) { g.fillStyle = "#4a1a12"; g.font = "30px Forum, Georgia, serif"; g.textAlign = "center"; g.fillText(title, w / 2, 52); }
    g.strokeStyle = "rgba(40,24,16,.55)"; g.lineWidth = 1.6;
    for (let i = 0; i < lines; i++) {
      const y = (title ? 90 : 40) + i * 18; let x = 26;
      g.beginPath(); g.moveTo(x, y);
      while (x < w - 30 - (i % 5 === 4 ? 80 : 0)) { x += R(4, 9); g.lineTo(x, y + R(-2, 2)); }
      g.stroke();
    }
  });
}
TEX.letter = paperTex(15);
TEX.page = paperTex(13);
TEX.news = canvasTex(256, 320, (g, w, h) => {
  g.fillStyle = "#d9d1bc"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#1a1612"; g.font = "bold 26px Georgia, serif"; g.textAlign = "center"; g.fillText("THE DAILY", w / 2, 36);
  g.fillRect(16, 46, w - 32, 2);
  g.font = "bold 16px Georgia, serif"; g.fillText("PROHIBITION ENDS", w / 2, 70);
  g.fillStyle = "rgba(20,16,12,.55)";
  for (let c = 0; c < 3; c++) for (let i = 0; i < 16; i++) g.fillRect(16 + c * 78, 86 + i * 13, 70 - (i % 6 === 5 ? 30 : 0), 4);
});

/* ================= набор движка: материалы, свет, бутылки и бокалы =================
   Общее для всех заведений. Залы конкретного бара (src/venues/<id>/rooms) строятся из этих деталей. */
const M = {
  floor: std({ map: TEX.floor, roughness: .38, envMapIntensity: .8 }),
  walnut: std({ map: TEX.walnut, roughness: .45, envMapIntensity: .6 }),
  walnutGloss: std({ map: TEX.walnut, roughness: .2, envMapIntensity: 1.1 }),
  darkwood: std({ map: TEX.darkwood, roughness: .55, envMapIntensity: .5 }),
  oak: std({ map: TEX.oak, roughness: .5 }),
  panel: lam({ map: TEX.darkwood }),
  ceiling: lam({ color: 0x1a0f0a }),
  beam: lam({ map: TEX.darkwood, color: 0x8a7a70 }),
  brass: std({ color: 0xc9944a, metalness: 1, roughness: .28, envMapIntensity: 1.4 }),
  brassDark: std({ color: 0x8a6430, metalness: 1, roughness: .4 }),
  chrome: std({ color: 0xd8dde2, metalness: 1, roughness: .16, envMapIntensity: 1.6 }),
  black: std({ color: 0x0b0908, roughness: .6 }),
  iron: std({ color: 0x1a1816, metalness: .7, roughness: .5 }),
  leatherRed: std({ map: TEX.leather, color: 0x5a1a14, roughness: .45, envMapIntensity: .7 }),
  leatherBrown: std({ map: TEX.leather, color: 0x4a2414, roughness: .5, envMapIntensity: .6 }),
  velvetGreen: std({ map: TEX.velvet, color: 0x1f3a2a, roughness: .9 }),
  velvetRed: std({ map: TEX.velvet, color: 0x4a0e18, roughness: .9 }),
  marble: std({ color: 0x1b1816, roughness: .22, envMapIntensity: .9 }),
  stone: std({ color: 0x24201c, roughness: .8 }),
  paper: std({ map: TEX.page, roughness: .9 }),
  candle: std({ color: 0xefe3c8, roughness: .6, emissive: 0x3a2410, emissiveIntensity: .6 })
};

/* ---------- свет ---------- */
const hemi = new THREE.HemisphereLight(0x8a4a3a, 0x1a0c08, 1.6);
scene.add(hemi);
const LIGHTS = {};
function point(name, color, intensity, dist, x, y, z) {
  const l = new THREE.PointLight(color, intensity, dist, 2);
  l.position.set(x, y, z);
  world.add(l);
  LIGHTS[name] = l;
  l.userData.base = intensity;
  return l;
}

/* профили бутылок в сантиметрах: [радиус, высота]; крышка отдельно */
const BOTTLE = {
  bordeaux: { p: [[0, 0], [3.5, 0], [3.75, .6], [3.75, 20], [3.5, 22.5], [2.5, 25], [1.45, 26.6], [1.3, 28], [1.3, 30.4]], cap: [1.45, 2.6], seg: 24 },
  squat:    { p: [[0, 0], [5.1, 0], [5.4, .6], [5.4, 12.5], [5, 15], [3.4, 17.2], [1.8, 18.6], [1.5, 20], [1.5, 21.6]], cap: [2, 2.8], seg: 24 },
  tall:     { p: [[0, 0], [3.3, 0], [3.55, .6], [3.55, 22], [3.2, 24], [1.8, 25.6], [1.4, 27], [1.4, 30.6]], cap: [1.6, 2.4], seg: 24 },
  flask:    { p: [[0, 0], [4.3, 0], [4.6, .6], [4.6, 16.5], [4.2, 19], [2.4, 21.2], [1.5, 22.6], [1.5, 25.8]], cap: [1.8, 2.6], seg: 24 },
  square:   { p: [[0, 0], [5.4, 0], [5.6, .6], [5.6, 18.5], [4.8, 20.6], [1.9, 22.2], [1.5, 22.8], [1.5, 25.6]], cap: [1.8, 2.6], seg: 4 },
  round:    { p: [[0, 0], [3.6, 0], [4.1, 1.2], [4.5, 6], [4.5, 13], [4.1, 17], [2.9, 19.4], [1.6, 20.8], [1.4, 21.8], [1.4, 25.4]], cap: [1.7, 2.4], seg: 24 }
};
const bodyR = s => Math.max(...BOTTLE[s].p.map(q => q[0])) / 100;
const neckTop = s => BOTTLE[s].p[BOTTLE[s].p.length - 1][1] / 100;
const BGEO = {};
for (const k in BOTTLE) {
  const b = BOTTLE[k];
  const g = lathe(b.p.map(([r, y]) => [r / 100, y / 100]).concat([[0, b.p[b.p.length - 1][1] / 100]]), b.seg);
  if (b.seg === 4) g.rotateY(Math.PI / 4);
  BGEO[k] = g;
  const lo = lathe(b.p.map(([r, y]) => [r / 100, y / 100]).concat([[0, b.p[b.p.length - 1][1] / 100]]), b.seg > 4 ? 10 : 4);
  if (b.seg === 4) lo.rotateY(Math.PI / 4);
  BGEO[k + "Lo"] = lo;
}

/* ---------- посуда для коктейлей ---------- */
const CUPS = {
  highball: { p: [[0, 0], [3, 0], [3.1, .5], [3.3, 14.5]], liq: [2.9, 3.15, .6, 13.2] },
  rocks:    { p: [[0, 0], [4, 0], [4.1, .8], [4.4, 9]], liq: [3.85, 4.2, .9, 7.4] },
  shot:     { p: [[0, 0], [2.1, 0], [2.2, .8], [2.6, 6.2]], liq: [2.05, 2.45, .9, 5.2] },
  coupe:    { p: [[0, 0], [3.5, 0], [3.5, .3], [.6, .8], [.4, 7.6], [1.6, 8.4], [4.4, 9.8], [5.4, 11.8]], liq: [.8, 5, 8.2, 11] },
  martini:  { p: [[0, 0], [3.5, 0], [3.5, .3], [.6, .8], [.4, 8], [.7, 8.4], [6, 14]], liq: [.7, 5.4, 8.5, 13.2] },
  wine:     { p: [[0, 0], [3.5, 0], [3.5, .3], [.6, .8], [.4, 8], [2.4, 9.4], [4, 12.8], [3.7, 18.2]], liq: [2.2, 3.9, 9.4, 13] },
  snifter:  { p: [[0, 0], [3.5, 0], [3.5, .3], [.6, .8], [.4, 4], [3, 5.4], [4.9, 8.6], [4.5, 12.4], [3.4, 13.8]], liq: [3, 4.9, 5.5, 8.6] }
};
const glassMat = std({ color: 0xeef4ff, transparent: true, opacity: .2, roughness: .02, envMapIntensity: 2.5, side: THREE.DoubleSide, depthWrite: false });
KEEP.add(glassMat); Object.values(M).forEach(m => KEEP.add(m)); Object.values(BGEO).forEach(g => KEEP.add(g));
function makeGlass(cup, color, { garnish = null, ice = false, op = .85 } = {}) {
  const c = CUPS[cup] || CUPS.rocks, gr = new THREE.Group();
  const g = mesh(lathe(c.p.map(([r, y]) => [r / 100, y / 100]), 28), glassMat, 0, 0, 0, gr);
  g.renderOrder = 5;
  const [r0, r1, y0, y1] = c.liq.map(v => v / 100);
  const liq = mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 24), std({ color, transparent: true, opacity: op, roughness: .15, emissive: new THREE.Color(color), emissiveIntensity: .25 }), 0, (y0 + y1) / 2, 0, gr);
  liq.renderOrder = 4;
  gr.userData.liq = { mesh: liq, y0, y1 };
  if (ice) for (let i = 0; i < 2; i++) {
    const cube = mesh(new RoundedBoxGeometry(.028, .028, .028, 2, .006), std({ color: 0xffffff, transparent: true, opacity: .35, roughness: .05 }), R(-.012, .012), y1 - .016 - i * .02, R(-.012, .012), gr);
    cube.rotation.set(R(0, 1), R(0, 1), 0);
    cube.renderOrder = 5;
  }
  if (garnish) {
    const col = { flame: 0xf08a22, wheel: 0x9fc23a, wedge: 0x9fc23a, lemon: 0xf2d24a, orange: 0xf08a22, mint: 0x3f8f3a, cherry: 0x9a0f1e, pineapple: 0xf2c84a, olive: 0x7a8a2a }[garnish] || 0x9fc23a;
    const topR = c.p[c.p.length - 1][0] / 100, topY = c.p[c.p.length - 1][1] / 100;
    if (garnish === "cherry" || garnish === "olive") mesh(new THREE.SphereGeometry(.012, 12, 8), std({ color: col, roughness: .3 }), 0, y1 - .004, 0, gr);
    else if (garnish === "mint") for (let i = 0; i < 3; i++) { const l = mesh(new THREE.SphereGeometry(.016, 8, 6), std({ color: col }), R(-.01, .01), topY + .01, R(-.01, .01), gr); l.scale.set(1, .35, .6); l.rotation.set(R(0, 1), R(0, 3), 0); }
    else { const w = mesh(new THREE.CylinderGeometry(.024, .024, .005, 18), std({ color: col, roughness: .5 }), topR - .01, topY - .012, 0, gr); w.rotation.z = Math.PI / 2.4; }
  }
  return gr;
}

/* ---------- затемнение экрана (закрытие смены, вход, погреб) ---------- */
const fadeEl = document.getElementById("fade");
function fade(on, dur = .6) {
  fadeEl.style.transitionDuration = (STILL ? 0 : dur) + "s";
  fadeEl.classList.toggle("on", on);
  return sleep(STILL ? 0 : dur);
}

/* ================= камерный зал: одна комната с барной стойкой =================
   Шаблон для настоящего заведения без улицы, читальни, курилки, сцены и погреба.
   Стойка — та же, что у Hacheden (use.txt → 30-bar.js); стены сдвинуты к стойке, свет — тот же набор
   источников (движок и прогрев шейдеров рассчитаны на него), но без «чужих» залов. */
const ROOM = { x0: -4.2, x1: 4.2, z0: -5, z1: 6, h: 3.6 };

/* пол */
const floorGeo = new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0);
const floor = mesh(floorGeo, M.floor, 0, 0, (ROOM.z0 + ROOM.z1) / 2);
floor.rotation.x = -Math.PI / 2;

/* стены: одни обои на весь зал (движок спрашивает W.nook / W.bar / W.smoke — пусть все три будут) */
const W = { bar: lam({ map: TEX.wallBar }) };
W.nook = W.smoke = W.bar;
const WALL_UV = .62;
box(ROOM.x0, ROOM.x1, 0, ROOM.h, -5.1, -5, W.bar, world, WALL_UV);
box(ROOM.x0 - .1, ROOM.x0, 0, ROOM.h, -5, 6, W.bar, world, WALL_UV);
box(ROOM.x1, ROOM.x1 + .1, 0, ROOM.h, -5, 6, W.bar, world, WALL_UV);
box(ROOM.x0, -.62, 0, ROOM.h, 6, 6.1, W.bar, world, WALL_UV);
box(.62, ROOM.x1, 0, ROOM.h, 6, 6.1, W.bar, world, WALL_UV);
box(-.62, .62, 2.42, ROOM.h, 6, 6.1, W.bar, world, WALL_UV);

/* деревянные панели снизу стен, плинтус и карниз */
(() => {
  const geos = [], rails = [];
  const run = (ax, a0, a1, fixed, side, h = 1.02) => {
    const t0 = fixed, t1 = fixed + side * .035;
    const B = (u0, u1, y0, y1, d0, d1) => ax === "x"
      ? boxAt(u0, u1, y0, y1, Math.min(d0, d1), Math.max(d0, d1), .8)
      : boxAt(Math.min(d0, d1), Math.max(d0, d1), y0, y1, u0, u1, .8);
    geos.push(B(a0, a1, 0, h, t0, t1));
    rails.push(B(a0, a1, h - .02, h + .05, t0, fixed + side * .065));
    rails.push(B(a0, a1, 0, .16, t0, fixed + side * .055));
    rails.push(B(a0, a1, ROOM.h - .14, ROOM.h, t0, fixed + side * .08));
    const n = Math.max(1, Math.round((a1 - a0) / .78)), pw = (a1 - a0) / n;
    for (let i = 0; i < n; i++) rails.push(B(a0 + i * pw + .09, a0 + (i + 1) * pw - .09, .26, h - .14, t1, fixed + side * .05));
  };
  run("x", ROOM.x0, ROOM.x1, -5, 1);
  run("z", -5, 6, ROOM.x0, 1); run("z", -5, 6, ROOM.x1, -1);
  run("x", ROOM.x0, -.75, 6, -1); run("x", .75, ROOM.x1, 6, -1);
  merged(geos, M.panel);
  merged(rails, M.darkwood);
})();

/* потолок с балками */
box(ROOM.x0, ROOM.x1, ROOM.h, ROOM.h + .1, -5, 6, M.ceiling, world, 0);
(() => {
  const geos = [];
  for (let x = -3; x <= 3; x += 2) geos.push(boxAt(x - .12, x + .12, ROOM.h - .26, ROOM.h, -5, 6, .8));
  geos.push(boxAt(ROOM.x0, ROOM.x1, ROOM.h - .2, ROOM.h, -2.5, -2.3, .8));
  merged(geos, M.beam);
})();

/* бра на боковых стенах: латунная чаша и тёплое пятно на обоях */
for (const sx of [-1, 1]) for (const z of [-2.9, .2, 3.2]) {
  const x = sx * (ROOM.x1 - .06);
  mesh(new THREE.CylinderGeometry(.09, .05, .1, 18, 1, true), M.brass, x - sx * .07, 2.25, z);
  mesh(new THREE.SphereGeometry(.035, 10, 8), basic({ color: 0xffe0b0, toneMapped: false }), x - sx * .08, 2.28, z);
  glowSprite(0xffb060, .8, x - sx * .1, 2.3, z, world, .35);
}

/* ---------- свет: тот же набор источников, что у Hacheden (pendL/C/R, red, fire, lamp, window, fill) ---------- */
point("pendL", 0xffb066, 3.4, 6.5, -1.7, 2.45, -2.35);
point("pendC", 0xffb066, 3.2, 6.5, 0, 2.45, -2.35);
point("pendR", 0xffb066, 3.4, 6.5, 1.7, 2.45, -2.35);
point("red", 0xff2238, 5, 5.5, 0, 1.95, -4.3);
point("fire", 0xff9a4a, 1.2, 5, 3.9, 2.3, .2);      // у бра справа; во время огненного шоу его берёт бармен
point("lamp", 0xffbe70, 1.2, 5, -3.9, 2.3, .2);     // у бра слева
point("window", 0x6f8cff, 0, 4, 0, 2.4, 5.6);       // окна нет — источник есть, но тёмный
point("fill", 0xffa070, 16, 10, 0, 2.5, .2);
const FILL_AT = [V3(0, 2.5, .2), V3(0, 2.5, .2), V3(0, 2.5, .2), V3(0, 2.5, .2), V3(0, 2.5, .2)];
/* наличник входной двери изнутри */
box(-.76, -.62, 0, 2.56, 5.94, 6.0, M.walnut, world, .8);
box(.62, .76, 0, 2.56, 5.94, 6.0, M.walnut, world, .8);
box(-.76, .76, 2.42, 2.56, 5.94, 6.0, M.walnut, world, .8);

/* ================= БАР: задняя стенка с бутылками, стойка, табуреты, лампы ================= */

/* ---------- задняя стенка бара ---------- */
const BB = { x0: -3.3, x1: 3.3, z0: -4.98, z1: -4.42, top: 1.04, shelves: [1.44, 1.9, 2.36], cor: 2.8 };
box(BB.x0, BB.x1, 0, 1.0, BB.z0, BB.z1, M.walnut, world, .8);
box(BB.x0 - .03, BB.x1 + .03, 1.0, BB.top, BB.z0, BB.z1 + .04, M.marble, world, 0);
box(BB.x0, BB.x1, 0, .08, BB.z0, BB.z1 + .01, M.black, world, 0);
(() => {
  // дверцы шкафа
  const geos = [];
  for (let i = 0; i < 6; i++) {
    const x0 = BB.x0 + .06 + i * 1.08, x1 = x0 + 1.0;
    geos.push(boxAt(x0, x1, .16, .94, BB.z1, BB.z1 + .02, .8));
    geos.push(boxAt(x0 + .08, x1 - .08, .26, .84, BB.z1 + .02, BB.z1 + .035, .8));
  }
  merged(geos, M.darkwood);
  const knobs = [];
  for (let i = 0; i < 6; i++) { const k = new THREE.SphereGeometry(.018, 10, 8); k.translate(BB.x0 + .06 + i * 1.08 + (i % 2 ? .1 : .9), .55, BB.z1 + .05); knobs.push(k); }
  merged(knobs, M.brass);
})();

/* подсветка за бутылками: тёплый красный, как в баре на референсе */
const glowPanelTex = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = "#1a0306"; g.fillRect(0, 0, w, h);
  const yOf = y => h - (y - 1.06) / 1.72 * h;
  for (const [a, b] of [[1.44, 1.9], [1.9, 2.36], [2.36, 2.78], [1.06, 1.44]]) {
    const y0 = yOf(b), y1 = yOf(a);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, "rgba(255,40,60,.05)"); gr.addColorStop(.55, "rgba(255,40,64,.55)"); gr.addColorStop(1, "rgba(255,90,100,1)");
    g.fillStyle = gr; g.fillRect(0, y0, w, y1 - y0);
  }
  const side = g.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, "rgba(0,0,0,.55)"); side.addColorStop(.18, "rgba(0,0,0,0)"); side.addColorStop(.82, "rgba(0,0,0,0)"); side.addColorStop(1, "rgba(0,0,0,.55)");
  g.fillStyle = side; g.fillRect(0, 0, w, h);
});
glowPanelTex.wrapS = glowPanelTex.wrapT = THREE.ClampToEdgeWrapping;
const glowPanelMat = basic({ map: glowPanelTex, color: 0xd8b0b0 });
/* подсветка задней стенки: гаснет в конце смены */
const BACKLIT = { panel: glowPanelMat };
for (const [x0, x1] of [[-3.1, -1.09], [-1.01, 1.01], [1.09, 3.1]]) {
  const p = mesh(new THREE.PlaneGeometry(x1 - x0, 1.72), glowPanelMat, (x0 + x1) / 2, 1.06 + .86, BB.z0 + .01);
}
/* стойки-перегородки, полки, карниз */
(() => {
  const geos = [];
  for (const x of [-3.18, -1.05, 1.05, 3.18]) geos.push(boxAt(x - .045, x + .045, BB.top, BB.cor, BB.z0, BB.z0 + .34, .8));
  geos.push(boxAt(BB.x0 - .05, BB.x1 + .05, BB.cor, BB.cor + .16, BB.z0, BB.z0 + .4, .8));
  geos.push(boxAt(BB.x0 - .08, BB.x1 + .08, BB.cor + .16, BB.cor + .2, BB.z0, BB.z0 + .44, .8));
  merged(geos, M.walnut);
  const sh = [];
  for (const y of BB.shelves) for (const [x0, x1] of [[-3.135, -1.095], [-1.005, 1.005], [1.095, 3.135]]) sh.push(boxAt(x0, x1, y - .03, y, BB.z0, BB.z0 + .3, 0));
  mesh(mergeGeometries(sh.map(g => (g.index ? g.toNonIndexed() : g))), std({ color: 0x2a1a14, roughness: .15, metalness: .3, envMapIntensity: 1.2 }));
  // светодиодные ленты под полками
  const led = [];
  for (const y of BB.shelves.concat([BB.cor])) for (const [x0, x1] of [[-3.135, -1.095], [-1.005, 1.005], [1.095, 3.135]]) led.push(boxAt(x0, x1, y - .042, y - .03, BB.z0 + .26, BB.z0 + .29, 0));
  BACKLIT.led = mesh(mergeGeometries(led.map(g => (g.index ? g.toNonIndexed() : g))), basic({ color: 0xff5a70, toneMapped: false })).material;
})();

/* неоновая вывеска Hacheden */
const neonTex = canvasTex(1024, 256, (g, w, h) => {
  g.textAlign = "center"; g.textBaseline = "middle";
  fitFont(g, BAR_NAME, w * .86, 150, "Forum, 'Palatino Linotype', Georgia, serif");   // название бара из src/venues
  g.lineJoin = "round";
  for (const [blur, col, lw, a] of [[60, "#ff1840", 10, .9], [28, "#ff2a55", 8, 1], [10, "#ff7a90", 5, 1]]) {
    g.shadowBlur = blur; g.shadowColor = col; g.strokeStyle = col; g.lineWidth = lw; g.globalAlpha = a;
    g.strokeText(BAR_NAME, w / 2, h / 2 + 8);
  }
  g.shadowBlur = 6; g.shadowColor = "#fff"; g.strokeStyle = "#ffe8ee"; g.lineWidth = 2.2; g.globalAlpha = 1;
  g.strokeText(BAR_NAME, w / 2, h / 2 + 8);
});
neonTex.wrapS = neonTex.wrapT = THREE.ClampToEdgeWrapping;
const neonMat = basic({ map: neonTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const neon = mesh(new THREE.PlaneGeometry(2.7, .675), neonMat, 0, 3.24, -4.96);
const neonGlow = glowSprite(0xff2a50, 4.2, 0, 3.24, -4.9, world, .35);
neonGlow.scale.set(4.4, 1.5, 1);
// держатели вывески
for (const x of [-1.1, 1.1]) mesh(new THREE.CylinderGeometry(.008, .008, .06, 6), M.chrome, x, 3.24, -4.97).rotation.x = Math.PI / 2;

/* ---------- бутылки: шесть главных и много декоративных ---------- */
function labelTex(d) {
  return canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = d.labelBg; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 500, .08);
    g.strokeStyle = d.labelInk; g.globalAlpha = .7; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
    g.lineWidth = 1; g.strokeRect(17, 17, w - 34, h - 34); g.globalAlpha = 1;
    g.fillStyle = d.labelInk; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "44px Forum, Georgia, serif";
    g.fillText(d.name.toUpperCase(), w / 2, h / 2 - 6);
    fitFont(g, BAR_SIGN, w - 44, 18, "Literata, Georgia, serif");
    g.globalAlpha = .75; g.fillText(BAR_SIGN, w / 2, h / 2 + 34);
  });
}
const HERO_X = [-2.55, -1.6, -.5, .5, 1.6, 2.55];
const HERO_Y = BB.shelves[0], HERO_Z = BB.z0 + .15;
const heroes = {};
DRINKS.forEach((d, i) => {
  const shape = d.shape, r = bodyR(shape), top = neckTop(shape);
  const root = group(HERO_X[i], HERO_Y, HERO_Z);
  root.scale.setScalar(1.28);
  const glassMat = std({ color: d.glass, transparent: true, opacity: Math.min(.92, .4 + d.glassOp * .5), roughness: .05, metalness: .1, envMapIntensity: 2.2 });
  const glass = mesh(BGEO[shape], glassMat, 0, 0, 0, root);
  glass.renderOrder = 2;
  // жидкость внутри
  const bodyTop = Math.max(...BOTTLE[shape].p.filter(q => q[0] >= r * 92).map(q => q[1])) / 100;
  const lvl = bodyTop * clamp(d.level / 70, .45, .95);
  const liq = mesh(new THREE.CylinderGeometry(r * .88, r * .88, lvl, BOTTLE[shape].seg > 4 ? 18 : 4, 1), std({ color: d.liquid, transparent: true, opacity: .85, roughness: .2, emissive: new THREE.Color(d.liquid), emissiveIntensity: .35 }), 0, lvl / 2 + .006, 0, root);
  if (BOTTLE[shape].seg === 4) liq.rotation.y = Math.PI / 4;
  liq.renderOrder = 1;
  liq.userData.noHit = true;
  // крышка
  const [cr, ch] = BOTTLE[shape].cap;
  mesh(new THREE.CylinderGeometry(cr / 100, cr / 100, ch / 100, 14), std({ color: d.cap, roughness: .4, metalness: .5 }), 0, top + ch / 200, 0, root);
  // этикетка
  const lab = BOTTLE[shape].seg === 4
    ? new THREE.PlaneGeometry(r * 1.25, .09)
    : new THREE.CylinderGeometry(r * 1.01, r * 1.01, .085, 20, 1, true, -1.05, 2.1);
  const label = mesh(lab, std({ map: labelTex(d), roughness: .7 }), 0, .095, BOTTLE[shape].seg === 4 ? r * .72 : 0, root);
  label.renderOrder = 3;
  // тёплый ореол: главные бутылки видно издалека
  const halo = glowSprite(0xffb070, .62, 0, .17, -.1, root, .3);
  box(HERO_X[i] - .07, HERO_X[i] + .07, HERO_Y - .028, HERO_Y - .005, BB.z0 + .3, BB.z0 + .305, M.brass, world, 0);
  halo.userData.noHit = true;
  heroes[d.id] = { root, d, halo, home: root.position.clone() };
  hot(root, 1, d.name, () => H3D.bottle(d.id), { lift: .03, grow: .06 });
});

/* декоративные бутылки: инстансами, чтобы не тормозило на телефоне */
(() => {
  const PAL = ["#16210f", "#2a1308", "#4a2108", "#1c1a10", "#0e1a16", "#3a1a0a", "#22301c", "#56300e", "#1a0c08"];
  const CAPS = ["#c9944a", "#1a1210", "#6a1a1a", "#d8dde2", "#2a1a10"];
  const items = Object.fromEntries(Object.keys(BOTTLE).map(k => [k, []]));
  const caps = [];
  const fill = (y, x0, x1, zRow, free = []) => {
    let x = x0 + R(0, .03);
    while (x < x1 - .05) {
      const shape = pickOne(Object.keys(BOTTLE)), s = R(.82, 1.04), r = bodyR(shape) * s;
      if (x + 2 * r > x1) break;
      const cx = x + r;
      if (!free.some(f => Math.abs(cx - f) < .16)) {
        items[shape].push({ x: cx, y, z: zRow + R(-.02, .02), s, ry: R(0, 6.3), c: pickOne(PAL) });
        const [cr, ch] = BOTTLE[shape].cap;
        caps.push({ x: cx, y: y + neckTop(shape) * s, z: zRow, r: cr / 100 * s, h: ch / 100 * s, c: pickOne(CAPS) });
      }
      x += 2 * r + R(.012, .04);
    }
  };
  const bays = [[-3.12, -1.1], [-1.0, 1.0], [1.1, 3.12]];
  for (const [x0, x1] of bays) {
    fill(BB.shelves[0], x0, x1, BB.z0 + .08, HERO_X);
    fill(BB.shelves[1], x0, x1, BB.z0 + .15);
    fill(BB.shelves[1], x0 + .05, x1, BB.z0 + .06);
    fill(BB.shelves[2], x0, x1, BB.z0 + .15);
    fill(BB.shelves[2], x0 + .04, x1, BB.z0 + .06);
  }
  fill(BB.top, -3.2, -2.3, BB.z0 + .12);
  fill(BB.top, 2.35, 3.2, BB.z0 + .12);
  const mat = std({ roughness: .12, metalness: .15, envMapIntensity: 1.6 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  for (const k in items) {
    const list = items[k];
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(BGEO[k + "Lo"], mat, list.length);
    list.forEach((b, i) => {
      q.setFromEuler(e.set(0, b.ry, 0));
      m4.compose(V3(b.x, b.y, b.z), q, V3(b.s, b.s, b.s));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, col.set(b.c));
    });
    world.add(im);
  }
  const cg = new THREE.CylinderGeometry(1, 1, 1, 8);
  const ci = new THREE.InstancedMesh(cg, std({ roughness: .4, metalness: .6 }), caps.length);
  caps.forEach((c, i) => {
    m4.compose(V3(c.x, c.y + c.h / 2, c.z), q.identity(), V3(c.r, c.h, c.r));
    ci.setMatrixAt(i, m4); ci.setColorAt(i, col.set(c.c));
  });
  world.add(ci);
})();

/* ---------- стойка ---------- */
const CT = { x0: -3.3, x1: 3.3, z0: -2.8, z1: -2.0, top: 1.12 };
box(CT.x0, CT.x1, 1.06, CT.top, CT.z0, CT.z1, M.walnutGloss, world, 1.2);
mesh(new THREE.CylinderGeometry(.035, .035, CT.x1 - CT.x0, 16), M.walnutGloss, 0, 1.085, CT.z1).rotation.z = Math.PI / 2;
box(CT.x0 + .05, CT.x1 - .05, .1, 1.06, CT.z0 + .05, CT.z1 - .06, M.darkwood, world, .8);
box(CT.x0 + .05, CT.x1 - .05, 0, .1, CT.z0 + .1, CT.z1 - .1, M.black, world, 0);
(() => {
  // каннелюры: вертикальные полуколонны по фасаду
  const geos = [];
  const n = Math.floor((CT.x1 - CT.x0 - .2) / .065);
  for (let i = 0; i < n; i++) {
    const g = new THREE.CylinderGeometry(.028, .028, .9, 8, 1, false, -Math.PI / 2, Math.PI);
    g.translate(CT.x0 + .13 + i * .065, .56, CT.z1 - .065);
    geos.push(g);
  }
  merged(geos, M.walnut);
  // латунная подножка на кронштейнах
  const bar = new THREE.CylinderGeometry(.024, .024, CT.x1 - CT.x0 - .2, 14);
  bar.rotateZ(Math.PI / 2); bar.translate(0, .24, CT.z1 + .1);
  const parts = [bar];
  for (let x = CT.x0 + .3; x <= CT.x1 - .3; x += 1.05) {
    const b = new THREE.CylinderGeometry(.012, .012, .16, 8); b.rotateX(Math.PI / 2); b.translate(x, .24, CT.z1 + .03); parts.push(b);
  }
  merged(parts, M.brass);
})();
// тёплый отсвет ленты на фасаде стойки
const washTex = canvasTex(8, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, "rgba(255,170,100,.55)"); gr.addColorStop(.25, "rgba(255,120,70,.16)"); gr.addColorStop(1, "rgba(255,90,60,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
washTex.wrapS = washTex.wrapT = THREE.ClampToEdgeWrapping;
mesh(new THREE.PlaneGeometry(CT.x1 - CT.x0 - .2, .95), basic({ map: washTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 0, .56, CT.z1 - .02).userData.noHit = true;
// тёплая лента под столешницей
mesh(new THREE.BoxGeometry(CT.x1 - CT.x0 - .1, .012, .012), basic({ color: 0xffa860, toneMapped: false }), 0, 1.045, CT.z1 - .07);
// рабочая поверхность бармена с обратной стороны
box(CT.x0 + .05, CT.x1 - .05, .9, .94, CT.z0 - .32, CT.z0 + .05, M.chrome, world, 0);

/* ---------- табуреты ---------- */
(() => {
  const leather = [], metal = [];
  for (const x of [-2.5, -1.25, 0, 1.25, 2.5]) {
    const z = -1.5;
    const seat = new THREE.CylinderGeometry(.21, .19, .09, 22); seat.translate(x, .79, z); leather.push(seat);
    const top = new THREE.SphereGeometry(.21, 22, 6, 0, Math.PI * 2, 0, Math.PI / 2); top.scale(1, .2, 1); top.translate(x, .835, z); leather.push(top);
    const pole = new THREE.CylinderGeometry(.03, .035, .74, 12); pole.translate(x, .4, z); metal.push(pole);
    const base = new THREE.CylinderGeometry(.2, .23, .03, 22); base.translate(x, .015, z); metal.push(base);
    const ring = new THREE.TorusGeometry(.17, .012, 8, 24); ring.rotateX(Math.PI / 2); ring.translate(x, .3, z); metal.push(ring);
    const cup = new THREE.CylinderGeometry(.12, .06, .06, 16); cup.translate(x, .73, z); metal.push(cup);
  }
  merged(leather, M.leatherRed);
  merged(metal, M.brass);
})();

/* ---------- подвесные лампы и световые конусы ---------- */
const coneMat = new THREE.ShaderMaterial({
  uniforms: { uOp: { value: .16 }, uCol: { value: new THREE.Color(0xffb070) } },
  vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
    void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uOp; uniform vec3 uCol; varying float vY; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(clamp(abs(dot(normalize(vN), normalize(vV))), .0001, 1.), 2.2); float a = clamp(uOp * f * pow(clamp(vY, .0001, 1.), 1.6), 0., 1.); gl_FragColor = vec4(uCol * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
});
const pendants = [];
for (const x of [-1.7, 1.7]) {
  const z = -2.4;
  mesh(new THREE.CylinderGeometry(.006, .006, ROOM.h - 2.78, 6), M.black, x, (ROOM.h + 2.78) / 2, z);
  const shade = mesh(lathe([[.02, .2], [.06, .19], [.14, .12], [.19, .02], [.2, 0]], 28), M.brass, x, 2.6, z);
  shade.material = std({ color: 0x6a4420, metalness: .85, roughness: .32, envMapIntensity: 1.2 });
  const inner = mesh(lathe([[.195, .002], [.14, .115], [.06, .185], [.02, .195]], 28), basic({ color: 0x8a5a30, side: THREE.BackSide }), x, 2.6, z);
  const bulb = mesh(new THREE.SphereGeometry(.05, 16, 10), basic({ color: 0xfff0d0, toneMapped: false }), x, 2.62, z);
  const cone = mesh(new THREE.CylinderGeometry(.17, .85, 1.45, 28, 1, true), coneMat, x, 2.6 - .73, z);
  cone.userData.noHit = true;
  const glow = glowSprite(0xffc080, .6, x, 2.56, z, world, .4);
  pendants.push({ x, z, cone, bulb, glow });
}

/* стеклянная полка с бокалами над задней частью стойки */
const stemGeo = lathe([[0, 0], [.036, 0], [.036, .003], [.005, .008], [.004, .08], [.024, .095], [.04, .13], [.037, .18], [.036, .183]], 16);
stemGeo.rotateX(Math.PI);
(() => {
  const rails = [];
  for (const [x0, x1] of [[-3.0, -1.3], [1.3, 3.0]]) {
    for (const z of [-3.05, -3.3]) {
      const g = new THREE.CylinderGeometry(.01, .01, x1 - x0, 8); g.rotateZ(Math.PI / 2); g.translate((x0 + x1) / 2, 2.86, z); rails.push(g);
    }
    for (const x of [x0 + .05, x1 - .05]) { const g = new THREE.CylinderGeometry(.006, .006, ROOM.h - 2.86, 6); g.translate(x, (ROOM.h + 2.86) / 2, -3.17); rails.push(g); }
  }
  merged(rails, M.brass);
  const pos = [];
  for (const [x0, x1] of [[-2.95, -1.35], [1.35, 2.95]]) for (const z of [-3.05, -3.3]) for (let x = x0; x <= x1; x += .14) pos.push([x, 2.86, z]);
  const im = new THREE.InstancedMesh(stemGeo, std({ color: 0xf0f4ff, transparent: true, opacity: .22, roughness: .03, envMapIntensity: 2.5, side: THREE.DoubleSide, depthWrite: false }), pos.length);
  const m4 = new THREE.Matrix4();
  pos.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m4); });
  im.renderOrder = 4;
  world.add(im);
})();

/* на стойке: свечи, лаймы, шейкер, карта коктейлей */
const STATIC_TOOLS = [];
(() => {
  for (const x of [-2.95, 2.95]) {
    mesh(new THREE.CylinderGeometry(.04, .036, .08, 16), std({ color: 0x7a1a20, transparent: true, opacity: .55, roughness: .1 }), x, CT.top + .04, -2.25);
    mesh(new THREE.SphereGeometry(.01, 8, 6), basic({ color: 0xffd080, toneMapped: false }), x, CT.top + .07, -2.25);
    glowSprite(0xffa050, .35, x, CT.top + .08, -2.25, world, .7);
  }
  // миска с лаймами
  const bowlX = -1.25;
  mesh(lathe([[0, 0], [.05, 0], [.09, .02], [.11, .06], [.112, .062]], 24), M.chrome, bowlX, CT.top, -2.45);
  const limeMat = std({ color: 0x7aa02a, roughness: .55 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; mesh(new THREE.SphereGeometry(.03, 12, 10), limeMat, bowlX + Math.cos(a) * .05, CT.top + .055 + (i % 2) * .01, -2.45 + Math.sin(a) * .05).scale.set(1, .85, .85); }
  // шейкер и джиггер у рабочего места
  const tin = mesh(lathe([[0, 0], [.04, 0], [.045, .16], [.046, .17]], 20), M.chrome, 1.05, CT.top, -2.55);
  const jig = mesh(lathe([[.018, 0], [.024, .002], [.01, .045], [.024, .09]], 16), M.chrome, 1.17, CT.top, -2.5);
  STATIC_TOOLS.push(tin, jig);
  const mat = box(.75, 1.4, CT.top, CT.top + .006, -2.68, -2.3, std({ color: 0x141012, roughness: .9 }), world, 0);
  // меню на подставке: открывает барную карту
  const menu = group(-.35, CT.top, -2.15);
  mesh(new THREE.BoxGeometry(.2, .26, .012), std({ color: 0x3a0e16, roughness: .6 }), 0, .13, 0, menu).rotation.x = -.25;
  const face = mesh(new THREE.PlaneGeometry(.17, .22), std({ map: paperTex(8, "Меню"), roughness: .9 }), 0, .132, .0075, menu);
  face.rotation.x = -.25;
  mesh(new THREE.BoxGeometry(.12, .01, .06), M.brass, 0, .005, -.02, menu);
  hot(menu, 1, "Барная карта", () => openMix(), { grow: .1 });
})();

/* ================= подача: готовый коктейль встаёт на стойку перед гостем =================
   От залов заведения нужна стойка CT (top); от движка — makeGlass, SEAT, SEAT_X, BT. */
let servedGlass = null, servedV = null;
function placeServed(c) {
  abortSip();
  servedV = null;
  if (servedGlass) drop(servedGlass);
  servedGlass = makeGlass(c.cup, c.pour, { garnish: c.garnish, ice: c.cup === "rocks" || c.cup === "highball", op: c.pourOp || .88 });
  // сидящему гостю — прямо перед ним
  if (SEAT.on) servedGlass.position.set(SEAT_X + .08, CT.top, -2.12);
  else servedGlass.position.set(clamp(BT.x - .25, -2.6, 2.6), CT.top, -2.25);
  world.add(servedGlass);
  servedGlass.scale.setScalar(.001);
  tween(servedGlass.scale, { x: 1.35, y: 1.35, z: 1.35 }, .5, ease.out);
}

/* ================= люди: фигуры с суставами, руки и ноги сами тянутся к точкам (IK) ================= */
const FIGS = [];
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _a = V3(), _b = V3(), _xa = V3(), _ya = V3(), _za = V3(), _w0 = V3();
const smoothK = (k, dt) => 1 - Math.exp(-k * dt);

function taper(r0, r1, len, seg = 14) { const g = new THREE.CylinderGeometry(r0, r1, len, seg, 1); g.translate(0, -len / 2, 0); return g; }
const sph = (r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 16, hs = 12) => { const g = new THREE.SphereGeometry(r, ws, hs); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
const rbox = (w, h, d, x, y, z, r = .01) => { const g = new RoundedBoxGeometry(w, h, d, 2, r); g.translate(x, y, z); return g; };

/* ---------- одежда: рисуем на развёртке торса ---------- */
const CLOTH = {};
function torsoTex(o) {
  const key = JSON.stringify(o);
  if (CLOTH[key]) return CLOTH[key];
  const t = canvasTex(512, 512, (g, w, h) => {
    const Y = v => h - v * h, U = u => u * w;
    const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([u, v], i) => i ? g.lineTo(U(u), Y(v)) : g.moveTo(U(u), Y(v))); g.closePath(); g.fill(); };
    const dot = (u, v, r, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(U(u), Y(v), r * .55, r, 0, 0, 7); g.fill(); };
    g.fillStyle = o.shirt || "#e6dfd0"; g.fillRect(0, 0, w, h);
    if (o.kind === "vest") {
      g.fillStyle = o.body; g.fillRect(0, Y(.88), w, h);
      // спинка жилета атласная
      g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(0, Y(.86), U(.18), h); g.fillRect(U(.82), Y(.86), U(.18), h);
      g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(U(.02), Y(.3)); g.lineTo(U(.98), Y(.3)); g.stroke();
      // проймы
      for (const u of [.25, .75]) { g.fillStyle = o.shirt; g.beginPath(); g.ellipse(U(u), Y(.86), U(.05), h * .12, 0, 0, 7); g.fill(); }
      // вырез: белая рубашка
      poly([[.5 - .08, .92], [.5 + .08, .92], [.5, .42]], o.shirt);
      g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(U(.42), Y(.92)); g.lineTo(U(.5), Y(.42)); g.lineTo(U(.58), Y(.92)); g.stroke();
      for (let i = 0; i < 5; i++) dot(.5, .38 - i * .072, 6, "#c9944a");
      g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(U(.36), Y(.24), 34, 4); g.fillRect(U(.6), Y(.24), 34, 4); g.fillRect(U(.6), Y(.56), 30, 4);
      // цепочка карманных часов
      g.strokeStyle = "#d8aa5a"; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(U(.5), Y(.24)); g.quadraticCurveTo(U(.56), Y(.15), U(.62), Y(.235)); g.stroke();
      for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(${rng() < .5 ? "255,255,255" : "0,0,0"},.05)`; g.fillRect(rng() * w, Y(.88) + rng() * h * .88, 1, 3); }
    } else if (o.kind === "suit") {
      g.fillStyle = o.body; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 10) { g.fillStyle = "rgba(255,255,255,.035)"; g.fillRect(x, 0, 1, h); }
      poly([[.5 - .14, .95], [.5 + .14, .95], [.5 + .02, .3], [.5 - .02, .3]], o.lapel || "rgba(0,0,0,.4)");
      poly([[.5 - .085, .95], [.5 + .085, .95], [.5, .36]], o.shirt);
      poly([[.5 - .014, .9], [.5 + .014, .9], [.5 + .02, .44], [.5, .38], [.5 - .02, .44]], o.tie || "#6a0f1e");
      g.fillStyle = "#f0ece0"; g.beginPath(); g.moveTo(U(.6), Y(.62)); g.lineTo(U(.64), Y(.62)); g.lineTo(U(.62), Y(.68)); g.fill();
      dot(.5, .26, 6, "#111"); dot(.5, .16, 6, "#111");
    } else if (o.kind === "dress") {
      g.fillStyle = o.body; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { g.fillStyle = rng() < .5 ? "rgba(255,220,150,.35)" : "rgba(0,0,0,.25)"; g.fillRect(rng() * w, rng() * h, 2, 2); }
      poly([[.5 - .07, .95], [.5 + .07, .95], [.5, .72]], o.skin);
      g.fillStyle = o.skin; g.fillRect(0, Y(1), w, h * .07);
      for (let i = 0; i <= 26; i++) { const k = i / 26, u = .43 + k * .14, v = .9 - Math.sin(k * Math.PI) * .38; dot(u, v, 5, "#f4eee2"); }
      g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, Y(.12), w, 10);
    } else {
      // вязаный кардиган
      g.fillStyle = o.body; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 6) { g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(x, 0, 2, h); }
      poly([[.5 - .07, .95], [.5 + .07, .95], [.5, .5]], o.shirt);
      for (let i = 0; i < 5; i++) dot(.5, .45 - i * .08, 5, "#3a2a1a");
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return (CLOTH[key] = t);
}

/* ---------- кисть с пальцами: ладонь, четыре пальца по три фаланги, большой палец из двух ---------- */
const NAIL = std({ color: 0xe8c2b0, roughness: .3 });
const FINGER_MAX = [1.35, 1.55, 1.05];
function buildHand(side, hand, mSkin) {
  // ладонь: чуть сужается к запястью, с подушечкой у большого пальца
  const palmG = new RoundedBoxGeometry(.078, .084, .026, 3, .011);
  const pp = palmG.attributes.position;
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); pp.setX(i, pp.getX(i) * (1 - Math.max(0, y) * 2.2)); }
  palmG.computeVertexNormals();
  palmG.translate(0, -.044, 0);
  merged([palmG, sph(.019, side * .022, -.03, .009, 1, 1.35, .75, 12, 10), sph(.021, 0, -.004, -.002, 1.6, .7, .8, 12, 8)], mSkin, hand);
  const spec = [[side * .027, .95, .06], [side * .009, 1, .0], [-side * .009, .95, -.05], [-side * .026, .78, -.11]];
  const fingers = spec.map(([x, len, spread]) => {
    const segs = [];
    let parent = group(x, -.084, 0, hand);
    parent.rotation.z = spread * side * .5;
    const root = parent;
    [.043, .027, .022].forEach((L0, i) => {
      const L = L0 * len, r = [.0088, .0081, .0074][i] * (len < .9 ? .92 : 1);
      const seg = i === 0 ? root : group(0, 0, 0, parent);
      const cap = new THREE.CapsuleGeometry(r, Math.max(.001, L - r * 1.2), 3, 8);
      cap.translate(0, -L / 2, 0);
      const parts = [cap];
      merged(parts, mSkin, seg);
      if (i === 2) mesh(new RoundedBoxGeometry(r * 1.5, L * .5, .002, 1, .0009), NAIL, 0, -L * .62, -r * .86, seg);
      segs.push(seg);
      parent = group(0, -L, 0, seg);
      seg.userData.next = parent;
    });
    // фаланги вкладываются: каждая следующая — в конце предыдущей
    for (let i = 1; i < 3; i++) segs[i - 1].userData.next.add(segs[i]);
    return segs;
  });
  // большой палец
  const tRoot = group(side * .03, -.018, .01, hand);
  const t1 = group(0, 0, 0, tRoot);
  merged([(() => { const c = new THREE.CapsuleGeometry(.0105, .022, 3, 8); c.translate(0, -.016, 0); return c; })()], mSkin, t1);
  const t2 = group(0, -.032, 0, t1);
  merged([(() => { const c = new THREE.CapsuleGeometry(.0095, .016, 3, 8); c.translate(0, -.013, 0); return c; })()], mSkin, t2);
  mesh(new RoundedBoxGeometry(.013, .011, .002, 1, .0009), NAIL, 0, -.02, -.0085, t2);
  return { fingers, thumb: [tRoot, t1, t2], fc: [.25, .25, .25, .25], ft: [.25, .25, .25, .25], tc: .2, tt: .2, ts: .3, tst: .3 };
}
/* позы кисти: насколько согнуты пальцы и куда смотрит большой */
function handPose(arm, name, r = .03) {
  if (!arm.fingers) { arm.curlT = { open: .05, flat: 0, relax: .3, pinch: .8, fist: 1, point: .8 }[name] ?? clamp(.09 / r / 4.1, .25, 1); return; }
  let f, t, s;
  switch (name) {
    case "flat": f = [.02, .02, .02, .04]; t = 0; s = 0; break;
    case "open": f = [.1, .12, .15, .2]; t = .1; s = .1; break;
    case "relax": f = [.28, .32, .38, .45]; t = .25; s = .3; break;
    case "pinch": f = [.48, .62, .78, .85]; t = .75; s = .9; break;
    case "hook": f = [.55, .6, .65, .7]; t = .2; s = .2; break;
    case "fist": f = [1, 1, 1, 1]; t = .7; s = .8; break;
    case "point": f = [.05, .9, .95, .95]; t = .6; s = .7; break;
    default: { const c = clamp(.088 / r / 4, .22, 1); f = [c, c * 1.04, c * 1.08, c * 1.12].map(v => Math.min(1, v)); t = clamp(c * .9, .3, .85); s = .75; }
  }
  arm.ft = f; arm.tt = t; arm.tst = s;
}
function poseFingers(arm, dt) {
  if (!arm.manual) { const c = arm.curl; arm.ft = [c * .95, c, c * 1.05, Math.min(1, c * 1.12)]; arm.tt = c * .6; arm.tst = .3 + c * .4; }
  const k = smoothK(arm.manual ? 16 : 30, dt);
  for (let i = 0; i < 4; i++) {
    arm.fc[i] += (arm.ft[i] - arm.fc[i]) * k;
    const segs = arm.fingers[i];
    for (let j = 0; j < 3; j++) segs[j].rotation.x = -arm.fc[i] * FINGER_MAX[j];
  }
  arm.tc += (arm.tt - arm.tc) * k;
  arm.ts += (arm.tst - arm.ts) * k;
  const [root, t1, t2] = arm.thumb, sd = arm.side;
  // от «в сторону» к «напротив ладони»
  root.rotation.set(-arm.ts * .9, sd * arm.ts * .5, sd * (.85 - arm.ts * .55));
  t1.rotation.x = -arm.tc * .5;
  t2.rotation.x = -arm.tc * .95;
}

/* профиль торса: от пояса (0) до основания шеи */
const TORSO_PROFILE = [[0, -.03], [.14, -.03], [.142, .02], [.146, .07], [.152, .12], [.16, .17], [.168, .22], [.174, .27], [.178, .32], [.179, .37], [.176, .41], [.166, .445], [.14, .47], [.095, .49], [.058, .505], [0, .51]];

function makeFigure(o) {
  const P = Object.assign({
    kind: "suit", body: "#2a2420", shirt: "#e6dfd0", trousers: 0x1c1a18, skin: 0xc48c6a, hair: 0x1a110b, hairStyle: "short",
    shoes: 0x0c0908, mustache: false, bowtie: null, rolled: false, hat: null, lady: false, scale: 1, seated: false
  }, o);
  const mSkin = std({ color: P.skin, roughness: .6 });
  const mHair = std({ color: P.hair, roughness: P.hairStyle === "slick" ? .35 : .8 });
  const mTr = std({ color: P.trousers, roughness: .8 });
  const mShoe = std({ color: P.shoes, roughness: .3, envMapIntensity: .8 });
  const mTorso = std({ map: torsoTex({ kind: P.kind, body: P.body, shirt: P.shirt, skin: "#" + new THREE.Color(P.skin).getHexString(), tie: P.tie }), roughness: .75 });
  const sleeveCol = P.kind === "vest" ? P.shirt : P.body;
  const mSleeve = std({ color: sleeveCol, roughness: .8 });
  const mWhite = std({ color: P.shirt, roughness: .8 });

  const root = new THREE.Group();
  root.scale.setScalar(P.scale);
  const pelvis = group(0, P.hipY || (P.seated ? .5 : .96), 0, root);
  const spine = group(0, .02, 0, pelvis);

  // торс с одеждой
  const torso = new THREE.Mesh(new THREE.LatheGeometry(TORSO_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 28, Math.PI, Math.PI * 2), mTorso);
  torso.scale.set(1.12, 1, .7);
  spine.add(torso);
  // бёдра в брюках или юбке
  const hipG = lathe([[0, .0], [.152, .0], [.158, -.06], [.15, -.13], [0, -.14]], 22);
  hipG.scale(1.08, 1, .78);
  mesh(hipG, P.lady ? std({ color: new THREE.Color(P.body), roughness: .6 }) : mTr, 0, 0, 0, pelvis);
  // шея, голова
  const neckParts = [taper(.045, .05, .08)]; neckParts[0].translate(0, .565, 0);
  if (P.bowtie || P.kind !== "dress") { const col = new THREE.TorusGeometry(.055, .014, 6, 18); col.rotateX(Math.PI / 2); col.scale(1, 1, .9); col.translate(0, .5, .005); mesh(col, mWhite, 0, 0, 0, spine); }
  merged(neckParts, mSkin, spine);
  if (P.bowtie) {
    const bm = std({ color: P.bowtie, roughness: .45 });
    const parts = [];
    for (const s of [-1, 1]) { const c = new THREE.ConeGeometry(.024, .045, 4); c.rotateZ(s * Math.PI / 2); c.rotateY(Math.PI / 4); c.scale(1, 1, .5); c.translate(s * .022, .487, .116); parts.push(c); }
    parts.push(sph(.01, 0, .487, .122));
    merged(parts, bm, spine);
  }
  const head = group(0, .535, 0, spine);
  const skin = [sph(.1, 0, .11, 0, .88, 1.07, .98, 24, 18), sph(.078, 0, .055, .022, .86, .72, .9), sph(.016, 0, .1, .095, .62, .9, 1.15, 10, 8)];
  for (const s of [-1, 1]) skin.push(sph(.022, s * .086, .1, -.005, .45, 1, .75, 10, 8));
  merged(skin, mSkin, head);
  // глаза: белки, зрачки; моргают
  const eyes = group(0, .118, .078, head);
  const ew = [], ei = [];
  for (const s of [-1, 1]) { ew.push(sph(.0105, s * .033, 0, -.002, 1, .7, .5, 10, 8)); ei.push(sph(.0068, s * .033, 0, .004, 1, 1, .5, 8, 6)); }
  merged(ew, std({ color: 0xece4d8, roughness: .3 }), eyes);
  merged(ei, std({ color: 0x1a120c, roughness: .2 }), eyes);
  // брови, волосы, усы
  const hair = [];
  for (const s of [-1, 1]) { const b = rbox(.03, .007, .01, s * .034, .143, .088, .003); b.rotateZ ? 0 : 0; hair.push(b); }
  if (P.hairStyle === "bob") {
    hair.push(sph(.116, 0, .125, -.008, .95, 1, 1.02, 24, 14));
    const band = new THREE.CylinderGeometry(.112, .118, .1, 24, 1, true, Math.PI * .3, Math.PI * 1.4); band.translate(0, .085, -.006); hair.push(band);
    hair.push(rbox(.15, .03, .03, 0, .175, .085, .012));
  } else {
    const cap = new THREE.SphereGeometry(.1, 28, 14, 0, Math.PI * 2, 0, Math.PI * .56); cap.rotateX(-.72); cap.scale(.93, 1.11, 1.05); cap.translate(0, .112, -.008); hair.push(cap);
    for (const s of [-1, 1]) hair.push(rbox(.012, .04, .02, s * .084, .098, .03, .004));
  }
  if (P.mustache) {
    const curve = new THREE.CatmullRomCurve3([V3(-.056, .082, .07), V3(-.042, .066, .088), V3(-.018, .066, .1), V3(0, .07, .102), V3(.018, .066, .1), V3(.042, .066, .088), V3(.056, .082, .07)]);
    hair.push(new THREE.TubeGeometry(curve, 20, .0055, 6));
  }
  merged(hair, mHair, head);
  if (P.lady) mesh(new THREE.BoxGeometry(.026, .006, .006), std({ color: 0x9a1a2a }), 0, .045, .093, head);
  else mesh(new THREE.BoxGeometry(.026, .004, .006), std({ color: 0x5a2a20 }), 0, .045, .093, head);
  if (P.hat) {
    const hm = std({ color: P.hat, roughness: .7 });
    merged([(() => { const g = new THREE.CylinderGeometry(.17, .17, .012, 28); g.translate(0, .2, 0); return g; })(), (() => { const g = new THREE.CylinderGeometry(.092, .106, .1, 24); g.translate(0, .25, 0); return g; })()], hm, head);
    mesh(new THREE.CylinderGeometry(.107, .107, .022, 24), std({ color: 0x3a0e16 }), 0, .215, 0, head);
  }

  // руки
  const LA = .285, LB = .26;
  const arm = side => {
    const S = V3(side * .2, .425, -.005);
    const up = group(S.x, S.y, S.z, spine);
    const slim = !!P.fingers;
    merged([sph(slim ? .046 : .05, 0, -.01, 0), taper(slim ? .046 : .05, slim ? .039 : .043, LA)], mSleeve, up);
    if (P.garter) { const gt = new THREE.TorusGeometry(slim ? .044 : .047, .007, 6, 20); gt.rotateX(Math.PI / 2); gt.translate(0, -.11, 0); merged([gt], std({ color: P.garter, roughness: .4, metalness: .2 }), up); }
    const fo = group(0, -LA, 0, up);
    const fp = [sph(slim ? .038 : .045, 0, 0, 0), taper(slim ? .036 : .044, slim ? .025 : .034, LB)];
    if (P.rolled) {
      merged(fp, mSkin, fo);
      const cuff = new THREE.TorusGeometry(slim ? .043 : .05, slim ? .016 : .02, 8, 18); cuff.rotateX(Math.PI / 2); cuff.translate(0, slim ? -.005 : .01, 0);
      const cuff2 = new THREE.TorusGeometry(slim ? .04 : .046, .012, 8, 18); cuff2.rotateX(Math.PI / 2); cuff2.translate(0, slim ? -.03 : -.015, 0);
      merged(slim ? [cuff, cuff2] : [cuff], mWhite, fo);
    } else {
      merged(fp, mSleeve, fo);
      const cuff = slim ? taper(.029, .028, .03) : taper(.037, .036, .03); cuff.translate(0, -LB + .02, 0);
      merged([cuff], mWhite, fo);
    }
    const hand = group(0, -LB, 0, fo);
    if (P.fingers) return Object.assign(buildHand(side, hand, mSkin), { S, up, fo, hand, side, tgt: V3(), cur: V3(), ori: { f: V3(0, -1, 0), p: V3(0, 0, 1) }, curl: .2, curlT: .2, pole: V3(side * .45, -1, -.35), k: 9, set: false });
    const palm = [rbox(.062, .072, .026, 0, -.038, 0, .012)];
    const th = new THREE.CapsuleGeometry(.0115, .035, 3, 8); th.rotateZ(side * .7); th.translate(side * .038, -.035, .012); palm.push(th);
    merged(palm, mSkin, hand);
    const fing = group(0, -.072, 0, hand);
    merged([rbox(.058, .062, .02, 0, -.028, 0, .0095)], mSkin, fing);
    return { S, up, fo, hand, fing, side, tgt: V3(), cur: V3(), ori: { f: V3(0, -1, 0), p: V3(0, 0, 1) }, curl: .2, curlT: .2, pole: V3(side * .45, -1, -.35), k: 9, set: false };
  };
  const L = arm(1), Rr = arm(-1);
  // ноги
  const TA = .44, TB = .43;
  const leg = side => {
    const H = V3(side * .092, -.07, 0);
    const th = group(H.x, H.y, H.z, pelvis);
    merged([sph(.07, 0, 0, 0), taper(.074, .056, TA)], P.lady ? std({ color: new THREE.Color(P.body), roughness: .6 }) : mTr, th);
    const sh = group(0, -TA, 0, th);
    merged([sph(.054, 0, 0, 0), taper(.052, .04, TB)], P.lady ? std({ color: 0xa87a64, roughness: .5 }) : mTr, sh);
    const ank = group(0, -TB, 0, sh);
    merged([rbox(P.lady ? .065 : .085, .06, P.lady ? .2 : .25, 0, -.04, .055, .025)], mShoe, ank);
    return { H, th, sh, ank, side, tgt: V3(), cur: V3(), world: V3(), from: V3(), to: V3(), stepT: 1, pole: V3(0, 0, 1) };
  };
  const legs = [leg(1), leg(-1)];
  const F = {
    P, root, pelvis, spine, head, eyes, L, R: Rr, legs, LA, LB, TA, TB,
    x: 0, z: 0, face: 0, tx: 0, tz: 0, tface: 0, speed: 0, faceWalk: true,
    lean: .04, twist: 0, sway: 0, leanT: .04, twistT: 0, look: null, lookK: 0, hy: 0, hp: 0,
    blink: R(1, 4), seated: P.seated, hipY: P.hipY || (P.seated ? .5 : .96), bob: 0, breath: R(0, 6), held: [], legsFixed: P.seated
  };
  world.add(root);
  FIGS.push(F);
  return F;
}

/* место и направление фигуры */
function placeFig(F, x, z, face) { F.x = F.tx = x; F.z = F.tz = z; F.face = F.tface = face; F.root.position.set(x, 0, z); F.root.rotation.y = face; for (const lg of F.legs) lg.stepT = 1; F._init = false; }
/* перевод точки из мира в систему фигуры и обратно */
function toFig(F, p, out = V3()) { const c = Math.cos(-F.face), s = Math.sin(-F.face), dx = p.x - F.x, dz = p.z - F.z; return out.set(dx * c + dz * s, p.y - (F.y0 || 0), -dx * s + dz * c); }
function fromFig(F, p, out = V3()) { const c = Math.cos(F.face), s = Math.sin(F.face); return out.set(F.x + p.x * c + p.z * s, p.y + (F.y0 || 0), F.z - p.x * s + p.z * c); }
/* задать цель руке: точка в системе фигуры; f — куда смотрят пальцы, p — куда ладонь */
function reach(arm, x, y, z, f, p, curl) {
  arm.tgt.set(x, y, z);
  if (f) arm.ori.f.copy(f).normalize();
  if (p) arm.ori.p.copy(p).normalize();
  if (curl !== undefined) arm.curlT = curl;
  if (!arm.set) { arm.cur.copy(arm.tgt); arm.set = true; }
}

/* двухзвенная IK: плечо S, цель T, длины a и b, подсказка изгиба pole (всё в одной системе) */
function solve2(S, T, a, b, pole, outE, outT) {
  _a.subVectors(T, S);
  let Ld = _a.length();
  const L = clamp(Ld, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const dir = _a.normalize();
  const cosA = clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1), A = Math.acos(cosA);
  _b.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (_b.lengthSq() < 1e-6) _b.set(0, 0, 1).addScaledVector(dir, -dir.z);
  _b.normalize();
  outE.copy(S).addScaledVector(dir, Math.cos(A) * a).addScaledVector(_b, Math.sin(A) * a);
  outT.copy(S).addScaledVector(dir, L);
}
/* повернуть кость (растёт вдоль -Y) так, чтобы она шла от A к B, а сустав сгибался в сторону C */
function aimBone(bone, A, B, C, bendSign, parentQ) {
  _ya.subVectors(A, B).normalize();
  _za.subVectors(C, B).normalize();
  _za.addScaledVector(_ya, -_za.dot(_ya));
  if (_za.lengthSq() < 1e-6) _za.set(0, 0, 1).addScaledVector(_ya, -_ya.z);
  _za.normalize().multiplyScalar(bendSign);
  _xa.crossVectors(_ya, _za);
  _m1.makeBasis(_xa, _ya, _za);
  _q1.setFromRotationMatrix(_m1);
  if (parentQ) _q1.premultiply(_q2.copy(parentQ).invert());
  bone.quaternion.copy(_q1);
}
const _S = V3(), _T = V3(), _E = V3(), _TT = V3(), _pq = new THREE.Quaternion(), _hq = new THREE.Quaternion();
const _inv = new THREE.Matrix4(), _pole = V3();
function solveArm(F, arm, dt) {
  if (arm.snap) arm.cur.copy(arm.tgt); else arm.cur.lerp(arm.tgt, smoothK(arm.k, dt));
  arm.curl += (arm.curlT - arm.curl) * smoothK(10, dt);
  // цель в системе позвоночника
  F.pelvis.updateMatrix(); F.spine.updateMatrix();
  _m2.multiplyMatrices(F.pelvis.matrix, F.spine.matrix);
  _inv.copy(_m2).invert();
  _T.copy(arm.cur).applyMatrix4(_inv);
  _S.copy(arm.S);
  _pole.copy(arm.pole);
  solve2(_S, _T, F.LA, F.LB, _pole, _E, _TT);
  // плечо: кость от S к E, локоть сгибается вперёд к цели
  aimBone(arm.up, _S, _E, _TT, 1, null);
  // предплечье: шарнир
  _a.subVectors(_E, _S).normalize(); _b.subVectors(_TT, _E).normalize();
  const ang = Math.acos(clamp(_a.dot(_b), -1, 1));
  arm.fo.quaternion.setFromAxisAngle(_xa.set(1, 0, 0), -ang);
  // кисть: пальцы и ладонь в системе фигуры
  _pq.copy(F.pelvis.quaternion).multiply(F.spine.quaternion).multiply(arm.up.quaternion).multiply(arm.fo.quaternion);
  _ya.copy(arm.ori.f).negate();
  _za.copy(arm.ori.p).addScaledVector(_ya, -arm.ori.p.dot(_ya));
  if (_za.lengthSq() < 1e-6) _za.set(0, 0, 1);
  _za.normalize();
  _xa.crossVectors(_ya, _za);
  _m1.makeBasis(_xa, _ya, _za);
  _hq.setFromRotationMatrix(_m1);
  arm.hand.quaternion.copy(_pq.invert().multiply(_hq));
  if (arm.fingers) poseFingers(arm, dt); else arm.fing.rotation.x = -arm.curl * 1.5;
}
function solveLeg(F, lg) {
  F.pelvis.updateMatrix();
  _inv.copy(F.pelvis.matrix).invert();
  _T.copy(lg.cur).applyMatrix4(_inv);
  solve2(lg.H, _T, F.TA, F.TB, _pole.set(lg.side * .15, 0, 1), _E, _TT);
  aimBone(lg.th, lg.H, _E, _TT, -1, null);
  _a.subVectors(_E, lg.H).normalize(); _b.subVectors(_TT, _E).normalize();
  const ang = Math.acos(clamp(_a.dot(_b), -1, 1));
  lg.sh.quaternion.setFromAxisAngle(_xa.set(1, 0, 0), ang);
  // стопа стоит ровно на полу
  _pq.copy(F.pelvis.quaternion).multiply(lg.th.quaternion).multiply(lg.sh.quaternion);
  lg.ank.quaternion.copy(_pq.invert());
}

/* шаги: стопа остаётся на месте, пока тело не уйдёт далеко, потом переставляется дугой */
function stepFeet(F, dt, vx, vz) {
  const homes = F.legs.map(lg => fromFig(F, V3(lg.side * .1, .075, .02)));
  if (!F._init) { F.legs.forEach((lg, i) => { lg.world.copy(homes[i]); lg.stepT = 1; }); F._init = true; }
  const moving = Math.hypot(vx, vz) > .05;
  F.legs.forEach((lg, i) => {
    const other = F.legs[1 - i];
    const lead = V3(vx * .32, 0, vz * .32);
    const want = homes[i].clone().add(lead);
    if (lg.stepT >= 1 && other.stepT >= 1) {
      const d = Math.hypot(lg.world.x - want.x, lg.world.z - want.z);
      const od = Math.hypot(other.world.x - homes[1 - i].x, other.world.z - homes[1 - i].z);
      if (d > (moving ? .16 : .07) && d >= od - .01) { lg.from.copy(lg.world); lg.to.copy(want); lg.stepT = 0; }
    }
    if (lg.stepT < 1) {
      lg.stepT = Math.min(1, lg.stepT + dt / (moving ? .3 : .26));
      const k = ease.sine(lg.stepT);
      lg.world.lerpVectors(lg.from, lg.to, k);
      lg.world.y = .075 + Math.sin(Math.PI * lg.stepT) * .07;
    }
    toFig(F, lg.world, lg.cur);
  });
}

function updateFigure(F, t, dt) {
  // перемещение к цели с разгоном и торможением
  const dx = F.tx - F.x, dz = F.tz - F.z, dist = Math.hypot(dx, dz);
  const want = dist > .02 ? Math.min(F.maxSpeed || .85, dist * 2.4) : 0;
  F.speed += (want - F.speed) * smoothK(5, dt);
  let vx = 0, vz = 0;
  if (dist > .005) { vx = dx / dist * F.speed; vz = dz / dist * F.speed; F.x += vx * dt; F.z += vz * dt; }
  // поворот: при ходьбе лицом по ходу, иначе к заданному направлению
  let faceT = F.tface;
  if (F.faceWalk && F.speed > .25 && dist > .15) faceT = Math.atan2(vx, vz);
  let df = Math.atan2(Math.sin(faceT - F.face), Math.cos(faceT - F.face));
  F.face += df * smoothK(6, dt);
  F.root.position.set(F.x, F.y0 || 0, F.z);
  F.root.rotation.y = F.face;
  // тело: дыхание, наклон, поворот плеч в сторону взгляда
  F.breath += dt;
  F.lean += (F.leanT - F.lean) * smoothK(4, dt);
  F.twist += (F.twistT - F.twist) * smoothK(4, dt);
  const stepping = F.legs.some(l => l.stepT < 1);
  F.bob += ((stepping ? -.018 : 0) - F.bob) * smoothK(10, dt);
  F.pelvis.position.y = F.hipY + F.bob + (F.seated ? 0 : .003 * Math.sin(F.breath * 1.6));
  F.pelvis.rotation.y = F.seated ? 0 : -df * .15;
  F.spine.rotation.set(F.lean + .012 * Math.sin(F.breath * 1.6), F.twist + df * .2, F.sway);
  F.spine.scale.set(1 + .008 * Math.sin(F.breath * 1.6), 1, 1 + .012 * Math.sin(F.breath * 1.6));
  // голова: смотрит на цель (точка в мире) или прямо
  let hy = 0, hp = .05;
  if (F.look) {
    toFig(F, F.look, _w0);
    const hx = _w0.x, hyy = _w0.y - (F.pelvis.position.y + .67) * F.P.scale, hz = _w0.z;
    hy = clamp(Math.atan2(hx, hz) - F.twist, -1.1, 1.1);
    hp = clamp(-Math.atan2(hyy, Math.hypot(hx, hz)), -.6, .7);
  }
  if (F.nod) hp += F.nod;
  F.hy += (hy - F.hy) * smoothK(5, dt);
  F.hp += (hp - F.hp) * smoothK(5, dt);
  F.head.rotation.set(F.hp - F.lean * .6, F.hy * .8, F.tilt || 0);
  F.spine.rotation.y += F.hy * .15;
  // моргание
  F.blink -= dt;
  F.eyes.scale.y = F.blink < .12 ? .12 : 1;
  if (F.blink < 0) F.blink = R(2, 5.5);
  // ноги
  if (!F.legsFixed) stepFeet(F, dt, vx, vz);
  else F.legs.forEach(lg => lg.cur.lerp(lg.tgt, smoothK(6, dt)));
  F.legs.forEach(lg => solveLeg(F, lg));
  // руки
  solveArm(F, F.L, dt);
  solveArm(F, F.R, dt);
  F.root.updateMatrixWorld(true);
  // предметы в руках
  for (const h of F.held) {
    const k = h.k === undefined ? 1 : h.k;
    h.arm.hand.localToWorld(_w0.copy(h.off));
    if (h.woff) _w0.add(h.woff);
    if (k >= 1) h.obj.position.copy(_w0);
    else h.obj.position.lerpVectors(h.from, _w0, k);
    if (h.tilt !== undefined) {
      h.obj.rotation.set(0, F.face + (h.yaw || 0), 0);
      h.obj.rotateX(h.tilt);
      if (h.tiltZ) h.obj.rotateZ(h.tiltZ);
      if (h.roll) h.obj.rotateY(h.roll);
    }
  }
}
const PRE_FIG = [];
function updateFigures(t, dt) { for (const f of PRE_FIG) f(t, dt); for (const F of FIGS) if (!F.off) updateFigure(F, t, dt); }
/* взять предмет: он плавно переходит из своего места в руку */
function grab(F, arm, obj, off, dur = .3) {
  const h = { arm, obj, off: off.clone(), from: obj.position.clone(), k: 0, tilt: 0 };
  F.held.push(h);
  tween(h, { k: 1 }, dur, ease.out);
  return h;
}
function release(F, obj) { F.held = F.held.filter(h => h.obj !== obj); }
/* пальцы смотрят вперёд, ладонь внутрь — обычный хват стакана */
const DIR = { fwd: V3(0, 0, 1), down: V3(0, -1, 0), up: V3(0, 1, 0), in: s => V3(-s, 0, 0), out: s => V3(s, 0, 0), back: V3(0, 0, -1) };

/* ================= звуки движка: общий аудиоконтекст эффектов, треск дров, стук в дверь =================
   Нужны любому бару (улица, облава, шоу бармена), поэтому не в зале курилки. */
let fxCtx = null;
const fx = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  fxCtx = fxCtx || AUDIO.route(new AC(), "ambient");
  fxCtx.resume();
  return fxCtx;
};
function crackle() {
  const c = fx(); if (!c) return;
  const len = c.sampleRate * 1.2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  let env = 0;
  for (let i = 0; i < len; i++) { if (Math.random() < .002) env = .5 + Math.random() * .5; env *= .99; d[i] = (Math.random() * 2 - 1) * env * (1 - i / len); }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = "highpass"; f.frequency.value = 700; g.gain.value = .35;
  s.connect(f).connect(g).connect(c.destination); s.start();
}
function knock() {
  const c = fx(); if (!c) return;
  const t0 = c.currentTime + .05;
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * .3, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + .12);
    g.gain.setValueAtTime(.6, t); g.gain.exponentialRampToValueAtTime(.0001, t + .18);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + .2);
  }
}

/* ================= заглушка курилки: у заведения нет зала с камином =================
   Подставляется сборкой вместо src/venues/<id>/rooms/40-smoke.js, если такого файла нет.
   Даёт движку те же имена, что и настоящая курилка, но пустые: атмосфера, сезоны и праздники
   пропускают камин, кота и гостей у огня; кнопка зала скрыта (FEAT.smoke = false). */
FEAT.smoke = false;
const FIRE = { boost: 1, lvl: 1, on: true, flames: [], candles: [] };
const FP = { x: 0, z: 0 };
const CAT = null;
const haze = [], smoke = [];
/* свет «камина» без камина: после огненного шоу бармена возвращается к своему уровню */
onTick(() => { LIGHTS.fire.intensity = LIGHTS.fire.userData.base * FIRE.boost * FIRE.lvl; });

/* ================= заглушка читальни: у заведения нет зала с книгами и окном =================
   Подставляется сборкой вместо src/venues/<id>/rooms/50-nook.js, если такого файла нет.
   Погода и сезоны пишут в «окно», которого нет, — поэтому у rainMat любые uniforms существуют и молча
   принимают значения. Кнопка зала скрыта (FEAT.nook = false). */
FEAT.nook = false;
const NOOK = { flash: 0, lampMode: 1, candleOn: false, globeSpeed: 0 };
const WIN = { x: 0, sill: 0 };
const SECRET = {};
const rainMat = { uniforms: new Proxy({}, { get: (o, k) => o[k] || (o[k] = { value: 0 }) }) };
function lightning() {}
function toggleCandle() {}

/* ================= сезоны: погода за окном, звук и убранство бара ================= */
const WEATHER = {
  winter: { rain: 0, snow: 1, stars: .3, leaves: 0, frost: 1, storm: false, sound: { rain: 0, wind: .5, crickets: 0, fire: .6 } },
  spring: { rain: .6, snow: 0, stars: 0, leaves: 0, frost: 0, storm: true, sound: { rain: .24, wind: 0, crickets: 0, fire: .45 } },
  summer: { rain: 0, snow: 0, stars: 1, leaves: 0, frost: 0, storm: false, sound: { rain: 0, wind: 0, crickets: .35, fire: 0 } },
  autumn: { rain: 1, snow: 0, stars: 0, leaves: 1, frost: 0, storm: true, sound: { rain: .32, wind: .12, crickets: 0, fire: .5 } }
}[SEASON];
rainMat.uniforms.uRain.value = WEATHER.rain;
rainMat.uniforms.uSnow.value = WEATHER.snow;
rainMat.uniforms.uStars.value = WEATHER.stars;
rainMat.uniforms.uLeaves.value = WEATHER.leaves;
rainMat.uniforms.uFrost.value = WEATHER.frost;
Music.weather(WEATHER.sound);

/* летом камин не топят: в нём стоят свечи */
const SUMMER_FIRE = SEASON === "summer" && FEAT.smoke;
if (SUMMER_FIRE) {
  FIRE.flames.forEach(f => { f.visible = false; });
  FIRE.glow.visible = false;
  FIRE.logMat.emissiveIntensity = 0;
  FIRE.logMat.emissive.setHex(0x000000);
  FIRE.embers.pts.visible = false;
  LIGHTS.fire.userData.base = 1.6;
  LIGHTS.fire.color.setHex(0xffb060);
  for (const [dz, h] of [[-.28, .18], [-.14, .26], [0, .32], [.13, .22], [.27, .16]]) {
    mesh(new THREE.CylinderGeometry(.03, .03, h, 14), M.candle, 7.84, .06 + h / 2, FP.z + dz);
    mesh(new THREE.SphereGeometry(.011, 8, 6), basic({ color: 0xffd890, toneMapped: false }), 7.84, .08 + h, FP.z + dz).scale.set(1, 1.8, 1);
    FIRE.candles.push(glowSprite(0xffa050, .3, 7.84, .08 + h, FP.z + dz, world, .7));
  }
  const fpHot = HOT.find(h => h.userData.hot.label === "Подбросить дров");
  if (fpHot) { fpHot.userData.hot.label = "Свечи в камине"; fpHot.userData.hot.act = () => { FIRE.boost = 1.5; }; }
}
if (SEASON === "winter") LIGHTS.fire.userData.base *= 1.15;

/* ---------- убранство по сезону ---------- */
const SEASONAL = [];
// гирлянда: лампочки провисают дугами между точками
function garland(points, sag = .07, per = .09, colors = [0xffc860, 0xff5a5a, 0x7ad0ff, 0xa0ff8a]) {
  const pos = [];
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k], b = points[k + 1], n = Math.max(2, Math.round(a.distanceTo(b) / per));
    for (let i = 0; i < n; i++) { const t = i / n; pos.push(V3().lerpVectors(a, b, t).add(V3(0, -Math.sin(Math.PI * t) * sag, 0))); }
  }
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(.014, 8, 6), basic({ toneMapped: false }), pos.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  pos.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m4); im.setColorAt(i, col.setHex(colors[i % colors.length])); });
  world.add(im);
  const cord = new THREE.CatmullRomCurve3(pos);
  mesh(new THREE.TubeGeometry(cord, pos.length * 2, .003, 4), std({ color: 0x0e1a0e }), 0, 0, 0);
  SEASONAL.push({ garland: im, n: pos.length, colors });
  return im;
}
if (FESTIVE) {
  // по карнизу бара и по каминной полке
  const pts = [];
  for (let x = -3.3; x <= 3.31; x += .66) pts.push(V3(x, 2.97, BB.z0 + .46));
  garland(pts, .08);
  if (FEAT.smoke) {
    const mp = [];
    for (let z = FP.z - 1.1; z <= FP.z + 1.11; z += .55) mp.push(V3(7.5, 1.3, z));
    garland(mp, .06);
  }
  // ёлка в углу курилки
  const t = group(4.45, 0, -3.55);
  mesh(new THREE.CylinderGeometry(.05, .06, .3, 8), M.darkwood, 0, .15, 0, t);
  mesh(new THREE.CylinderGeometry(.2, .24, .18, 16), std({ color: 0x5a1414, roughness: .6 }), 0, .09, 0, t);
  const pine = std({ color: 0x173a22, roughness: .9 });
  [[.62, .7, .55], [.5, .6, .95], [.38, .5, 1.3], [.24, .4, 1.6]].forEach(([r, h, y]) => mesh(new THREE.ConeGeometry(r, h, 18), pine, 0, y, 0, t));
  const star = mesh(new THREE.OctahedronGeometry(.07), basic({ color: 0xffd060, toneMapped: false }), 0, 1.86, 0, t);
  star.scale.set(1, 1.3, .4);
  glowSprite(0xffd060, .6, 0, 1.86, 0, t, .7);
  const balls = [], m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < 26; i++) {
    const y = R(.4, 1.55), r = (1.75 - y) * .42 + .04, a = R(0, 6.3);
    balls.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(.032, 12, 8), std({ roughness: .15, metalness: .6, envMapIntensity: 1.5 }), balls.length);
  balls.forEach((b, i) => { m4.makeTranslation(...b); bi.setMatrixAt(i, m4); bi.setColorAt(i, col.setHex([0xb01820, 0xd4a040, 0x2050a0, 0xe8e0d0][i % 4])); });
  t.add(bi);
  const lights = [];
  for (let i = 0; i < 40; i++) { const y = .35 + i / 40 * 1.25, r = (1.75 - y) * .44 + .03, a = i * 2.4; lights.push(V3(Math.cos(a) * r, y, Math.sin(a) * r).add(t.position)); }
  const li = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 6, 5), basic({ toneMapped: false }), lights.length);
  lights.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); li.setMatrixAt(i, m4); li.setColorAt(i, col.setHex(0xffc860)); });
  world.add(li);
  SEASONAL.push({ garland: li, n: lights.length, colors: [0xffc860, 0xffe0a0] });
  glowSprite(0xffb050, 1.6, 4.45, 1.0, -3.55, world, .25);
  // подарки
  [[.25, .2, .22, .18, .1, 0xb01820], [-.22, .16, .18, .16, .08, 0x1f4a7a], [.05, .14, .14, .14, .3, 0xd4a040]].forEach(([x, w, h, d, z, c]) => {
    const g = mesh(new THREE.BoxGeometry(w, h, d), std({ color: c, roughness: .5 }), x, h / 2, z, t);
    mesh(new THREE.BoxGeometry(w + .004, h + .004, .025), std({ color: 0xf0e0b0, roughness: .4 }), 0, 0, 0, g);
  });
  hot(t, 2, "Ёлка", () => { for (const s of SEASONAL) s.boost = 1; }, { grow: .02 });
}
if (SEASON === "winter") {
  // кружки с глинтвейном на стойке
  for (const [x, z] of [[-2.3, -2.3], [-2.15, -2.42]]) {
    const g = group(x, CT.top, z);
    mesh(lathe([[0, 0], [.035, 0], [.038, .09], [.04, .1]], 18), std({ color: 0xf0e8dc, roughness: .3 }), 0, 0, 0, g);
    mesh(new THREE.CylinderGeometry(.034, .034, .004, 18), std({ color: 0x5a0a14, roughness: .15, emissive: 0x2a0408 }), 0, .085, 0, g);
    const h = mesh(new THREE.TorusGeometry(.025, .006, 6, 12, Math.PI), std({ color: 0xf0e8dc }), .04, .05, 0, g);
    h.rotation.z = -Math.PI / 2;
  }
}
if (SEASON === "spring") {
  // ваза с цветами на стойке и веточка на столе писателя
  const vase = (x, y, z, s = 1) => {
    const g = group(x, y, z); g.scale.setScalar(s);
    mesh(lathe([[0, 0], [.04, 0], [.05, .06], [.03, .16], [.035, .2]], 18), std({ color: 0xcfe6e0, transparent: true, opacity: .45, roughness: .05 }), 0, 0, 0, g);
    const stem = std({ color: 0x3a6a2a });
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * 6.28, l = R(.22, .34), tilt = R(.12, .3);
      const st = mesh(new THREE.CylinderGeometry(.003, .003, l, 4), stem, Math.cos(a) * tilt * l / 2, .14 + l / 2, Math.sin(a) * tilt * l / 2, g);
      st.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
      const top = V3(Math.cos(a) * tilt * l, .14 + l, Math.sin(a) * tilt * l);
      for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(.018, 8, 6), std({ color: [0xf2b8c8, 0xfff0f4, 0xe890a8][i % 3], roughness: .7 }), top.x + R(-.015, .015), top.y + R(-.015, .015), top.z + R(-.015, .015), g);
    }
  };
  vase(2.35, CT.top, -2.35, 1.1);
  if (FEAT.nook) vase(WIN.x - .65, .785, -4.2, .8);
}
if (SEASON === "summer") {
  // ведёрко со льдом и шампанским, фрукты
  const g = group(-2.35, CT.top, -2.4);
  mesh(lathe([[0, 0], [.09, 0], [.11, .2], [.115, .21]], 24), M.chrome, 0, 0, 0, g);
  const ice = [];
  for (let i = 0; i < 12; i++) { const c = new RoundedBoxGeometry(.03, .03, .03, 1, .006); c.rotateY(R(0, 3)); c.translate(R(-.07, .07), .2 + R(-.01, .01), R(-.07, .07)); ice.push(c); }
  merged(ice, std({ color: 0xe8f4ff, transparent: true, opacity: .5, roughness: .05 }), g);
  const bot = mesh(BGEO.bordeaux, std({ color: 0x1a2a14, roughness: .1, metalness: .2, envMapIntensity: 1.6 }), .01, .05, 0, g);
  bot.rotation.z = .25; bot.scale.setScalar(1.05);
  for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(.032, 12, 10), std({ color: [0xf0a020, 0xf2d24a][i % 2], roughness: .5 }), -1.25 + Math.cos(i * 1.6) * .05, CT.top + .075, -2.45 + Math.sin(i * 1.6) * .05);
}
if (SEASON === "autumn") {
  // тыквы на каминной полке и у камина
  const pumpkin = (x, y, z, s, c = 0xd2701a) => {
    const g = group(x, y, z); g.scale.setScalar(s);
    const m = std({ color: c, roughness: .6 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; const p = mesh(new THREE.SphereGeometry(.06, 14, 10), m, Math.cos(a) * .045, .055, Math.sin(a) * .045, g); p.scale.set(.75, .9, .75); }
    mesh(new THREE.CylinderGeometry(.008, .012, .04, 6), std({ color: 0x4a3a1a }), 0, .12, 0, g).rotation.z = .3;
  };
  if (FEAT.smoke) {
  pumpkin(7.72, 1.32, FP.z - .6, 1);
  pumpkin(7.72, 1.32, FP.z + .55, .75, 0xb8851e);
  pumpkin(7.4, .04, FP.z - 1.25, 1.6);
  pumpkin(7.55, .04, FP.z - 1.0, 1.1, 0xc06018);
  }
  // кленовые листья на подоконнике
  if (FEAT.nook) for (let i = 0; i < 5; i++) { const l = mesh(new THREE.CircleGeometry(.03, 5), std({ color: [0xc04a10, 0x9a2a0a, 0xd08a1a][i % 3], side: THREE.DoubleSide }), WIN.x + R(-.7, .7), WIN.sill + .003, -4.88 + R(-.05, .05)); l.rotation.set(-Math.PI / 2, 0, R(0, 6)); }
}

/* ---------- меловая доска с сезонным напитком ---------- */
(() => {
  const dr = SEASON_DRINK[SEASON];
  const board = group(2.75, CT.top, -2.18);
  board.rotation.y = -.25;
  const tex = canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = "#1a1f1c"; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1500, .08, "#fff", "#000");
    g.fillStyle = "#e8e2d4"; g.textAlign = "center";
    g.font = "26px Forum, Georgia, serif"; g.globalAlpha = .75; g.fillText(SEASON_INFO[SEASON].name.toUpperCase(), w / 2, 52);
    g.globalAlpha = 1; g.font = "40px Forum, Georgia, serif";
    const words = dr.name.split(" ");
    words.forEach((t, i) => g.fillText(t, w / 2, 124 + i * 46 - (words.length - 1) * 23));
    g.strokeStyle = "rgba(232,226,212,.6)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(60, 200); g.quadraticCurveTo(128, 214, 196, 200); g.stroke();
    g.font = "20px Literata, Georgia, serif"; g.globalAlpha = .8; g.fillText("сезонное предложение", w / 2, 250);
  });
  const frame = mesh(new THREE.BoxGeometry(.26, .32, .02), M.oak, 0, .2, 0, board);
  frame.rotation.x = -.18;
  const face = mesh(new THREE.PlaneGeometry(.22, .28), std({ map: tex, roughness: .95 }), 0, .2, .011, board);
  face.rotation.x = -.18;
  face.position.z = .011 * Math.cos(.18); face.position.y = .2 - .011 * Math.sin(.18);
  hot(board, 1, `Сезонное: ${dr.name}`, () => openCard(dr), { grow: .08 });
})();

/* каждый кадр: огоньки гирлянд переливаются */
const _gc = new THREE.Color();
onTick((t, dt) => {
  const col = _gc;
  for (const s of SEASONAL) {
    if (!s.garland) continue;
    s.boost = Math.max(0, (s.boost || 0) - dt * .3);
    s.ph = (s.ph || 0) + dt * (2.2 + s.boost * 9);
    for (let i = 0; i < s.n; i++) {
      const k = .45 + .55 * Math.max(0, Math.sin(s.ph + i * .9));
      s.garland.setColorAt(i, col.setHex(s.colors[i % s.colors.length]).multiplyScalar(k));
    }
    s.garland.instanceColor.needsUpdate = true;
  }
});

/* ================= бармен: протирает бокал, ходит шагами, достаёт бутылки рукой ================= */
const BT_Z = -3.4;
const bt = makeFigure({ kind: "vest", body: "#2a0d13", shirt: "#e8e2d4", trousers: 0x121012, skin: 0xc28a68, hair: 0x140d09,
  hairStyle: "slick", mustache: true, bowtie: 0x7a0f22, rolled: true, fingers: true, garter: 0x5a0a18 });
placeFig(bt, .9, BT_Z, 0);
bt.maxSpeed = 1.35;
const BT = { busy: false, mode: "polish", get x() { return bt.x; } };
// фартук поверх брюк
(() => {
  const ap = new THREE.PlaneGeometry(.4, .62, 6, 1), p = ap.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.cos(p.getX(i) / .2 * 1.2) * .03);
  ap.computeVertexNormals();
  mesh(ap, std({ color: 0x0d0b0c, roughness: .9, side: THREE.DoubleSide }), 0, -.3, .1, bt.pelvis);
})();
// бокал и полотенце
const btGlass = mesh(lathe([[0, 0], [.038, 0], [.039, .006], [.042, .09], [.043, .092]], 24), std({ color: 0xf4f8ff, transparent: true, opacity: .38, roughness: .02, envMapIntensity: 3, side: THREE.DoubleSide, depthWrite: false }), 0, 0, 0);
btGlass.renderOrder = 5;
/* полотенце: смятый комок с висящим краем */
const ragGeo = (() => {
  const blob = new THREE.IcosahedronGeometry(.042, 2), p = blob.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(1 + Math.sin(v.x * 90) * .18 + Math.cos(v.y * 70 + v.z * 40) * .15); v.y *= .75; p.setXYZ(i, v.x, v.y, v.z); }
  const flap = new THREE.PlaneGeometry(.08, .12, 4, 6), q = flap.attributes.position;
  for (let i = 0; i < q.count; i++) q.setZ(i, Math.sin(q.getY(i) * 40) * .008 + Math.sin(q.getX(i) * 50) * .006);
  flap.translate(.01, -.07, .0);
  const g = mergeGeometries([(blob.index ? blob.toNonIndexed() : blob), (flap.index ? flap.toNonIndexed() : flap)]);
  g.computeVertexNormals();
  return g;
})();
const btRag = mesh(ragGeo, std({ color: 0xd8d2c4, roughness: 1, side: THREE.DoubleSide }), 0, 0, 0);
let glassHold = null, ragHold = null;
const GLASS_LOCAL = V3(.03, 1.18, .36);
function holdTools() {
  release(bt, btGlass); release(bt, btRag);
  glassHold = grab(bt, bt.L, btGlass, V3(0, -.055, .05), .35);
  glassHold.woff = V3(0, -.045, 0);
  ragHold = grab(bt, bt.R, btRag, V3(0, -.08, .03), .35);
}
holdTools();

/* поза «протираю бокал»: левая рука держит, правая с полотенцем ходит по кругу */
function polishTargets(t) {
  const g = GLASS_LOCAL;
  reach(bt.L, g.x + .055, g.y, g.z - .01, V3(-.5, 0, 1), DIR.in(1), .75);
  const a = t * 5.2;
  reach(bt.R, g.x - .01 + Math.cos(a) * .022, g.y + .1 + Math.sin(a * .5) * .01, g.z + Math.sin(a) * .022, V3(.2, -1, .3), V3(1, 0, .2), .55);
}
/* опустить руки вдоль тела */
function armsDown(curl = .25) {
  reach(bt.L, .23, .92, .06, DIR.down, V3(-1, 0, .3), curl);
  reach(bt.R, -.23, .92, .06, DIR.down, V3(1, 0, .3), curl);
}

/* каждый кадр — режимы, которые двигаются сами */
let wipePh = 0;
onTick((t, dt) => {
  if (BT.mode === "polish") { polishTargets(t); bt.leanT = .07; }
  else if (BT.mode === "inspect") {
    reach(bt.L, .06, 1.48, .34, V3(-.3, .3, 1), DIR.in(1), .75);
    reach(bt.R, -.2, 1.0, .2, DIR.down, V3(1, 0, .3), .4);
  } else if (BT.mode === "wipe") {
    wipePh += dt * 1.6;
    reach(bt.R, -.08 + Math.sin(wipePh) * .22, 1.135, .5 + Math.cos(wipePh * 2) * .05, V3(0, -.2, 1), DIR.down, .1);
    reach(bt.L, .25, 1.14, .42, V3(0, -.2, 1), DIR.down, .1);
    bt.leanT = .32;
  } else if (BT.mode === "lean") {
    reach(bt.L, .26, 1.14, .5, V3(0, -.3, 1), DIR.down, .3);
    reach(bt.R, -.26, 1.14, .5, V3(0, -.3, 1), DIR.down, .3);
    bt.leanT = .2;
  } else if (BT.mode === "shake") {
    const s = Math.sin(t * 16) * .06;
    reach(bt.R, -.14, 1.5 + s, .2 + s * .5, V3(0, 1, .3), DIR.in(-1), .9);
    reach(bt.L, .02, 1.38 + s, .24 + s * .5, V3(0, 1, .3), DIR.in(1), .9);
  }
  // кивает в такт музыке, когда отдыхает
  const beat = Music.beat();
  bt.nod = BT.nod && beat !== null ? Math.pow(Math.max(0, Math.cos(beat * Math.PI * 2)), 6) * .07 : 0;
});

/* ---------- инструменты ---------- */
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
async function walkTo(x, z = bt.tz, face = null) {
  bt.tx = clamp(x, -2.85, 2.85); bt.tz = z;
  if (face !== null) bt.tface = face;
  for (let i = 0; i < 80; i++) { if (Math.hypot(bt.tx - bt.x, bt.tz - bt.z) < .03 && bt.speed < .08) break; await sleep(.05); }
}
async function turnTo(face) {
  bt.tface = face;
  for (let i = 0; i < 40; i++) { if (Math.abs(Math.atan2(Math.sin(face - bt.face), Math.cos(face - bt.face))) < .08) break; await sleep(.05); }
}
function putDown(F, obj, worldPos, dur = .3) {
  release(F, obj);
  return tween(obj.position, { x: worldPos.x, y: worldPos.y, z: worldPos.z }, dur, ease.out);
}
async function stash() {
  BT.mode = "free";
  const gp = fromFig(bt, V3(.12, CT.top, .6)), rp = fromFig(bt, V3(-.12, CT.top + .004, .6));
  reach(bt.L, .14, CT.top + .1, .55, V3(0, -.6, 1), DIR.in(1), .75);
  reach(bt.R, -.12, CT.top + .07, .55, V3(0, -.8, 1), DIR.down, .55);
  await sleep(.45);
  if (bt.held.some(h => h.obj === btGlass)) putDown(bt, btGlass, gp);
  if (bt.held.some(h => h.obj === btRag)) putDown(bt, btRag, rp);
  btRag.rotation.set(-Math.PI / 2, 0, 0);
  reach(bt.L, .14, CT.top + .14, .5, V3(0, -.6, 1), DIR.in(1), .2);
  reach(bt.R, -.12, CT.top + .14, .5, V3(0, -.6, 1), DIR.down, .2);
  await sleep(.25);
  armsDown();
}
async function unstash() {
  const gx = btGlass.position.x;
  await walkTo(gx - .12, BT_Z, 0);
  reach(bt.L, .14, CT.top + .1, .55, V3(0, -.6, 1), DIR.in(1), .3);
  reach(bt.R, -.12, CT.top + .07, .55, V3(0, -.8, 1), DIR.down, .3);
  await sleep(.5);
  // захват берёт предмет из того места на стойке, где он лежит
  holdTools();
  btRag.rotation.set(0, 0, 0);
  await sleep(.3);
  BT.mode = "polish";
}

async function fetchBottle(h) {
  BT.busy = true;
  bt.look = null;
  await stash();
  const hb = h.root.position;
  await walkTo(hb.x - .2, -3.95, Math.PI);
  await turnTo(Math.PI);
  bt.look = V3(hb.x, hb.y + .2, hb.z);
  // тянется к бутылке
  const gp = V3(hb.x, hb.y + .17, hb.z + .02);
  const lp = toFig(bt, gp);
  reach(bt.R, lp.x, lp.y, lp.z - .02, V3(0, 0, 1), DIR.in(-1), .15);
  await sleep(.6);
  bt.R.curlT = .85;
  h.root.userData.out = true;
  const hold = grab(bt, bt.R, h.root, V3(0, -.04, .045), .25);
  hold.woff = V3(0, -.17, 0);
  await sleep(.3);
  reach(bt.R, -.18, 1.3, .38, V3(0, .2, 1), DIR.in(-1));
  await sleep(.3);
  bt.look = null;
  await walkTo(hb.x - .2, -3.3, 0);
  await turnTo(0);
  // ставит на стойку перед гостем
  const spot = V3(hb.x - .35, CT.top, -2.42);
  const sl = toFig(bt, spot);
  reach(bt.R, sl.x, CT.top + .2, sl.z - .03, V3(0, -.1, 1), DIR.in(-1), .85);
  await sleep(.55);
  await putDown(bt, h.root, spot, .2);
  bt.R.curlT = .1;
  reach(bt.R, sl.x * .5 - .05, 1.1, .36, V3(-.3, 0, 1), V3(.2, 1, 0), .1);
  reach(bt.L, .24, 1.0, .16, DIR.down, V3(-1, 0, .3), .3);
  bt.look = camera.position;
  await sleep(.5);
}
async function returnBottle(h) {
  bt.look = null;
  const p = h.root.position, lp = toFig(bt, V3(p.x, CT.top + .2, p.z));
  reach(bt.R, lp.x, lp.y, lp.z - .03, V3(0, -.1, 1), DIR.in(-1), .2);
  await sleep(.45);
  bt.R.curlT = .85;
  const hold = grab(bt, bt.R, h.root, V3(0, -.04, .045), .2);
  hold.woff = V3(0, -.17, 0);
  await sleep(.25);
  reach(bt.R, -.18, 1.3, .35, V3(0, .2, 1), DIR.in(-1));
  await walkTo(h.home.x - .2, -3.95, Math.PI);
  await turnTo(Math.PI);
  const hp = toFig(bt, V3(h.home.x, h.home.y + .17, h.home.z + .02));
  reach(bt.R, hp.x, hp.y, hp.z - .02, V3(0, 0, 1), DIR.in(-1), .85);
  await sleep(.55);
  await putDown(bt, h.root, h.home, .2);
  h.root.userData.out = false;
  bt.R.curlT = .15;
  reach(bt.R, -.2, 1.2, .25, V3(0, 0, 1), DIR.in(-1));
  await sleep(.25);
  armsDown();
  await unstash();
  BT.busy = false;
}
/* коктейль: идёт к шейкеру и трясёт его, пока камера смотрит крупным планом */
async function prepCocktail() {
  BT.busy = true;
  await stash();
  await walkTo(1.2, BT_Z, 0);
  BT.mode = "shake";
  bt.look = camera.position;
}
async function presentCocktail() {
  BT.mode = "free";
  const sp = servedGlass ? servedGlass.position : fromFig(bt, V3(-.2, CT.top, .9));
  await walkTo(sp.x + .2, BT_Z, 0);
  const l = toFig(bt, sp);
  reach(bt.R, l.x + .02, CT.top + .06, l.z - .05, V3(0, -.3, 1), DIR.in(-1), .3);
  reach(bt.L, .24, .95, .1, DIR.down, V3(-1, 0, .3), .3);
  bt.look = camera.position;
  await sleep(.6);
  reach(bt.R, l.x - .02, CT.top + .14, l.z - .2, V3(.2, -.2, 1), V3(.3, 1, 0), .1);
}
async function relax() {
  bt.look = null;
  await unstash();
  BT.busy = false;
}

/* ---------- сам по себе: протирает, разглядывает бокал на свет, вытирает стойку, болтает с гостями ---------- */
async function idleLife() {
  if (STILL) return;
  for (;;) {
    await sleep(R(3.5, 7));
    if (BT.busy || PAUSED) continue;
    const r = rng();
    if (r < .22) {
      await walkTo(clamp(bt.x + R(-1.6, 1.6), -2.2, 2.3), BT_Z, 0);
    } else if (r < .42) {
      bt.look = camera.position;
      await sleep(R(1.6, 2.6));
      if (!BT.busy) bt.look = null;
    } else if (r < .56) {
      BT.mode = "inspect";
      bt.look = fromFig(bt, V3(.06, 1.55, .34));
      await sleep(1.8);
      if (!BT.busy) { BT.mode = "polish"; bt.look = null; }
    } else if (r < .7 && typeof GUESTS !== "undefined" && GUESTS.length) {
      // подходит к гостю и перекидывается парой слов
      const g = pickOne(GUESTS);
      await walkTo(g.F.x + .05, BT_Z + .1, 0);
      if (BT.busy) continue;
      bt.look = V3(g.F.x, 1.45, g.F.z);
      bt.nod = 0;
      g.F.look = bt.head.getWorldPosition(V3());
      for (let i = 0; i < 3 && !BT.busy; i++) { bt.tilt = R(-.12, .12); await sleep(.9); }
      bt.tilt = 0;
      g.F.look = null;
      if (!BT.busy) bt.look = null;
    } else if (r < .82) {
      // вытирает стойку
      BT.mode = "free";
      await stash();
      if (BT.busy) continue;
      reach(bt.R, 0, CT.top + .02, .5, V3(0, -.2, 1), DIR.down, .1);
      await sleep(.3);
      const rag = grab(bt, bt.R, btRag, V3(0, -.07, .02), .25);
      rag.woff = V3(0, -.02, 0);
      BT.mode = "wipe";
      await sleep(4.5);
      if (BT.busy) continue;
      BT.mode = "free";
      await putDown(bt, btRag, fromFig(bt, V3(-.12, CT.top + .004, .6)));
      bt.leanT = .07;
      await unstash();
    } else {
      BT.nod = 1;
      await sleep(4);
      BT.nod = 0;
    }
  }
}

/* ================= шоу бармена: предметы движутся по продуманным траекториям, пальцы их обхватывают ================= */
const SHOW = { on: false, gen: 0, fast: false, served: false, ran: false, glassV: null, main: null, c: null, focus: V3(), force: null };
const ABORT = { abort: true };
let SG = 0;
const rr = (a, b) => a + Math.random() * (b - a);
const chance = p => Math.random() < p;
const choose = list => list[Math.floor(Math.random() * list.length)];
function live() { if (SHOW.on && SHOW.gen !== SG) throw ABORT; }
// темп шоу: 0.78 — движения бармена быстрее на пятую часть, огненный коктейль идёт ~35 с вместо 49, простые — ~20–25 с
const TEMPO = .78;
const SL = () => (SHOW.slow || 1) * TEMPO;
async function ws(s) { await sleep(SHOW.fast ? Math.min(s, .01) : s * SL()); live(); }
const PROGS = () => Closeup.PROGRAMS;
const NOM = { rum: "Ром", tequila: "Текила", gin: "Джин", whisky: "Виски", cognac: "Коньяк", pisco: "Писко", wine: "Красное вино", triple: "Апельсиновый ликёр", cherry: "Вишнёвый ликёр",
  campari: "Кампари", vermouthR: "Красный вермут", vermouthD: "Сухой вермут", bitters: "Ангостура", tonic: "Тоник", soda: "Содовая",
  cola: "Кола", oj: "Апельсиновый сок", pineapple: "Ананасовый сок", coconut: "Кокосовые сливки", lime: "Сок лайма",
  lemon: "Лимонный сок", syrup: "Сахарный сироп", grenadine: "Гренадин", coffee: "Кофе", tea: "Чай", cream: "Сливки" };
const liqOf = ing => new THREE.Color((Closeup.LOOK[ing] || {}).liq || "#ffffff");

/* ---------- координаты: всё считается от места бармена (x — его левая рука, z — к гостю) ---------- */
const ST = { bx: 1.2, bz: -3.0 };
const B = (x, y, z) => V3(ST.bx + x, y, ST.bz + z);
const TOP = () => CT.top;
const Qe = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "YXZ"));
const Qz = a => new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), a);
const Qx = a => new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), a);
const _up = V3(0, 1, 0);

/* ---------- материалы ---------- */
const MX = {
  glass: std({ color: 0xf2f6ff, transparent: true, opacity: .22, roughness: .02, envMapIntensity: 2.8, side: THREE.DoubleSide, depthWrite: false }),
  rim: new THREE.MeshBasicMaterial({ color: 0xfff4e4, transparent: true, opacity: .55, depthWrite: false }),
  ice: std({ color: 0xf4fbff, transparent: true, opacity: .62, roughness: .04, envMapIntensity: 2.4, emissive: 0x334450, depthWrite: false }),
  frost: std({ color: 0xe6edf0, metalness: .45, roughness: .62, envMapIntensity: 1 }),
  wood: std({ color: 0x5a3420, roughness: .55 }),
  stream: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .92, depthWrite: false }),
  core: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })
};
const cubeGeo = new RoundedBoxGeometry(.024, .024, .024, 2, .006);
const crushGeo = new RoundedBoxGeometry(.013, .011, .013, 1, .004);

/* сосуд: стекло или металл, уровень жидкости, кольцо по краю, чтобы силуэт читался */
function vessel(profile, mat, [r0, r1, y0, y1, cap], { rim = true, scale = 1 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(lathe(profile, 32), mat);
  body.renderOrder = 5;
  g.add(body);
  const mouthY = profile[profile.length - 1][1], mouthR = profile[profile.length - 1][0];
  if (rim && mat === MX.glass) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(mouthR, .0011, 4, 40), MX.rim);
    ring.rotation.x = Math.PI / 2; ring.position.y = mouthY; ring.renderOrder = 6;
    g.add(ring);
  }
  const lg = new THREE.CylinderGeometry(r1, r0, 1, 28);
  lg.translate(0, .5, 0);
  const liq = new THREE.Mesh(lg, std({ color: 0xffffff, transparent: true, opacity: .88, roughness: .12, emissive: 0x000000 }));
  liq.renderOrder = 4; liq.position.y = y0; liq.scale.y = .0001; liq.visible = false;
  g.add(liq);
  g.scale.setScalar(scale);
  g.visible = false;
  world.add(g);
  return { g, body, liq, ml: 0, cap, col: new THREE.Color(0xffffff), ice: [], y0, y1, r0, r1, mouthY, mouthR, scale };
}
function setLevel(V) {
  const f = clamp(V.ml / V.cap, 0, .94);
  V.liq.visible = f > .004;
  V.liq.scale.y = Math.max(.0001, f * (V.y1 - V.y0));
  V.liq.material.color.copy(V.col);
  V.liq.material.emissive.copy(V.col).multiplyScalar(.3);
  // светлое и прозрачное (вода, джин, содовая) не должно выглядеть молоком
  const lum = V.col.r * .3 + V.col.g * .59 + V.col.b * .11;
  V.liq.material.opacity = .9 - .52 * clamp((lum - .62) / .3, 0, 1);
}
const mouth = (V, dy = 0) => V.g.localToWorld(V3(0, V.mouthY + dy / V.scale, 0));
const surface = V => V.g.localToWorld(V3(0, V.y0 + Math.max(.004, clamp(V.ml / V.cap, 0, .94) * (V.y1 - V.y0)), 0));

/* ---------- реквизит ---------- */
const P = {};
(() => {
  P.tin = vessel([[0, 0], [.043, 0], [.044, .004], [.048, .175], [.05, .178]], M.chrome, [.04, .046, .004, .17, 520]);
  P.cap = { g: new THREE.Group() };
  P.cap.g.add(new THREE.Mesh(lathe([[0, 0], [.036, 0], [.037, .004], [.042, .12], [.043, .123]], 28), M.chrome));
  world.add(P.cap.g); P.cap.g.visible = false;
  P.mixer = vessel([[0, 0], [.048, 0], [.049, .008], [.05, .15], [.051, .152]], MX.glass, [.045, .047, .01, .145, 420]);
  // джиггер: верхняя чаша 50 мл, нижняя 25 мл
  P.jig = { g: new THREE.Group() };
  P.jig.g.add(new THREE.Mesh(lathe([[.017, 0], [.019, .001], [.009, .043], [.009, .047], [.024, .088], [.026, .09]], 24), M.chrome));
  const jl = new THREE.CylinderGeometry(.022, .01, 1, 18); jl.translate(0, .5, 0);
  P.jig.liq = mesh(jl, std({ color: 0xffffff, transparent: true, opacity: .9, roughness: .1 }), 0, .049, 0, P.jig.g);
  P.jig.liq.visible = false;
  world.add(P.jig.g); P.jig.g.visible = false;
  // барная ложка: витая ручка, капля на конце
  P.spoon = { g: new THREE.Group() };
  const nonIdx = x => x.index ? x.toNonIndexed() : x;
  const sp = [new THREE.CylinderGeometry(.0026, .0026, .29, 6)];
  sp[0].translate(0, -.15, 0);
  for (let i = 0; i < 22; i++) { const t = new THREE.TorusGeometry(.003, .0008, 3, 6); t.rotateX(Math.PI / 2); t.translate(0, -.04 - i * .0095, 0); sp.push(t); }
  const bowl = new THREE.SphereGeometry(.011, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); bowl.scale(1, .45, 1.7); bowl.translate(0, -.302, 0); sp.push(bowl);
  sp.push(new THREE.SphereGeometry(.0065, 10, 8));
  P.spoon.g.add(new THREE.Mesh(mergeGeometries(sp.map(nonIdx)), M.chrome));
  world.add(P.spoon.g); P.spoon.g.visible = false;
  // стрейнер: диск, пружина по краю, ручка
  P.strainer = { g: new THREE.Group() };
  const sg = [new THREE.CylinderGeometry(.047, .047, .003, 28), new THREE.TorusGeometry(.039, .0045, 6, 28), new THREE.BoxGeometry(.018, .003, .1)];
  sg[1].rotateX(Math.PI / 2); sg[1].translate(0, -.006, 0);
  sg[2].translate(0, 0, .09);
  for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28, t = new THREE.TorusGeometry(.004, .0009, 3, 6); t.rotateY(a); t.translate(Math.cos(a) * .04, -.007, Math.sin(a) * .04); sg.push(t); }
  P.strainer.g.add(new THREE.Mesh(mergeGeometries(sg.map(nonIdx)), M.chrome));
  world.add(P.strainer.g); P.strainer.g.visible = false;
  // мадлер
  P.muddler = { g: new THREE.Group() };
  P.muddler.g.add(new THREE.Mesh(lathe([[0, -.22], [.014, -.22], [.016, -.2], [.012, -.06], [.015, -.02], [.013, 0], [0, 0]], 14), MX.wood));
  world.add(P.muddler.g); P.muddler.g.visible = false;
  // совок для льда: ковш вдоль +x, ручка вдоль −x
  P.scoop = { g: new THREE.Group() };
  const sc = new THREE.CylinderGeometry(.035, .035, .1, 20, 1, true, Math.PI * .4, Math.PI * 1.2); sc.rotateZ(Math.PI / 2); sc.translate(.05, 0, 0);
  const scEnd = new THREE.CircleGeometry(.035, 20); scEnd.rotateY(Math.PI / 2);
  const scH = new THREE.CylinderGeometry(.008, .009, .09, 10); scH.rotateZ(Math.PI / 2); scH.translate(-.045, .006, 0);
  P.scoop.g.add(new THREE.Mesh(mergeGeometries([sc, scEnd, scH].map(nonIdx)), std({ color: 0xd8dde2, metalness: 1, roughness: .2, side: THREE.DoubleSide, envMapIntensity: 1.6 })));
  P.scoop.cubes = [];
  for (let i = 0; i < 5; i++) { const c = mesh(cubeGeo, MX.ice, .025 + (i % 3) * .022, -.014 + Math.floor(i / 3) * .018, (i % 2 - .5) * .018, P.scoop.g); c.rotation.set(rr(0, 2), rr(0, 2), 0); c.renderOrder = 5; c.visible = false; P.scoop.cubes.push(c); }
  world.add(P.scoop.g); P.scoop.g.visible = false;
  // ведёрко со льдом
  P.bucket = { g: new THREE.Group() };
  P.bucket.g.add(new THREE.Mesh(lathe([[0, 0], [.07, 0], [.075, .01], [.09, .14], [.094, .145]], 32), M.chrome));
  const bi = new THREE.InstancedMesh(cubeGeo, MX.ice, 18), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 18; i++) { m4.compose(V3(rr(-.06, .06), .11 + rr(0, .03), rr(-.06, .06)), q.setFromEuler(e.set(rr(0, 3), rr(0, 3), 0)), V3(1.1, 1.1, 1.1)); bi.setMatrixAt(i, m4); }
  bi.renderOrder = 5;
  P.bucket.g.add(bi);
  world.add(P.bucket.g); P.bucket.g.visible = false;
  // доска с гарниром
  P.tray = { g: new THREE.Group() };
  const t = P.tray.g;
  t.add(new THREE.Mesh(new RoundedBoxGeometry(.2, .018, .13, 2, .006), MX.wood));
  for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(.022, .022, .006, 20), std({ color: 0xa8c83e, roughness: .5, emissive: 0x1a2a00 }), -.07 + i * .028, .013 + i * .003, -.035, t).rotation.z = .2;
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(.01, 12, 8), std({ color: 0xa8101e, roughness: .2 }), .03 + i * .02, .019, -.035, t);
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(.01, 12, 8), std({ color: 0x8a9a30, roughness: .35 }), .03 + i * .02, .018, .03, t).scale.set(1, .8, 1);
  mesh(new THREE.CylinderGeometry(.022, .022, .006, 20), std({ color: 0xf08a22, roughness: .5 }), -.05, .015, .035, t).rotation.z = -.15;
  world.add(t); t.visible = false;
  P.salt = mesh(new THREE.CylinderGeometry(.065, .06, .012, 28), std({ color: 0xf4f1ea, roughness: .95 }), 0, 0, 0);
  P.salt.visible = false;
})();
const PROPS = () => [P.tin.g, P.cap.g, P.mixer.g, P.jig.g, P.spoon.g, P.strainer.g, P.muddler.g, P.scoop.g, P.bucket.g, P.tray.g, P.salt].concat(typeof FIRE_PROPS === "function" && P.mugA ? FIRE_PROPS() : []);

/* ---------- бутылка с крупной этикеткой ---------- */
const BKIND = { spirit: "tall", square: "square", flask: "flask", squat: "squat", wine: "bordeaux", dash: "bordeaux", soda: "round", squeeze: "squeeze", carafe: "carafe" };
const LABELS = {};
function bigLabel(ing) {
  if (LABELS[ing]) return LABELS[ing];
  const L = Closeup.LOOK[ing] || {};
  const t = canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = L.label || "#efe6d2"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(201,148,74,.9)"; g.lineWidth = 5; g.strokeRect(146, 10, 220, h - 20);
    g.fillStyle = L.ink || "#2a1a10"; g.textAlign = "center"; g.textBaseline = "middle";
    const name = L.name || (NOM[ing] || "").toUpperCase();
    g.font = `400 ${name.length > 7 ? 38 : 50}px Forum, serif`;
    g.fillText(name, 256, 68);
    fitFont(g, `${BAR_SIGN} · 1924`, 440, 19, "Literata, serif"); g.globalAlpha = .75; g.fillText(`${BAR_SIGN} · 1924`, 256, 118);
  });
  return (LABELS[ing] = t);
}
function makeBottle(ing) {
  const L = Closeup.LOOK[ing] || { kind: "spirit", glass: "#2a1a10", liq: "#c27a1a" };
  const g = new THREE.Group();
  let top = .3, r = .035;
  if (L.kind === "carafe") {
    g.add(new THREE.Mesh(lathe([[0, 0], [.045, 0], [.05, .02], [.05, .14], [.03, .2], [.028, .24], [.034, .25]], 28), MX.glass));
    mesh(new THREE.CylinderGeometry(.046, .046, .12, 24), std({ color: L.liq, transparent: true, opacity: .9, roughness: .2, emissive: new THREE.Color(L.liq).multiplyScalar(.2) }), 0, .075, 0, g);
    top = .25; r = .05;
  } else if (L.kind === "squeeze") {
    mesh(new THREE.CylinderGeometry(.032, .032, .15, 24), std({ color: L.glass, transparent: (L.op || 1) < 1, opacity: Math.max(.5, L.op || 1), roughness: .3 }), 0, .075, 0, g);
    if ((L.op || 1) < .6) mesh(new THREE.CylinderGeometry(.03, .03, .1, 18), std({ color: L.liq, roughness: .3 }), 0, .052, 0, g);
    mesh(new THREE.CylinderGeometry(.008, .02, .05, 12), std({ color: 0xe8e2d0, roughness: .4 }), 0, .175, 0, g);
    const lab = mesh(new THREE.CylinderGeometry(.0325, .0325, .06, 28, 1, true), std({ map: bigLabel(ing), roughness: .7 }), 0, .085, 0, g);
    lab.rotation.y = Math.PI;
    top = .2; r = .032;
  } else {
    const shape = BKIND[L.kind] || "tall", s = L.kind === "dash" ? .6 : L.kind === "soda" ? .85 : 1;
    const b = new THREE.Mesh(BGEO[shape], std({ color: L.glass, transparent: (L.op || 1) < 1, opacity: Math.max(.5, L.op || .95), roughness: .05, metalness: .1, envMapIntensity: 2.4 }));
    b.scale.setScalar(s); g.add(b);
    r = bodyR(shape) * s;
    const lh = .08 * s;
    const lab = BOTTLE[shape].seg === 4
      ? mesh(new THREE.BoxGeometry(r * 1.42, lh, r * 1.42), std({ map: bigLabel(ing), roughness: .7 }), 0, .11 * s, 0, g)
      : mesh(new THREE.CylinderGeometry(r * 1.015, r * 1.015, lh, 32, 1, true), std({ map: bigLabel(ing), roughness: .7 }), 0, .11 * s, 0, g);
    lab.rotation.y = Math.PI;
    top = neckTop(shape) * s;
    mesh(new THREE.CylinderGeometry(.007, .0055, .032, 10), M.chrome, 0, top + .013, 0, g);
    top += .028;
  }
  g.userData = { top, r, ing };
  world.add(g);
  return g;
}

/* ---------- движение предметов: путь с подъёмом, поворот по кратчайшей дуге ---------- */
const TMP = new Set();
onTick((t, dt) => { for (const f of TMP) f(t, dt); });
function onTickTmp(fn) { TMP.add(fn); return () => TMP.delete(fn); }
function place(o, p, q) { o.position.copy(p); if (q) o.quaternion.copy(q); o.visible = true; }
function move(o, p, { q = null, dur = .5, e = ease.io, arc = 0 } = {}) {
  const p0 = o.position.clone(), q0 = o.quaternion.clone(), p1 = p.clone(), q1 = q ? q.clone() : null;
  const d = SHOW.fast ? .001 : dur * SL(), t0 = performance.now();
  return new Promise(res => {
    const stop = onTickTmp(() => {
      const k = clamp((performance.now() - t0) / (d * 1000), 0, 1), v = e(k);
      o.position.lerpVectors(p0, p1, v);
      if (arc) o.position.y += Math.sin(Math.PI * v) * arc;
      if (q1) o.quaternion.slerpQuaternions(q0, q1, v);
      if (k >= 1) { stop(); res(); }
    });
  }).then(live);
}
/* поворот вокруг точки предмета (горлышко, край): точка стоит на месте */
function tiltAbout(o, pivotLocal, q1, dur = .4, e = ease.io) {
  o.updateMatrixWorld(true);
  const pw = o.localToWorld(pivotLocal.clone()), q0 = o.quaternion.clone(), qq = new THREE.Quaternion(), d = SHOW.fast ? .001 : dur * SL(), t0 = performance.now();
  return new Promise(res => {
    const stop = onTickTmp(() => {
      const k = clamp((performance.now() - t0) / (d * 1000), 0, 1);
      qq.slerpQuaternions(q0, q1, e(k));
      o.quaternion.copy(qq);
      o.position.copy(pw).sub(pivotLocal.clone().multiply(o.scale).applyQuaternion(qq));
      if (k >= 1) { stop(); res(); }
    });
  }).then(live);
}
/* где поставить предмет, чтобы его точка оказалась в нужном месте */
function posFor(o, local, at, q = o.quaternion) { return at.clone().sub(local.clone().multiply(o.scale).applyQuaternion(q)); }
function waitTicks(dur, fn) {
  const d = SHOW.fast ? .001 : dur * SL(), t0 = performance.now();
  return new Promise(res => { const stop = onTickTmp(() => { const t = (performance.now() - t0) / 1000 / SL(), k = clamp(t * SL() / d, 0, 1); fn(k, t); if (k >= 1) { stop(); res(); } }); }).then(live);
}

/* ---------- кисти: рука держится за предмет, пальцы обхватывают ---------- */
const HANDS = new Map();
const _gq = new THREE.Quaternion(), _hc = V3(), _gf = V3(), _gn = V3(), _gw = V3();
function dirToFig(v, F = bt) { const c = Math.cos(-F.face), s = Math.sin(-F.face); return V3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
/* хват: p — точка на предмете, f — куда смотрят пальцы, n — куда смотрит ладонь (к предмету), r — толщина предмета */
function grip(arm, obj, g, dur = .38) {
  arm.manual = true;
  handPose(arm, g.pose || "grip", g.r || .03);
  const H = { obj, F: g.F || bt, g: Object.assign({ r: .03 }, g), k: 0, from: arm.cur.clone(), lift: g.lift ?? .04 };
  HANDS.set(arm, H);
  if (SHOW.fast || dur <= 0) { H.k = 1; return Promise.resolve(); }
  return tween(H, { k: 1 }, dur * SL(), ease.io).then(live);
}
function letGo(arm, pose = "relax") {
  HANDS.delete(arm);
  arm.snap = false; arm.k = 11;
  handPose(arm, pose);
}
/* свободная рука: плавно в точку мира */
function handTo(arm, p, f, n, pose = "relax", dur = .35, F = bt) {
  HANDS.delete(arm);
  arm.snap = false; arm.k = 3.4 / Math.max(.1, dur * SL());
  arm.manual = true;
  handPose(arm, pose);
  const l = toFig(F, p);
  reach(arm, l.x, l.y, l.z, dirToFig(f, F), dirToFig(n, F));
  return ws(dur);
}
/* руки на стойке, ладонями вниз — спокойная поза между делом */
function rest(arm) {
  const s = arm.side;
  return handTo(arm, B(s * .19, TOP() + .028, .3), V3(-s * .3, -.12, 1), V3(0, -1, 0), "relax", .45).catch(() => {});
}
PRE_FIG.push(() => {
  if (!HANDS.size) return;
  for (const [arm, H] of HANDS) {
    const o = H.obj, g = H.g;
    o.updateMatrixWorld(true);
    o.getWorldQuaternion(_gq);
    o.localToWorld(_hc.copy(g.p));
    _gf.copy(g.f).applyQuaternion(_gq).normalize();
    _gn.copy(g.n).applyQuaternion(_gq).normalize();
    // запястье: от точки хвата назад вдоль пальцев и от ладони
    _gw.copy(_hc).addScaledVector(_gf, -(g.along ?? .048)).addScaledVector(_gn, -(.013 + g.r));
    const l = toFig(H.F, _gw);
    if (H.k < 1) { l.lerpVectors(H.from, l, H.k); l.y += Math.sin(Math.PI * H.k) * H.lift; }
    reach(arm, l.x, l.y, l.z, dirToFig(_gf, H.F), dirToFig(_gn, H.F));
    arm.snap = true;
  }
});
/* хват для правой (s = -1) и левой (s = 1) руки: кисть заходит сзади-сбоку, пальцы обнимают предмет спереди */
const wrap = (s, p, r, extra = {}) => Object.assign({ p, r, f: V3(s * .7, 0, .7), n: V3(-s * .7, 0, .7), pose: "grip" }, extra);

/* ---------- струя ---------- */
const streamMesh = mesh(new THREE.CylinderGeometry(.0042, .0034, 1, 10, 1, true), MX.stream, 0, 0, 0);
const streamCore = mesh(new THREE.CylinderGeometry(.0016, .0012, 1, 6, 1, true), MX.core, 0, 0, 0);
streamMesh.visible = streamCore.visible = false;
streamMesh.renderOrder = 6; streamCore.renderOrder = 7;
const splash = glowSprite(0xffffff, .05, 0, 0, 0, world, 0);
const STREAM = { from: null, to: null, w: 1 };
const _sa = V3(), _sb = V3(), _sd = V3();
function streamOn(fromFn, toFn, color, w = 1) {
  STREAM.from = fromFn; STREAM.to = toFn; STREAM.w = w;
  MX.stream.color.copy(color).lerp(new THREE.Color(0xffffff), .12);
  streamMesh.visible = streamCore.visible = true;
  splash.material.color.copy(color).lerp(new THREE.Color(0xffffff), .5);
}
function streamOff() { streamMesh.visible = streamCore.visible = false; STREAM.from = null; splash.material.opacity = 0; }
onTick(t => {
  if (!streamMesh.visible || !STREAM.from) return;
  STREAM.from(_sa); STREAM.to(_sb);
  _sd.subVectors(_sb, _sa);
  const len = _sd.length();
  const wob = 1 + Math.sin(t * 40) * .08;
  _sd.normalize();
  for (const m of [streamMesh, streamCore]) {
    m.position.copy(_sa).addScaledVector(_sd, len / 2);
    m.scale.set(STREAM.w * wob, Math.max(.001, len), STREAM.w * wob);
    m.quaternion.setFromUnitVectors(_up, _sd);
  }
  splash.position.copy(_sb);
  splash.material.opacity = .5 + Math.sin(t * 30) * .2;
});

/* ---------- звуки ---------- */
function noiseHit(t, dur, freq, q, gain, type = "bandpass") {
  const c = fx(); if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur)), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
  s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + t);
}
const SND = {
  clink: () => { if (SHOW.fast) return; const c = fx(); if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime; o.frequency.value = rr(3200, 4200); g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .25); o.connect(g).connect(c.destination); o.start(t); o.stop(t + .3); noiseHit(0, .05, 5000, 2, .07); },
  pour: dur => { if (SHOW.fast) return; for (let i = 0; i < dur * 14; i++) noiseHit(i / 14, .08, rr(700, 1400), 4, .05); },
  rattle: (dur, hz) => { if (SHOW.fast) return; for (let i = 0; i < dur * hz * 2; i++) noiseHit(i / (hz * 2), .06, rr(3500, 5200), 1.5, .13); },
  tap: () => { if (!SHOW.fast) noiseHit(0, .05, 1800, 3, .25); },
  tick: () => { if (!SHOW.fast) noiseHit(0, .03, 2600, 5, .12); },
  clap: () => { if (!SHOW.fast) noiseHit(0, .07, 1500, 1, .35, "highpass"); },
  plop: () => { if (SHOW.fast) return; const c = fx(); if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime; o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(1100, t + .08); g.gain.setValueAtTime(.09, t); g.gain.exponentialRampToValueAtTime(.0001, t + .12); o.connect(g).connect(c.destination); o.start(t); o.stop(t + .14); },
  tinkle: dur => { if (SHOW.fast) return; for (let i = 0; i < dur * 6; i++) setTimeout(() => SND.clink(), i * 170 + rr(0, 60)); }
};

/* ---------- станция ---------- */
function station() {
  ST.bx = SEAT.on ? SEAT_X + .02 : 1.2;
  ST.bz = -3.0;
  const T = TOP();
  Object.assign(ST, {
    glass: B(-.07, T, .42), serve: SEAT.on ? V3(SEAT_X + .06, T, -2.14) : B(-.07, T, .78),
    tin: B(.15, T, .38), cap: B(.29, T, .5), jig: B(.31, T, .36), spoon: B(.07, T + .005, .54), strainer: B(.36, T + .004, .53),
    bucket: B(-.44, T, .27), scoop: B(-.3, T + .006, .25), tray: B(-.31, T + .01, .47), rail: B(-.22, T - .21, .17), salt: B(-.2, T + .006, .3),
    kettle: B(-.42, T, .3), mbox: B(.04, T + .007, .56), saucer: B(.3, T, .52)
  });
}

/* ---------- камера-режиссёр: кадр строится вокруг точки действия и плавно её ведёт ---------- */
const CD = { shot: "medium", fs: V3(), snap: true, side: 1 };
function shot(name, focus, side = choose([-1, 1])) { CD.shot = SHOW.force || name; SHOW.focus.copy(focus); CD.side = side; CD.snap = true; }
function follow(focus) { SHOW.focus.copy(focus); }
function shotDef(name, f) {
  const s = CD.side, bx = ST.bx, bz = ST.bz;
  switch (name) {
    case "macro": return { pos: f.clone().add(V3(s * .17, .01, .5)), tgt: f.clone().add(V3(0, .01, 0)), span: .44 };
    case "low": return { pos: f.clone().add(V3(s * .24, -.04, .52)), tgt: f.clone().add(V3(0, .07, 0)), span: .55 };
    case "top": return { pos: f.clone().add(V3(s * .06, .44, .3)), tgt: f.clone(), span: .4 };
    case "side": return { pos: f.clone().add(V3(s * .62, .08, .34)), tgt: f.clone().add(V3(0, .03, 0)), span: .55 };
    case "fire": return { pos: V3(bx + s * .3, 1.44, bz + 1.8), tgt: V3(bx, 1.4, bz + .34), span: 1.12 };
    case "face": return { pos: V3(bx + s * .3, (f.y + 1.58) / 2 + .04, bz + 1.25), tgt: V3(bx + (f.x - bx) * .5, (f.y + 1.58) / 2, bz + .25), span: .85 };
    default: return { pos: V3(bx + s * .22, 1.43, bz + 1.5), tgt: V3(bx + (f.x - bx) * .4, 1.31, bz + .33), span: 1.05 };
  }
}
const _cp = V3(), _ct = V3(), CARD_W = 280;
onTick((t, dt) => {
  if (!SHOW.on || flight) return;
  if (CD.snap) CD.fs.copy(SHOW.focus); else CD.fs.lerp(SHOW.focus, smoothK(3.2, dt));
  const aspect = innerWidth / innerHeight;
  let fov;
  if (SEAT.on) {
    const s = seatShot();
    _cp.set(s.px, s.py, s.pz); _ct.copy(CD.fs).add(V3(0, .04, 0));
    const dist = _cp.distanceTo(_ct), span = CD.shot === "face" || CD.shot === "medium" ? .95 : .62;
    const need = 2 * Math.atan(span / 2 / dist) / D2R;
    fov = clamp(aspect < 1 ? 2 * Math.atan(Math.tan(need * D2R / 2) / aspect) / D2R : need, 26, 62);
    if (innerWidth > 640) {
      const hf = 2 * Math.atan(Math.tan(fov / 2 * D2R) * aspect) / D2R;
      _ct.addScaledVector(V3().subVectors(_ct, _cp).cross(_up).normalize(), 2 * dist * Math.tan(hf / 2 * D2R) * (CARD_W / 2 / innerWidth));
    }
  } else {
    const d = shotDef(CD.shot, CD.fs);
    const base = aspect < 1 ? 56 : 36;
    const hf = 2 * Math.atan(Math.tan(base / 2 * D2R) * aspect) / D2R, mf = Math.min(base, hf);
    const dist = d.span / 2 / Math.tan(mf / 2 * D2R);
    const dir = d.pos.clone().sub(d.tgt).normalize();
    _cp.copy(d.tgt).addScaledVector(dir, dist);
    _cp.z = Math.max(_cp.z, CT.z0 + .45);
    _cp.y = Math.max(_cp.y, 1.0);
    _ct.copy(d.tgt); fov = base;
    // справа карточка рецепта: действие сдвигаем левее центра
    if (innerWidth > 640) {
      const r = V3().subVectors(_ct, _cp).cross(_up).normalize();
      const sh = 2 * dist * Math.tan(hf / 2 * D2R) * (CARD_W / 2 / innerWidth);
      _cp.addScaledVector(r, sh); _ct.addScaledVector(r, sh);
    }
  }
  if (CD.snap) { setCam({ px: _cp.x, py: _cp.y, pz: _cp.z, tx: _ct.x, ty: _ct.y, tz: _ct.z, fov }); CD.snap = false; return; }
  const k = smoothK(2.4, dt), kt = smoothK(4, dt);
  CAM.px += (_cp.x - CAM.px) * k; CAM.py += (_cp.y - CAM.py) * k; CAM.pz += (_cp.z - CAM.pz) * k;
  CAM.tx += (_ct.x - CAM.tx) * kt; CAM.ty += (_ct.y - CAM.ty) * kt; CAM.tz += (_ct.z - CAM.tz) * kt;
  CAM.fov += (fov - CAM.fov) * k;
});

/* ---------- интерфейс: подписи, карточка рецепта, ярлык у бутылки ---------- */
const showUI = { root: document.getElementById("show-ui"), title: document.getElementById("show-title"), name: document.getElementById("sc-name"), count: document.getElementById("show-count"), text: document.getElementById("show-text"), cap: document.getElementById("show-cap"),
  list: document.getElementById("sc-list"), sub: document.getElementById("sc-sub"), cup: document.getElementById("sc-cup"), tag: document.getElementById("show-tag") };
document.getElementById("show-skip").addEventListener("click", () => { if (SHOW.on) { SHOW.fast = true; SHOW.gen++; } });
addEventListener("keydown", e => { if (e.key === "Escape" && SHOW.on) { SHOW.fast = true; SHOW.gen++; } });
function caption(count, text) {
  showUI.count.textContent = count;
  showUI.text.textContent = text;
  showUI.cap.classList.remove("show"); void showUI.cap.offsetWidth; showUI.cap.classList.add("show");
}
function stepCaption(st, c) {
  const { GEN, TOPACC, GNAME } = Closeup;
  switch (st[0]) {
    case "ice": return st[2] ? "Колотый лёд доверху" : st[1] === "tin" ? "Лёд в шейкер" : st[1] === "mixer" ? "Лёд в стакан для смешивания" : "Лёд в бокал";
    case "jig": return `${st[2]} мл ${GEN[st[1]]} — точно по джиггеру`;
    case "pour": return `${st[2]} мл ${GEN[st[1]]}`;
    case "top": return `Доливаем ${TOPACC[st[1]]}`;
    case "dash": return `${st[2]} ${st[2] === 1 ? "капля" : "капли"} ангостуры`;
    case "leaves": return "Листья свежей мяты";
    case "muddle": return "Мягко разминаем мяту — она отдаёт аромат";
    case "squeeze": return "Выжимаем лайм";
    case "rim": return "Солёный ободок";
    case "shake": return "Встряхиваем, пока шейкер не покроется инеем";
    case "stir": return "Размешиваем ложкой: холодно и прозрачно";
    case "stirIn": return "Перемешиваем";
    case "strain": return "Процеживаем через стрейнер";
    case "float": return "Гренадин тяжелее — он опускается на дно";
    case "hot": return "Горячая вода: этот коктейль подают тёплым";
    case "fire": return "Огненная струя: горящий коньяк переливают из кружки в кружку";
    case "garnish": return c.garnish === "flame" ? "Цедра через пламя: масло апельсина вспыхивает над стаканом" : `Финальный штрих: ${GNAME[c.garnish] || "украшение"}`;
    case "serve": return choose(["Готово. Приятного вечера!", "Ваш коктейль. Наслаждайтесь.", "Прошу. За ваш вечер!"]);
  }
  return "";
}
const GCOL = { flame: 0xf08a22, wheel: 0xa8c83e, wedge: 0xa8c83e, lemon: 0xf2d24a, orange: 0xf08a22, mint: 0x3f8f3a, cherry: 0xa8101e, pineapple: 0xf2c84a, olive: 0x8a9a30 };
/* строка карточки для шага рецепта */
function cardRow(st, c) {
  const { GNAME } = Closeup;
  const ing = (n, a) => ({ name: NOM[n] || n, amt: a, col: "#" + liqOf(n).getHexString() });
  const tech = (name, amt = "") => ({ name, amt, tech: true });
  switch (st[0]) {
    case "ice": return tech(st[2] ? "Колотый лёд" : "Лёд", st[1] === "tin" ? "в шейкер" : st[1] === "mixer" ? "в стакан" : "в бокал");
    case "jig": case "pour": return ing(st[1], `${st[2]} мл`);
    case "top": return ing(st[1], "доверху");
    case "dash": return ing("bitters", `${st[2]} ${st[2] === 1 ? "капля" : "капли"}`);
    case "float": return ing("grenadine", "15 мл");
    case "leaves": return { name: "Мята", amt: "8 листьев", col: "#3f8f3a" };
    case "squeeze": return { name: "Лайм", amt: "выжать", col: "#a8c83e" };
    case "rim": return { name: "Соль", amt: "на ободок", col: "#f4f1ea" };
    case "muddle": return tech("Размять");
    case "hot": return { name: "Горячая вода", amt: `${st[1]} мл`, col: "#cfe0e6" };
    case "fire": return tech("Поджечь", "огненная струя");
    case "shake": return tech("Взболтать", "со льдом");
    case "stir": return tech("Размешать", "со льдом");
    case "stirIn": return tech("Перемешать");
    case "strain": return tech("Процедить", "в бокал");
    case "garnish": { const g = GNAME[c.garnish] || "украшение"; return { name: g[0].toUpperCase() + g.slice(1), amt: "", col: "#" + new THREE.Color(GCOL[c.garnish] || 0x9fc23a).getHexString() }; }
  }
  return null;
}
const CUP_SVG = {
  martini: { d: "M14 14 L86 14 L50 62 Z", stem: [62, 104], top: 14, bot: 62 },
  coupe: { d: "M14 18 Q16 58 50 60 Q84 58 86 18 Z", stem: [60, 104], top: 18, bot: 60 },
  wine: { d: "M26 10 Q20 60 50 64 Q80 60 74 10 Z", stem: [64, 104], top: 10, bot: 64 },
  rocks: { d: "M22 44 L26 108 L74 108 L78 44 Z", stem: null, top: 44, bot: 108 },
  highball: { d: "M30 8 L32 110 L68 110 L70 8 Z", stem: null, top: 8, bot: 110 },
  shot: { d: "M36 60 L39 108 L61 108 L64 60 Z", stem: null, top: 60, bot: 108 },
  snifter: { d: "M30 30 Q14 70 50 76 Q86 70 70 30 Z", stem: [76, 104], top: 30, bot: 76 }
};
const CARD = { rows: [], map: [], layers: [], total: 100, filled: 0, cup: null };
function buildCard(c, prog) {
  showUI.list.innerHTML = "";
  CARD.rows = []; CARD.map = []; CARD.layers = []; CARD.filled = 0;
  const kind = prog.some(s => s[0] === "fire") ? "fire" : prog.some(s => s[0] === "shake") ? "shake" : prog.some(s => s[0] === "stir") ? "stir" : "build";
  showUI.sub.textContent = { fire: "Фирменный · огненная подача", shake: "Взболтать в шейкере", stir: "Размешать со льдом", build: "Собрать в бокале" }[kind];
  prog.forEach((st, i) => {
    const r = cardRow(st, c);
    if (!r) { CARD.map[i] = -1; return; }
    const li = document.createElement("li");
    if (r.tech) li.className = "tech";
    li.innerHTML = `<i${r.col ? ` style="background:${r.col}"` : ""}></i><span class="n"></span><span class="a"></span>`;
    li.querySelector(".n").textContent = r.name; li.querySelector(".a").textContent = r.amt;
    showUI.list.appendChild(li);
    CARD.map[i] = CARD.rows.length;
    CARD.rows.push(li);
  });
  CARD.total = prog.reduce((s, st) => s + (st[0] === "jig" || st[0] === "pour" ? st[2] : st[0] === "top" ? 70 : st[0] === "float" ? 15 : st[0] === "hot" ? st[1] : st[0] === "squeeze" ? 10 : st[0] === "dash" ? 4 : 0), 0) || 100;
  const cup = CUP_SVG[c.cup] || CUP_SVG.rocks;
  const stem = cup.stem ? `<path d="M50 ${cup.stem[0]} L50 ${cup.stem[1]}" class="st"/><ellipse cx="50" cy="${cup.stem[1] + 3}" rx="17" ry="3" class="st"/>` : "";
  showUI.cup.innerHTML = `<defs><clipPath id="sc-clip"><path d="${cup.d}"/></clipPath></defs><g clip-path="url(#sc-clip)" id="sc-fill"></g><path d="${cup.d}" class="gl"/>${stem}`;
  CARD.cup = cup;
}
function cardStep(i) {
  const k = CARD.map[i];
  if (k === undefined || k < 0) return;
  CARD.rows.forEach((li, j) => { li.classList.toggle("now", j === k); if (j < k) li.classList.add("done"); });
  const li = CARD.rows[k];
  if (li && li.scrollIntoView && showUI.list.scrollHeight > showUI.list.clientHeight) li.scrollIntoView({ block: "nearest", inline: "nearest" });
}
function cardDone() { CARD.rows.forEach(li => { li.classList.remove("now"); li.classList.add("done"); }); }
/* слой в маленьком бокале на карточке */
function cardLayer(col, ml) {
  const cup = CARD.cup, fill = document.getElementById("sc-fill");
  if (!cup || !fill) return;
  const H = cup.bot - cup.top, h = H * .88 * ml / CARD.total;
  const y = cup.bot - CARD.filled - h;
  CARD.filled += h;
  const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  r.setAttribute("x", 0); r.setAttribute("y", y.toFixed(2)); r.setAttribute("width", 100); r.setAttribute("height", (h + .6).toFixed(2));
  r.setAttribute("fill", "#" + col.getHexString());
  r.classList.add("ly");
  fill.appendChild(r);
  CARD.layers.push(r);
}
function cardMix(col) { const h = "#" + new THREE.Color(col).getHexString(); CARD.layers.forEach(r => r.setAttribute("fill", h)); }
/* ярлык у бутылки: «Текила · 50 мл» рядом с этикеткой */
const TAG = { obj: null };
function tagOn(obj, text) { TAG.obj = obj; showUI.tag.textContent = text; showUI.tag.classList.add("show"); }
function tagOff() { TAG.obj = null; showUI.tag.classList.remove("show"); }
const _tp = V3();
onTick(() => {
  if (!TAG.obj || !SHOW.on) return;
  TAG.obj.updateMatrixWorld(true);
  TAG.obj.localToWorld(_tp.set(0, TAG.obj.userData.top * .5, 0)).project(camera);
  const x = (_tp.x * .5 + .5) * innerWidth, y = (-_tp.y * .5 + .5) * innerHeight;
  const W = showUI.tag.offsetWidth || 140;
  const left = innerWidth <= 640 ? x - W - 30 : x < innerWidth * .5 ? x + 40 : x - W - 40;
  showUI.tag.style.transform = `translate(${clamp(left, 8, innerWidth - W - 8).toFixed(0)}px, ${clamp(y - 16, 70, innerHeight - 170).toFixed(0)}px)`;
});

/* ---------- лёд ---------- */
function iceSpot(V, crushed) {
  const n = V.ice.length, r = Math.max(.006, Math.min(V.r0, V.r1) * .55);
  const a = n * 2.39996, per = crushed ? 6 : 3;
  const ring = n % per === 0 ? .2 : 1;
  return V3(Math.cos(a) * r * ring, V.y0 + .013 + Math.floor(n / per) * (crushed ? .011 : .02), Math.sin(a) * r * ring);
}
async function dropCube(V, from, crushed) {
  const cube = new THREE.Mesh(crushed ? crushGeo : cubeGeo, MX.ice);
  cube.renderOrder = 5;
  cube.position.copy(from);
  cube.rotation.set(rr(0, 3), rr(0, 3), 0);
  world.add(cube);
  const local = iceSpot(V, crushed);
  V.ice.push(cube);
  const dst = V.g.localToWorld(local.clone());
  await tween(cube.position, { x: dst.x, y: dst.y, z: dst.z }, SHOW.fast ? .001 : rr(.16, .24), ease.in);
  V.g.attach(cube);
  SND.clink();
}
async function stepIce(st) {
  const V = st[1] === "tin" ? P.tin : st[1] === "mixer" ? P.mixer : SHOW.glassV, crushed = !!st[2];
  const n = crushed ? 12 : V === SHOW.glassV ? (SHOW.c.cup === "rocks" ? 3 : 5) : 7;
  const S = P.scoop.g, R = bt.R;
  shot(choose(["macro", "low", "medium"]), ST.bucket.clone().add(V3(.15, .12, .05)));
  bt.look = ST.bucket;
  // совок за ручку: ладонь сверху, пальцы вдоль ручки
  await grip(R, S, { p: V3(-.06, .006, 0), r: .009, f: V3(0, 0, 1), n: V3(0, -1, 0), pose: "grip", along: .045 }, .45);
  const inB = ST.bucket.clone().add(V3(.02, .11, 0));
  await move(S, inB.clone().add(V3(0, .09, 0)), { q: Qe(0, .25, -.5), dur: .4, arc: .03 });
  await move(S, inB, { q: Qe(0, .25, -.7), dur: .2, e: ease.in });
  P.scoop.cubes.forEach((c, i) => { c.visible = i < Math.min(5, n); c.geometry = crushed ? crushGeo : cubeGeo; });
  SND.clink();
  await move(S, inB.clone().add(V3(0, .1, 0)), { q: Qe(0, .25, .2), dur: .25, e: ease.out });
  follow(mouth(V));
  bt.look = mouth(V);
  // над сосудом и наклон ковшом вниз
  const over = mouth(V, .06).add(V3(-.04, 0, 0));
  await move(S, over, { q: Qe(0, 0, .2), dur: .55, arc: .05 });
  await move(S, over.clone().add(V3(.01, -.01, 0)), { q: Qe(0, 0, -.9), dur: .25 });
  P.scoop.cubes.forEach(c => { c.visible = false; });
  const from = mouth(V, .04);
  for (let i = 0; i < n; i++) { dropCube(V, from.clone().add(V3(rr(-.012, .012), rr(0, .03), rr(-.012, .012))), crushed); await ws(crushed ? .03 : .06); }
  await ws(.2);
  await move(S, over.clone().add(V3(0, .03, 0)), { q: Qe(0, 0, .1), dur: .25 });
  await move(S, ST.scoop, { q: Qe(0, 0, 0), dur: .45, arc: .05 });
  letGo(R);
  await rest(R);
}

/* ---------- бутылка: из рейла, показать этикетку, налить ---------- */
async function bottleUp(ing, label) {
  const b = makeBottle(ing), u = b.userData, R = bt.R;
  place(b, ST.rail, Qe(0, 0, 0));
  bt.look = b.position.clone().add(V3(0, .3, 0));
  await grip(R, b, wrap(-1, V3(0, u.top * .5, 0), u.r), .4);
  // поднимает и на миг показывает этикетку гостю
  const show = B(-.17, TOP() + .1, .36);
  await move(b, show, { q: Qe(0, rr(-.15, .15), 0), dur: .5, arc: .04 });
  tagOn(b, `${NOM[ing] || ""}${label ? " · " + label : ""}`);
  const r = Math.random();
  if (r < .25 && !SHOW.fast) {
    // прокрутка в ладони
    await move(b, show.clone().add(V3(0, .02, 0)), { q: Qe(0, Math.PI * 2 - .01, 0), dur: .55 });
  } else if (r < .42 && !SHOW.fast) {
    // подброс с переворотом и ловля
    const H = HANDS.get(R); HANDS.delete(R);
    handPose(R, "open");
    await move(b, show.clone().add(V3(0, .26, 0)), { q: Qe(Math.PI, 0, 0), dur: .3, e: ease.out });
    await move(b, show, { q: Qe(Math.PI * 2 - .001, 0, 0), dur: .3, e: ease.in });
    b.quaternion.identity();
    HANDS.set(R, H); handPose(R, "grip", u.r);
    SND.tap();
  } else await ws(.35);
  return b;
}
async function bottleDown(b) {
  tagOff();
  await move(b, ST.rail.clone().add(V3(0, .06, 0)), { q: Qe(0, 0, 0), dur: .45, arc: .03 });
  letGo(bt.R);
  move(b, ST.rail.clone().add(V3(0, -.35, 0)), { dur: .3, e: ease.in }).then(() => drop(b), () => drop(b));
  rest(bt.R);
}
/* налить из предмета с носиком: носик подходит к цели, поворот вокруг носика, струя */
async function pourFrom(o, spoutLocal, to, ml, col, { gap = .05, ang = -2.25, rate = 1, fill = null, approach = .5, w = 1 } = {}) {
  const tgt = to().add(V3(0, gap, 0));
  const q1 = Qz(ang * .45);
  await move(o, posFor(o, spoutLocal, tgt.clone().add(V3(ang < 0 ? -.03 : .03, .03, 0)), q1), { q: q1, dur: approach, arc: .03 });
  await tiltAbout(o, spoutLocal, Qz(ang), .32);
  const spout = v => v.copy(o.localToWorld(spoutLocal.clone()));
  streamOn(spout, v => v.copy(to()), col, w * (ml > 60 ? 1.25 : 1));
  const dur = (.45 + ml / 65) / rate;
  SND.pour(Math.min(2.5, dur));
  await waitTicks(dur, k => { if (fill) fill(k); });
  streamOff();
  // отсекает струю: горлышко вверх
  await tiltAbout(o, spoutLocal, Qz(ang * .4), .22);
}

/* ---------- джиггер ---------- */
let jigOn = false;
const JIG_WAIST = V3(0, .046, 0);
async function jiggerUp(V) {
  const L = bt.L, J = P.jig.g;
  if (!jigOn) {
    await grip(L, J, wrap(1, JIG_WAIST, .01, { pose: "pinch", along: .05 }), .4);
    jigOn = true;
  }
  await move(J, posFor(J, JIG_WAIST, mouth(V, .05).add(V3(.035, 0, -.005)), Qe(0, 0, 0)), { q: Qe(0, 0, 0), dur: .4, arc: .03 });
}
async function jiggerPark() {
  if (!jigOn) return;
  await move(P.jig.g, ST.jig, { q: Qe(0, 0, 0), dur: .4, arc: .04 });
  letGo(bt.L); jigOn = false;
  await rest(bt.L);
}
async function stepJig(st) {
  const [, ing, ml, into] = st;
  const V = into === "glass" ? SHOW.glassV : SHOW.main;
  const col = liqOf(ing), J = P.jig.g, jl = P.jig.liq;
  shot(choose(["macro", "low", "side", "macro"]), mouth(V, .12).add(V3(-.06, 0, 0)));
  const [b] = await Promise.all([bottleUp(ing, `${ml} мл`), jiggerUp(V)]);
  const full = .039 * clamp(ml / 50, .25, 1);
  const jSurf = () => J.localToWorld(V3(0, .049 + Math.max(.004, jl.scale.y), 0));
  follow(J.localToWorld(V3(0, .1, 0)));
  bt.look = J.position;
  const high = chance(.35) && ml >= 20;
  jl.material.color.copy(col); jl.material.emissive = col.clone().multiplyScalar(.3);
  await pourFrom(b, V3(0, b.userData.top, 0), jSurf, ml, col, {
    gap: high ? rr(.18, .26) : rr(.05, .08), rate: high ? .85 : 1,
    fill: k => { jl.visible = k > .02; jl.scale.y = Math.max(.0001, full * k); }
  });
  if (high) bt.look = camera.position;
  bottleDown(b);
  // джиггер переворачивается над сосудом
  follow(mouth(V, .04));
  bt.look = mouth(V);
  const flip = 2.5;
  await tiltAbout(J, JIG_WAIST, Qz(flip), .26, ease.in);
  streamOn(v => v.copy(J.localToWorld(V3(-.025, .089, 0))), v => v.copy(surface(V)), col, .95);
  const m0 = V.ml;
  await waitTicks(.34, k => { jl.scale.y = Math.max(.0001, full * (1 - k)); V.ml = m0 + ml * k; if (V !== P.tin) { V.col.lerp(col, .08); setLevel(V); } });
  streamOff();
  jl.visible = false;
  V.ml = m0 + ml; V.col.lerp(col, ml / Math.max(V.ml, 1)); setLevel(V);
  cardLayer(col, ml);
  await tiltAbout(J, JIG_WAIST, Qz(0), .24);
  // иногда небрежно крутит джиггер пальцами
  if (chance(.25) && !SHOW.fast) await move(J, J.position.clone().add(V3(0, .02, 0)), { q: Qe(0, Math.PI * 2 - .01, 0), dur: .45 });
}
async function stepPour(st, isTop = false) {
  const [, ing, ml0] = st, ml = isTop ? 70 : ml0;
  const V = SHOW.glassV, col = liqOf(ing);
  await jiggerPark();
  shot(choose(["side", "macro", "low"]), mouth(V, .05));
  const b = await bottleUp(ing, isTop ? "доверху" : `${ml} мл`);
  bt.look = mouth(V);
  follow(mouth(V, .08));
  const m0 = V.ml;
  await pourFrom(b, V3(0, b.userData.top, 0), () => surface(V), ml, col, {
    gap: isTop ? rr(.04, .07) : rr(.1, .2), rate: isTop ? .75 : 1.1,
    fill: k => { V.ml = m0 + ml * k; V.col.lerp(col, .05); setLevel(V); }
  });
  cardLayer(col, ml);
  await bottleDown(b);
}
async function stepDash(st) {
  const V = st[3] === "glass" ? SHOW.glassV : SHOW.main;
  await jiggerPark();
  shot("macro", mouth(V, .06));
  const b = await bottleUp("bitters", `${st[2]} ${st[2] === 1 ? "капля" : "капли"}`);
  const top = V3(0, b.userData.top, 0), q = Qz(-2.4);
  follow(mouth(V, .06));
  await move(b, posFor(b, top, mouth(V, .09), q), { q, dur: .45, arc: .03 });
  for (let i = 0; i < (st[2] || 1); i++) {
    const p0 = b.position.clone();
    await move(b, p0.clone().add(V3(0, -.03, 0)), { dur: .08, e: ease.in });
    const d = mesh(new THREE.SphereGeometry(.004, 8, 6), std({ color: 0x5a1a0c }), 0, 0, 0);
    b.localToWorld(d.position.copy(top));
    tween(d.position, { y: surface(V).y }, .18, ease.in).then(() => drop(d));
    await move(b, p0, { dur: .14, e: ease.out });
    await ws(.12);
  }
  cardLayer(new THREE.Color(0x5a1a0c), 4);
  await bottleDown(b);
}

/* ---------- шейк ---------- */
async function stepShake(st) {
  const dry = !!st && st[1] === "dry";
  const V = P.tin, T = V.g, C = P.cap.g, R = bt.R, L = bt.L;
  await jiggerPark();
  shot(choose(["macro", "low"]), mouth(V, .05));
  bt.look = mouth(V);
  // малый стакан: левой рукой, переворот и сверху на шейкер
  await grip(L, C, wrap(1, V3(0, .07, 0), .04), .38);
  const qC = Qx(Math.PI);
  await move(C, posFor(C, V3(0, .123, 0), mouth(V, .05), qC), { q: qC, dur: .45, arc: .05 });
  await move(C, posFor(C, V3(0, .123, 0), mouth(V, -.03), qC), { dur: .16, e: ease.in });
  T.attach(C);
  // ладонью прихлопывает
  letGo(L, "flat");
  const capTop = () => C.localToWorld(V3(0, 0, 0));
  await handTo(L, capTop().add(V3(0, .06, -.03)), V3(0, 0, 1), V3(0, -1, 0), "flat", .16);
  await handTo(L, capTop().add(V3(0, .03, -.03)), V3(0, 0, 1), V3(0, -1, 0), "flat", .08);
  SND.tap();
  // обе руки: правая на корпусе, левая на дне малого стакана
  const tl = T.worldToLocal(capTop());
  await Promise.all([
    grip(R, T, wrap(-1, V3(0, .07, 0), .047), .35),
    grip(L, T, { p: tl.clone().add(V3(0, .004, 0)), r: .012, f: V3(0, 0, 1), n: V3(0, -1, 0), pose: "hook", along: .05 }, .35)
  ]);
  const style = choose(["shoulder", "shoulder", "front", "hard"]);
  // иногда подброс: шейкер переворачивается в воздухе
  if (chance(.22) && !SHOW.fast) {
    const hold = [HANDS.get(R), HANDS.get(L)]; HANDS.clear();
    handPose(R, "open"); handPose(L, "open");
    const p0 = T.position.clone();
    await move(T, p0.clone().add(V3(0, .3, .02)), { q: Qe(0, Math.PI, 0), dur: .32, e: ease.out });
    await move(T, p0.clone().add(V3(0, .12, 0)), { q: Qe(0, Math.PI * 2 - .001, 0), dur: .28, e: ease.in });
    T.quaternion.identity();
    HANDS.set(R, hold[0]); HANDS.set(L, hold[1]); handPose(R, "grip", .047); handPose(L, "hook");
    SND.tap();
  }
  shot(choose(["face", "medium", "face"]), B(-.05, 1.42, .3));
  bt.look = chance(.6) ? camera.position : null;
  BT.nod = 1;
  // ось шейкера: корпус у плеча, малый стакан к гостю
  const axis = { shoulder: V3(.25, -.06, .97), front: V3(.05, .97, .22), hard: V3(.3, .1, .95) }[style].normalize();
  const base = { shoulder: B(-.17, 1.46, .12), front: B(-.03, 1.2, .3), hard: B(-.16, 1.4, .13) }[style];
  const ctr = base.clone().addScaledVector(axis, .14);
  const q = new THREE.Quaternion().setFromUnitVectors(_up, axis);
  await move(T, base, { q, dur: .5, arc: .04 });
  follow(ctr);
  const dur = rr(2.4, 3.1), hz = rr(2.6, 3.3), amp = rr(.06, .085);
  if (dry) SND.slosh(Math.min(dur, 3), hz); else SND.rattle(Math.min(dur, 3), hz);
  const side = V3().crossVectors(axis, V3(1, 0, 0)).normalize();
  await waitTicks(dur, (k, t) => {
    const ph = t * hz * Math.PI * 2;
    let o;
    if (style === "hard") { const i = Math.floor(((ph / (Math.PI * 2)) % 1) * 3); o = [axis.clone().multiplyScalar(amp), side.clone().multiplyScalar(-.04), axis.clone().multiplyScalar(-amp * .8)][i]; }
    else o = axis.clone().multiplyScalar(Math.sin(ph) * amp).addScaledVector(side, Math.cos(ph) * .015);
    T.position.copy(base).add(o);
    T.quaternion.copy(q).multiply(Qx(Math.sin(ph) * .08));
    bt.spine.position.y = Math.sin(ph) * .005;
    bt.leanT = .1 + Math.sin(ph * .5) * .02;
  });
  BT.nod = 0; bt.spine.position.y = 0; bt.leanT = .1;
  if (!dry) cardMix(SHOW.c.pour);
  // на стойку: металл в инее (после сухого шейка без льда инея нет)
  if (!dry) T.children[0].material = MX.frost;
  shot(choose(["macro", "low"]), mouth(V, .09));
  await move(T, ST.tin, { q: Qe(0, 0, 0), dur: .5, arc: .05 });
  SND.tap();
  // ладонью по стыку, малый стакан снимается
  letGo(L, "flat");
  const seam = mouth(V, .0);
  await handTo(L, seam.clone().add(V3(.13, .02, -.02)), V3(0, .3, 1), V3(-1, 0, 0), "flat", .2);
  await handTo(L, seam.clone().add(V3(.075, .02, -.02)), V3(0, .3, 1), V3(-1, 0, 0), "flat", .07);
  SND.tap();
  world.attach(C);
  await grip(L, C, wrap(1, V3(0, .06, 0), .04), .3);
  await move(C, C.position.clone().add(V3(.02, .08, 0)), { q: Qx(Math.PI).multiply(Qe(0, .6, 0)), dur: .3 });
  await move(C, ST.cap, { q: Qe(0, 0, 0), dur: .45, arc: .06 });
  letGo(L); letGo(R);
  await Promise.all([rest(L), rest(R)]);
}

/* ---------- стир ---------- */
const SPOON_GRIP = { p: V3(0, -.05, 0), r: .004, f: V3(0, -1, .25), n: V3(-1, 0, 0), pose: "pinch", along: .07 };
async function stepStir() {
  const V = P.mixer, S = P.spoon.g, R = bt.R, L = bt.L;
  await jiggerPark();
  shot(choose(["macro", "low", "side"]), mouth(V, .03));
  bt.look = mouth(V);
  await grip(L, V.g, wrap(1, V3(0, .05, 0), .05), .35);
  place(S, ST.spoon, Qx(Math.PI / 2));
  await grip(R, S, SPOON_GRIP, .4);
  const c0 = mouth(V);
  await move(S, c0.clone().add(V3(0, .32, 0)), { q: Qe(0, 0, 0), dur: .45, arc: .04 });
  await move(S, c0.clone().add(V3(.026, .155, 0)), { dur: .3, e: ease.in });
  const dur = rr(2.4, 3), w = rr(8.5, 11);
  SND.tinkle(Math.min(dur, 3));
  await waitTicks(dur, (k, t) => {
    const a = t * w;
    // ложка идёт по стенке, спинкой к стеклу
    S.position.set(c0.x + Math.cos(a) * .026, c0.y + .155, c0.z + Math.sin(a) * .026);
    S.quaternion.copy(Qe(0, -a, 0)).multiply(Qz(.06));
    V.ice.forEach((cube, i) => { cube.rotation.y += .06; const b = a * .35 + i * 1.9, rr_ = (i % 3) ? .022 : .006; cube.position.x = Math.cos(b) * rr_; cube.position.z = Math.sin(b) * rr_; });
  });
  V.col.lerp(new THREE.Color(SHOW.c.pour), .8); setLevel(V);
  cardMix(SHOW.c.pour);
  await move(S, c0.clone().add(V3(0, .34, 0)), { q: Qe(0, 0, 0), dur: .35, e: ease.out });
  if (chance(.35) && !SHOW.fast) await move(S, c0.clone().add(V3(0, .36, 0)), { q: Qe(0, Math.PI * 4 - .01, 0), dur: .55 });
  await move(S, ST.spoon, { q: Qx(Math.PI / 2), dur: .45, arc: .04 });
  letGo(R); letGo(L);
  await Promise.all([rest(R), rest(L)]);
}
async function stepStirIn() {
  const V = SHOW.glassV, S = P.spoon.g, R = bt.R;
  await jiggerPark();
  shot(choose(["macro", "low"]), mouth(V, .03));
  place(S, ST.spoon, Qx(Math.PI / 2));
  await grip(R, S, SPOON_GRIP, .4);
  const c0 = mouth(V);
  await move(S, c0.clone().add(V3(0, .34, 0)), { q: Qe(0, 0, 0), dur: .45, arc: .04 });
  const knob = V.g.position.y + .305 + .015;
  await move(S, V3(c0.x, knob, c0.z), { dur: .3, e: ease.in });
  const dur = rr(1.2, 1.7);
  SND.tinkle(dur);
  await waitTicks(dur, (k, t) => { const a = t * 9; S.position.set(c0.x + Math.cos(a) * .012, knob + Math.sin(t * 6) * .01, c0.z + Math.sin(a) * .012); S.quaternion.copy(Qe(0, -a, 0)); });
  V.col.lerp(new THREE.Color(SHOW.c.pour), .85); setLevel(V);
  cardMix(SHOW.c.pour);
  await move(S, c0.clone().add(V3(0, .36, 0)), { q: Qe(0, 0, 0), dur: .3 });
  await move(S, ST.spoon, { q: Qx(Math.PI / 2), dur: .4, arc: .04 });
  letGo(R);
  await rest(R);
}

/* ---------- процеживание ---------- */
async function stepStrain() {
  const S = SHOW.main, G = SHOW.glassV, R = bt.R, L = bt.L, SR = P.strainer.g;
  await jiggerPark();
  shot(choose(["macro", "low"]), mouth(S, .03));
  bt.look = mouth(S);
  // стрейнер на край, ручкой к бармену
  place(SR, ST.strainer, Qe(0, 0, 0));
  await grip(L, SR, { p: V3(0, 0, .11), r: .004, f: V3(0, 0, -1), n: V3(0, -1, 0), pose: "pinch", along: .05 }, .35);
  await move(SR, mouth(S, .004), { q: Qe(0, Math.PI, 0), dur: .45, arc: .05 });
  S.g.attach(SR);
  letGo(L);
  const high = chance(.3);
  // правая рука: корпус, указательный прижимает стрейнер
  await grip(R, S.g, wrap(-1, V3(0, .12, 0), .048), .35);
  R.ft = [.12, .55, .62, .7];
  // левая придерживает бокал у основания
  grip(L, G.g, wrap(1, V3(0, .012, 0), .015, { pose: "pinch", along: .05 }), .4).catch(() => {});
  shot(choose(["side", "macro", "low"]), mouth(G, .09));
  bt.look = mouth(G);
  const spout = V3(-S.mouthR, S.mouthY, 0);
  const col = new THREE.Color(SHOW.c.pour), ml = Math.max(40, S.ml * .82), m0 = G.ml;
  G.col.copy(col);
  await pourFrom(S.g, spout, () => surface(G), ml, col, {
    gap: high ? rr(.12, .16) : rr(.05, .08), ang: 1.75, rate: .9,
    fill: k => { G.ml = m0 + ml * k; setLevel(G); }
  });
  S.ml = 0;
  letGo(L);
  rest(L);
  await move(S.g, ST.tin, { q: Qe(0, 0, 0), dur: .5, arc: .05 });
  letGo(R);
  world.attach(SR);
  SR.visible = false;
  await rest(R);
}

/* ---------- мята, мадлер, лайм, ободок, гренадин ---------- */
function leafMesh() { const l = mesh(new THREE.SphereGeometry(.013, 10, 6), std({ color: 0x3f8f3a, roughness: .55, emissive: 0x0a2a08 }), 0, 0, 0); l.scale.set(1, .22, .55); return l; }
const PINCH = (p = V3(0, 0, 0)) => ({ p, r: .006, f: V3(.2, -.45, .85).normalize(), n: V3(.95, 0, .25).normalize(), pose: "pinch", along: .068 });
async function stepLeaves() {
  const G = SHOW.glassV, R = bt.R;
  shot(choose(["macro", "low"]), mouth(G, .04));
  bt.look = ST.tray;
  const bunch = new THREE.Group();
  for (let i = 0; i < 6; i++) { const l = leafMesh(); world.remove(l); l.position.set(rr(-.008, .008), i * .006, rr(-.008, .008)); l.rotation.set(rr(0, 1), rr(0, 3), 0); bunch.add(l); }
  world.add(bunch);
  place(bunch, ST.tray.clone().add(V3(.04, .02, 0)));
  await grip(R, bunch, PINCH(V3(0, .01, 0)), .4);
  await move(bunch, mouth(G, .06), { dur: .5, arc: .06 });
  bt.look = mouth(G);
  letGo(R, "open");
  [...bunch.children].forEach((l, i) => {
    world.attach(l);
    const d = G.g.localToWorld(V3(rr(-.012, .012), G.y0 + .006 + i * .003, rr(-.012, .012)));
    tween(l.position, { x: d.x, y: d.y, z: d.z }, SHOW.fast ? .001 : .3 + i * .03, ease.in).then(() => G.g.attach(l));
  });
  world.remove(bunch);
  await ws(.45);
  await rest(R);
}
async function stepMuddle() {
  const G = SHOW.glassV, MD = P.muddler.g, R = bt.R, L = bt.L;
  shot(choose(["macro", "low"]), mouth(G, .04));
  const home = ST.spoon.clone().add(V3(.02, .012, -.05));
  place(MD, home, Qz(Math.PI / 2));
  await Promise.all([grip(R, MD, { p: V3(0, -.03, 0), r: .014, f: V3(0, 0, 1), n: V3(1, 0, 0), pose: "grip" }, .4), grip(L, G.g, wrap(1, V3(0, .04, 0), .035), .4)]);
  const c0 = mouth(G);
  await move(MD, c0.clone().add(V3(0, .26, 0)), { q: Qe(0, 0, 0), dur: .45, arc: .03 });
  const low = G.g.localToWorld(V3(0, G.y0 + .015, 0)).add(V3(0, .22, 0));
  for (let i = 0; i < 4; i++) {
    await move(MD, low, { q: Qe(0, i * .9 + .9, 0), dur: .22, e: ease.in });
    SND.tick();
    await move(MD, low.clone().add(V3(0, .05, 0)), { q: Qe(0, i * .9 + .5, 0), dur: .18, e: ease.out });
  }
  G.col.set(0xbfdc8a);
  await move(MD, home, { q: Qz(Math.PI / 2), dur: .45, arc: .05 });
  letGo(R); letGo(L);
  MD.visible = false;
  await Promise.all([rest(R), rest(L)]);
}
async function stepSqueeze() {
  const G = SHOW.glassV, R = bt.R;
  shot(choose(["macro", "low"]), mouth(G, .06));
  const wedge = mesh(new THREE.CylinderGeometry(.024, .024, .022, 14, 1, false, 0, Math.PI), std({ color: 0xa8c83e, roughness: .5, emissive: 0x1a2a00 }), 0, 0, 0);
  place(wedge, ST.tray.clone().add(V3(-.04, .02, -.02)), Qz(Math.PI / 2));
  await grip(R, wedge, PINCH(), .4);
  await move(wedge, mouth(G, .07), { q: Qz(Math.PI / 2).multiply(Qx(.4)), dur: .5, arc: .05 });
  handPose(R, "fist");
  for (let i = 0; i < 8; i++) {
    const d = mesh(new THREE.SphereGeometry(.0028, 6, 4), std({ color: 0xe0eeb0, emissive: 0x3a4a10 }), 0, 0, 0);
    d.position.copy(wedge.position);
    tween(d.position, { y: surface(G).y, x: d.position.x + rr(-.01, .01) }, .22, ease.in).then(() => drop(d));
    await ws(.04);
  }
  letGo(R, "open");
  const dst = G.g.localToWorld(V3(.008, G.y0 + .03, 0));
  await tween(wedge.position, { x: dst.x, y: dst.y, z: dst.z }, SHOW.fast ? .001 : .22, ease.in);
  G.g.attach(wedge);
  SND.plop();
  cardLayer(new THREE.Color(0xd9e8a0), 10);
  await rest(R);
}
async function stepRim() {
  const G = SHOW.glassV, R = bt.R;
  place(P.salt, ST.salt);
  shot(choose(["macro", "side"]), ST.salt.clone().add(V3(0, .1, 0)));
  bt.look = ST.salt;
  await grip(R, G.g, wrap(-1, V3(0, .03, 0), .008, { pose: "pinch", along: .05 }), .4);
  const lip = V3(0, G.mouthY, 0), over = ST.salt.clone().add(V3(0, .008, 0)), qInv = Qx(Math.PI * .82);
  await move(G.g, posFor(G.g, lip, over.clone().add(V3(0, .05, 0)), qInv), { q: qInv, dur: .55, arc: .08 });
  await move(G.g, posFor(G.g, lip, over, qInv), { dur: .18 });
  await waitTicks(.9, k => { G.g.quaternion.copy(Qe(0, k * Math.PI * 2, 0)).multiply(qInv); G.g.position.copy(posFor(G.g, lip, over)); });
  const rim = mesh(new THREE.TorusGeometry(G.mouthR + .0015, .0032, 6, 32), std({ color: 0xf4f1ea, roughness: .95 }), 0, G.mouthY - .004, 0, G.g);
  rim.rotation.x = Math.PI / 2;
  await move(G.g, ST.glass, { q: Qe(0, 0, 0), dur: .6, arc: .06 });
  letGo(R);
  P.salt.visible = false;
  await rest(R);
}
async function stepFloat() {
  const G = SHOW.glassV;
  await jiggerPark();
  shot(choose(["side", "macro"]), mouth(G, -.03));
  const b = await bottleUp("grenadine", "15 мл");
  const col = new THREE.Color(0xb3122a);
  const layer = mesh(new THREE.CylinderGeometry(G.r0 * .98, G.r0 * .96, 1, 24), std({ color: col, transparent: true, opacity: .92, roughness: .2, emissive: col.clone().multiplyScalar(.3) }), 0, G.y0, 0, G.g);
  layer.geometry.translate(0, .5, 0); layer.scale.y = .0001; layer.renderOrder = 4;
  await pourFrom(b, V3(0, b.userData.top, 0), () => mouth(G, -.02).add(V3(-.015, 0, 0)), 15, col, { gap: .04, ang: -2.0, rate: .6, fill: k => { layer.scale.y = Math.max(.0001, (G.y1 - G.y0) * .28 * k); } });
  cardLayer(col, 15);
  await bottleDown(b);
}

/* ---------- гарнир ---------- */
function garnishMesh(kind) {
  const col = GCOL[kind] || 0x9fc23a;
  const g = new THREE.Group();
  const m = std({ color: col, roughness: kind === "cherry" ? .15 : .45, emissive: new THREE.Color(col).multiplyScalar(.15) });
  if (kind === "olive" || kind === "cherry") {
    mesh(new THREE.SphereGeometry(.011, 16, 12), m, 0, 0, 0, g).scale.set(1, kind === "olive" ? .8 : 1, 1);
    if (kind === "olive") { mesh(new THREE.CylinderGeometry(.0011, .0011, .11, 6), std({ color: 0xd8c08a, roughness: .5 }), 0, .035, 0, g); mesh(new THREE.SphereGeometry(.003, 8, 6), std({ color: 0xa8101e }), 0, 0, .009, g); }
    else { const s = mesh(new THREE.CylinderGeometry(.0009, .0009, .035, 4), std({ color: 0x3a5a1a }), 0, .02, 0, g); s.rotation.z = .3; }
  } else if (kind === "mint") {
    mesh(new THREE.CylinderGeometry(.0015, .0015, .06, 4), std({ color: 0x2a5a1a }), 0, .02, 0, g);
    for (let i = 0; i < 7; i++) { const l = leafMesh(); world.remove(l); l.position.set(rr(-.012, .012), .01 + i * .007, rr(-.012, .012)); l.rotation.set(rr(-.6, .6), rr(0, 3), rr(-.6, .6)); g.add(l); }
  } else if (kind === "flame") {
    const peel = new THREE.SphereGeometry(.026, 14, 8, 0, Math.PI * 2, 0, Math.PI * .28); peel.scale(1, .5, .62);
    mesh(peel, m, 0, -.006, 0, g);
  } else if (kind === "lemon") {
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => V3(Math.cos(i * .9) * .012, -i * .006, Math.sin(i * .9) * .012)));
    mesh(new THREE.TubeGeometry(curve, 40, .004, 6), m, 0, .03, 0, g);
  } else {
    const w = mesh(new THREE.CylinderGeometry(.024, .024, .005, 22, 1, false, 0, kind === "wedge" ? Math.PI : Math.PI * 2), m, 0, 0, 0, g);
    w.rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(.019, .019, .0055, 22), std({ color: new THREE.Color(col).lerp(new THREE.Color(0xffffff), .45), roughness: .6 }), 0, 0, 0, g).rotation.x = Math.PI / 2;
  }
  world.add(g);
  return g;
}
async function stepGarnish(c) {
  const G = SHOW.glassV, kind = c.garnish || "wheel", R = bt.R, L = bt.L;
  const rw = G.mouthR * G.scale, m = mouth(G);
  shot(choose(["macro", "low", "side"]), m.clone().add(V3(0, .06, 0)));
  bt.look = ST.tray;
  const gm = garnishMesh(kind);
  place(gm, ST.tray.clone().add(V3(.03, .02, 0)));
  const pinch = PINCH(V3(0, kind === "olive" ? .07 : 0, 0));
  if (kind !== "flame") await grip(R, gm, pinch, .42);
  if (kind === "flame") {
    await stepFlameZest(gm, G);
  } else if (kind === "olive" || kind === "cherry") {
    // высоко над бокалом: пауза для гостя, затем медленно вниз
    await move(gm, m.clone().add(V3(0, .22, 0)), { dur: .55, arc: .04 });
    bt.look = camera.position;
    follow(m.clone().add(V3(0, .12, 0)));
    await ws(rr(.5, .8));
    bt.look = m;
    if (kind === "cherry" || chance(.35)) {
      letGo(R, "open");
      const dst = G.g.localToWorld(V3(0, G.y0 + Math.max(.012, (G.y1 - G.y0) * .55), 0));
      await tween(gm.position, { x: dst.x, y: dst.y, z: dst.z }, SHOW.fast ? .001 : .3, ease.in);
      SND.plop();
      for (let i = 0; i < 6; i++) { const s = mesh(new THREE.SphereGeometry(.003, 6, 4), std({ color: new THREE.Color(c.pour), transparent: true, opacity: .9 }), 0, 0, 0); s.position.copy(dst).add(V3(0, .02, 0)); tween(s.position, { x: s.position.x + rr(-.03, .03), y: s.position.y + rr(.02, .05), z: s.position.z + rr(-.03, .03) }, .25, ease.out).then(() => drop(s)); }
    } else {
      const dst = G.g.localToWorld(V3(0, G.y0 + (G.y1 - G.y0) * .4, 0));
      await move(gm, dst, { q: Qz(.3), dur: 1.1, e: ease.out });
      SND.plop();
      letGo(R, "open");
    }
  } else if (kind === "mint") {
    // хлопок: мята между ладонями отдаёт аромат
    const mid = B(-.05, 1.33, .38);
    await move(gm, mid, { q: Qx(-.3), dur: .5, arc: .04 });
    letGo(R, "flat");
    await Promise.all([handTo(R, mid.clone().add(V3(-.03, 0, 0)), V3(0, 1, .2), V3(1, 0, 0), "flat", .2), handTo(L, mid.clone().add(V3(.13, 0, 0)), V3(0, 1, .2), V3(-1, 0, 0), "flat", .3)]);
    await handTo(L, mid.clone().add(V3(.035, 0, 0)), V3(0, 1, .2), V3(-1, 0, 0), "flat", .1);
    SND.clap();
    await ws(.15);
    rest(L);
    await grip(R, gm, pinch, .25);
    await move(gm, m.clone().add(V3(.01, .01, 0)), { q: Qe(0, 0, 0), dur: .5 });
    letGo(R, "open");
  } else if (kind === "lemon") {
    // скручивает цедру над бокалом: брызги эфирного масла
    await move(gm, m.clone().add(V3(0, .1, 0)), { dur: .5, arc: .04 });
    await move(gm, m.clone().add(V3(0, .1, 0)), { q: Qe(0, Math.PI * 1.5, 0), dur: .45 });
    for (let i = 0; i < 12; i++) {
      const s = glowSprite(0xfff0a0, .035, gm.position.x, gm.position.y, gm.position.z, world, .9);
      tween(s.position, { x: s.position.x + rr(-.05, .05), y: s.position.y - rr(.03, .08), z: s.position.z + rr(-.05, .05) }, .45).then(() => drop(s));
    }
    await ws(.3);
    await move(gm, m.clone().add(V3(rw * .85, -.012, 0)), { q: Qz(.4), dur: .4 });
    letGo(R, "open");
  } else {
    // кружок на край бокала: надрез садится на стекло
    await move(gm, m.clone().add(V3(rw, .08, 0)), { q: Qe(0, Math.PI / 2, 0), dur: .5, arc: .04 });
    await move(gm, m.clone().add(V3(rw - .004, -.008, 0)), { dur: .3, e: ease.in });
    letGo(R, "open");
  }
  G.g.attach(gm);
  await ws(.2);
  await rest(R);
}

/* ---------- подача ---------- */
async function stepServe() {
  const G = SHOW.glassV, R = bt.R;
  shot(SEAT.on ? "medium" : choose(["medium", "low"]), G.g.position.clone().add(V3(0, .1, .15)));
  bt.look = G.g.position;
  // двумя пальцами за основание — бокал скользит к гостю
  await grip(R, G.g, { p: V3(0, .004, -.03), r: .006, f: V3(0, -.45, .9).normalize(), n: V3(0, -.9, -.45).normalize(), pose: "hook", along: .065 }, .4);
  follow(ST.serve.clone().add(V3(0, .1, 0)));
  await move(G.g, ST.serve, { dur: .9, e: ease.io });
  letGo(R, "flat");
  // открытая ладонь: «прошу»
  bt.look = camera.position;
  await handTo(R, B(-.16, TOP() + .1, .55), V3(-.3, .1, 1), V3(0, 1, .2), "flat", .4);
  bt.nod = .08;
  await ws(.35);
  bt.nod = 0;
  await ws(.45);
}

/* ---------- маленькие жесты между шагами ---------- */
const FLOURISH = [
  async () => { bt.look = camera.position; bt.nod = .07; await ws(.3); bt.nod = 0; await ws(.25); bt.look = null; },
  async () => { await Promise.all([handTo(bt.L, B(.04, 1.5, .12), V3(-.4, .8, .3), V3(-.4, 0, 1), "pinch", .35), handTo(bt.R, B(-.04, 1.5, .12), V3(.4, .8, .3), V3(.4, 0, 1), "pinch", .35)]); await ws(.3); await Promise.all([rest(bt.L), rest(bt.R)]); },
  async () => { for (let i = 0; i < 3; i++) { await handTo(bt.R, B(-.19, TOP() + .05, .3), V3(.3, -.3, 1), V3(0, -1, 0), "relax", .1); await handTo(bt.R, B(-.19, TOP() + .028, .3), V3(.3, -.3, 1), V3(0, -1, 0), "relax", .08); SND.tick(); } await rest(bt.R); },
  async () => { bt.tilt = rr(-.12, .12); bt.look = camera.position; await ws(.55); bt.tilt = 0; bt.look = null; }
];
async function flourish() { if (!SHOW.fast && chance(.3)) await choose(FLOURISH)(); }

/* ================= огонь: фирменный Hacheden и огненная струя ================= */
const flameTex = (blue) => {
  const t = canvasTex(64, 128, (g, w, h) => {
    // язык пламени: широкий снизу, узкий сверху
    g.beginPath(); g.moveTo(32, 4);
    g.bezierCurveTo(44, 40, 58, 74, 52, 100); g.bezierCurveTo(48, 120, 16, 120, 12, 100); g.bezierCurveTo(6, 74, 20, 40, 32, 4);
    const gr = g.createRadialGradient(32, 98, 2, 32, 82, 70);
    if (blue) { gr.addColorStop(0, "rgba(210,235,255,1)"); gr.addColorStop(.25, "rgba(90,150,255,.95)"); gr.addColorStop(.6, "rgba(40,70,220,.55)"); gr.addColorStop(1, "rgba(20,30,160,0)"); }
    else { gr.addColorStop(0, "rgba(255,250,220,1)"); gr.addColorStop(.25, "rgba(255,205,90,.95)"); gr.addColorStop(.6, "rgba(255,110,30,.6)"); gr.addColorStop(1, "rgba(200,40,10,0)"); }
    g.fillStyle = gr; g.fill();
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
};
const FTEX = { o: flameTex(false), b: flameTex(true) };
const fireMat = blue => new THREE.SpriteMaterial({ map: blue ? FTEX.b : FTEX.o, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
/* язычки пламени: группа спрайтов, size — общая сила огня */
const CLUSTERS = new Set();
function flames(parent, at, n, spread, { blue = .5, h = .05 } = {}) {
  const g = new THREE.Group(); g.position.copy(at); parent.add(g);
  const sp = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(fireMat(i / n < blue));
    s.center.set(.5, .1);
    const a = i * 2.4, r = spread * Math.sqrt((i + .5) / n);
    s.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, k: rr(.6, 1.1), ph: rr(0, 9), w: rr(.45, .7) };
    s.renderOrder = 8; g.add(s); sp.push(s);
  }
  const F = { g, sp, size: 0, h, on: true };
  CLUSTERS.add(F);
  return F;
}
function dropFlames(F) { if (!F) return; CLUSTERS.delete(F); F.g.parent && F.g.parent.remove(F.g); }
/* огненная струя: цепочка языков пламени по дуге */
const ARC = { on: false, p0: V3(), p1: V3(), p2: V3(), sp: [], k: 0 };
for (let i = 0; i < 44; i++) { const s = new THREE.Sprite(fireMat(i % 3 !== 0)); s.center.set(.5, .3); s.visible = false; s.renderOrder = 8; world.add(s); ARC.sp.push(s); }
const ARC_CORE = mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(V3(), V3(0, 0, 0), V3(0, -1, 0)), 16, .0035, 6), new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: .85, toneMapped: false, depthWrite: false }), 0, 0, 0);
ARC_CORE.visible = false;
function bez(t, out) { const u = 1 - t; return out.set(0, 0, 0).addScaledVector(ARC.p0, u * u).addScaledVector(ARC.p1, 2 * u * t).addScaledVector(ARC.p2, t * t); }
/* искры и угольки: летят вверх и гаснут */
const EMB = { n: 90, i: 0 };
EMB.geo = new THREE.BufferGeometry();
EMB.pos = new Float32Array(EMB.n * 3); EMB.col = new Float32Array(EMB.n * 3); EMB.v = new Float32Array(EMB.n * 3); EMB.life = new Float32Array(EMB.n);
EMB.geo.setAttribute("position", new THREE.BufferAttribute(EMB.pos, 3)); EMB.geo.setAttribute("color", new THREE.BufferAttribute(EMB.col, 3));
EMB.pts = new THREE.Points(EMB.geo, new THREE.PointsMaterial({ size: .011, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
EMB.pts.frustumCulled = false; EMB.pts.visible = false; world.add(EMB.pts);
function spark(p, v, life = rr(.5, 1.1)) {
  const i = EMB.i++ % EMB.n;
  EMB.pos.set([p.x, p.y, p.z], i * 3); EMB.v.set([v.x, v.y, v.z], i * 3); EMB.life[i] = life;
  EMB.pts.visible = true;
}
/* дым после того, как пламя гаснет */
const smokeTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, "rgba(200,190,180,.55)"); gr.addColorStop(1, "rgba(200,190,180,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
function puff(p, n = 7) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: .45, depthWrite: false, fog: false }));
    s.position.copy(p).add(V3(rr(-.02, .02), rr(0, .02), rr(-.02, .02))); s.scale.setScalar(.04); world.add(s);
    const d = SHOW.fast ? .001 : rr(1.4, 2.2);
    tween(s.position, { y: s.position.y + rr(.18, .32), x: s.position.x + rr(-.06, .06) }, d, ease.out);
    tween(s.scale, { x: .2, y: .2 }, d, ease.out);
    tween(s.material, { opacity: 0 }, d, ease.in).then(() => drop(s));
  }
}
/* свет огня: на время шоу берём свет камина из курилки и переносим к пламени */
const FIRELT = { on: false, pos: V3(), lev: 0, home: null, col: null };
const _fl = V3(), _fp = V3();
onTick((t, dt) => {
  // пламя дрожит
  let tot = 0; _fl.set(0, 0, 0);
  for (const F of CLUSTERS) {
    for (const s of F.sp) {
      const u = s.userData, n = .75 + .25 * Math.sin(t * 17 * u.k + u.ph) + .15 * Math.sin(t * 31 + u.ph * 3);
      const hgt = F.h * F.size * u.k * n;
      s.scale.set(hgt * u.w, hgt, 1);
      s.position.set(u.x + Math.sin(t * 9 + u.ph) * .002, 0, u.z);
      s.visible = F.size > .02;
    }
    if (F.size > .05) {
      F.g.getWorldPosition(_fp);
      _fl.addScaledVector(_fp, F.size); tot += F.size;
      if (Math.random() < F.size * dt * 18) spark(_fp.clone().add(V3(rr(-.01, .01), F.h * F.size * .5, rr(-.01, .01))), V3(rr(-.05, .05), rr(.15, .35), rr(-.05, .05)));
    }
  }
  // струя по дуге
  if (ARC.on) {
    const n = ARC.sp.length;
    ARC.sp.forEach((s, i) => {
      const tt = ((i + ARC.k * 6) % n) / n;
      if (tt > ARC.k + .02) { s.visible = false; return; }
      bez(tt, s.position);
      const f = (.038 + .018 * Math.sin(t * 23 + i * 1.7)) * (1.15 - tt * .35);
      s.scale.set(f * .75, f * 1.35, 1);
      s.visible = true;
    });
    ARC.k = Math.min(1, ARC.k + dt * 3.5);
    bez(.5, _fp); _fl.addScaledVector(_fp, 1.2); tot += 1.2;
    if (Math.random() < dt * 25) { bez(Math.random() * ARC.k, _fp); spark(_fp.clone(), V3(rr(-.06, .06), rr(.1, .3), rr(-.06, .06))); }
  }
  // искры
  if (EMB.pts.visible) {
    let alive = 0;
    for (let i = 0; i < EMB.n; i++) {
      if (EMB.life[i] <= 0) { EMB.col[i * 3] = EMB.col[i * 3 + 1] = EMB.col[i * 3 + 2] = 0; continue; }
      alive++;
      EMB.life[i] -= dt;
      for (let k = 0; k < 3; k++) EMB.pos[i * 3 + k] += EMB.v[i * 3 + k] * dt;
      EMB.v[i * 3 + 1] -= dt * .05;
      const l = clamp(EMB.life[i], 0, 1);
      EMB.col[i * 3] = l; EMB.col[i * 3 + 1] = .55 * l * l; EMB.col[i * 3 + 2] = .15 * l * l * l;
    }
    EMB.geo.attributes.position.needsUpdate = EMB.geo.attributes.color.needsUpdate = true;
    if (!alive) EMB.pts.visible = false;
  }
  // свет
  if (FIRELT.on) {
    const L = LIGHTS.fire;
    if (tot > .01) _fl.multiplyScalar(1 / tot);
    FIRELT.pos.lerp(tot > .01 ? _fl : FIRELT.pos, smoothK(8, dt));
    FIRELT.lev += (Math.min(1.1, tot) - FIRELT.lev) * smoothK(6, dt);
    // свет чуть впереди пламени, к гостю: тёплый отблеск на бармене, но без пересвета рук и рубашки
    L.position.copy(FIRELT.pos).add(V3(0, .16, .34));
    L.intensity = FIRELT.lev * (1.25 + .3 * Math.sin(t * 19) + .18 * Math.sin(t * 37));
  }
});
function fireLight(on) {
  const L = LIGHTS.fire;
  if (on && !FIRELT.on) { FIRELT.home = L.position.clone(); FIRELT.col = L.color.clone(); FIRELT.dist = L.distance; L.color.set(0xff9a4a); L.distance = 3.2; FIRELT.on = true; FIRELT.lev = 0; FIRELT.pos.copy(B(0, 1.3, .4)); }
  if (!on && FIRELT.on) { FIRELT.on = false; L.position.copy(FIRELT.home); L.color.copy(FIRELT.col); L.distance = FIRELT.dist; }
}
/* звуки огня */
const FSND = {
  strike: () => { if (SHOW.fast) return; noiseHit(0, .14, 3200, .8, .35, "highpass"); noiseHit(.05, .25, 900, .6, .18, "lowpass"); },
  whoosh: (dur = .7, g = .5) => {
    if (SHOW.fast) return; const c = fx(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain(), t = c.currentTime;
    s.buffer = b; f.type = "lowpass"; f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(2600, t + dur * .35); f.frequency.exponentialRampToValueAtTime(500, t + dur);
    gn.gain.value = g; s.connect(f).connect(gn).connect(c.destination); s.start(t);
  },
  burn: dur => { if (SHOW.fast) return; for (let i = 0; i < dur * 9; i++) noiseHit(i / 9 + rr(0, .08), .05, rr(1500, 4200), 2, rr(.03, .09)); },
  hiss: () => { if (!SHOW.fast) noiseHit(0, .5, 5200, .7, .12, "highpass"); }
};

/* ---------- реквизит для огня: кружки, чайник, спички, блюдце ---------- */
const MXF = { copper: std({ color: 0xc0703e, metalness: 1, roughness: .28, envMapIntensity: 1.5 }), silver: M.chrome };
function mugV(side) {
  const V = vessel([[0, 0], [.036, 0], [.037, .004], [.039, .09], [.041, .095]], MXF.silver, [.034, .037, .004, .09, 220]);
  const h = new THREE.TorusGeometry(.026, .0055, 8, 18, Math.PI);
  h.rotateZ(-side * Math.PI / 2); h.translate(side * .039, .048, 0);
  V.g.add(new THREE.Mesh(h, MXF.silver));
  V.handle = V3(side * .064, .048, 0);
  V.side = side;
  return V;
}
(() => {
  P.mugA = mugV(-1); P.mugB = mugV(1);
  // медный чайник с горячей водой
  P.kettle = { g: new THREE.Group() };
  const k = P.kettle.g;
  k.add(new THREE.Mesh(lathe([[0, 0], [.055, 0], [.062, .03], [.06, .07], [.042, .095], [.02, .1], [.0, .102]], 28), MXF.copper));
  mesh(new THREE.SphereGeometry(.009, 10, 8), M.brass, 0, .108, 0, k);
  const sp = new THREE.CylinderGeometry(.006, .01, .09, 10); sp.rotateZ(-.85); sp.translate(.085, .07, 0);
  k.add(new THREE.Mesh(sp, MXF.copper));
  const hd = new THREE.TorusGeometry(.045, .006, 8, 18, Math.PI); hd.rotateY(Math.PI / 2); hd.translate(0, .1, 0);
  k.add(new THREE.Mesh(hd, std({ color: 0x1a0c08, roughness: .5 })));
  P.kettle.spout = V3(.123, .103, 0);
  world.add(k); k.visible = false;
  // спичечный коробок и спичка
  P.mbox = new THREE.Group();
  mesh(new THREE.BoxGeometry(.052, .014, .036), std({ color: 0x8a1a1a, roughness: .7 }), 0, 0, 0, P.mbox);
  mesh(new THREE.BoxGeometry(.053, .0145, .03), std({ color: 0x3a2418, roughness: 1 }), 0, 0, 0, P.mbox);
  mesh(new THREE.PlaneGeometry(.03, .02), std({ color: 0xe8d8b0, roughness: .8 }), 0, .0073, 0, P.mbox).rotation.x = -Math.PI / 2;
  world.add(P.mbox); P.mbox.visible = false;
  P.match = new THREE.Group();
  mesh(new THREE.CylinderGeometry(.0013, .0013, .05, 6), std({ color: 0xe8d4a8, roughness: .8 }), 0, .0, 0, P.match);
  P.matchHead = mesh(new THREE.SphereGeometry(.0028, 8, 6), std({ color: 0x9a1a14, roughness: .6 }), 0, .026, 0, P.match);
  P.matchHead.scale.set(1, 1.3, 1);
  world.add(P.match); P.match.visible = false;
  // блюдце, которым гасят пламя
  P.saucer = { g: new THREE.Group() };
  P.saucer.g.add(new THREE.Mesh(lathe([[0, 0], [.04, 0], [.042, .004], [.072, .012], [.074, .015]], 32), MXF.silver));
  world.add(P.saucer.g); P.saucer.g.visible = false;
})();
const FIRE_PROPS = () => [P.mugA.g, P.mugB.g, P.kettle.g, P.mbox, P.match, P.saucer.g];

/* пар над горячим */
function steam(at, n = 6, spread = .02) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    s.position.copy(at).add(V3(rr(-spread, spread), 0, rr(-spread, spread))); s.scale.setScalar(.03); world.add(s);
    const d = SHOW.fast ? .001 : rr(1.6, 2.6), dl = i * .18;
    setTimeout(() => {
      tween(s.material, { opacity: .32 }, .3).then(() => tween(s.material, { opacity: 0 }, d - .3));
      tween(s.position, { y: s.position.y + rr(.14, .24), x: s.position.x + rr(-.03, .03) }, d, ease.out);
      tween(s.scale, { x: .11, y: .11 }, d, ease.out).then(() => drop(s));
    }, SHOW.fast ? 0 : dl * 1000);
  }
}

/* горячая вода из чайника */
async function stepHot(st) {
  const ml = st[1] || 50, G = SHOW.glassV, K = P.kettle.g, R = bt.R;
  await jiggerPark();
  shot(choose(["side", "macro"]), mouth(G, .06));
  bt.look = K.position;
  await grip(R, K, { p: V3(0, .145, 0), r: .006, f: V3(1, 0, 0), n: V3(0, -1, 0), pose: "grip", along: .045 }, .45);
  bt.look = mouth(G);
  const col = new THREE.Color(0xd8e6ea), m0 = G.ml;
  steam(K.localToWorld(P.kettle.spout.clone()), 3, .005);
  await pourFrom(K, P.kettle.spout, () => surface(G), ml, col, { gap: rr(.04, .07), ang: -.95, rate: .9,
    fill: k => { G.ml = m0 + ml * k; G.col.lerp(new THREE.Color(0xc89a6a), .02); setLevel(G); } });
  cardLayer(col, ml);
  steam(mouth(G, .01), 6, .025);
  await move(K, ST.kettle, { q: Qe(0, 0, 0), dur: .55, arc: .05 });
  letGo(R);
  await rest(R);
}

/* зажечь спичку о коробок: левая держит коробок, правая чиркает */
async function lightMatch(arm = bt.R, boxArm = bt.L) {
  const box = P.mbox, mt = P.match;
  place(box, ST.mbox, Qe(0, 0, 0));
  place(mt, ST.mbox.clone().add(V3(.0, .012, .0)), Qz(Math.PI / 2));
  await Promise.all([
    grip(boxArm, box, { p: V3(0, 0, 0), r: .018, f: V3(0, 0, 1), n: V3(-boxArm.side, 0, 0), pose: "grip", along: .04 }, .4),
    grip(arm, mt, { p: V3(0, -.012, 0), r: .002, f: V3(.2, -.4, .9).normalize(), n: V3(-arm.side * .95, 0, .2).normalize(), pose: "pinch", along: .065 }, .4)
  ]);
  const at = B(.02, 1.3, .36);
  await Promise.all([move(box, at, { q: Qe(0, 0, Math.PI / 2), dur: .4, arc: .02 }), move(mt, at.clone().add(V3(-.04, .02, .02)), { q: Qz(-.4), dur: .4, arc: .02 })]);
  // чирк по боковине
  await move(mt, at.clone().add(V3(.0, .0, .025)), { dur: .1 });
  FSND.strike();
  await move(mt, at.clone().add(V3(-.08, .05, .03)), { q: Qz(-.2), dur: .12, e: ease.out });
  const fl = flames(mt, V3(0, .028, 0), 3, .001, { blue: .34, h: .03 });
  fl.size = 1.6; tween(fl, { size: 1 }, .4);
  const flash = glowSprite(0xffc070, .18, 0, .028, 0, mt, .9);
  tween(flash.material, { opacity: 0 }, .35).then(() => mt.remove(flash));
  for (let i = 0; i < 6; i++) spark(mt.localToWorld(V3(0, .028, 0)), V3(rr(-.15, .15), rr(.05, .3), rr(-.1, .1)), rr(.2, .5));
  await move(box, ST.mbox, { q: Qe(0, 0, 0), dur: .4, arc: .03 });
  letGo(boxArm);
  rest(boxArm);
  return fl;
}
async function matchOut(fl, arm = bt.R) {
  const mt = P.match, p = mt.position.clone();
  for (let i = 0; i < 3; i++) await move(mt, p.clone().add(V3(i % 2 ? -.05 : .05, .01, 0)), { dur: .08 });
  dropFlames(fl);
  puff(mt.localToWorld(V3(0, .03, 0)), 2);
  await move(mt, ST.mbox.clone().add(V3(.04, .01, -.02)), { q: Qz(Math.PI / 2), dur: .35, arc: .03 });
  letGo(arm);
  mt.visible = false;
}

/* одна огненная дуга: из кружки src в кружку dst */
async function arcPass(src, dst, dur) {
  const dir = Math.sign(dst.g.position.x - src.g.position.x) || 1;
  const lip = V3(dir * src.mouthR, src.mouthY, 0);
  await tiltAbout(src.g, lip, Qz(-dir * 1.95), .28, ease.in);
  const from = () => src.g.localToWorld(lip.clone()), to = () => mouth(dst, .005);
  ARC.on = true; ARC.k = 0; ARC_CORE.visible = false;
  const m0s = src.ml, m0d = dst.ml;
  FSND.whoosh(dur, .35); FSND.burn(dur);
  await waitTicks(dur, k => {
    ARC.p0.copy(from()); ARC.p2.copy(to());
    ARC.p1.set(ARC.p0.x + (ARC.p2.x - ARC.p0.x) * .55, ARC.p0.y + .01, (ARC.p0.z + ARC.p2.z) / 2);
    src.ml = m0s * (1 - k); dst.ml = m0d + m0s * k;
    src.fire.size = .3 + .7 * (1 - k); dst.fire.size = Math.min(1, .2 + k * 1.2);
  });
  ARC.on = false; ARC.sp.forEach(s => { s.visible = false; });
  await tiltAbout(src.g, lip, Qz(0), .26);
}
async function stepFire() {
  const A = P.mugA, Bm = P.mugB, G = SHOW.glassV, R = bt.R, L = bt.L;
  await jiggerPark();
  shot("fire", B(0, 1.32, .38), 1);
  showUI.root.classList.add("fire");
  bt.look = mouth(A);
  // свет в зале гаснет
  FIRELT.exp0 = renderer.toneMappingExposure;
  tween(renderer, { toneMappingExposure: FIRELT.exp0 * .4 }, SHOW.fast ? .001 : 1.4);
  fireLight(true);
  await ws(.4);
  const mf = await lightMatch();
  shot(choose(["macro", "low"]), mouth(A, .04));
  bt.look = mouth(A);
  // поджигаем коньяк в кружке
  await move(P.match, mouth(A, .03).add(V3(-.02, 0, .01)), { q: Qz(-.9), dur: .45, arc: .03 });
  A.fire = flames(A.g, V3(0, A.mouthY - .004, 0), 8, .022, { blue: .65, h: .095 });
  Bm.fire = flames(Bm.g, V3(0, Bm.mouthY - .004, 0), 8, .022, { blue: .65, h: .095 });
  A.fire.size = .2; Bm.fire.size = 0;
  FSND.whoosh(.8, .55);
  tween(A.fire, { size: 1 }, SHOW.fast ? .001 : .5, ease.out);
  await ws(.35);
  await matchOut(mf);
  // кружки в руки
  shot("fire", B(0, 1.34, .36), choose([-1, 1]));
  bt.look = camera.position;
  await Promise.all([grip(R, A.g, wrap(-1, A.handle, .006, { pose: "grip", along: .04 }), .4), grip(L, Bm.g, wrap(1, Bm.handle, .006, { pose: "grip", along: .04 }), .4)]);
  const hi = y => [B(-.13, y, .34), B(.13, y, .36)], lo = y => [B(-.13, y, .36), B(.13, y, .37)];
  await Promise.all([move(A.g, hi(1.5)[0], { dur: .5 }), move(Bm.g, lo(1.17)[1], { dur: .5 })]);
  bt.look = mouth(Bm);
  // три прохода, каждый выше прежнего
  const passes = SHOW.fast ? 1 : 3;
  let src = A, dst = Bm;
  for (let i = 0; i < passes; i++) {
    follow(B(0, 1.32 + i * .015, .36));
    await arcPass(src, dst, rr(.95, 1.15));
    [src, dst] = [dst, src];
    if (i < passes - 1) {
      const y = 1.53 + (i + 1) * .045;
      const sp = src === A ? 0 : 1, dp = 1 - sp;
      await Promise.all([move(src.g, hi(y)[sp], { dur: .42, e: ease.io }), move(dst.g, lo(1.17)[dp], { dur: .42, e: ease.io })]);
      bt.look = mouth(dst);
    }
  }
  // жидкость снова в кружке A (или переливаем в неё последним проходом)
  if (src !== A) { await Promise.all([move(Bm.g, hi(1.48)[1], { dur: .4 }), move(A.g, lo(1.17)[0], { dur: .4 })]); await arcPass(Bm, A, .9); }
  // в стакан: огонь ложится на поверхность
  shot(choose(["macro", "low", "side"]), mouth(G, .08));
  bt.look = mouth(G);
  await Promise.all([move(Bm.g, ST.cap, { q: Qe(0, 0, 0), dur: .5, arc: .04 }), move(A.g, mouth(G, .12).add(V3(-.11, 0, 0)), { dur: .5, arc: .03 })]);
  letGo(L); rest(L);
  dropFlames(Bm.fire); Bm.fire = null;
  G.fire = flames(G.g, V3(0, G.y1 * .75, 0), 9, .03, { blue: .8, h: .05 });
  G.fire.size = 0;
  const m0 = G.ml, ml = A.ml || 65, col = new THREE.Color(SHOW.c.pour);
  {
    const lip = V3(A.mouthR, A.mouthY, 0);
    await tiltAbout(A.g, lip, Qz(-1.9), .3, ease.in);
    ARC.on = true; ARC.k = 0;
    FSND.burn(1);
    await waitTicks(.9, k => {
      ARC.p0.copy(A.g.localToWorld(lip.clone())); ARC.p2.copy(surface(G));
      ARC.p1.set(ARC.p0.x + (ARC.p2.x - ARC.p0.x) * .6, ARC.p0.y, (ARC.p0.z + ARC.p2.z) / 2);
      A.fire.size = 1 - k * .8; G.fire.size = Math.min(1, k * 1.4);
      G.ml = m0 + ml * k; G.col.lerp(col, .06); setLevel(G);
    });
    ARC.on = false; ARC.sp.forEach(s => { s.visible = false; });
    await tiltAbout(A.g, lip, Qz(0), .25);
  }
  dropFlames(A.fire); A.fire = null; A.ml = 0;
  cardLayer(liqOf("cognac"), 65);
  cardMix(SHOW.c.pour);
  await move(A.g, ST.tin, { dur: .5, arc: .05 });
  letGo(R);
  // пламя в стакане: пауза для гостя
  bt.look = camera.position;
  follow(mouth(G, .05));
  await ws(1.1);
  // гасим: накрыть блюдцем
  place(P.saucer.g, ST.saucer, Qe(0, 0, 0));
  await grip(L, P.saucer.g, { p: V3(0, .012, -.07), r: .004, f: V3(0, 0, 1), n: V3(0, -1, 0), pose: "pinch", along: .055 }, .4);
  await move(P.saucer.g, mouth(G, .05), { q: Qx(Math.PI), dur: .45, arc: .04 });
  await move(P.saucer.g, mouth(G, .016), { dur: .14, e: ease.in });
  SND.tap();
  G.fire.size = 0; FSND.hiss();
  await ws(.7);
  await move(P.saucer.g, mouth(G, .09), { dur: .3 });
  dropFlames(G.fire); G.fire = null;
  puff(mouth(G, .02), 8);
  steam(mouth(G, .01), 4, .02);
  await move(P.saucer.g, ST.saucer, { q: Qe(0, 0, 0), dur: .45, arc: .04 });
  letGo(L);
  // свет возвращается
  showUI.root.classList.remove("fire");
  tween(renderer, { toneMappingExposure: FIRELT.exp0 }, SHOW.fast ? .001 : 1.6);
  await Promise.all([rest(L), rest(R)]);
}

/* обожжённая цедра: масло апельсина вспыхивает над стаканом */
async function stepFlameZest(gm, G) {
  const R = bt.R, m = mouth(G);
  const mf = await lightMatch(bt.L, bt.R);
  // правая берёт цедру с доски
  place(gm, ST.tray.clone().add(V3(-.05, .02, -.02)), Qe(0, 0, 0));
  await grip(R, gm, { p: V3(0, 0, 0), r: .004, f: V3(.6, -.2, .75).normalize(), n: V3(.75, 0, -.6).normalize(), pose: "pinch", along: .062 }, .4);
  // спичка между цедрой и стаканом
  shot(choose(["macro", "side"]), m.clone().add(V3(0, .08, 0)));
  bt.look = m;
  const matchAt = m.clone().add(V3(.02, .08, .0)), zestAt = m.clone().add(V3(-.07, .1, 0));
  await Promise.all([move(P.match, matchAt, { q: Qz(.5), dur: .45 }), move(gm, zestAt, { q: Qe(0, 0, -Math.PI / 2), dur: .5, arc: .03 })]);
  await ws(.25);
  // сжатие: вспышка через пламя
  handPose(R, "fist");
  FSND.whoosh(.45, .6);
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Sprite(fireMat(false)); s.center.set(.5, .5);
    s.position.copy(zestAt).add(V3(.02, rr(-.01, .01), rr(-.01, .01))); s.scale.setScalar(.02); s.renderOrder = 8; world.add(s);
    const to = matchAt.clone().add(V3(rr(.0, .07), rr(-.04, .04), rr(-.03, .03)));
    const d = SHOW.fast ? .001 : rr(.22, .4);
    tween(s.position, { x: to.x, y: to.y, z: to.z }, d, ease.out);
    tween(s.scale, { x: rr(.05, .09), y: rr(.06, .11) }, d, ease.out);
    tween(s.material, { opacity: 0 }, d * 1.3, ease.in).then(() => drop(s));
    if (i % 2) spark(matchAt.clone(), V3(rr(-.1, .3), rr(-.05, .25), rr(-.1, .1)), rr(.3, .7));
  }
  if (FIRELT.on) FIRELT.lev = 1.6;
  const flash = glowSprite(0xffb050, .35, matchAt.x, matchAt.y, matchAt.z, world, .9);
  tween(flash.material, { opacity: 0 }, .5).then(() => drop(flash));
  await ws(.5);
  await matchOut(mf, bt.L);
  rest(bt.L);
  // цедру — по краю и в стакан
  handPose(R, "pinch");
  const rw = G.mouthR * G.scale;
  await move(gm, m.clone().add(V3(-rw, .01, 0)), { q: Qe(0, 0, -Math.PI / 2.4), dur: .35 });
  await move(gm, m.clone().add(V3(0, .01, rw * .9)), { q: Qe(Math.PI / 2, 0, -Math.PI / 2.4), dur: .35 });
  letGo(R, "open");
  const dst = G.g.localToWorld(V3(.01, G.y0 + (G.y1 - G.y0) * .55, 0));
  await tween(gm.position, { x: dst.x, y: dst.y, z: dst.z }, SHOW.fast ? .001 : .25, ease.in);
  SND.plop();
}

/* ---------- сцена целиком ---------- */
const STEP = {
  ice: stepIce, jig: stepJig, pour: st => stepPour(st), top: st => stepPour(st, true), dash: stepDash, shake: stepShake, stir: stepStir,
  strain: stepStrain, stirIn: stepStirIn, leaves: stepLeaves, muddle: stepMuddle, squeeze: stepSqueeze, rim: stepRim, float: stepFloat,
  garnish: (st, c) => stepGarnish(c), serve: stepServe, hot: stepHot, fire: stepFire
};
function buildGlass(c) {
  const cup = CUPS[c.cup] || CUPS.rocks;
  const prof = cup.p.map(([r, y]) => [r / 100, y / 100]);
  const [r0, r1, y0, y1] = cup.liq.map(v => v / 100);
  const V = vessel(prof, MX.glass, [r0, r1, y0, y1, Closeup.CAP_ML[c.cup] || 150], { scale: 1.35 });
  V.g.visible = true;
  return V;
}
function resetVessel(V) {
  V.ml = 0; V.col.set(0xffffff); setLevel(V);
  V.ice.forEach(i => i.parent && i.parent.remove(i)); V.ice = [];
}
async function setupStation(c) {
  station();
  BT.busy = true;
  BT.mode = "free";
  if (bt.held.some(h => h.obj === btGlass)) await stash();
  btGlass.visible = btRag.visible = false;
  STATIC_TOOLS.forEach(o => { o.visible = false; });
  resetVessel(P.tin); resetVessel(P.mixer);
  P.tin.g.children[0].material = M.chrome;
  world.attach(P.cap.g); world.attach(P.strainer.g);
  for (const o of PROPS()) { o.visible = false; o.quaternion.identity(); }
  place(P.bucket.g, ST.bucket); place(P.tray.g, ST.tray); place(P.scoop.g, ST.scoop, Qe(0, 0, 0));
  place(P.jig.g, ST.jig); place(P.spoon.g, ST.spoon, Qx(Math.PI / 2));
  place(P.strainer.g, ST.strainer);
  P.jig.liq.visible = false;
  const prog = PROGS()[c.id] || [];
  const shaken = prog.some(s => s[0] === "shake"), stirred = prog.some(s => s[0] === "stir"), fiery = prog.some(s => s[0] === "fire");
  SHOW.main = fiery ? P.mugA : shaken ? P.tin : stirred ? P.mixer : null;
  if (shaken) { place(P.tin.g, ST.tin); place(P.cap.g, ST.cap); }
  if (stirred) place(P.mixer.g, ST.tin);
  if (fiery) {
    resetVessel(P.mugA); resetVessel(P.mugB);
    place(P.mugA.g, ST.tin); place(P.mugB.g, ST.cap); place(P.kettle.g, ST.kettle); place(P.mbox, ST.mbox); place(P.saucer.g, ST.saucer);
    P.bucket.g.visible = P.scoop.g.visible = false;
  }
  if (!fiery && prog.some(s => s[0] === "hot")) place(P.kettle.g, ST.kettle);
  if (SHOW.glassV) drop(SHOW.glassV.g);
  SHOW.glassV = buildGlass(c);
  place(SHOW.glassV.g, ST.glass);
  if (!SHOW.main) SHOW.main = SHOW.glassV;
  for (const o of [P.bucket.g, P.tray.g, P.jig.g, P.spoon.g, P.strainer.g, P.tin.g, P.cap.g, P.mixer.g, P.scoop.g, SHOW.glassV.g]) {
    if (!o.visible) continue;
    const y = o.position.y; o.position.y += .03;
    tween(o.position, { y }, SHOW.fast ? .001 : .35, ease.out);
  }
  shot("medium", B(0, 1.3, .35), 1);
  await walkTo(ST.bx, ST.bz, 0);
  await turnTo(0);
  bt.leanT = .1;
  await Promise.all([rest(bt.L), rest(bt.R)]);
}
function cleanup(c, aborted) {
  for (const t of TMP) TMP.delete(t);
  HANDS.delete(bt.L); HANDS.delete(bt.R);
  for (const a of [bt.L, bt.R]) { a.manual = false; a.snap = false; a.k = 9; }
  streamOff(); tagOff();
  jigOn = false;
  for (const F of [...CLUSTERS]) dropFlames(F);
  ARC.on = false; ARC.sp.forEach(s => { s.visible = false; });
  for (const t of tweens) if (t.obj === renderer) tweens.delete(t);
  showUI.root.classList.remove("fire");
  if (FIRELT.on) { fireLight(false); renderer.toneMappingExposure = FIRELT.exp0 || 1.2; }
  for (const V of [P.mugA, P.mugB]) V.fire = null;
  BT.nod = 0; bt.nod = 0; bt.tilt = 0;
  world.attach(P.cap.g); world.attach(P.strainer.g);
  PROPS().forEach(o => { o.visible = false; o.quaternion.identity(); });
  STATIC_TOOLS.forEach(o => { o.visible = true; });
  btGlass.visible = btRag.visible = true;
  for (const o of [...world.children]) if (o.userData && o.userData.ing) drop(o);
  if (aborted || !SHOW.glassV) {
    if (SHOW.glassV) drop(SHOW.glassV.g);
    SHOW.glassV = null;
    placeServed(c);
  } else {
    if (servedGlass && servedGlass !== SHOW.glassV.g) drop(servedGlass);
    const V = SHOW.glassV;
    if (V.ml < V.cap * .5) { V.ml = V.cap * .82; V.col.set(c.pour); setLevel(V); }
    V.g.position.copy(ST.serve); V.g.quaternion.identity();
    servedGlass = V.g; servedV = V;
    SHOW.glassV = null;
  }
  SHOW.served = true;
  bt.leanT = .07; bt.spine.position.y = 0;
  reach(bt.L, .23, .92, .06, DIR.down, V3(-1, 0, .3), .25);
  reach(bt.R, -.23, .92, .06, DIR.down, V3(1, 0, .3), .25);
}
async function playShow(c) {
  abortSip();
  SHOW.on = true; SHOW.ran = true; SHOW.fast = false; SHOW.served = false; SHOW.c = c;
  SG = ++SHOW.gen;
  const prog = (PROGS()[c.id] || [["garnish"]]).concat([["serve"]]);
  showUI.title.textContent = showUI.name.textContent = c.name;
  showUI.root.classList.remove("docked");
  buildCard(c, prog);
  showUI.root.hidden = false;
  app.classList.add("showing");
  caption("", choose(["Бармен берётся за дело", "Сейчас будет красиво", "Минуту — и готово"]));
  let aborted = false;
  try {
    await setupStation(c);
    const total = prog.length - 1;
    for (let i = 0; i < prog.length; i++) {
      const st = prog[i];
      caption(st[0] === "serve" ? "" : `Шаг ${i + 1} из ${total}`, stepCaption(st, c));
      if (i === 0) showUI.root.classList.add("docked");   // дальше крупные планы: название уходит в карточку
      cardStep(i);
      await STEP[st[0]](st, c);
      const next = (prog[i + 1] || [])[0];
      if (jigOn && next !== "jig") await jiggerPark();
      if (i < prog.length - 2) await flourish();
    }
    cardDone();
  } catch (e) {
    if (e !== ABORT) console.error(e);
    aborted = true;
  }
  cleanup(c, aborted);
  SHOW.fast = false;
  showUI.root.hidden = true;
  showUI.root.classList.remove("docked");
  app.classList.remove("showing");
  SHOW.on = false;
  BT.mode = "free";
  if (SEAT.on) flyTo(seatShot(true), 1.2, 0);
  else flyTo(framed({ pos: [ST.bx - .2, 1.6, -.6], tgt: [ST.bx - .15, 1.3, -2.4], span: 2.2, pull: 1 }), 1.3, 0);
  await sleep(.3);
}
/* крупный план теперь живёт в 3D: подменяем старое 2D-представление */
Closeup.play = c => playShow(c);
Object.defineProperty(Closeup, "active", { get: () => SHOW.on, configurable: true });
Object.assign(H3D, { show: SHOW, bt, handPose, HANDS });

/* ================= живая компания: гости у стойки, в курилке и в читальне ================= */
const GUESTS = [];
const bubbleEl = document.getElementById("bubble");
let bubble = null;
function say(F, text, dur = 5) {
  bubble = { F, until: NOW + dur * 1000 };
  bubbleEl.textContent = text;
  F.look = camera.position;
  clearTimeout(F._sayT);
  F._sayT = setTimeout(() => { if (F.look === camera.position) F.look = null; }, dur * 1000);
}
const _hp = V3();
onTick(() => {
  if (!bubble) return;
  if (NOW > bubble.until || modalOpen()) { bubbleEl.classList.remove("show"); bubble = null; return; }
  // облачко видно, только пока голова говорящего в кадре: отвернулся — реплика прячется
  bubble.F.head.getWorldPosition(_hp);
  _hp.y += .12;
  const h = _hp.clone().project(camera);
  const inView = h.z < 1 && Math.abs(h.x) < .98 && h.y > -.95 && h.y < 1.02;
  bubbleEl.classList.toggle("show", inView);
  if (!inView) return;
  const p = _hp.add(_w0.set(0, .14, 0)).project(camera);
  const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight;
  const half = bubbleEl.offsetWidth / 2 + 8;
  bubbleEl.style.transform = `translate(${clamp(x, half, innerWidth - half)}px, ${clamp(y, bubbleEl.offsetHeight + 12, innerHeight - 160)}px) translate(-50%, -100%)`;
});
const lineOf = F => { F._li = ((F._li ?? -1) + 1) % F.lines.length; return F.lines[F._li]; };

/* звон бокалов */
function clink() {
  const c = fx(); if (!c) return;
  const t = c.currentTime + .01;
  for (const [f, v] of [[2650, .14], [3970, .08], [5210, .05]]) {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f + R(-40, 40);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .9);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 1);
  }
}

/* сколько гостей сейчас: к открытию один, вечером и ночью полный зал, под утро двое */
const GUEST_H = hoursOf(sceneDate());
const crowd = GUEST_H >= 17 && GUEST_H < 19 ? 1 : GUEST_H >= 1 && GUEST_H < 3 ? 2 : 3;

/* ---------- гости за стойкой ---------- */
function barGuest(x, look, drink, lines) {
  const F = makeFigure(Object.assign({ seated: true, hipY: .93 }, look));
  placeFig(F, x, -1.5, Math.PI);
  F.legsFixed = true;
  F.legs.forEach(lg => { lg.tgt.set(lg.side * .1, .33, .14); lg.cur.copy(lg.tgt); });
  F.leanT = .12;
  const glass = makeGlass(drink.cup, drink.color, { garnish: drink.garnish, ice: drink.ice, op: .85 });
  const spot = fromFig(F, V3(-.1, CT.top, .62));
  glass.position.copy(spot);
  glass.scale.setScalar(1.25);
  world.add(glass);
  const G = { F, glass, spot, busy: false, x };
  F.lines = lines;
  restHands(G);
  hot(F.root, 1, look.label, () => say(F, lineOf(F)), { grow: 0, noChip: true });
  GUESTS.push(G);
  return G;
}
function restHands(G) {
  const F = G.F;
  reach(F.L, .15, 1.15, .6, V3(-.3, -.15, 1), DIR.down, .35);
  reach(F.R, -.13, 1.15, .58, V3(.3, -.15, 1), DIR.down, .35);
}
async function sip(G) {
  const F = G.F, gl = toFig(F, G.glass.position);
  G.busy = true;
  reach(F.R, gl.x - .045, CT.top + .07, gl.z - .02, V3(.2, 0, 1), DIR.in(-1), .2);
  await sleep(.6);
  F.R.curlT = .8;
  const h = grab(F, F.R, G.glass, V3(0, -.05, .05), .2);
  h.woff = V3(0, -.07, 0);
  await sleep(.25);
  reach(F.R, -.03, 1.5, .2, V3(.4, .6, 1), DIR.in(-1));
  F.look = null;
  await sleep(.7);
  tween(h, { tilt: -.75 }, .5);
  F.nod = -.12;
  await sleep(1.1);
  tween(h, { tilt: 0 }, .4);
  F.nod = 0;
  await sleep(.3);
  reach(F.R, gl.x - .045, CT.top + .07, gl.z - .02, V3(.2, 0, 1), DIR.in(-1));
  await sleep(.6);
  await putDown(F, G.glass, G.spot, .15);
  G.glass.rotation.set(0, 0, 0);
  F.R.curlT = .3;
  restHands(G);
  G.busy = false;
}
async function gesture(G, other) {
  const F = G.F;
  G.busy = true;
  if (other) F.look = other.F.head.getWorldPosition(V3());
  for (let i = 0; i < 4; i++) {
    reach(F.L, .12 + R(-.04, .06), 1.28 + R(-.04, .08), .4 + R(-.04, .06), V3(.4, .5, 1), V3(-.3, .8, .2), .3);
    F.tilt = R(-.1, .1);
    await sleep(R(.5, .8));
  }
  F.tilt = 0;
  restHands(G);
  G.busy = false;
}
async function laugh(G) {
  const F = G.F;
  for (let i = 0; i < 10; i++) { F.sway = Math.sin(i * 2.1) * .03; F.nod = -.14 + Math.sin(i * 1.7) * .05; F.leanT = -.02; await sleep(.12); }
  F.sway = 0; F.nod = 0; F.leanT = .12;
}
async function clinkToast(A, B) {
  if (A.busy || B.busy) return;
  A.busy = B.busy = true;
  const mid = V3((A.F.x + B.F.x) / 2, 1.42, -1.82);
  const holds = [];
  for (const G of [A, B]) {
    const F = G.F, gl = toFig(F, G.glass.position);
    reach(F.R, gl.x - .045, CT.top + .07, gl.z - .02, V3(.2, 0, 1), DIR.in(-1), .2);
    F.look = mid;
  }
  await sleep(.6);
  for (const G of [A, B]) { G.F.R.curlT = .8; const h = grab(G.F, G.F.R, G.glass, V3(0, -.05, .05), .2); h.woff = V3(0, -.07, 0); holds.push(h); }
  await sleep(.3);
  for (const G of [A, B]) {
    const s = G === A ? 1 : -1, m = toFig(G.F, V3(mid.x + s * .07, mid.y, mid.z));
    reach(G.F.R, m.x, m.y, m.z, V3(0, .3, 1), DIR.in(-1));
  }
  await sleep(.75);
  clink();
  for (const G of [A, B]) G.F.look = (G === A ? B : A).F.head.getWorldPosition(V3());
  await sleep(.5);
  for (const G of [A, B]) { G.F.busy = true; }
  await Promise.all([A, B].map(async (G, i) => {
    const h = holds[i];
    reach(G.F.R, -.03, 1.5, .2, V3(.4, .6, 1), DIR.in(-1));
    await sleep(.6);
    tween(h, { tilt: -.7 }, .5); G.F.nod = -.12;
    await sleep(1);
    tween(h, { tilt: 0 }, .4); G.F.nod = 0;
    await sleep(.3);
    const gl = toFig(G.F, G.spot);
    reach(G.F.R, gl.x - .045, CT.top + .07, gl.z - .02, V3(.2, 0, 1), DIR.in(-1));
    await sleep(.6);
    await putDown(G.F, G.glass, G.spot, .15);
    G.glass.rotation.set(0, 0, 0);
    G.F.look = null;
    restHands(G);
  }));
  A.busy = B.busy = false;
}

const LADY = { kind: "dress", body: "#1f4a3a", skin: 0xd6a088, hair: 0x0e0a08, hairStyle: "bob", lady: true, label: "Гостья в зелёном" };
const GENT = { kind: "suit", body: "#2c2c32", tie: "#7a1424", skin: 0xc8946e, hair: 0x4a2e1a, mustache: false, label: "Гость в сером костюме" };
const SOLO = { kind: "suit", body: "#4a3626", tie: "#1f3a5a", skin: 0xb88262, hair: 0x2a2a2a, hat: 0x1c1a18, mustache: true, label: "Завсегдатай в шляпе" };
const pair = [];
if (crowd >= 2) {
  pair.push(barGuest(-2.5, LADY, { cup: "martini", color: "#e8e4c8", garnish: "olive" }, [
    "Говорят, «Негрони» придумали во Флоренции: граф Негрони попросил сделать его американо покрепче.",
    "Мартини — только сухой и с оливкой. Остальное — разговоры.",
    "Граммофон в курилке играет лучше любого оркестра."
  ]));
  pair.push(barGuest(-1.25, GENT, { cup: "rocks", color: "#c27a1a", ice: true }, [
    "В сухой закон коктейли спасали положение: плохой подпольный алкоголь прятали за соками и сиропами.",
    "Бармен здесь трясёт шейкер так, будто внутри гроза.",
    "Пароль от этого бара я тебе не скажу. Ты и так уже внутри."
  ]));
}
if (crowd !== 2) barGuest(2.5, SOLO, { cup: "highball", color: "#cfe6ea", garnish: "wheel", ice: true }, [
  "Я тут с самого открытия. Лучшее время: бармен ещё никуда не спешит.",
  "Джин с тоником придумали британцы в Индии: хинный тоник пили от малярии.",
  "Загляни в курилку и постучи в дверь. Только тихо."
]);

/* распорядок гостей: разговоры, глоток, смех, тост */
async function guestLife() {
  if (STILL) return;
  for (;;) {
    await sleep(R(2.5, 5));
    if (PAUSED || curZone !== 1) continue;
    const free = GUESTS.filter(g => !g.busy);
    if (!free.length) continue;
    const r = rng();
    if (pair.length === 2 && r < .12) clinkToast(pair[0], pair[1]);
    else if (pair.length === 2 && r < .55) {
      const [a, b] = rng() < .5 ? pair : [pair[1], pair[0]];
      if (!a.busy) { b.F.look = a.F.head.getWorldPosition(V3()); gesture(a, b).then(() => { if (rng() < .4) laugh(b); setTimeout(() => { if (!b.busy) b.F.look = null; }, 1500); }); }
    } else if (r < .8) { const g = pickOne(free); sip(g); }
    else { const g = pickOne(free); g.F.look = rng() < .5 ? bt.head.getWorldPosition(V3()) : camera.position; setTimeout(() => { g.F.look = null; }, 2200); }
  }
}

/* ---------- курилка: гость с газетой и курильщик с сигарой ---------- */
function seatIn(F, x, z, face, back = .05) {
  placeFig(F, x - Math.sin(face) * back, z - Math.cos(face) * back, face);
  F.legsFixed = true;
  F.legs.forEach(lg => { lg.tgt.set(lg.side * .13, .075, .5); lg.cur.copy(lg.tgt); });
}
const reader = makeFigure({ kind: "suit", body: "#2a2420", tie: "#5a1a1a", skin: 0xc49272, hair: 0x3a3430, mustache: true, hat: 0x1c1a18, seated: true, hipY: .52 });
seatIn(reader, 6.75, -.15, 2.69);
reader.leanT = -.08;
const NEWS = group(0, 1.0, .4, reader.root);
NEWS.rotation.x = -.35;
const newsMat = std({ map: TEX.news, roughness: .9, side: THREE.DoubleSide });
const newsL = group(0, 0, 0, NEWS), newsR = group(0, 0, 0, NEWS);
mesh(new THREE.PlaneGeometry(.3, .4), newsMat, -.15, 0, 0, newsL);
mesh(new THREE.PlaneGeometry(.3, .4), newsMat, .15, 0, 0, newsR);
newsL.rotation.y = .25; newsR.rotation.y = -.25;
const newsHands = () => {
  reach(reader.L, .27, .98, .35, V3(0, 1, -.2), DIR.in(1), .7);
  reach(reader.R, -.27, .98, .35, V3(0, 1, -.2), DIR.in(-1), .7);
};
newsHands();
reader.look = fromFig(reader, V3(0, .95, .45));
hot(reader.root, 2, "Газета: сухой закон", () => openCard(STORY), { grow: 0, noChip: true });
async function readerLife() {
  if (STILL) return;
  for (;;) {
    await sleep(R(9, 16));
    if (PAUSED) continue;
    // перелистывает: правая половина уходит влево
    reach(reader.R, .05, 1.05, .42, V3(0, 1, -.2), DIR.in(-1), .6);
    await tween(newsR.rotation, { y: -Math.PI + .3 }, .6);
    newsR.rotation.y = -.25;
    newsHands();
    if (rng() < .4) { reader.look = camera.position; await sleep(1.5); reader.look = fromFig(reader, V3(0, .95, .45)); }
  }
}

const SMOKE_ON = GUEST_H >= 19 || GUEST_H < 3;
let smoker = null;
const puffs = [];
if (SMOKE_ON) {
  smoker = makeFigure({ kind: "suit", body: "#1e1a20", tie: "#8a6a2a", skin: 0xb07a5a, hair: 0x6a6a6a, mustache: true, seated: true, hipY: .52 });
  seatIn(smoker, 6.75, -3.25, .45);
  smoker.lines = ["Хорошая сигара не терпит спешки.", "Камин, кресло и тишина. Что ещё нужно?", "В этом клубе не спрашивают, кто ты. Только пароль."];
  smoker.leanT = -.1;
  const cig = mesh(new THREE.CylinderGeometry(.009, .009, .13, 10), std({ color: 0x4a2a14, roughness: .8 }), 0, 0, 0);
  cig.rotation.z = Math.PI / 2;
  const tipC = mesh(new THREE.SphereGeometry(.0095, 8, 6), basic({ color: 0xff6a20, toneMapped: false }), .066, 0, 0, cig);
  const ch = grab(smoker, smoker.R, cig, V3(0, -.07, .03), 0);
  ch.k = 1; ch.tilt = undefined;
  smoker.cig = cig;
  reach(smoker.R, -.34, .8, .12, V3(0, -.3, 1), DIR.in(-1), .6);
  reach(smoker.L, .34, .78, .1, V3(0, -.3, 1), DIR.down, .3);
  hot(smoker.root, 2, "Курильщик", () => say(smoker, lineOf(smoker)), { grow: 0, noChip: true });
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.puff, color: 0xd8c8c0, transparent: true, opacity: 0, depthWrite: false }));
    s.userData.t = 1; world.add(s); puffs.push(s);
  }
}
onTick((t, dt) => {
  if (!smoker) return;
  smoker.cig.rotation.set(0, smoker.face + .4, Math.PI / 2 - .2);
  for (const s of puffs) {
    if (s.userData.t >= 1) { s.material.opacity = 0; continue; }
    s.userData.t += dt * .35;
    const k = s.userData.t;
    s.position.copy(s.userData.o).addScaledVector(s.userData.v, k).add(_w0.set(0, k * .5, 0));
    const sc = .08 + k * .45; s.scale.set(sc, sc, 1);
    s.material.opacity = (1 - k) * .4;
  }
});
async function smokerLife() {
  if (STILL || !smoker) return;
  for (;;) {
    await sleep(R(7, 12));
    if (PAUSED) continue;
    reach(smoker.R, -.04, 1.13, .2, V3(.3, .8, .5), DIR.in(-1));
    await sleep(1.6);
    reach(smoker.R, -.34, .8, .12, V3(0, -.3, 1), DIR.in(-1));
    await sleep(.5);
    // выдыхает дым
    const mouth = smoker.head.localToWorld(V3(0, .05, .12));
    const fwd = fromFig(smoker, V3(0, 0, .5)).sub(V3(smoker.x, 0, smoker.z));
    puffs.forEach((s, i) => setTimeout(() => { s.userData.t = 0; s.userData.o = mouth.clone(); s.userData.v = fwd.clone().multiplyScalar(R(.5, .9)); }, i * 90));
    smoker.nod = -.15; await sleep(1.2); smoker.nod = 0;
  }
}

/* ---------- читальня: писатель за столом и читательница в кресле ---------- */
const writer = makeFigure({ kind: "cardigan", body: "#4a3a28", shirt: "#e2d8c4", trousers: 0x1e1a16, skin: 0xd09a7a, hair: 0x5a3a22, seated: true, hipY: .56 });
placeFig(writer, WIN.x, -3.62, Math.PI);
writer.legsFixed = true;
writer.legs.forEach(lg => { lg.tgt.set(lg.side * .13, .075, .42); lg.cur.copy(lg.tgt); });
writer.lines = ["Пишу роман о баре, где время идёт по-настоящему.", "Не мешай, муза только что зашла.", "Осталось придумать последнюю главу. Может, ты подскажешь?"];
const pen = mesh(new THREE.CylinderGeometry(.004, .002, .14, 6), std({ color: 0x1a1210, roughness: .3 }), 0, 0, 0);
const penH = grab(writer, writer.R, pen, V3(0, -.07, .03), 0); penH.k = 1; penH.tilt = .5;
writer.mode = "write";
hot(writer.root, 0, "Писатель", () => say(writer, lineOf(writer)), { grow: 0, noChip: true });
onTick(t => {
  if (writer.mode === "write") {
    writer.leanT = .32;
    reach(writer.R, -.1 + Math.sin(t * 1.3) * .05 + Math.sin(t * 9) * .008, .815 + Math.max(0, Math.sin(t * 9)) * .006, .5 + Math.cos(t * 9) * .006, V3(.3, -.4, 1), DIR.down, .6);
    reach(writer.L, .17, .8, .48, V3(-.3, -.2, 1), DIR.down, .25);
    if (writer.look !== camera.position) writer.look = fromFig(writer, V3(-.08, .79, .52));
  } else if (writer.mode === "think") {
    writer.leanT = -.05;
    reach(writer.L, .02, 1.13, .14, V3(0, 1, .3), V3(-.2, 0, 1), .7);
    reach(writer.R, -.15, .82, .4, V3(.3, -.4, 1), DIR.down, .6);
  }
});
async function writerLife() {
  if (STILL) return;
  for (;;) {
    await sleep(R(10, 18));
    if (PAUSED) continue;
    writer.mode = "think";
    writer.look = V3(WIN.x + .3, 2.3, -5);
    await sleep(R(3, 5));
    writer.mode = "write";
  }
}

let lady = null;
if (GUEST_H >= 18 || GUEST_H < 1) {
  lady = makeFigure({ kind: "dress", body: "#5a1a2a", skin: 0xe0ac92, hair: 0x6a3a1a, hairStyle: "bob", lady: true, seated: true, hipY: .6 });
  seatIn(lady, -6.85, -1.25, .95, .02);
  lady.leanT = -.1;
  lady.lines = ["Тсс... я на самом интересном месте.", "«Великий Гэтсби». Перечитываю каждую осень, но и зимой хорошо.", "Попробуй открыть книгу рецептов на кафедре. Там все шестнадцать коктейлей."];
  const book = group(0, .96, .32, lady.root);
  book.rotation.x = -.7;
  mesh(new THREE.BoxGeometry(.3, .21, .02), std({ color: 0x3a1a10 }), 0, 0, -.012, book);
  const pg = std({ map: TEX.page, roughness: .95, side: THREE.DoubleSide });
  mesh(new THREE.PlaneGeometry(.14, .2), pg, -.072, 0, .001, book).rotation.y = .12;
  const leafG = group(0, 0, .002, book);
  mesh(new THREE.PlaneGeometry(.14, .2), pg, .072, 0, 0, leafG);
  leafG.rotation.y = -.12;
  lady.leaf = leafG;
  reach(lady.L, .16, .9, .3, V3(0, .6, .3), DIR.in(1), .6);
  reach(lady.R, -.16, .9, .3, V3(0, .6, .3), DIR.in(-1), .6);
  lady.look = fromFig(lady, V3(0, .92, .36));
  hot(lady.root, 0, "Читательница", () => say(lady, lineOf(lady)), { grow: 0, noChip: true });
}
async function ladyLife() {
  if (STILL || !lady) return;
  for (;;) {
    await sleep(R(8, 14));
    if (PAUSED) continue;
    await tween(lady.leaf.rotation, { y: -Math.PI + .12 }, .7);
    lady.leaf.rotation.y = -.12;
    if (rng() < .35) { lady.look = camera.position; await sleep(1.6); lady.look = fromFig(lady, V3(0, .92, .36)); }
  }
}
/* у заведения без курилки или читальни (заглушки залов) их гостей нет */
for (const [on, F] of [[FEAT.smoke, reader], [FEAT.smoke, smoker], [FEAT.nook, writer], [FEAT.nook, lady]]) if (!on && F) { F.off = true; F.root.visible = false; }
function companyLife() { guestLife(); readerLife(); smokerLife(); writerLife(); ladyLife(); }
Object.assign(H3D, { toast: () => pair.length === 2 && clinkToast(pair[0], pair[1]), sip: i => GUESTS[i] && sip(GUESTS[i]), guests: GUESTS });

/* ================= заглушка сцены: у заведения нет зала с джаз-бэндом =================
   Подставляется сборкой (tools/build.py) вместо src/venues/<id>/rooms/66-stage.js, если такого файла нет.
   Даёт движку те же имена, что и настоящая сцена, но пустые: закрытие смены, бармен и праздники
   не падают, а кнопка «Сцена» скрыта (FEAT.stage = false). */
FEAT.stage = false;
const BANDH = new Date().getHours();
let BAND_HERE = false;
const MUS = {};
const STG = { bow: false, beams: [], dim: 1, x0: 0, x1: 0, z0: 0, z1: 0, h: 0 };

/* ================= заглушка погреба: у заведения нет тайного погреба =================
   Подставляется сборкой вместо src/venues/<id>/rooms/67-cellar.js, если такого файла нет.
   Движок проверяет CEL.on / CEL.busy, переход в погреб не случается (FEAT.cellar = false). */
FEAT.cellar = false;
const CEL = { on: false, busy: false };
const SOM = { head: new THREE.Object3D() };
async function cellarCross() {}

/* ================= место у стойки: гость садится, бармен подбирает напиток под настроение ================= */
const SEAT_X = 1.25;   // этот табурет всегда свободен: напротив шейкера
const SEAT = { on: false, gen: 0, mood: null, strength: null, pickI: 0 };
const talkEl = document.getElementById("talk");

/* что посоветовать: настроение × крепость → коктейли и слова бармена (факты — как в книге рецептов) */
const ADVICE = {
  celebrate: {
    strong: [
      ["c-sidecar", "Тогда «Сайдкар»: коньяк, апельсиновый ликёр и лимон. Классика Парижа и Лондона, ровесница ревущих двадцатых."],
      ["c-manhattan", "«Манхэттен»: ржаной виски, красный вермут и вишня. Нью-Йорк конца XIX века — торжественно и без суеты."],
      ["c-hacheden", `Тогда наш фирменный «${BAR_NAME}»: горящий коньяк с вишней, огненная струя между двух кружек и цедра через пламя. Смотрите внимательно.`]
    ],
    light: [
      ["c-sunrise", "«Текила санрайз» — рассвет в стакане. Её прославили The Rolling Stones в американском туре 1972 года."],
      ["c-mojito", "«Мохито»: ром, лайм, мята и много льда. Праздник по-гавански."]
    ]
  },
  relax: {
    strong: [
      ["c-oldfashioned", "«Олд фэшн»: виски, капля сахара, биттер и большой кусок льда. Его пьют медленно — то, что нужно."],
      ["c-sour", "Виски сауэр: виски, лимон, сахар и белок — под шелковистой пеной с тремя каплями ангостуры. Рецепт есть ещё в книге Джерри Томаса 1862 года."]
    ],
    light: [
      ["c-pinacolada", "«Пина колада»: ром, ананас и кокос. С 1978 года — официальный напиток Пуэрто-Рико."],
      ["c-cubalibre", "«Куба либре»: ром, кола и лайм. Гавана, около 1900 года. Просто и без спешки."]
    ]
  },
  think: {
    strong: [
      ["c-negroni", "«Негрони»: джин, кампари и красный вермут поровну. Флоренция, около 1919 года. Горечь располагает к мыслям."],
      ["c-martini", "Сухой мартини: джин, немного вермута и оливка. Строгий напиток для неспешного вечера."]
    ],
    light: [
      ["c-gintonic", "Джин-тоник: горчинка хинина, лайм и пузырьки. Под него хорошо думается."],
      ["c-collins", "«Том Коллинз»: джин, лимон и содовая. Лёгкий, с пузырьками и с историей о розыгрыше 1874 года."]
    ]
  },
  fresh: {
    strong: [
      ["c-daiquiri", "«Дайкири»: ром, лайм и сахар, встряхнуть со льдом. Три ингредиента — и чистая свежесть."],
      ["c-margarita", "«Маргарита»: текила, апельсиновый ликёр и лайм. Свежо и с характером."],
      ["c-junglebird", "«Джангл бёрд»: тёмный ром, кампари, ананас и лайм. Куала-Лумпур, 1978 год — тропики с горчинкой, а сверху пенка от ананаса."],
      ["c-pisco", "«Писко сауэр»: перуанский виноградный бренди, лимон и белок. Лима, «Бар Морриса», 1920-е — свежо, с бархатной пеной и тремя каплями ангостуры."]
    ],
    light: [
      ["c-mojito", "«Мохито»: мята, лайм, ром и колотый лёд доверху. Освежает лучше всего."],
      ["c-gintonic", "Джин-тоник со льдом и лаймом. Холодный, сухой и звонкий."]
    ]
  },
  none: [
    ["c-nojito", "Тогда мохито без алкоголя: мята, лайм и содовая со льдом. Свежести не меньше, чем в оригинале."]
  ]
};
const MOODS = [["celebrate", "Есть что отметить"], ["relax", "Хочу расслабиться"], ["think", "Задумчивое"], ["fresh", "Освежиться бы"]];

/* кадр с табурета: глаза сидящего гостя, бармен напротив */
function seatShot(served = false) {
  const narrow = innerWidth / innerHeight < .8;
  return { px: SEAT_X, py: 1.5, pz: -1.32, tx: SEAT_X - .05, ty: served ? 1.2 : 1.38, tz: -3.4, fov: narrow ? 62 : 52 };
}
/* реплика бармена: облачко плавно сменяется */
function btSay(text) {
  bubbleEl.classList.remove("show");
  return new Promise(res => setTimeout(() => { say(bt, text, 900); res(); }, STILL ? 0 : 220));
}
function quietBubble() { if (bubble && bubble.F === bt) bubble.until = 0; }
/* варианты ответа под облачком */
function answers(list) {
  talkEl.innerHTML = "";
  list.forEach(([label, fn, quiet], i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    if (quiet) b.className = "quiet";
    b.style.animationDelay = (i * .07) + "s";
    b.addEventListener("click", () => { if (SEAT.on && !busy) fn(); });
    talkEl.appendChild(b);
  });
  talkEl.hidden = !list.length;
}
const standBtn = ["Встать из-за стойки", () => standUp(), true];

async function sitDown() {
  if (SEAT.on || busy || modalOpen() || mixDlg.open) return;
  SEAT.on = true;
  const g = ++SEAT.gen;
  hideTip();
  app.classList.add("seated");
  subEl.textContent = "Место у стойки, напротив бармена";
  answers([]);
  tween(LOOK, { yaw: 0, pitch: 0 }, 1.2);
  nudge = 0;
  const fly = flyTo(seatShot(), 2.4, .25);
  // бармен заканчивает своё дело и подходит
  for (let i = 0; i < 80 && (BT.busy || BT.mode !== "polish"); i++) await sleep(.1);
  if (g !== SEAT.gen) return;
  BT.busy = true;
  bt.look = null;
  await walkTo(SEAT_X + .04, BT_Z + .1, 0);
  await fly;
  if (g !== SEAT.gen) return;
  bt.look = camera.position;
  // напиток уже подан: бармен придвигает бокал к гостю и не спрашивает про настроение заново
  if (servedGlass && servedGlass.parent === world) {
    const fresh = SIP.glass !== servedGlass, full = fresh || SIP.frac > .02;
    const to = V3(SEAT_X + .06, CT.top, -2.14);
    const gp = servedGlass.position, dist = gp.distanceTo(to);
    if (dist > .04) {
      BT.mode = "free";
      if (Math.abs(gp.x - bt.x) > .45) await walkTo(gp.x + .2, BT_Z, 0);
      const handOn = () => { const l = toFig(bt, gp); reach(bt.R, l.x + .02, CT.top + .06, l.z - .05, V3(0, -.3, 1), DIR.in(-1), .3); };
      handOn();
      await sleep(STILL ? 0 : .45);
      if (g !== SEAT.gen) return;
      const walk = walkTo(SEAT_X + .04, BT_Z + .1, 0);
      let done = false;
      tween(gp, { x: to.x, y: to.y, z: to.z }, STILL ? .001 : clamp(dist * 1.1, .8, 2), ease.io).then(() => { done = true; });
      while (!done) { handOn(); await sleep(.05); }
      await walk;
      reach(bt.R, -.23, .92, .06, DIR.down, V3(1, 0, .3), .25);
      BT.mode = "polish";
      if (g !== SEAT.gen) return;
    }
    if (fresh) prepSip();
    if (full) {
      await btSay(choose(["С возвращением. Ваш бокал — я придвинул поближе.", "Присаживайтесь, ваш напиток вас дождался."]));
      if (g !== SEAT.gen) return;
      seatAnswers();
    } else {
      await btSay("Вижу, бокал уже пуст. Повторим?");
      if (g !== SEAT.gen) return;
      answers([["Ещё по одной", oneMore], standBtn]);
    }
    return;
  }
  await btSay("Добрый вечер! Присаживайтесь. Какое сегодня настроение?");
  await sleep(.5);
  if (g !== SEAT.gen) return;
  askMood();
}
function askMood() {
  answers([...MOODS.map(([id, label]) => [label, () => askStrength(id)]), standBtn]);
}
async function askStrength(mood) {
  SEAT.mood = mood;
  answers([]);
  bt.tilt = .08;
  await btSay(mood === "celebrate" ? "Прекрасный повод. Покрепче или полегче?" : mood === "relax" ? "Понимаю. Покрепче или полегче?"
    : mood === "think" ? "Хороший вечер для этого. Покрепче или полегче?" : "Сейчас освежим. Покрепче или полегче?");
  bt.tilt = 0;
  answers([["Покрепче", () => suggest("strong")], ["Полегче", () => suggest("light")], ["Без алкоголя", () => suggest("none")], standBtn]);
}
async function suggest(strength, next = false) {
  const g = SEAT.gen;
  SEAT.strength = strength;
  const list = strength === "none" ? ADVICE.none : ADVICE[SEAT.mood][strength];
  if (next) SEAT.pickI++; else SEAT.pickI = Math.floor(rng() * list.length);
  const [id, line] = list[SEAT.pickI % list.length];
  answers([]);
  // задумался на секунду: взгляд на полку с бутылками
  bt.look = V3(SEAT_X, 1.7, -4.2);
  await sleep(.7);
  if (g !== SEAT.gen) return;
  bt.look = camera.position;
  await btSay(next && list.length < 2 ? "Без алкоголя лучше него ничего не придумать. " + line : line);
  answers([["Готовьте!", () => order(id)], ["А что ещё?", () => suggest(strength, true)], ["Другое настроение", () => { answers([]); btSay("Тогда начнём сначала. Какое настроение?").then(askMood); }, true], standBtn]);
}
function order(id) {
  answers([]);
  quietBubble();
  BT.busy = false;   // дальше бармен работает по обычному сценарию коктейля
  makeCocktail(id);
}
/* после коктейля: бармен остаётся напротив */
async function afterServe() {
  if (!SEAT.on) return;
  const g = SEAT.gen;
  BT.busy = true;
  await walkTo(SEAT_X + .04, BT_Z + .1, 0);
  if (g !== SEAT.gen) return;
  bt.look = camera.position;
  prepSip();
  await btSay("Приятного вечера. Если что — я рядом.");
  if (g !== SEAT.gen) return;
  seatAnswers();
}
/* встать: чистим всё, что связано с местом у стойки (камеру двигает вызывающий) */
function leaveSeat() {
  if (!SEAT.on) return;
  SEAT.on = false;
  SEAT.gen++;
  abortSip();
  answers([]);
  quietBubble();
  app.classList.remove("seated");
  subEl.textContent = ZONES[1].sub;
  if (bt.look === camera.position) bt.look = null;
  bt.tilt = 0;
  if (!busy) BT.busy = false;
}
function standUp() { leaveSeat(); goZone(1, 1.6); }
addEventListener("keydown", e => { if (e.key === "Escape" && SEAT.on && !modalOpen() && !mixDlg.open && !busy) standUp(); });

/* невидимая зона над табуретом: на неё можно нажать */
{
  const hit = mesh(new THREE.CylinderGeometry(.24, .24, .5, 12), basic({ visible: false }), SEAT_X, .85, -1.5);
  hot(hit, 1, "Сесть за стойку", () => sitDown(), { grow: 0 });
  HOT.unshift(HOT.pop());   // первая кнопка в ряду: так её видно и на телефоне
}
Object.assign(H3D, { sit: () => sitDown() });

/* ================= глоток: гость сам берёт бокал, подносит к губам и ставит обратно ================= */
const SIP = { on: false, n: 0, gen: 0, pitch: 0, anim: null, glass: null, liq: null, frac: 1, P0: V3() };
const SIPS = 4;   // столько глотков в бокале
renderer.localClippingEnabled = true;
const sipPlane = new THREE.Plane(V3(0, -1, 0), 100);   // поверхность напитка: всё выше неё срезается

/* рука гостя: кисть с пальцами, белая манжета с латунной запонкой, рукав тёмного бархата */
const GUEST = (() => {
  const rig = new THREE.Group();
  rig.visible = false;
  world.add(rig);
  const wrist = group(0, 0, 0, rig);
  const arm = Object.assign(buildHand(-1, wrist, std({ color: 0xd8a585, roughness: .58 })), { side: -1, manual: true, hand: wrist });
  handPose(arm, "open");
  arm.fc = arm.ft.slice(); arm.tc = arm.tt; arm.ts = arm.tst;
  const fore = group(0, 0, 0, world);
  fore.visible = false;
  mesh(new THREE.CylinderGeometry(.036, .035, .034, 20).translate(0, .011, 0), std({ color: 0xf1ece2, roughness: .7 }), 0, 0, 0, fore);
  mesh(new RoundedBoxGeometry(.012, .016, .01, 2, .003), M.brass, .036, .012, 0, fore);
  const sleeve = mesh(new THREE.CylinderGeometry(.056, .041, 1, 22, 1, true).translate(0, .5, 0), std({ color: 0x1b1720, roughness: .92, side: THREE.DoubleSide }), 0, .026, 0, fore);
  return { rig, wrist, arm, fore, sleeve };
})();

/* куда смотрит камера: вперёд по горизонтали, вправо, вниз */
function camAxes() {
  const p = V3(CAM.px, CAM.py, CAM.pz), f = V3(CAM.tx - CAM.px, 0, CAM.tz - CAM.pz).normalize();
  return { p, f, r: V3(-f.z, 0, f.x) };
}
/* обхват: стебель берут щепотью, стакан — всей ладонью */
function gripFor(cupId) {
  const c = CUPS[cupId] || CUPS.rocks, p = c.p, S = 1.35 / 100;
  const stem = p.find(([r, y], i) => i > 1 && r < 1);
  if (stem) return { y: (stem[1] + 1.3) * S, r: .45 * S, pose: "stem", rimY: p[p.length - 1][1] * S, tilt: .62 };
  const top = p[p.length - 1], y = top[1] * .38;
  return { y: y * S, r: (p[2][0] + (top[0] - p[2][0]) * .38) * S, pose: null, rimY: top[1] * S, tilt: cupId === "highball" ? 1.05 : .9 };
}
/* уровень напитка: и у бокала из шоу, и у простого бокала */
function liquidOf(g) {
  if (servedV && servedV.g === g) {
    const V = servedV, full = V.ml;
    return { mesh: V.liq, y: f => V.y0 + f * (V.y1 - V.y0) * Math.min(.94, full / V.cap),
      set: f => { V.ml = full * f; setLevel(V); }, fullH: () => { V.liq.visible = true; V.liq.scale.y = .94 * (V.y1 - V.y0); } };
  }
  const L = g.userData.liq;
  if (!L) return null;
  const { mesh: m, y0, y1 } = L;
  return { mesh: m, y: f => y0 + f * (y1 - y0),
    set: f => { m.visible = f > .01; m.scale.y = Math.max(.001, f); m.position.y = y0 + (y1 - y0) * f / 2; },
    fullH: () => { m.visible = true; m.scale.y = 1; m.position.y = (y0 + y1) / 2; } };
}
/* заранее: срез по поверхности и двусторонний материал, чтобы шейдер собрался до движения */
function prepSip() {
  SIP.n = 0; SIP.frac = 1;
  SIP.glass = servedGlass;
  SIP.liq = servedGlass ? liquidOf(servedGlass) : null;
  if (!SIP.liq) return;
  const m = SIP.liq.mesh.material;
  m.clippingPlanes = [sipPlane]; m.side = THREE.DoubleSide; m.needsUpdate = true;
  sipPlane.constant = 100;
}

/* плавная анимация по кадрам */
function sipPlay(dur, fn, e = ease.io) {
  if (STILL) { fn(1); return Promise.resolve(); }
  return new Promise(res => { SIP.anim = { t0: NOW, dur: dur * 1000 * (SIP.slow || 1), fn, e, res }; });
}
const _sw = V3(), _se = V3(), _sx = V3(), _sy = V3(), _sz = V3(), _sm = new THREE.Matrix4();
onTick(() => {
  const A = SIP.anim;
  if (A) {
    const k = clamp((NOW - A.t0) / A.dur, 0, 1);
    A.fn(A.e(k));
    if (k >= 1) { SIP.anim = null; A.res(); }
  }
  if (!GUEST.rig.visible) return;
  poseFingers(GUEST.arm, 1 / 60);
  // предплечье: от запястья вниз-вправо, за край кадра
  const { p, f, r } = camAxes();
  GUEST.wrist.getWorldPosition(_sw);
  _se.copy(p).addScaledVector(r, .3).addScaledVector(f, .12); _se.y -= .62;
  _sy.subVectors(_se, _sw);
  const len = _sy.length();
  _sy.normalize();
  _sx.set(0, 1, 0).addScaledVector(_sy, -_sy.y).normalize();
  _sz.crossVectors(_sx, _sy);
  _sm.makeBasis(_sx, _sy, _sz);
  GUEST.fore.quaternion.setFromRotationMatrix(_sm);
  GUEST.fore.position.copy(_sw).addScaledVector(_sy, -.006);
  GUEST.sleeve.scale.y = len;
  // поверхность напитка всегда горизонтальна
  if (SIP.liq && SIP.glass && SIP.on) {
    SIP.glass.localToWorld(_sw.set(0, SIP.liq.y(SIP.frac), 0));
    sipPlane.constant = _sw.y;
  }
});

/* кисть в системе бокала: ладонь сбоку, пальцы обнимают его спереди */
function handAt(G, out = {}) {
  const n = V3(-1, 0, -.2).normalize(), fw = V3(.2, 0, -1).normalize();
  const Y = fw.clone().negate(), X = V3().crossVectors(Y, n);
  out.q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, n));
  out.p = V3(0, G.y, 0).addScaledVector(n, -(G.r + .016)).addScaledVector(fw, -.044);
  return out;
}
function sipReset() {
  SIP.anim = null;
  GUEST.rig.visible = GUEST.fore.visible = false;
  SIP.pitch = 0;
  if (SIP.glass && SIP.glass.parent === GUEST.rig) {
    world.attach(SIP.glass);
    SIP.glass.position.copy(SIP.P0); SIP.glass.quaternion.identity();
  }
  if (SIP.liq) { SIP.liq.set(SIP.frac); sipPlane.constant = 100; }
  SIP.on = false;
}
function abortSip() { if (SIP.on) { SIP.gen++; sipReset(); } }

async function takeSip(T = null) {
  const G0 = servedGlass;
  if ((SIP.on && !T) || !SEAT.on || !G0 || SHOW.on || SIP.frac <= .02) return;
  if (SIP.glass !== G0) prepSip();
  const c = pendingCocktail || SHOW.c;
  const G = gripFor(c ? c.cup : "rocks");
  SIP.on = true;
  const g = T ? SIP.gen : ++SIP.gen, sg = SEAT.gen;
  const alive = () => g === SIP.gen && sg === SEAT.gen;
  answers([]);
  quietBubble();
  const { p, f, r } = camAxes();
  // рука приходит из-за края кадра
  SIP.P0.copy(G0.position);
  const rig = GUEST.rig;
  rig.position.copy(SIP.P0); rig.quaternion.identity();
  const H = handAt(G);
  const from = H.p.clone().addScaledVector(r, .22).add(V3(0, -.2, 0)).addScaledVector(f, -.42);
  const W = GUEST.wrist, arm = GUEST.arm;
  W.position.copy(from); W.quaternion.copy(H.q);
  handPose(arm, "open");
  rig.visible = GUEST.fore.visible = true;
  await sipPlay(.85, k => W.position.lerpVectors(from, H.p, k), ease.out);
  if (!alive()) return;
  // ножку держат щепотью: большой, указательный и средний, безымянный и мизинец поджаты
  if (G.pose === "stem") { arm.ft = [.72, .8, .95, 1]; arm.tt = .55; arm.tst = .85; }
  else handPose(arm, G.pose, G.r);
  await sipPlay(.28, () => {});
  if (!alive()) return;
  SND.tick();
  // бокал поднимается к глазам — напиток на просвет, — затем к губам, голова чуть запрокидывается
  rig.attach(G0);
  const tilt = new THREE.Quaternion().setFromAxisAngle(r, G.tilt), q0 = new THREE.Quaternion();
  const look = p.clone().addScaledVector(f, .4).addScaledVector(r, .02); look.y -= .1 + G.rimY * .55;
  const mouthP = p.clone().addScaledVector(f, .12); mouthP.y -= .25;   // у губ бокал уже за краем кадра
  const P1 = mouthP.clone().sub(V3(0, G.rimY, 0).applyQuaternion(tilt));
  const lift = SIP.P0.clone().lerp(look, .5); lift.y += .05;
  const _a = V3(), _b = V3();
  let qs = q0;
  if (T) {
    // тост: бокал навстречу бокалу бармена, чуть наклонён к нему
    const lean = new THREE.Quaternion().setFromAxisAngle(f, -.06);
    await sipPlay(1.05, k => {
      rig.position.lerpVectors(SIP.P0, T.pre, k); rig.position.y += Math.sin(k * Math.PI) * .03;
      rig.quaternion.slerpQuaternions(q0, lean, k);
      SIP.pitch = -.02 * k;
    });
    if (!alive()) return;
    await T.ready;
    if (!alive()) return;
    await Promise.all([sipPlay(.5, k => rig.position.lerpVectors(T.pre, T.hit, k), ease.out), T.meet()]);
    if (!alive()) return;
    T.clink();
    await sipPlay(.4, k => rig.position.lerpVectors(T.hit, T.back, k), ease.out);
    if (!alive()) return;
    await sipPlay(.35, () => {});
    if (!alive()) return;
    look.copy(rig.position); qs = rig.quaternion.clone();
  } else {
  await sipPlay(1.1, k => {
    _a.lerpVectors(SIP.P0, lift, k); _b.lerpVectors(lift, look, k);
    rig.position.lerpVectors(_a, _b, k);
    SIP.pitch = -.03 * k;
  });
  if (!alive()) return;
  await sipPlay(.55, k => { rig.position.y = look.y + Math.sin(k * Math.PI) * .006; });
  if (!alive()) return;
  }
  await sipPlay(.8, k => {
    rig.position.lerpVectors(look, P1, k);
    rig.quaternion.slerpQuaternions(qs, tilt, k);
    SIP.pitch = lerp(T ? -.02 : -.03, .045, ease.io(k));
  });
  if (!alive()) return;
  // глоток: уровень опускается
  const f0 = SIP.frac, f1 = Math.max(0, f0 - 1 / SIPS - .001);
  const tiltMore = new THREE.Quaternion().setFromAxisAngle(r, G.tilt + .14);
  await sipPlay(.9, k => {
    SIP.frac = lerp(f0, f1, k);
    rig.quaternion.slerpQuaternions(tilt, tiltMore, Math.sin(k * Math.PI));
    SIP.pitch = .045 + .02 * Math.sin(k * Math.PI);
  });
  if (!alive()) return;
  // обратно на стойку
  const back = rig.position.clone(), qb = rig.quaternion.clone(), mid = look.clone().lerp(SIP.P0, .4);
  await sipPlay(1.1, k => {
    _a.lerpVectors(back, mid, k); _b.lerpVectors(mid, SIP.P0, k);
    rig.position.lerpVectors(_a, _b, k);
    rig.quaternion.slerpQuaternions(qb, q0, ease.io(clamp(k / .6, 0, 1)));
    SIP.pitch = .045 * (1 - ease.io(k));
  });
  if (!alive()) return;
  SND.tap();
  if (SIP.frac > .05 && ["rocks", "highball"].includes(c ? c.cup : "")) setTimeout(() => SND.clink(), 120);
  world.attach(G0);
  G0.position.copy(SIP.P0); G0.quaternion.identity();
  handPose(arm, "open");
  await sipPlay(.25, () => {});
  if (!alive()) return;
  const at = W.position.clone();
  await sipPlay(.75, k => W.position.lerpVectors(at, from, k), ease.io);
  if (!alive()) return;
  sipReset();
  SIP.n++;
  if (T) { await T.done; if (sg !== SEAT.gen) return; }
  // бармен отвечает взглядом и словом
  if (SIP.frac <= .02) {
    await btSay(choose(["Бокал пуст — значит, получилось. Повторим?", "До дна — лучший комплимент бармену. Ещё по одной?"]));
    if (sg !== SEAT.gen) return;
    answers([["Ещё по одной", oneMore], standBtn]);
    return;
  }
  if (SIP.n === 1 && !T) {
    bt.nod = .08; setTimeout(() => { bt.nod = 0; }, 450);
    await btSay(choose(["Ну как? По-моему, баланс что надо.", "Вижу, пришёлся по вкусу.", "Не спешите: такой напиток раскрывается постепенно."]));
    if (sg !== SEAT.gen) return;
  }
  seatAnswers();
}
function oneMore() { flyTo(seatShot(), 1, 0); btSay("С удовольствием. Какое теперь настроение?").then(askMood); answers([]); }
function seatAnswers() {
  const list = [["Сделать глоток", () => takeSip()]];
  if (SIP.frac > .02 && TOAST.glass !== servedGlass) list.push(["Чокнуться с барменом", () => toastBartender()]);
  list.push(["Ещё по одной", oneMore], ["Поговорить", () => talkMenu()], standBtn);
  answers(list);
}
Object.assign(H3D, { takeSip: () => takeSip(), SIP });

/* ================= чокнуться с барменом: он наливает себе на палец виски, бокалы встречаются над стойкой ================= */
const TOAST = { on: false, glass: null, gen: 0 };
const toastPlane = new THREE.Plane(V3(0, -1, 0), 100);   // поверхность виски в его стакане, когда он пьёт
/* его стакан: маленький олд фэшн, лежит под стойкой */
const TOAST_V = (() => {
  const cup = CUPS.rocks, V = vessel(cup.p.map(([r, y]) => [r / 100, y / 100]), MX.glass, [...cup.liq.map(v => v / 100), 90], { scale: .9 });
  const m = V.liq.material;
  m.clippingPlanes = [toastPlane]; m.side = THREE.DoubleSide;   // шейдер собирается заранее, при прогреве
  V.col.copy(liqOf("whisky"));
  return V;
})();
const TOAST_LINES = [
  ["С удовольствием. Себе — на палец виски.", "За этот вечер!"],
  ["Почту за честь. Мне — немного виски.", "За вас!"],
  ["Не откажусь. Капля виски — и я с вами.", `За тех, кто нашёл дорогу в ${BAR_NAME}!`]
];
/* радиус бокала на высоте y (профиль в сантиметрах, как в CUPS) */
function cupRadAt(p, y) {
  let r = p[p.length - 1][0];
  for (let i = 1; i < p.length; i++) {
    const [r0, y0] = p[i - 1], [r1, y1] = p[i];
    if (y >= y0 && y <= y1 && y1 > y0) r = r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return r;
}
/* где бокалы встречаются: край к краю — у самых ободков, где бокал шире всего, ниже ничего не выступает */
function toastGeom(cup) {
  const p = (CUPS[cup] || CUPS.rocks).p, rim = p[p.length - 1][1], S = 1.35 / 100;
  const hc = rim - .4;
  let rgc = cupRadAt(p, hc);
  for (const [r, y] of p) if (y >= hc - 3 && y <= rim) rgc = Math.max(rgc, r);
  const hg = hc * S, rg = rgc * S;
  const rp = CUPS.rocks.p, hb = (rp[rp.length - 1][1] - .4) * .9 / 100, rb = rp[rp.length - 1][0] * .9 / 100;
  const M = V3(SEAT_X + .03, TOP() + .1 + hg, -2.42), gap = .003;
  return {
    gHit: V3(M.x + rg + gap, M.y - hg, M.z), gPre: V3(M.x + rg + .07, M.y - hg - .015, M.z + .07), gBack: V3(M.x + rg + .03, M.y - hg + .01, M.z + .03),
    bHit: V3(M.x - rb - gap, M.y - hb, M.z), bPre: V3(M.x - rb - .07, M.y - hb - .01, M.z - .07), M
  };
}
function toastAbort() {
  TOAST.on = false;
  HANDS.delete(bt.L); HANDS.delete(bt.R);
  for (const a of [bt.L, bt.R]) { a.manual = false; a.snap = false; a.k = 9; }
  streamOff();
  for (const o of [...world.children]) if (o.userData && o.userData.ing) drop(o);
  TOAST_V.g.visible = false; toastPlane.constant = 100; TOAST.glass = null;
  bt.nod = 0; bt.leanT = .07;
  if (!bt.held.some(h => h.obj === btGlass)) unstash().then(() => { if (!SEAT.on && !busy) BT.busy = false; });
}

/* бармен: стакан из-под стойки, виски из бутылки, поднимает навстречу, пьёт и убирает стакан */
async function toastBt(Tg, line, alive, raised) {
  const V = TOAST_V, L = bt.L, Rh = bt.R, T = TOP();
  const ok = () => { if (!alive()) throw ABORT; };
  BT.busy = true;
  await btSay(line);
  BT.mode = "free";
  if (bt.held.some(h => h.obj === btGlass)) await stash();
  ok();
  station();
  // стакан берёт правой рукой с полки под стойкой и ставит на коврик
  const shelf = V3(SEAT_X - .1, T - .2, -2.9), mat = V3(SEAT_X - .12, T + .006, -2.62);
  V.ml = 0; setLevel(V); toastPlane.constant = 100;
  place(V.g, shelf, Qe());
  bt.look = mat.clone();
  await grip(Rh, V.g, wrap(-1, V3(0, .035, 0), .04), .45); ok();
  await move(V.g, V3(shelf.x, T + .05, shelf.z), { dur: .4, e: ease.out }); ok();
  await move(V.g, mat, { dur: .45, arc: .03 }); ok();
  SND.tap();
  letGo(Rh);
  // бутылка виски с рейки: показывает этикетку и наливает на палец
  const b = makeBottle("whisky"), u = b.userData;
  place(b, ST.rail, Qe());
  bt.look = b.position.clone().add(V3(0, .3, 0));
  await grip(Rh, b, wrap(-1, V3(0, u.top * .5, 0), u.r), .4); ok();
  await move(b, B(-.17, T + .1, .3), { q: Qe(0, .25, 0), dur: .5, arc: .04 }); ok();
  bt.look = mouth(V);
  const col = liqOf("whisky");
  await pourFrom(b, V3(0, u.top, 0), () => surface(V), 25, col, { gap: .09, rate: 1.3, ang: 2.25, fill: k => { V.ml = 25 * k; setLevel(V); } }); ok();
  await bottleDown(b); ok();
  reach(L, .24, 1.0, .12, DIR.down, V3(-1, 0, .3), .3);
  raised.start();   // гость уже тянется к своему бокалу
  // подходит к краю стойки и берёт стакан правой
  bt.look = camera.position;
  await walkTo(SEAT_X + .04, -3.06, 0); ok();
  bt.leanT = .16;
  await grip(Rh, V.g, wrap(-1, V3(0, .03, 0), .04), .4); ok();
  await move(V.g, Tg.bPre, { q: Qz(-.06), dur: 1.1, arc: .04 }); ok();
  bt.look = Tg.M;
  await btSay(raised.line); ok();
  await sleep(.25); ok();
  raised.meet = () => move(V.g, Tg.bHit, { dur: .5, e: ease.out });
  raised.ready();
}
async function toastDrink(Tg, alive) {
  const V = TOAST_V, Rh = bt.R, T = TOP();
  const ok = () => { if (!alive()) throw ABORT; };
  await move(V.g, Tg.bHit.clone().add(V3(-.03, .01, -.03)), { dur: .4, e: ease.out }); ok();
  quietBubble();
  bt.look = camera.position;
  await sleep(.3); ok();
  // к губам: край стакана у рта, стакан наклонён к нему; поверхность виски остаётся горизонтальной
  bt.head.updateMatrixWorld(true);
  const lips = bt.head.localToWorld(V3(0, .04, .1)), q = Qx(-.95);
  const rimLocal = V3(0, V.mouthY, -V.mouthR * .9);
  V.liq.visible = true; V.liq.scale.y = .94 * (V.y1 - V.y0);
  const f0 = V.ml / V.cap / .94;
  const lvl = f => V.g.localToWorld(V3(0, V.y0 + Math.max(0, f) * .94 * (V.y1 - V.y0), 0)).y;
  let fr = f0;
  V.g.updateMatrixWorld(true); toastPlane.constant = lvl(fr);
  const stop = onTickTmp(() => { V.g.updateMatrixWorld(true); toastPlane.constant = lvl(fr); V.liq.visible = fr > .01; });
  try {
    bt.nod = -.05;
    await move(V.g, posFor(V.g, rimLocal, lips.clone().add(V3(0, 0, .012)), Qx(-.55)), { q: Qx(-.55), dur: .75 }); ok();
    bt.nod = -.14;
    await tiltAbout(V.g, rimLocal, q, .55); ok();
    await waitTicks(.6, k => { fr = f0 * (1 - k); }); ok();
    fr = 0;
    bt.nod = 0;
    await tiltAbout(V.g, rimLocal, Qx(-.4), .35); ok();
  } finally { stop(); }
  V.ml = 0; setLevel(V); toastPlane.constant = 100;
  // ставит пустой стакан под стойку
  await move(V.g, V3(SEAT_X - .08, T + .1, -2.9), { q: Qe(), dur: .7, arc: .03 }); ok();
  await move(V.g, V3(SEAT_X - .1, T - .2, -2.9), { dur: .4, e: ease.in }); ok();
  V.g.visible = false;
  letGo(Rh); bt.leanT = .07;
  for (const a of [bt.L, bt.R]) { HANDS.delete(a); a.manual = false; a.snap = false; a.k = 9; }
  await walkTo(SEAT_X + .04, BT_Z + .1, 0); ok();
  await unstash(); ok();
  bt.look = camera.position;
}

async function toastBartender() {
  if (TOAST.on || SIP.on || !SEAT.on || !servedGlass || SHOW.on || busy || SIP.frac <= .02) return;
  if (SIP.glass !== servedGlass) prepSip();
  TOAST.on = true; TOAST.glass = servedGlass;
  SIP.on = true;   // гость пока не пьёт сам
  const g = ++SIP.gen, sg = SEAT.gen, tg = ++TOAST.gen;
  const alive = () => g === SIP.gen && sg === SEAT.gen && tg === TOAST.gen && SEAT.on;
  answers([]);
  quietBubble();
  const c = pendingCocktail || SHOW.c, Tg = toastGeom(c ? c.cup : "rocks");
  const [l1, l2] = choose(TOAST_LINES);
  let started, ready, done, clinked = false;
  const pStart = new Promise(r => { started = r; }), pReady = new Promise(r => { ready = r; }), pDone = new Promise(r => { done = r; });
  const raised = { start: started, ready, line: l2, meet: null };
  const bt1 = toastBt(Tg, l1, alive, raised);
  bt1.catch(() => {});
  try {
    // гость тянется к бокалу, когда бармен уже взял свой
    await Promise.race([pStart, bt1]);
    if (!alive()) throw ABORT;
    SIP.on = false;
    const T = {
      pre: Tg.gPre, hit: Tg.gHit, back: Tg.gBack,
      ready: Promise.race([pReady, bt1.then(() => {})]),
      meet: () => raised.meet ? raised.meet() : Promise.resolve(),
      clink: () => {
        clinked = true;
        clink();
        const s = glowSprite(0xfff0d0, .07, Tg.M.x, Tg.M.y, Tg.M.z, world, .9);
        tween(s.material, { opacity: 0 }, .45, ease.out).then(() => { world.remove(s); s.material.dispose(); });
        tween(s.scale, { x: .13, y: .13 }, .45, ease.out);
        bt.nod = .06; setTimeout(() => { bt.nod = 0; }, 300);
      },
      done: pDone
    };
    const sipP = takeSip(T);
    await bt1;
    while (!clinked && alive()) await sleep(.1);   // ждём, пока бокалы встретятся
    if (!alive()) throw ABORT;
    await toastDrink(Tg, alive);
    done();
    void sipP;
  } catch (e) {
    if (e !== ABORT) console.error(e);
    done();
    if (tg === TOAST.gen) toastAbort();
    return;
  }
  TOAST.on = false;
}
Object.assign(H3D, { clinkBt: () => toastBartender(), TOAST, TOAST_V });

/* ================= сосед по стойке: завсегдатай в шляпе сам заговаривает с сидящим гостем и чокается с ним ================= */
const NB = { G: GUESTS.find(g => g.x === 2.5) || null, gen: 0, on: false, tale: Math.floor(Math.random() * 4), tok: 0, timer: 0, glass: null, asked: -1 };
/* правдивые истории завсегдатая */
const NB_TALES = [
  "К концу двадцатых в одном Нью-Йорке, по оценкам полиции, работали десятки тысяч подпольных баров. Пить запретили, а люди просто научились стучать в правильные двери.",
  "В Новом Орлеане Генри Рамос в 1888 году придумал свой джин-физ со сливками и белком. Трясти его надо было так долго, что за стойкой стояла цепочка «шейкер-боев» — говорят, на карнавал 1915 года их было тридцать пять.",
  "В двадцатые «колени пчелы» значило «высший класс». Так назвали и коктейль: джин, мёд и лимон. Мёд заодно смягчал резкий подпольный джин.",
  "До сухого закона в салуны женщин почти не пускали. А в подпольных барах двадцатых им были рады — так бар и стал местом для всех."
];
const NB_TOASTS = ["За знакомство!", "За правильные двери!", "Ваше здоровье!"];
const NB_BYE = ["Приятно было познакомиться. Не буду отвлекать — бармен вас ждёт.", "Хорошего вечера. Если что — я тут, у края стойки."];

/* кадр: гость разворачивается на табурете к соседу */
function nbShot() {
  const narrow = innerWidth / innerHeight < .8;
  return narrow ? { px: SEAT_X - .3, py: 1.55, pz: -.62, tx: 2.12, ty: 1.42, tz: -1.82, fov: 66 }
    : { px: SEAT_X, py: 1.5, pz: -1.28, tx: 2.02, ty: 1.52, tz: -1.9, fov: 54 };
}
function nbAlive(g, sg) { return g === NB.gen && sg === SEAT.gen && SEAT.on; }
function nbQuiet() { if (bubble && NB.G && bubble.F === NB.G.F) bubble.until = 0; }
function nbSay(text) {
  bubbleEl.classList.remove("show");
  return new Promise(res => setTimeout(() => { say(NB.G.F, text, 900); res(); }, STILL ? 0 : 220));
}
/* сосед опять сам по себе: рука на стойке, взгляд вперёд */
function nbFree() {
  const G = NB.G;
  if (!G) return;
  nbQuiet();
  G.F.look = null; G.F.nod = 0; G.F.leanT = .12; G.F.twistT = 0;
  if (NB.glass) {
    release(G.F, G.glass);
    G.glass.position.copy(G.spot); G.glass.rotation.set(0, 0, 0);
    NB.glass = null;
  }
  G.F.L.curlT = .3;
  restHands(G);
  G.busy = false;
  NB.on = false;
}

/* заговорить: он поворачивается, гость — к нему */
async function nbStart() {
  const G = NB.G;
  if (!G || NB.on || !SEAT.on || SIP.on || TOAST.on || SHOW.on || busy || modalOpen()) return;
  NB.on = true;
  const g = ++NB.gen, sg = SEAT.gen;
  NB.asked = sg;
  clearTimeout(NB.timer);
  answers([]);
  quietBubble();
  for (let i = 0; i < 40 && G.busy; i++) await sleep(.1);
  if (!nbAlive(g, sg)) { if (g === NB.gen) nbFree(); return; }
  G.busy = true;
  if (bt.look === camera.position) bt.look = null;
  G.F.leanT = .06; G.F.twistT = -.18;
  G.F.look = camera.position;
  await flyTo(nbShot(), 1.5, 0);
  if (!nbAlive(g, sg)) { if (g === NB.gen) nbFree(); return; }
  const c = LAST_DRINK;
  await nbSay(`Простите, что вмешиваюсь. ${c && !c.custom ? `«${c.name}» — хороший выбор. ` : ""}Я здесь с самого открытия и люблю поговорить с новым человеком у стойки.`);
  if (!nbAlive(g, sg)) return;
  nbMenu();
}
function nbMenu() {
  const list = [];
  if (servedGlass && SIP.frac > .02 && NB_GLASS !== servedGlass) list.push(["Чокнуться с соседом", () => nbToast()]);
  list.push(["Расскажите что-нибудь", () => nbTale()], ["Вернуться к бармену", () => nbBack(), true]);
  answers(list);
}
let NB_GLASS = null;   // с этим бокалом гость уже чокался с соседом
async function nbTale() {
  const g = NB.gen, sg = SEAT.gen;
  answers([]);
  NB.tale = (NB.tale + 1) % NB_TALES.length;
  NB.G.F.tilt = .06;
  await nbSay(NB_TALES[NB.tale]);
  NB.G.F.tilt = 0;
  await sleep(.4);
  if (nbAlive(g, sg)) nbMenu();
}
async function nbBack(line) {
  const sg = SEAT.gen;
  answers([]);
  if (line) { await nbSay(line); await sleep(1.6); if (sg !== SEAT.gen) return; }
  NB.gen++;
  nbFree();
  bt.look = camera.position;
  await flyTo(seatShot(true), 1.4, 0);
  if (sg === SEAT.gen && SEAT.on) seatAnswers();
}

/* бокалы встречаются у самых ободков, между двумя табуретами */
function nbGeom(cup) {
  const p = (CUPS[cup] || CUPS.rocks).p, rim = p[p.length - 1][1], S = 1.35 / 100;
  const hc = rim - .4;
  let rgc = cupRadAt(p, hc);
  for (const [r, y] of p) if (y >= hc - 3 && y <= rim) rgc = Math.max(rgc, r);
  const hg = hc * S, rg = rgc * S;
  const hp = CUPS.highball.p, hb = (hp[hp.length - 1][1] - .4) * 1.25 / 100, rb = hp[hp.length - 1][0] * 1.25 / 100;
  const M = V3(1.9, CT.top + .3, -1.95), d = V3(1, 0, .12).normalize(), gap = .003;
  const hitOf = Mp => Mp.clone().addScaledVector(d, -(rg + gap)).add(V3(0, -hg, 0));
  return {
    M, d, hb, hitOf,
    nGlass: M.clone().addScaledVector(d, rb + gap).add(V3(0, -hb, 0)),
    gHit: hitOf(M), gPre: hitOf(M).addScaledVector(d, -.07).add(V3(0, -.015, .06)), gBack: hitOf(M).addScaledVector(d, -.03).add(V3(0, .01, .03))
  };
}
/* держать стакан соседа точно в нужной точке: цель руки подправляется по тому, где стакан оказался */
async function nbHold(G, want, steps = 3) {
  const F = G.F, _g = V3(), _h = V3();
  for (let i = 0; i < steps; i++) {
    await sleep(i ? .3 : .55);
    G.glass.getWorldPosition(_g);
    F.L.hand.getWorldPosition(_h);
    const t = want.clone().sub(_g).add(_h), m = toFig(F, t);
    reach(F.L, m.x, m.y, m.z);
  }
}

async function nbToast() {
  const G = NB.G, F = G.F;
  if (!G || !servedGlass || SIP.on || TOAST.on || SHOW.on || SIP.frac <= .02) return;
  if (SIP.glass !== servedGlass) prepSip();
  const g = NB.gen, sg = SEAT.gen;
  const alive = () => nbAlive(g, sg);
  NB_GLASS = servedGlass;
  answers([]);
  SIP.on = true;   // гость пока не пьёт сам
  const c = pendingCocktail || SHOW.c, Tg = nbGeom(c ? c.cup : "rocks");
  let ready, done, clinked = false;
  const pReady = new Promise(r => { ready = r; }), pDone = new Promise(r => { done = r; });
  try {
    // берёт свой хайбол левой рукой — она ближе к гостю
    const gl = toFig(F, G.glass.position);
    reach(F.L, gl.x + .045, CT.top + .07, gl.z - .02, V3(-.2, 0, 1), DIR.in(1), .2);
    F.look = G.glass.position.clone().add(V3(0, .1, 0));
    await sleep(.65); if (!alive()) throw ABORT;
    F.L.curlT = .8;
    const h = grab(F, F.L, G.glass, V3(0, -.05, .05), .2);
    h.woff = V3(0, -.07, 0);
    NB.glass = h;
    await sleep(.25); if (!alive()) throw ABORT;
    // поднимает навстречу и говорит тост
    const pre = Tg.nGlass.clone().addScaledVector(Tg.d, .06).add(V3(0, -.01, .05)), mp = toFig(F, pre);
    reach(F.L, mp.x, mp.y + .07, mp.z + .02, V3(-.5, .4, 1), DIR.in(1));
    F.look = camera.position;
    SIP.on = false;
    const T = {
      pre: Tg.gPre, hit: Tg.gHit, back: Tg.gBack,
      ready: pReady,
      meet: async () => { reach(F.L, F.L.tgt.x, F.L.tgt.y, F.L.tgt.z); await nbHold(G, Tg.nGlass, 2); },
      clink: () => {
        clinked = true;
        clink();
        const s = glowSprite(0xfff0d0, .07, Tg.M.x, Tg.M.y, Tg.M.z, world, .9);
        tween(s.material, { opacity: 0 }, .45, ease.out).then(() => { world.remove(s); s.material.dispose(); });
        tween(s.scale, { x: .13, y: .13 }, .45, ease.out);
        F.nod = .07; setTimeout(() => { F.nod = 0; }, 300);
      },
      done: pDone
    };
    const sipP = takeSip(T);
    await nbHold(G, pre, 3); if (!alive()) throw ABORT;
    await nbSay(choose(NB_TOASTS)); if (!alive()) throw ABORT;
    // к точке встречи: настоящее положение его стакана решает, куда прийти бокалу гостя
    await nbHold(G, Tg.nGlass, 3); if (!alive()) throw ABORT;
    const ng = G.glass.getWorldPosition(V3());
    const Mreal = ng.clone().addScaledVector(Tg.d, -(.041 + .003)).add(V3(0, Tg.hb, 0));
    Tg.M.copy(Mreal); T.hit = Tg.hitOf(Mreal);
    ready();
    while (!clinked && alive()) await sleep(.1);
    if (!alive()) throw ABORT;
    // пьёт сам
    await sleep(.35); if (!alive()) throw ABORT;
    nbQuiet();
    reach(F.L, .03, 1.5, .2, V3(-.4, .6, 1), DIR.in(1));
    await sleep(.6); if (!alive()) throw ABORT;
    tween(h, { tilt: -.75 }, .5); F.nod = -.12;
    await sleep(1.1); if (!alive()) throw ABORT;
    tween(h, { tilt: 0 }, .4); F.nod = 0;
    await sleep(.3); if (!alive()) throw ABORT;
    const sp = toFig(F, G.spot);
    reach(F.L, sp.x + .045, CT.top + .07, sp.z - .02, V3(-.2, 0, 1), DIR.in(1));
    await sleep(.6); if (!alive()) throw ABORT;
    await putDown(F, G.glass, G.spot, .15);
    G.glass.rotation.set(0, 0, 0);
    NB.glass = null;
    F.L.curlT = .3;
    restHands(G);
    F.look = camera.position;
    await sleep(.3); if (!alive()) throw ABORT;
    await nbSay(choose(NB_BYE)); if (!alive()) throw ABORT;
    await sleep(2.2); if (!alive()) throw ABORT;
    NB.gen++;
    nbFree();
    bt.look = camera.position;
    await flyTo(seatShot(true), 1.4, 0);
    done();
    void sipP;
  } catch (e) {
    if (e !== ABORT) console.error(e);
    if (!clinked && NB_GLASS === servedGlass) NB_GLASS = null;   // не успели чокнуться — можно ещё раз
    done();
    if (g === NB.gen) { NB.gen++; nbFree(); }
    if (sg === SEAT.gen && SEAT.on && !SIP.on) { flyTo(seatShot(true), 1.2, 0); seatAnswers(); }
  }
}

/* сам заговаривает: после первого глотка, если гость задумался над бокалом */
{
  const baseAnswers = answers;
  answers = function (list) { NB.tok++; clearTimeout(NB.timer); baseAnswers(list); };
  const baseSeat = seatAnswers;
  seatAnswers = function () {
    baseSeat();
    if (!NB.G || NB.asked === SEAT.gen || SIP.n < 1 || STILL) return;
    const tok = NB.tok, sg = SEAT.gen;
    const tryStart = () => {
      if (tok !== NB.tok || sg !== SEAT.gen || !SEAT.on) return;
      if (modalOpen()) { NB.timer = setTimeout(tryStart, 6000); return; }   // гость читает карточку — не перебивать
      if (NB.G.busy || SIP.on || TOAST.on || SHOW.on || busy) { NB.timer = setTimeout(tryStart, 1500); return; }
      nbStart();
    };
    NB.timer = setTimeout(tryStart, 9000);
  };
  const baseLeave = leaveSeat;
  leaveSeat = function () {
    clearTimeout(NB.timer);
    if (NB.on) { NB.gen++; nbFree(); }
    baseLeave();
  };
}
/* щелчок по соседу, когда сидишь за стойкой, — заговорить с ним */
if (NB.G) {
  const hd = NB.G.F.root.userData.hot, base = hd && hd.act;
  if (hd && base) hd.act = () => { if (SEAT.on && !NB.on) nbStart(); else if (!SEAT.on) base(); };
}
Object.assign(H3D, { nbStart: () => nbStart(), nbToast: () => nbToast(), NB });

/* ================= заглушка улицы: гость входит сразу в зал =================
   Подставляется сборкой вместо src/venues/<id>/rooms/69-street.js, если такого файла нет.
   «Войти» ведёт прямо к стойке: камера влетает из глубины зала. Закрытие смены
   заканчивается в том же зале (окна и вывеска улицы — пустые). FEAT.street = false. */
FEAT.street = false;
const STREET = { on: false, step: "inside", wrong: 0, winGlow: [], doorStreak: { material: { opacity: 0 } } };
const street = new THREE.Group(); street.visible = false;
const FZ = (typeof ROOM !== "undefined" ? ROOM.z1 : 6) + .1;
const SDOOR = { g: new THREE.Object3D(), eyes: new THREE.Object3D(), flap: new THREE.Object3D(), flapY: 0 };
const doorway = { material: { opacity: 0 } };
const PREC = { N: 0, snow: false, active: 0, RN: 0, g: { setDrawRange() {} }, lines: { material: { color: new THREE.Color(), opacity: 0 } }, rings: { count: 0 } };
/* «улица» без улицы: общий план зала от входа и чуть ближе */
const SHOT = {
  wide: { pos: [0, 2.2, FZ - 1.2], tgt: [0, 1.45, -4.6], span: 8.5, pull: 1 },
  near: { pos: [0, 2.05, FZ - 2.4], tgt: [0, 1.45, -4.6], span: 7.6, pull: 1 },
  door: { pos: [0, 2.05, FZ - 2.4], tgt: [0, 1.45, -4.6], span: 7.6, pull: 1 }
};
let greeted = false;
let GREET = () => "";
function streetLights() {}
function streetTalk() {}
async function streetIntro() {
  STREET.on = false; STREET.step = "inside";
  Music.room(1);
  hintEl.textContent = ZONES[1].hint;
  renderZoneUI(1);
  await flyTo(framed(1), STILL ? 0 : 3.2, 0);
}

/* ================= камера по точкам, клики, интерфейс и главный цикл ================= */
const ZONES = [
  { name: "Читальня", sub: "Книги до потолка, дождь за окном, письмо на столе", pos: [-2.5, 1.6, 1.25], tgt: [-6.3, 1.3, -3.1], span: 5.4, pull: 2.6,
    hint: "Открой книгу рецептов на кафедре, прочти письмо или задуй свечу." },
  { name: "Бар", sub: "Бармен на месте, лёд уже в ведёрке", pos: [0, 1.95, 1.45], tgt: [0, 1.48, -4.6], span: 7.0, spanP: 4.3, pull: 3.0,
    hint: "Нажми на бутылку или сядь за стойку: бармен подберёт коктейль под настроение." },
  { name: "Курилка", sub: "Камин, кожаные кресла и дверь, в которую лучше постучать", pos: [2.8, 1.6, 1.65], tgt: [7.3, 1.05, -1.9], span: 5.6, pull: 2.4,
    hint: "Постучи в дверь, заведи граммофон или подбрось дров в камин." },
  { name: "Сцена", sub: BAND_HERE ? "Джаз-бэнд: фортепиано, саксофон, контрабас и щётки" : "Музыканты выходят на сцену в 19:00", pos: [-2.7, 1.62, .55], tgt: [-4.85, 1.3, 5.0], span: 5.0, pull: 2.2,
    hint: "Каждая нота, которую ты слышишь, сыграна на сцене. Кликни по музыканту — он что-нибудь расскажет." },
  { name: "Погреб", sub: "Тайный погреб под читальней: бочки, свечи и сомелье", pos: [-26, 1.75, 2.3], tgt: [-26.1, .95, -1.2], span: 3.0, pull: 1.0,
    hint: "Выбери вино: сомелье нальёт и расскажет его историю." }
];
ZONES[0].sub = SEASON_INFO[SEASON].nook;
if (SEASON === "summer") ZONES[2].hint = "Постучи в дверь или заведи граммофон. Летом камин не топят: в нём горят свечи.";
const INTRO_CAM = { pos: [0, 1.8, 5.5], tgt: [0, 1.5, -4.6], span: 8, pull: 1 };
const TEST = location.hash.includes("test");
let curZone = 1, PAUSED = false, flight = null, nudge = 0;
const CAM = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, fov: 50 };
const LOOK = { yaw: 0, pitch: 0, py: 0, pp: 0 };

/* кадр для зоны с учётом экрана: на узком телефоне камера отходит и расширяет угол */
function framed(z, extra = 0) {
  const c = typeof z === "number" ? ZONES[z] : z;
  const aspect = innerWidth / innerHeight;
  const pos = V3(...c.pos), tgt = V3(...c.tgt);
  const dir = pos.clone().sub(tgt), dist = dir.length();
  dir.normalize();
  let vfov = 50;
  const hOf = v => 2 * Math.atan(Math.tan(v / 2 * D2R) * aspect);
  // на телефоне чуть ближе: остальное можно рассмотреть, проведя пальцем; у бара свой кадр (spanP), чтобы бармен не терялся
  const span = aspect < .62 && c.spanP ? c.spanP : (c.span || 6) * (aspect < .8 ? .8 : 1);
  const need = 2 * Math.atan(span / 2 / dist);
  if (hOf(vfov) < need) vfov = Math.min(68, 2 * Math.atan(Math.tan(need / 2) / aspect) / D2R);
  let d2 = dist;
  if (hOf(vfov) < need) d2 = Math.min(dist + (c.pull || 0), (span / 2) / Math.tan(hOf(vfov) / 2));
  d2 -= extra;
  const p = tgt.clone().addScaledVector(dir, d2);
  return { px: p.x, py: p.y, pz: p.z, tx: tgt.x, ty: tgt.y, tz: tgt.z, fov: vfov };
}
function setCam(s) { Object.assign(CAM, s); }
/* перелёт по дуге: камера чуть отступает назад и плавно разворачивается */
function flyTo(s, dur = 1.8, back = .9) {
  if (STILL) { setCam(s); return Promise.resolve(); }
  return new Promise(res => {
    if (flight) flight.res();
    const A = Object.assign({}, CAM);
    const mid = V3((A.px + s.px) / 2, (A.py + s.py) / 2 + .12, (A.pz + s.pz) / 2 + back);
    flight = { A, B: s, mid, t0: NOW, dur: dur * 1000, res };
  });
}
function runFlight() {
  if (!flight) return;
  const f = flight, k = clamp((NOW - f.t0) / f.dur, 0, 1), e = ease.io(k), u = 1 - e;
  CAM.px = u * u * f.A.px + 2 * u * e * f.mid.x + e * e * f.B.px;
  CAM.py = u * u * f.A.py + 2 * u * e * f.mid.y + e * e * f.B.py;
  CAM.pz = u * u * f.A.pz + 2 * u * e * f.mid.z + e * e * f.B.pz;
  const et = ease.io(clamp(k * 1.08, 0, 1));
  for (const key of ["tx", "ty", "tz", "fov"]) CAM[key] = lerp(f.A[key], f.B[key], et);
  if (k >= 1) { flight = null; f.res(); }
}

/* ---------- интерфейс ---------- */
const navBtns = [...document.querySelectorAll("#nav button")];
/* залы, которых у заведения нет (заглушки), не показываются; остался один бар — нет и переключателя */
const ZONE_ON = [FEAT.nook, true, FEAT.smoke, FEAT.stage, FEAT.cellar && FEAT.nook];
navBtns.forEach(b => { if (!ZONE_ON[+b.dataset.zone]) b.hidden = true; });
if (navBtns.filter(b => !b.hidden).length < 2) document.getElementById("nav").hidden = true;
const titleEl = document.getElementById("zone-title"), subEl = document.getElementById("zone-sub");
const spotsEl = document.getElementById("spots"), tip = document.getElementById("tip");
function renderZoneUI(i) {
  track("room", i);
  navBtns.forEach(b => b.setAttribute("aria-current", String(+b.dataset.zone === i)));
  titleEl.classList.add("swap");
  setTimeout(() => {
    titleEl.firstChild.textContent = ZONES[i].name;
    subEl.textContent = ZONES[i].sub;
    titleEl.classList.remove("swap");
  }, STILL ? 0 : 280);
  if (!mixDlg.open && !busy) hintEl.textContent = ZONES[i].hint;
  spotsEl.innerHTML = "";
  HOT.filter(h => h.userData.hot.zone === i && !h.userData.hot.noChip && !h.userData.hot.secret && !h.userData.hot.hidden).forEach(h => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "spot"; b.textContent = h.userData.hot.label;
    b.addEventListener("click", () => activate(h));
    b.addEventListener("pointerenter", () => { chipHover = h; });
    b.addEventListener("pointerleave", () => { if (chipHover === h) chipHover = null; });
    b.addEventListener("focus", () => { chipHover = h; });
    b.addEventListener("blur", () => { if (chipHover === h) chipHover = null; });
    h.userData.chip = b;
    spotsEl.appendChild(b);
  });
}
function goZone(i, dur = 1.9) {
  i = clamp(i, 0, ZONES.length - 1);
  if (!ZONE_ON[i]) i = 1;                    // зала нет — остаёмся в баре
  if (typeof CEL !== "undefined" && CEL.busy) return Promise.resolve();
  const cross = (curZone === 4) !== (i === 4);
  leaveSeat();
  const same = i === curZone;
  curZone = i; cur = i;
  applyTime();
  track("room", i);
  Music.room(i === 3 ? 4 : i === 4 ? 5 : i);
  if (mixDlg.open && i !== 1) mixDlg.close();
  renderZoneUI(i);
  tween(LIGHTS.fill.position, { x: FILL_AT[i].x, y: FILL_AT[i].y, z: FILL_AT[i].z }, same ? .1 : dur);
  tween(LOOK, { yaw: 0, pitch: 0 }, same ? .6 : dur * .8);
  nudge = 0;
  if (cross) return cellarCross(i);
  return flyTo(framed(i), same ? .8 : dur, same ? 0 : .9);
}
navBtns.forEach(b => b.addEventListener("click", () => { if (!busy) goZone(+b.dataset.zone); }));

/* ---------- клики и наведение ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let hovered = null, chipHover = null, pointer = null, mouseAt = null, needRay = false;
function pick(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(hotMeshes, false);
  // на улице кликается только своё, внутри — только бар
  const hit = hits.find(h => (h.object.userData.hotRoot.userData.hot.zone === "street") === STREET.on && h.object.userData.hotRoot.visible);
  return hit ? hit.object.userData.hotRoot : null;
}
const modalOpen = () => dlg.open || Book.isOpen || (typeof Closeup !== "undefined" && Closeup.active);
async function activate(root) {
  const h = root.userData.hot;
  if (modalOpen()) return;
  if (busy && h.zone !== 1) return;
  if (SEAT.on && !h.noChip) return;
  if (STREET.on || h.zone === "street") { if (STREET.on && h.zone === "street") h.act(); return; }   // сидя у стойки, можно только перекинуться словом с соседом
  if (h.zone !== curZone) await goZone(h.zone);
  h.act();
}
canvas.addEventListener("pointerdown", e => {
  if (!e.isPrimary) return;
  pointer = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, yaw: LOOK.yaw, pitch: LOOK.pitch, type: e.pointerType };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", e => {
  mouseAt = { x: e.clientX, y: e.clientY, type: e.pointerType };
  if (e.pointerType === "mouse") needRay = true;
  if (!pointer || pointer.id !== e.pointerId) return;
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  if (!pointer.drag && Math.hypot(dx, dy) > 7) { pointer.drag = true; app.classList.add("drag"); hideTip(); }
  if (pointer.drag) {
    const k = 1.25 / Math.max(innerWidth, 500);
    const lim = innerWidth / innerHeight < 1 ? .62 : .38;
    LOOK.yaw = clamp(pointer.yaw + dx * k * 1.6, -lim, lim);
    LOOK.pitch = clamp(pointer.pitch + dy * k, -.22, .22);
    for (const t of tweens) if (t.obj === LOOK) tweens.delete(t);
  }
});
canvas.addEventListener("pointerup", e => {
  if (!pointer || pointer.id !== e.pointerId) return;
  const p = pointer;
  pointer = null;
  app.classList.remove("drag");
  if (p.drag) return;
  const root = pick(e.clientX, e.clientY);
  if (root) activate(root);
});
canvas.addEventListener("pointercancel", () => { pointer = null; app.classList.remove("drag"); });
canvas.addEventListener("pointerleave", () => { if (!pointer) { mouseAt = null; needRay = true; } });
function hideTip() { tip.classList.remove("show"); }
addEventListener("keydown", e => {
  if (modalOpen() || mixDlg.open || busy || STREET.on) return;
  if (e.target.closest && e.target.closest("input, textarea")) return;
  if (curZone === 4) return;
  if (e.key === "ArrowLeft") { e.preventDefault(); goZone(Math.max(0, curZone - 1)); }
  if (e.key === "ArrowRight") { e.preventDefault(); goZone(Math.min(3, curZone + 1)); }
});

/* ---------- бутылки, коктейли и связь с барной картой ---------- */
/* кадр на бармена с бутылкой: на компьютере бутылка слева от карточки, на телефоне — над ней */
function serveShot(hx) {
  const wide = innerWidth / innerHeight > 1.05;
  const bx = hx - .45;
  const s = framed({ pos: [bx * .7 + (wide ? .55 : 0), 1.62, -.15], tgt: [bx + (wide ? .75 : 0), wide ? 1.4 : 1.12, -3.6], span: 2.6, pull: 1.6 });
  return s;
}
let pendingCocktail = null;
H3D.bottle = async id => {
  if (mixDlg.open) { toggleIng(id); return; }
  if (busy || BT.busy) return;
  const h = heroes[id];
  if (STILL) { openCard(h.d); return; }
  busy = true;
  hideTip();
  nudge = .55;
  flyTo(serveShot(h.home.x), 1.4, 0);
  await fetchBottle(h);
  busy = false;
  openCard(h.d);
  dlg.addEventListener("close", () => {
    nudge = 0;
    flyTo(framed(1), 1.2, 0);
    returnBottle(h);
  }, { once: true });
};
const baseMake = window.makeCocktail;
window.makeCocktail = async id => {
  if (busy || BT.busy) return;
  if (curZone !== 1) await goZone(1);
  pendingCocktail = COCKTAIL_BY_ID[id];
  await baseMake(id);
};
H3D.prep = () => { if (!STILL) BT.busy = true; };
H3D.done = () => {
  if (pendingCocktail && !SHOW.served) placeServed(pendingCocktail);
  const showed = SHOW.served;
  SHOW.served = false;
  if (STILL) return;
  if (!showed) presentCocktail();
  dlg.addEventListener("close", () => {
    if (SEAT.on) { flyTo(seatShot(true), 1.3, 0); relax().then(afterServe); }
    else { flyTo(framed(1), 1.3, 0); relax(); }
  }, { once: true });
};
H3D.pause = on => { PAUSED = on; };
H3D.go = i => goZone(i);

/* ---------- пыль в свете ламп ---------- */
const DUST = (() => {
  const N = QUALITY > 1 ? 160 : 80, pos = new Float32Array(N * 3), base = [];
  for (let i = 0; i < N; i++) base.push([R(-3, 3), R(1.15, 2.6), R(-3.4, -1.4), R(0, 6.3), R(.02, .06)]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffc890, size: .012, map: TEX.glow, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  world.add(p);
  return { N, pos, base, g, p };
})();

/* ---------- окружение для отражений: снимок самой комнаты ---------- */
function bakeEnvironment() {
  const pm = new THREE.PMREMGenerator(renderer);
  world.position.set(0, -1.6, 1.8);
  const rt = pm.fromScene(scene, .03, .1, 40);
  world.position.set(0, 0, 0);
  scene.environment = rt.texture;
  pm.dispose();
}

/* ---------- главный цикл ---------- */
let last = performance.now(), frames = 0, slowAcc = 0, slowN = 0, slowHits = 0, startedAt = 0, neonT = 6 + Math.random() * 6;
const _p = V3(), _t = V3(), _d = V3();
const GYRO = { on: false, x: 0, y: 0 };   // наклон телефона (заполняет 92-venue.js)
function tick(now) {
  requestAnimationFrame(tick);
  // 30 кадров в секунду в режиме экономии: пропускаем каждый второй кадр
  if ((SET.fps === "30" || SET.saver) && now - last < 30) return;
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (PAUSED || document.hidden || (closedNow && !started)) return;
  NOW = now;
  const t = now / 1000;
  runTweens();
  runFlight();
  // камера: положение, взгляд, лёгкое «дыхание» и параллакс мыши
  _p.set(CAM.px, CAM.py, CAM.pz);
  _t.set(CAM.tx, CAM.ty, CAM.tz);
  _d.subVectors(_t, _p);
  const len = _d.length();
  let yaw = Math.atan2(_d.x, _d.z), pitch = Math.asin(clamp(_d.y / len, -1, 1));
  if (mouseAt && mouseAt.type === "mouse" && !pointer && !STILL) {
    LOOK.py = lerp(LOOK.py, -(mouseAt.x / innerWidth - .5) * .07, .05);
    LOOK.pp = lerp(LOOK.pp, -(mouseAt.y / innerHeight - .5) * .04, .05);
  } else if (GYRO.on && !pointer && !STILL) {   // на телефоне — от наклона
    LOOK.py = lerp(LOOK.py, -GYRO.x * .06, .06);
    LOOK.pp = lerp(LOOK.pp, GYRO.y * .035, .06);
  } else { LOOK.py = lerp(LOOK.py, 0, .03); LOOK.pp = lerp(LOOK.pp, 0, .03); }
  yaw += LOOK.yaw + LOOK.py; pitch += LOOK.pitch + LOOK.pp + SIP.pitch;
  if (!STILL) { _p.y += Math.sin(t * .8) * .006; _p.x += Math.sin(t * .37) * .008; }
  // параллакс: камера чуть смещается вслед за взглядом — ближние предметы сдвигаются сильнее дальних
  if (!STILL) { _p.x -= Math.cos(yaw) * LOOK.py * .55; _p.z += Math.sin(yaw) * LOOK.py * .55; _p.y += LOOK.pp * .35; }
  camera.position.copy(_p);
  camera.lookAt(_p.x + Math.sin(yaw) * Math.cos(pitch), _p.y + Math.sin(pitch), _p.z + Math.cos(yaw) * Math.cos(pitch));
  if (Math.abs(camera.fov - CAM.fov) > .01) { camera.fov = CAM.fov; camera.updateProjectionMatrix(); }

  // наведение
  if (needRay && mouseAt && !pointer && !modalOpen()) {
    needRay = false;
    hovered = mouseAt.type === "mouse" ? pick(mouseAt.x, mouseAt.y) : null;
  } else if (!mouseAt || modalOpen()) hovered = null;
  const lit = hovered || chipHover;
  app.classList.toggle("hover", !!hovered);
  if (hovered && mouseAt) {
    tip.textContent = hovered.userData.hot.label;
    tip.style.transform = `translate(${Math.min(mouseAt.x + 16, innerWidth - tip.offsetWidth - 8)}px, ${mouseAt.y + 18}px)`;
    tip.classList.add("show");
  } else hideTip();
  for (const h of HOT) {
    const d = h.userData.hot, want = h === lit ? 1 : 0;
    d.h += (want - d.h) * Math.min(1, dt * 10);
    if (d.grow) h.scale.copy(d.base).multiplyScalar(1 + d.grow * d.h);
    if (d.lift && !h.userData.out) h.position.y = d.y0 + d.lift * d.h;
    if (h.userData.chip) h.userData.chip.classList.toggle("lit", want === 1);
  }
  // бутылки в шейкере светятся золотом
  for (const id in heroes) {
    const hr = heroes[id], inS = mixDlg.open && inShaker.has(id);
    const target = mixDlg.open ? (inS ? 1 : .4) : .2 + hr.root.userData.hot.h * .4;
    hr.halo.material.opacity += (target - hr.halo.material.opacity) * Math.min(1, dt * 6);
    hr.halo.material.color.setHex(inS ? 0xffd27a : 0xffb070);
    if (hr.root.userData.chip) hr.root.userData.chip.classList.toggle("in", inS);
  }

  updateFigures(t, dt);
  // неон иногда мигает
  neonT -= dt;
  let nb = 1;
  if (neonT < 0 && neonT > -.5) nb = .35 + .65 * (Math.sin(-neonT * 60) > 0 ? 1 : 0);
  else if (neonT <= -.5) neonT = 7 + Math.random() * 9;
  nb *= SHUT.neon;
  neonMat.opacity = nb; neonGlow.material.opacity = .35 * nb;
  LIGHTS.red.intensity = LIGHTS.red.userData.base * (.8 + .2 * nb) * (.08 + .92 * SHUT.back);
  // пыль
  if (DUST.p.visible) for (let i = 0; i < DUST.N; i++) {
    const b = DUST.base[i];
    DUST.pos[i * 3] = b[0] + Math.sin(t * .2 + b[3]) * .3;
    DUST.pos[i * 3 + 1] = b[1] + Math.sin(t * b[4] * 4 + b[3]) * .2;
    DUST.pos[i * 3 + 2] = b[2] + Math.cos(t * .17 + b[3]) * .2;
  }
  if (DUST.p.visible) DUST.g.attributes.position.needsUpdate = true;
  for (const fn of tickers) fn(t, dt);

  if (!TEST) POST.render(dt);
  // если тормозит: уменьшаем разрешение
  if (started) {
    frames++;
    slowAcc += dt; slowN++;
    if (slowN >= 90) {
      const fps = slowN / slowAcc;
      // сначала упрощаем эффекты, потом уменьшаем разрешение; первые секунды после входа и разовые подвисания не считаем
      slowHits = fps < 40 && NOW - startedAt > 5000 ? slowHits + 1 : 0;
      if (slowHits >= 2) { slowHits = 0; if (!POST.degrade() && DPR > .85) { DPR = Math.max(.85, DPR - .25); renderer.setPixelRatio(DPR); POST.setSize(); } }
      slowAcc = 0; slowN = 0;
    }
  }
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  POST.setSize();
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  if (started && !flight) setCam(SEAT.on ? seatShot() : framed(curZone, nudge));
}
addEventListener("resize", resize);

/* ---------- вход ---------- */
let started = false;
const intro = document.getElementById("intro"), enter = document.getElementById("enter");
resize();
setCam(framed(SHOT.wide));
CAM.fov = framed(1).fov;
progress(.7);
bakeEnvironment();
renderer.compile(scene, camera);
POST.render();
progress(.86);
H3D.ready = true;
H3D.bt = bt; H3D.figs = FIGS; H3D.BT = BT;
H3D.cam = (p, t, fov = 40) => { flight = null; setCam({ px: p[0], py: p[1], pz: p[2], tx: t[0], ty: t[1], tz: t[2], fov }); };
H3D.render = () => POST.render();
H3D.post = POST;
H3D.info = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, dpr: DPR, zone: curZone, busy, btBusy: BT.busy });
renderZoneUI(1);
requestAnimationFrame(tick);
/* ---------- часы работы: открыто с 17:00 до 3:00 ---------- */
const introText = document.getElementById("intro-text"), statusEl = document.getElementById("status"), introTitle = intro.querySelector("h1");
const ownerOut = document.getElementById("owner-out");
ownerOut.addEventListener("click", () => {
  try { localStorage.removeItem("hacheden-owner"); } catch (e) {}
  location.reload();
});
const BAR_COLD = new THREE.Color(0x7d9cff), BAR_WARM = new THREE.Color(0xffb27a);
/* конец смены: лампы и неон гаснут по одной (1 — горит, 0 — погашено) */
const SHUT = { pendL: 1, pendC: 1, pendR: 1, fill: 1, neon: 1, back: 1 };
/* атмосфера: по часам или вручную — вечер, полночь, поздняя ночь */
function moodDate() {
  const m = SET.mood;
  if (m === "auto") return sceneDate();
  const e = new Date(sceneDate());
  if (m === "evening") { const h = Math.max(17, SUNSET - .35); e.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0); }
  else if (m === "midnight") e.setHours(0, 0, 0, 0);
  else e.setHours(2, 30, 0, 0);
  return e;
}
const ZONE_LIGHT = [1, 1, 1, 1, 1];
/* свет меняется плавно: смена атмосферы, зала или времени суток идёт за пару секунд, а не рывком */
let atFirst = true;
const _wc = new THREE.Color();
function applyTime() {
  const d = moodDate(), sky = skyLight(d), late = lateness(d);
  const soft = (obj, key, v, dur = 2.2) => { if (atFirst || STILL) obj[key] = v; else if (Math.abs(obj[key] - v) > 1e-3) tween(obj, { [key]: v }, dur); };
  soft(hemi, "intensity", 1.6 * (1 + .1 * sky - .18 * late));
  soft(rainMat.uniforms.uSky, "value", sky, 3);
  if (!STREET.on) { _wc.copy(BAR_COLD).lerp(BAR_WARM, sky); if (atFirst) LIGHTS.window.color.copy(_wc); else tween(LIGHTS.window.color, { r: _wc.r, g: _wc.g, b: _wc.b }, 3); }
  for (const k of ["pendL", "pendC", "pendR", "fill"]) soft(LIGHTS[k], "intensity", LIGHTS[k].userData.base * (1 - .3 * late) * SHUT[k] * (k === "fill" ? ZONE_LIGHT[curZone] ?? 1 : 1), k === "fill" ? 1.2 : 2.2);
  atFirst = false;
}
function showClosed(afterVisit) {
  intro.classList.add("closed");
  const min = minutesUntil(OPEN_H);
  introTitle.classList.add("off");
  introText.textContent = afterVisit || intro.dataset.after
    ? "Бар закрылся. Спасибо, что заглянул! Ждём тебя снова."
    : "Сейчас закрыто. Бар открывается каждый день в 17:00 и работает до 3:00 ночи.";
  statusEl.textContent = `Откроемся в 17:00, через ${spell(min)}`;
  statusEl.hidden = false;
  enter.hidden = true;
}
function showOpen() {
  intro.classList.remove("closed");
  introTitle.classList.remove("off");
  const left = minutesUntil(CLOSE_H);
  // у другого бара — его собственный текст (meta.intro): про камин и читальню Hacheden там ни слова
  introText.textContent = VENUE_ID !== "hacheden" && VENUE.meta.intro ? VENUE.meta.intro : `${SEASON_INFO[SEASON].line} Стойка, курилка у камина и читальня ждут.`;
  statusEl.textContent = OWNER
    ? (openByClock() ? "Режим хозяина. Для гостей открыто до 3:00" : "Режим хозяина: для тебя открыто. Гостей ждём с 17:00")
    : left <= 30 ? `Последний заказ: закрываемся через ${spell(left)}` : "Открыто до 3:00";
  ownerOut.hidden = !OWNER;
  statusEl.hidden = false;
  enter.hidden = false;
  enter.disabled = !WARM_DONE;
}
let closedNow = !isOpen();
if (closedNow) showClosed(false); else showOpen();
applyTime();
if (!closedNow) enter.focus({ preventScroll: true });
let lastCallShown = false, visited = false;
setInterval(() => {
  const open = isOpen();
  applyTime();
  if (!started) {
    if (open && closedNow) { closedNow = false; showOpen(); introTitle.style.animation = "none"; void introTitle.offsetWidth; introTitle.style.animation = ""; }
    else if (!open) { closedNow = true; showClosed(visited); }
    else showOpen();
    return;
  }
  const h = hoursOf(nowDate());
  if (!OWNER && open && h >= LAST_CALL && h < CLOSE_H && !lastCallShown) {
    lastCallShown = true;
    ZONES.forEach(z => { z.hint = `Последний заказ: в 3:00 бар закрывается. ${z.hint}`; });
    if (!busy && !mixDlg.open) hintEl.textContent = ZONES[curZone].hint;
  }
  if (!open && !CLOSING.on) playClosing();
}, 15000);
function closeBar() {
  if (closedNow) return;
  closedNow = true;
  if (dlg.open) dlg.close();
  if (mixDlg.open) mixDlg.close();
  if (Book.isOpen) document.getElementById("book").close();
  if (Music.on) Music.stop();
  started = false;
  visited = true;
  showClosed(true);
  intro.classList.remove("gone", "dive");
}
enter.addEventListener("click", async () => {
  if (started || !isOpen()) return;
  started = true;
  startedAt = performance.now();
  intro.classList.add("gone");
  let pref = null;
  try { pref = localStorage.getItem("hacheden-music"); } catch (e) {}
  if (pref !== "off" && !Music.on) setMusic(true);
  renderer.toneMappingExposure = STILL ? 1.2 : .15;
  if (!STILL) tween(renderer, { toneMappingExposure: 1.2 }, 2.2, ease.out);
  if (!idleStarted) { idleStarted = true; idleLife(); companyLife(); }
  streetIntro();
  if (!idleStarted) { idleStarted = true; idleLife(); companyLife(); }
});
let idleStarted = false;

/* ================= конец смены: последняя мелодия, гости расходятся, бармен убирает и гасит свет ================= */
const CLOSING = { on: false, gen: 0, skip: false };
const CLOSE_ABORT = { closing: true };
function cAlive(g) { if (g !== CLOSING.gen || CLOSING.skip) throw CLOSE_ABORT; }
async function cw(g, s) { await sleep(STILL ? 0 : s); cAlive(g); }
const peekBtn = document.getElementById("peek");

/* кнопка на закрытом экране: первые полчаса после трёх видно, как смена заканчивается; хозяину — всегда */
function updatePeek() {
  const h = hoursOf(nowDate());
  const justClosed = !isOpen() && h >= CLOSE_H && h < CLOSE_H + .5;
  peekBtn.hidden = !(justClosed || OWNER) || started || CLOSING.on;
  peekBtn.textContent = OWNER && !justClosed ? "Посмотреть, как закрывается смена" : "Заглянуть: смена закрывается";
}
updatePeek();
setInterval(updatePeek, 15000);
peekBtn.addEventListener("click", () => {
  if (started || CLOSING.on) return;
  started = true;
  closedNow = false;
  intro.classList.add("gone");
  peekBtn.hidden = true;
  renderer.toneMappingExposure = 1.2;
  if (!Music.on) setMusic(true);
  setCam(framed(1));
  renderZoneUI(1);
  playClosing();
});

function cCaption(t) { caption("", t); }
const CL_LINES = ["Спокойной ночи!", `До завтра, ${BAR_NAME}!`, "Лучший вечер за неделю.", "Ещё увидимся."];
async function playClosing() {
  track("secret", "closing");
  if (CLOSING.on) return;
  CLOSING.on = true; CLOSING.skip = false;
  const g = ++CLOSING.gen;
  // всё открытое закрываем, гостя поднимаем со стула
  if (dlg.open) dlg.close();
  if (mixDlg.open) mixDlg.close();
  if (Book.isOpen) document.getElementById("book").close();
  if (SHOW.on) { SHOW.fast = true; SHOW.gen++; }
  for (let i = 0; i < 60 && (SHOW.on || busy || CEL.busy); i++) await sleep(.1);
  busy = true;
  leaveSeat();
  talkEl.hidden = true;
  if (curZone === 4) { await goZone(1); }
  BT.busy = true;
  showUI.title.textContent = "Смена подходит к концу";
  showUI.root.classList.add("closing");
  showUI.root.hidden = false;
  app.classList.add("showing");
  try {
    // 1. последняя мелодия и поклон
    BAND_HERE = true;
    for (const F of Object.values(MUS)) F.root.visible = true;
    cCaption("Последняя мелодия этой ночи");
    await goZone(3, 2.2);
    cAlive(g);
    await cw(g, 4.5);
    if (Music.on) Music.stop();
    STG.bow = true;
    applause(2.8);
    cCaption("Музыканты кланяются");
    await cw(g, 2.6);
    STG.bow = false;
    // свет на сцене гаснет
    STG.beams.forEach(b => tween(b.material, { opacity: 0 }, 1.6));
    STG.dim = 1; tween(STG, { dim: .15 }, 1.6);
    await cw(g, 1.6);

    // 2. гости прощаются
    await goZone(1, 2.0);
    cAlive(g);
    cCaption("Гости допивают и прощаются");
    for (let i = 0; i < GUESTS.length; i++) { say(GUESTS[i].F, CL_LINES[i % CL_LINES.length], 2.4); if (i === 0) clink(); await cw(g, 1.5); }
    bt.look = camera.position;
    say(bt, "Спасибо, что были с нами!", 2.6);
    await cw(g, 2.4);
    // пока камера смотрит на бармена, гости уходят
    await flyTo(framed({ pos: [bt.x + .2, 1.55, -1.1], tgt: [bt.x, 1.35, -3.3], span: 1.8, pull: .5 }), STILL ? 0 : 1.6, 0);
    cAlive(g);
    GUESTS.forEach(G => { G.F.root.visible = false; G.F.off = true; });
    for (const F of [MUS.piano, MUS.sax, MUS.bass, MUS.drum]) F.root.visible = false;

    // 3. бармен собирает бокалы
    cCaption("Бармен собирает бокалы");
    BT.mode = "free";
    if (bt.held.some(h => h.obj === btGlass)) await stash();
    const glasses = GUESTS.map(G => G.glass).concat(servedGlass ? [servedGlass] : []);
    for (const gl of glasses) {
      if (!gl.parent) continue;
      const gx = clamp(gl.position.x + .08, -2.6, 2.6);
      flyTo(framed({ pos: [gx + .15, 1.6, -.7], tgt: [gx, 1.2, -2.7], span: 2.0, pull: .5 }), STILL ? 0 : 1.2, 0);
      await walkTo(gx, BT_Z + .12, 0);
      cAlive(g);
      const l = toFig(bt, gl.position);
      reach(bt.R, l.x, CT.top + .1, l.z - .02, V3(.1, -.4, 1), DIR.in(-1), .2);
      await cw(g, .45);
      bt.R.curlT = .85;
      const hand = bt.R.hand.getWorldPosition(V3());
      SND.clink();
      await tween(gl.position, { x: hand.x, y: CT.top + .12, z: hand.z }, STILL ? 0 : .3, ease.out);
      reach(bt.R, l.x, .9, -.05, DIR.down, DIR.in(-1), .8);
      await tween(gl.position, { y: .7, z: bt.z + .2 }, STILL ? 0 : .45, ease.in);
      gl.visible = false;
      bt.R.curlT = .2;
      await cw(g, .2);
    }
    if (servedGlass && !servedGlass.visible) { drop(servedGlass); servedGlass = null; }

    // 4. протирает стойку
    cCaption("Протирает стойку до блеска");
    await walkTo(.2, BT_Z, 0);
    cAlive(g);
    await flyTo(framed({ pos: [.6, 1.5, -1.0], tgt: [.2, 1.15, -2.6], span: 1.9, pull: .4 }), STILL ? 0 : 1.2, 0);
    reach(bt.R, 0, CT.top + .02, .5, V3(0, -.2, 1), DIR.down, .1);
    await cw(g, .3);
    const rag = grab(bt, bt.R, btRag, V3(0, -.07, .02), .25);
    rag.woff = V3(0, -.02, 0);
    BT.mode = "wipe";
    await cw(g, 3.6);
    BT.mode = "free";
    await putDown(bt, btRag, fromFig(bt, V3(-.12, CT.top + .004, .6)));
    bt.leanT = .07;
    armsDown();

    // 5. гасит свет: лампы по одной, потом неон
    cCaption("Гасит свет");
    await flyTo(framed({ pos: [0, 1.75, .9], tgt: [0, 1.6, -4.4], span: 6.2, pull: 1.6 }), STILL ? 0 : 1.6, 0);
    cAlive(g);
    for (const [k, idx] of [["pendR", 1], ["pendL", 0]]) {
      await walkTo(idx ? 1.7 : -1.7, BT_Z, 0);
      cAlive(g);
      reach(bt.R, -.05, 1.75, .25, V3(0, 1, .3), DIR.in(-1), .6);
      await cw(g, .45);
      switchClick();
      SHUT[k] = 0; LIGHTS[k].intensity = 0;
      pendants[idx].bulb.material.color.setHex(0x2a2018);
      pendants[idx].cone.visible = false;
      pendants[idx].glow.visible = false;
      armsDown();
      await cw(g, .6);
    }
    SHUT.pendC = 0; LIGHTS.pendC.intensity = 0;
    await cw(g, .4);
    // неон мигает и гаснет
    await walkTo(0, BT_Z, 0);
    bt.look = V3(0, 3.2, -4.9);
    for (const v of [.2, 1, .1, .6, 0]) { SHUT.neon = v; buzz(); await cw(g, .16); }
    SHUT.neon = 0;
    // подсветка полок гаснет последней
    switchClick();
    tween(SHUT, { back: 0 }, 1.4);
    tween(BACKLIT.panel.color, { r: .12, g: .08, b: .08 }, 1.4);
    tween(BACKLIT.led.color, { r: .15, g: .06, b: .07 }, 1.4);
    tween(SHUT, { fill: .28 }, 1.2);
    tween(LIGHTS.fill, { intensity: LIGHTS.fill.userData.base * .28 }, 1.2);
    await cw(g, 1.2);

    // 6. последний взгляд
    cCaption("Смена окончена");
    bt.look = camera.position;
    await flyTo(framed({ pos: [bt.x + .1, 1.55, -1.25], tgt: [bt.x, 1.5, -3.3], span: 1.6, pull: .4 }), STILL ? 0 : 1.6, 0);
    cAlive(g);
    say(bt, "Спокойной ночи. Ждём завтра в пять.", 3.2);
    bt.nod = .1;
    await cw(g, .6);
    bt.nod = 0;
    await cw(g, 2.4);
    bubbleEl.classList.remove("show");
    await walkTo(-2.7, BT_Z, 0);
    await fade(true, 1.0);
    cAlive(g);

    // 7. улица: окна гаснут, неон на фасаде тухнет
    street.visible = true;
    app.classList.add("street");
    streetLights(true);
    LIGHTS.fill.intensity = LIGHTS.fill.userData.base;
    SHUT.neon = 1;
    setCam(framed(SHOT.near));
    cCaption("До завтра. Открываемся в 17:00");
    await fade(false, 1.2);
    cAlive(g);
    await cw(g, 1.2);
    for (let i = 0; i < STREET.winGlow.length; i += 2) {
      tween(STREET.winGlow[i].material.color, { r: .08, g: .05, b: .05 }, .8);
      tween(STREET.winGlow[i + 1].material, { opacity: 0 }, .8);
      switchClick();
      await cw(g, 1.0);
    }
    for (const v of [.3, 1, .15, .7, .05, .4, 0]) { SHUT.neon = v; buzz(); await cw(g, .18); }
    SHUT.neon = 0;
    flyTo(framed(SHOT.wide), STILL ? 0 : 5, 0);
    await cw(g, 4.2);
  } catch (e) {
    if (e !== CLOSE_ABORT) console.error(e);
  }
  if (g === CLOSING.gen) finishClosing();
}
/* финал: закрытый экран; если бар ещё открыт (хозяин), всё возвращается как было */
function finishClosing() {
  showUI.root.hidden = true;
  showUI.root.classList.remove("closing");
  app.classList.remove("showing");
  bubbleEl.classList.remove("show");
  STG.bow = false;
  fade(false, .3);
  if (Music.on) Music.stop();
  started = false;
  busy = false;
  CLOSING.on = false;
  if (!isOpen()) {
    closedNow = true;
    visited = true;
    intro.dataset.after = "1";
    SHUT.neon = 0;
    showClosed(true);
  } else {
    restoreBar();
    showOpen();
  }
  intro.classList.remove("gone", "dive");
  updatePeek();
}
function restoreBar() {
  Object.assign(SHUT, { pendL: 1, pendC: 1, pendR: 1, fill: 1, neon: 1 });
  pendants.forEach(p => { p.bulb.material.color.setHex(0xfff0d0); p.cone.visible = true; p.glow.visible = true; });
  SHUT.back = 1; BACKLIT.panel.color.setHex(0xd8b0b0); BACKLIT.led.color.setHex(0xff5a70);
  applyTime();
  STG.dim = 1; STG.beams.forEach(b => { b.material.opacity = .13; });
  BAND_HERE = OWNER || BANDH >= 19 || BANDH < 3;
  for (const F of Object.values(MUS)) F.root.visible = BAND_HERE;
  GUESTS.forEach(G => { G.F.root.visible = true; G.F.off = false; G.glass.visible = true; });
  for (let i = 0; i < STREET.winGlow.length; i += 2) { STREET.winGlow[i].material.color.setHex(0xcc8866); STREET.winGlow[i + 1].material.opacity = .18; }
  app.classList.remove("street");
  streetLights(false);
  street.visible = false;
  BT.busy = false; BT.mode = "polish";
  holdTools();
  curZone = 1; cur = 1;
}
document.getElementById("show-skip").addEventListener("click", () => { if (CLOSING.on) CLOSING.skip = true; });
addEventListener("keydown", e => { if (e.key === "Escape" && CLOSING.on) CLOSING.skip = true; });

/* ---------- звуки: аплодисменты, щелчок выключателя, гудение неона ---------- */
function applause(dur) {
  const c = fx(); if (!c || STILL) return;
  for (let i = 0; i < dur * 40; i++) noiseHit(i / 40 + R(0, .03), .04, R(1200, 3000), 1.4, .07 * Math.sin(Math.PI * i / (dur * 40)));
}
function switchClick() { noiseHit(0, .03, 3000, 5, .3); noiseHit(.04, .02, 1500, 5, .15); }
function buzz() {
  const c = fx(); if (!c) return;
  const o = c.createOscillator(), gg = c.createGain(), t = c.currentTime;
  o.type = "sawtooth"; o.frequency.value = 100;
  gg.gain.setValueAtTime(.025, t); gg.gain.exponentialRampToValueAtTime(.0001, t + .12);
  o.connect(gg).connect(c.destination); o.start(t); o.stop(t + .14);
}
Object.assign(H3D, { closing: playClosing });

/* ================= атмосфера залов, настройки графики, секреты и редкие события ================= */
const ROOMS = Object.assign({ lamp: "warm", rain: 1, fire: true, smoke: "warm", crackle: 1, lib: "warm" },
  (() => { try { return JSON.parse(localStorage.getItem("hacheden-rooms")) || {}; } catch (e) { return {}; } })());
const saveRooms = () => { try { localStorage.setItem("hacheden-rooms", JSON.stringify(ROOMS)); } catch (e) {} };
const LAMP_MUL = { bright: 1.45, warm: 1, dim: .45 }, FILL_MUL = { bright: 1.15, warm: 1, dim: .55 };

/* ---------- эффекты и качество из настроек ---------- */
function applyEffects() {
  const on = SET.effects && !SET.saver;
  DUST.p.visible = on;
  for (const s of haze) s.visible = on;
  for (const s of smoke) s.visible = on;
}
applyEffects();
onSetting(k => {
  if (k === "effects" || k === "saver") applyEffects();
  if (k === "quality" || k === "saver") { DPR = Math.min(devicePixelRatio || 1, dprCap()); renderer.setPixelRatio(DPR); resize(); }
  if (k === "quality" || k === "saver") { const t = SET.saver || SET.quality === "low" ? 0 : SET.quality === "high" ? 2 : SET.quality === "medium" ? 1 : QUALITY > 1 ? 2 : 1; POST.tier = Math.min(t, 2); bloom.enabled = t >= 1; }
  if (k === "mood") applyTime();
});

/* ---------- свет и звук комнат ---------- */
function applyRooms() {
  NOOK.lampMode = LAMP_MUL[ROOMS.lamp] || 1;   // без читальни и курилки (заглушки) — просто числа в пустых объектах
  if (NOOK.lampGlow) NOOK.lampGlow.material.opacity = .5 * Math.min(1.3, NOOK.lampMode);
  ZONE_LIGHT[0] = FILL_MUL[ROOMS.lib] || 1;
  ZONE_LIGHT[2] = ROOMS.smoke === "dim" ? .5 : 1;
  FIRE.on = ROOMS.fire;
  Music.mix({ rain: ROOMS.rain, fire: ROOMS.crackle * (ROOMS.fire ? 1 : .12) });
  const st = HOT.find(o => o.userData.hot.label === "Подбросить дров" || o.userData.hot.label === "Разжечь камин");
  if (st) { st.userData.hot.label = ROOMS.fire ? "Подбросить дров" : "Разжечь камин"; if (st.userData.chip) st.userData.chip.textContent = st.userData.hot.label; }
  applyTime();
}
/* камин: «Подбросить дров» разжигает погасший огонь */
{
  const st = HOT.find(o => o.userData.hot.label === "Подбросить дров");
  if (st) {
    const base = st.userData.hot.act;
    st.userData.hot.act = () => { if (!ROOMS.fire) { ROOMS.fire = true; saveRooms(); applyRooms(); FIRE.boost = 1.8; crackle(); toast("Камин разгорается", "Дрова потрескивают"); } else base(); };
  }
}

/* панель «Атмосфера» для читальни и курилки */
const atmoDlg = document.createElement("dialog");
atmoDlg.className = "atmo";
atmoDlg.setAttribute("aria-labelledby", "atmo-title");
document.body.appendChild(atmoDlg);
function renderAtmo() {
  const z = curZone;
  const segB = (key, v, t) => `<button class="chip" type="button" data-room="${key}:${v}" aria-pressed="${ROOMS[key] === v}">${t}</button>`;
  const rangeRow = (key, label) => `<div class="row slider"><label for="r-${key}">${label}</label><input class="rng" type="range" id="r-${key}" data-rr="${key}" min="0" max="100" value="${Math.round(ROOMS[key] * 100)}" style="--v:${Math.round(ROOMS[key] * 100)}%"><output>${Math.round(ROOMS[key] * 100)}%</output></div>`;
  let html = `<button class="close" type="button" aria-label="Закрыть" data-atmo-close>×</button>`;
  if (z === 0) {
    html += `<h2 id="atmo-title">Атмосфера читальни</h2>
      <div class="row" style="grid-template-columns:1fr"><span class="lbl">Настольная лампа</span><div class="seg">${segB("lamp", "bright", "Яркая")}${segB("lamp", "warm", "Тёплая")}${segB("lamp", "dim", "Приглушённая")}</div></div>
      <div class="row" style="grid-template-columns:1fr"><span class="lbl">Свет в комнате</span><div class="seg">${segB("lib", "bright", "Светлее")}${segB("lib", "warm", "Как обычно")}${segB("lib", "dim", "Полумрак")}</div></div>
      <div class="row"><span class="lbl">Свеча на столе</span><button class="make ghost" type="button" data-candle>${NOOK.candleOn ? "Задуть" : "Зажечь"}</button></div>
      ${rangeRow("rain", "Шум дождя")}
      <div class="acts"><button class="make" type="button" data-stories>Полка рассказов</button></div>`;
  } else {
    html += `<h2 id="atmo-title">Атмосфера курилки</h2>
      <div class="row"><span class="lbl">Камин</span><span class="sw"><input type="checkbox" data-fire aria-label="Камин горит"${ROOMS.fire ? " checked" : ""}><span></span></span></div>
      <div class="row" style="grid-template-columns:1fr"><span class="lbl">Свет</span><div class="seg">${segB("smoke", "warm", "Тёплый")}${segB("smoke", "dim", "Приглушённый")}</div></div>
      ${rangeRow("crackle", "Треск дров")}
      <div class="acts"><button class="make" type="button" data-player>Граммофон: выбрать музыку</button></div>`;
  }
  atmoDlg.innerHTML = html;
}
function openAtmo() {
  for (const o of document.querySelectorAll("dialog.sheet[open]")) o.close();
  renderAtmo();
  atmoDlg.show();
  uiSound("open");
  const f = atmoDlg.querySelector(".chip, .make, input"); if (f) f.focus({ preventScroll: true });
}
atmoDlg.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if ("atmoClose" in b.dataset) { atmoDlg.close(); return; }
  if (b.dataset.room) { const [k, v] = b.dataset.room.split(":"); ROOMS[k] = v; saveRooms(); applyRooms(); renderAtmo(); const f = atmoDlg.querySelector(`[data-room="${k}:${v}"]`); if (f) f.focus(); }
  else if ("candle" in b.dataset) { toggleCandle(); renderAtmo(); const f = atmoDlg.querySelector("[data-candle]"); if (f) f.focus(); }
  else if ("stories" in b.dataset) { atmoDlg.close(); openStories(); }
  else if ("player" in b.dataset) { atmoDlg.close(); openPlayer(); }
});
atmoDlg.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.rr) { ROOMS[t.dataset.rr] = +t.value / 100; t.style.setProperty("--v", t.value + "%"); t.nextElementSibling.textContent = t.value + "%"; saveRooms(); applyRooms(); Music.wake(); }
});
atmoDlg.addEventListener("change", e => { if ("fire" in e.target.dataset) { ROOMS.fire = e.target.checked; saveRooms(); applyRooms(); if (ROOMS.fire) { FIRE.boost = 1.6; crackle(); } } });
addEventListener("keydown", e => { if (e.key === "Escape" && atmoDlg.open) atmoDlg.close(); });
/* кнопки-«чипы» без предмета в зале */
function chipOnly(zone, label, act, x = 0, y = -5, z = 0) {
  const m = mesh(new THREE.BoxGeometry(.01, .01, .01), basic({ visible: false }), x, y, z);
  m.userData.noHit = true;
  return hot(m, zone, label, act, { grow: 0 });
}
chipOnly(0, "Атмосфера", openAtmo);
chipOnly(2, "Атмосфера", openAtmo);

/* ---------- читальня: стопка рассказов и книга, что светится без свечи ---------- */
const LIB = {};
if (FEAT.nook) {
  const dx = NOOK.lampGlow.position.x + .5, top = .785;   // стол писателя у окна
  const stack = group(dx - .64, top, -4.1);
  const covers = [0x5a1420, 0x1f3a2c, 0x2a2440];
  covers.forEach((c, i) => {
    const b = mesh(new THREE.BoxGeometry(.2 - i * .015, .035, .15 - i * .01), std({ color: c, roughness: .7 }), 0, .018 + i * .036, 0, stack);
    b.rotation.y = (i - 1) * .18;
    mesh(new THREE.BoxGeometry(.19 - i * .015, .028, .004), std({ color: 0xeee2c4, roughness: .9 }), 0, .018 + i * .036, (.15 - i * .01) / 2 - .001, stack).rotation.y = (i - 1) * .18;
  });
  hot(stack, 0, "Полка рассказов", () => openStories(), { grow: .08 });
  LIB.stack = stack;
  // книга без названия: днём обычная, без свечи на обложке проступают светящиеся строки
  const book = group(dx - .2, top + .186, -4.5);   // сверху на стопке книг
  book.rotation.y = .25;
  mesh(new THREE.BoxGeometry(.17, .03, .23), std({ color: 0x1a1210, roughness: .8 }), 0, .015, 0, book);
  LIB.glowMat = basic({ map: canvasTex(256, 340, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = "#bfe8ff"; c.fillStyle = "#bfe8ff"; c.lineWidth = 3;
    c.strokeRect(18, 18, w - 36, h - 36);
    c.textAlign = "center"; fitFont(c, BAR_SIGN, w - 60, 28, "Forum, Georgia, serif");
    c.fillText(BAR_SIGN, w / 2, 90);
    for (let i = 0; i < 7; i++) c.fillRect(48, 140 + i * 24, w - 96 - (i % 3) * 30, 3);
    c.beginPath(); c.arc(w / 2, 300, 12, 0, Math.PI * 2); c.stroke();
  }), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const face = mesh(new THREE.PlaneGeometry(.16, .22), LIB.glowMat, 0, .031, 0, book);
  face.rotation.x = -Math.PI / 2; face.userData.noHit = true;
  LIB.glow = glowSprite(0x9fd8ff, .5, 0, .06, 0, book, 0);
  LIB.book = book;
  hot(book, 0, "Книга без названия", () => {
    if (LIB.lit > .6) { track("secret", "glowbook"); openStories(SECRET_STORY.id); }
    else toast("Книга без названия", "На обложке ни слова, страницы пустые. Странно…");
  }, { grow: .06 });
  LIB.lit = 0;
  onTick((t, dt) => {
    const want = NOOK.candleOn || curZone !== 0 ? 0 : 1;
    LIB.lit += (want - LIB.lit) * Math.min(1, dt * (want ? .5 : 2));
    LIB.glowMat.opacity = LIB.lit * (.75 + .15 * Math.sin(t * 1.7));
    LIB.glow.material.opacity = LIB.lit * .35;
  });
}

/* ---------- кот: если гладить долго, он доверяет ---------- */
{
  const h = HOT.find(o => o.userData.hot.label === "Кот");
  if (h) {
    const base = h.userData.hot.act;
    let n = 0;
    h.userData.hot.act = () => {
      base();
      if (++n === 5) {
        const g = CAT.head.parent;
        tween(g.rotation, { z: .5 }, .6, ease.out).then(() => wait(2.2)).then(() => tween(g.rotation, { z: 0 }, .8));
        track("secret", "cat");
      }
    };
  }
}
/* ---------- дверь «Приват»: условный стук ---------- */
{
  const h = HOT.find(o => o.userData.hot.label === "Постучать в дверь" && o.userData.hot.zone === 2);
  if (h) {
    const base = h.userData.hot.act;
    let n = 0, t0 = 0;
    h.userData.hot.act = () => {
      const now = performance.now();
      if (now - t0 > 20000) n = 0;
      t0 = now;
      if (++n === 3) track("secret", "knock");
      base();
    };
  }
}
/* ---------- граммофон и сцена открывают плеер ---------- */
{
  const g = HOT.find(o => o.userData.hot.label === "Граммофон: музыка");
  if (g) { g.userData.hot.label = "Граммофон: плеер"; g.userData.hot.act = () => openPlayer(); }
  chipOnly(3, "Плеер: выбрать композицию", () => openPlayer());
}

/* ---------- редкое событие: кот приходит на стойку ---------- */
const CATV = { chance: QS.get("rare") === "cat" ? 1 : .2, done: false, on: false, since: 0 };
CATV.today = FEAT.smoke && Math.random() < CATV.chance;   // кот живёт в курилке: нет курилки — нет и кота
setInterval(() => {
  if (!CATV.today || CATV.done || CATV.on || !started || curZone !== 1 || busy || SEAT.on || modalOpen() || mixDlg.open || STREET.on) { CATV.since = 0; return; }
  CATV.since += 5;
  if (CATV.since < (QS.get("rare") === "cat" ? 5 : 75)) return;
  catVisit();
}, 5000);
function catVisit() {
  const g = CAT.head.parent, h = g.userData.hot;
  CATV.on = true;
  CATV.home = { p: g.position.clone(), r: g.rotation.y, act: h.act, label: h.label, zone: h.zone, y0: h.y0 };
  g.position.set(2.1, CT.top + .005, (CT.z0 + CT.z1) / 2 - .1);
  g.rotation.y = -2.1;
  h.zone = 1; h.label = "Кот на стойке"; h.y0 = g.position.y;
  h.act = () => { CATV.home.act(); track("secret", "catvisit"); hintEl.textContent = "Кот щурится и мурлычет. Бармен делает вид, что ничего не видит."; setTimeout(catHome, 25000); };
  renderZoneUI(1);
  hintEl.textContent = "На стойку запрыгнул кот из курилки. Бармен делает вид, что не замечает.";
  setTimeout(catHome, 120000);
}
function catHome() {
  if (!CATV.on) return;
  const g = CAT.head.parent, h = g.userData.hot, H = CATV.home;
  g.position.copy(H.p); g.rotation.y = H.r;
  Object.assign(h, { act: H.act, label: H.label, zone: H.zone, y0: H.y0 });
  CATV.on = false; CATV.done = true;
  renderZoneUI(curZone);
  if (curZone === 1 && !busy) hintEl.textContent = ZONES[1].hint;
}

applyRooms();
Object.assign(H3D, { rooms: ROOMS, applyRooms, lib: LIB, catVisit, atmo: openAtmo });

/* ================= разговор с барменом: темы, советы, контекст, случайные фразы ================= */
const TALK = { story: Math.floor(Math.random() * 8), clicks: [], idleT: 0 };
/* правдивые истории из жизни баров */
const BAR_TALES = [
  "Сухой закон в США вступил в силу 17 января 1920 года, а отменили его 5 декабря 1933-го. Тринадцать лет люди пили в таких местах, как наше, — за дверью без вывески.",
  "«Спикизи» — от английского «говори тише». О таком баре не кричали на улице: стучали условным стуком и говорили вполголоса.",
  "Слово «коктейль» впервые объяснили в печати в 1806 году, в нью-йоркской газете: крепкий напиток, сахар, вода и биттер. Почти наш «Олд фэшн».",
  "Лёд в бокалах — заслуга Фредерика Тюдора, «ледяного короля». В 1806 году он отправил первый корабль со льдом из Новой Англии на Мартинику. Над ним смеялись — а потом весь мир пил со льдом.",
  "Ангостуру придумал немецкий врач Иоганн Зигерт в 1824 году в венесуэльском городе Ангостура. Сначала это было лекарство для солдат, а стало — главной каплей в баре.",
  "Первую книгу для барменов выпустил Джерри Томас в 1862 году. Он работал с таким размахом, что его называли «профессором».",
  "Когда в США запретили алкоголь, многие бармены уехали в Европу. Гарри Крэддок перебрался в Лондон, в отель «Савой», и в 1930 году выпустил там знаменитую книгу коктейлей.",
  "«Гарриз Нью-Йорк бар» в Париже открылся в 1911 году, а в 1923-м его выкупил бармен Гарри Макэлхоун. Там до сих пор помнят «Бульвардье» — кстати, он есть в нашем тайном меню."
];
const BT_OWN = [
  "Сам? После смены — «Олд фэшн», медленно, с одним большим кубиком льда. А за работой только вода: бармену нужна ясная голова.",
  "Я люблю «Негрони». Горький, честный и не притворяется сладким. Как хороший разговор.",
  "Признаюсь: самый вкусный напиток — первый кофе перед сменой, когда зал ещё пустой и лампы только загораются."
];
const BT_RANDOM = [
  "Лёд сегодня особенно прозрачный. Хороший знак.",
  "Если не знаете, что выбрать, — садитесь за стойку. Подберу под настроение.",
  "Слышите? Пианист сегодня в ударе.",
  "В барной карте можно смешать и своё. Я подскажу пропорции.",
  "Кот из курилки иногда заходит в гости. Не говорите хозяину."
];
function hourNow() { const d = sceneDate(); return d.getHours() + d.getMinutes() / 60; }
function eveningLine() {
  const h = hourNow(), parts = [];
  parts.push(h >= 17 && h < 20 ? "Вечер только начинается, зал понемногу наполняется." : h >= 20 && h < 23 ? "Самое время: музыка, разговоры, лёд звенит." : h >= 23 || h < 1 ? "Ближе к полуночи — лучшее время в баре." : "Поздно уже. Остались самые свои.");
  if (WEATHER.snow) parts.push("За окном метёт — хорошо, что у нас тепло.");
  else if (WEATHER.rain) parts.push("Слышите дождь? В такую погоду бар особенно уютный.");
  else if (WEATHER.stars) parts.push("Ночь звёздная, а у нас вместо звёзд — лампы.");
  if (WX_NOW.ok) { const t = Math.round(WX_NOW.temp); parts.push(t <= 0 ? `На улице ${t}°, так что горячий тодди сегодня в самый раз.` : t < 10 ? `Снаружи всего +${t}°. Согрейтесь.` : `На улице +${t}°.`); }
  if (BAND_HERE && Music.on) parts.push(`Ансамбль играет «${Music.info().track.title}».`);
  else if (BAND_HERE) parts.push("Музыканты на сцене, но ждут, пока их попросят сыграть.");
  if (LAST_DRINK) {
    const c = LAST_DRINK;
    parts.push(c.custom ? `А ваш «${c.name}» — смелый рецепт. Я его запомнил.` : c.secret ? `И вы нашли «${c.name}». Его знают немногие.` : c.signature ? "И вы выбрали наш фирменный — уважаю." : `Как вам «${c.name}»?`);
  }
  return parts.join(" ");
}
function talkMenu(first = false) {
  const h = hourNow(), late = h < 3;
  const list = [["Как вечер?", () => talkSay(eveningLine())],
    ["Расскажите историю", () => { TALK.story = (TALK.story + 1) % BAR_TALES.length; talkSay(BAR_TALES[TALK.story]); }],
    ["А вы сами что пьёте?", () => talkSay(BT_OWN[Math.floor(Math.random() * BT_OWN.length)])],
    ["Есть что-то не из меню?", offMenu]];
  if (late) list.push(["Расскажите что-нибудь не для всех", midnightTale]);
  list.push(["Посоветуйте коктейль", () => { answers([]); btSay("С удовольствием. Какое настроение?").then(askMood); }]);
  if (servedGlass && SIP.frac > .02 && !SHOW.on) list.push(["Вернуться к бокалу", () => seatAnswers()]);
  list.push(standBtn);
  if (first) answers(list); else answers(list);
}
async function talkSay(text) {
  answers([]);
  bt.look = camera.position;
  await btSay(text);
  await sleep(.4);
  if (SEAT.on) talkMenu();
}
function offMenu() {
  const left = SECRETS.filter(s => !FOUND.has(s.id));
  if (!left.length) return talkSay("Вы знаете меню лучше меня. Все тайные рецепты уже ваши.");
  const s = left[Math.floor(Math.random() * left.length)];
  talkSay(`Есть пара рецептов, которых нет в карте. Намекну: ${s.hint.charAt(0).toLowerCase() + s.hint.slice(1)} Соберите это в шейкере — я узнаю.`);
}
function midnightTale() {
  track("secret", "midnight");
  talkSay("Ладно, только между нами. Говорят, первый хозяин этого бара прятал ключи от погреба в книгах. В читальне одна книга до сих пор торчит из полки — я бы на вашем месте присмотрелся.");
}
/* в разговоре у стойки появляется «Поговорить» */
{
  const baseAsk = askMood;
  askMood = function () {
    answers([...MOODS.map(([id, label]) => [label, () => askStrength(id)]), ["Просто поговорить", () => { answers([]); btSay("С удовольствием. О чём?").then(() => talkMenu(true)); }, true], standBtn]);
  };
  void baseAsk;
}
/* бармена можно позвать: щелчок по нему — сесть за стойку; слишком настойчиво — особая реакция */
hot(bt.root, 1, "Бармен", () => {
  const now = performance.now();
  TALK.clicks = TALK.clicks.filter(t => now - t < 6000);
  TALK.clicks.push(now);
  if (TALK.clicks.length >= 5) {
    TALK.clicks = [];
    track("secret", "barkeep");
    say(bt, "Я вас вижу, вижу! Пять раз звать не обязательно — хотя за упорство полагается секрет: попробуйте задуть свечу в читальне.", 7);
    return;
  }
  if (!SEAT.on && !busy) sitDown();
}, { grow: 0, noChip: true });
/* после подачи бармен отзывается о выборе гостя */
{
  const base = afterServe;
  afterServe = async function () {
    if (!SEAT.on) return;
    const g = SEAT.gen;
    BT.busy = true;
    await walkTo(SEAT_X + .04, BT_Z + .1, 0);
    if (g !== SEAT.gen) return;
    bt.look = camera.position;
    prepSip();
    const c = LAST_DRINK;
    await btSay(c && c.custom ? `Ваш «${c.name}». Смелый рецепт — я бы и сам такой заказал.` : c && c.secret ? `«${c.name}» — не из карты. Приятно встретить знающего человека.` : "Приятного вечера. Если что — я рядом.");
    if (g !== SEAT.gen) return;
    seatAnswers();
  };
  void base;
}
/* фразы «между делом» теперь подбирает состояние бармена: src/js/88-mind.js */

/* ================= настоящая погода в Алматы за окнами и на улице =================
   Open-Meteo (бесплатно, без ключа). Обновляется каждые 15 минут; без интернета — погода по сезону.
   Проверить любую погоду: ?wx=rain | snow | storm | clear | fog */
const WX_CITY = { name: "Алматы", lat: 43.2389, lon: 76.8897, tz: "Asia/Almaty" };
const WX_NOW = { ok: false, temp: null, code: null, wind: 0, label: "" };
function wxLabel(code) {
  if (code === 0) return "ясно";
  if (code <= 2) return "небольшая облачность";
  if (code === 3) return "пасмурно";
  if (code === 45 || code === 48) return "туман";
  if (code >= 51 && code <= 57) return "морось";
  if (code >= 61 && code <= 67) return code >= 65 ? "ливень" : "дождь";
  if (code >= 71 && code <= 77) return code >= 75 ? "сильный снег" : "снег";
  if (code >= 80 && code <= 82) return "ливень";
  if (code >= 85 && code <= 86) return "снегопад";
  if (code >= 95) return "гроза";
  return "облачно";
}
function weatherLine() {
  if (!WX_NOW.ok) return "";
  const t = Math.round(WX_NOW.temp), sign = t > 0 ? "+" : t < 0 ? "−" : "";
  return `${WX_CITY.name}, ${sign}${Math.abs(t)}°, ${WX_NOW.label}.`;
}
/* погода → дождь, снег, звёзды, иней, звуки */
function applyWeather(code, temp, wind) {
  const rain = code >= 51 && code <= 57 ? .35 : code === 61 ? .5 : code === 63 ? .75 : code >= 64 && code <= 67 ? 1 : code >= 80 && code <= 82 ? .85 : code >= 95 ? 1 : 0;
  const snow = code === 71 || code === 77 ? .45 : code === 73 ? .7 : code === 75 ? 1 : code >= 85 && code <= 86 ? .85 : 0;
  const stars = code === 0 ? 1 : code === 1 ? .7 : code === 2 ? .35 : 0;
  const fog = code === 45 || code === 48;
  Object.assign(WEATHER, {
    rain, snow, stars: fog ? 0 : stars, storm: code >= 95, frost: temp < -1 ? 1 : temp < 2 ? .4 : 0,
    leaves: SEASON === "autumn" && !snow ? (wind > 14 ? 1 : .45) : 0
  });
  const u = rainMat.uniforms;
  for (const [k, v] of [["uRain", WEATHER.rain], ["uSnow", WEATHER.snow], ["uStars", WEATHER.stars], ["uLeaves", WEATHER.leaves], ["uFrost", WEATHER.frost]]) tween(u[k], { value: v }, 3);
  Music.weather({ rain: rain * .34, wind: Math.min(.55, wind / 45) + (snow ? .1 : 0), crickets: SEASON === "summer" && !rain && temp > 15 ? .35 : 0, fire: temp < 12 ? .55 : SEASON === "summer" ? 0 : .4 });
  // улица: капли, снежинки или сухо
  const P = PREC;
  P.snow = snow > 0;
  P.active = Math.round(P.N * (snow ? Math.max(.35, snow) : rain ? Math.max(.3, rain) : 0));
  P.g.setDrawRange(0, P.active * 2);
  P.lines.material.color.setHex(P.snow ? 0xffffff : 0xb8c8e8);
  P.lines.material.opacity = P.snow ? .8 : .33;
  P.rings.count = !P.snow && rain ? Math.round(P.RN * Math.max(.4, rain)) : 0;
  // подзаголовок читальни: что сейчас за окном
  const outside = snow ? "снег" : code >= 95 ? "гроза" : rain >= .8 ? "ливень" : rain ? "дождь" : code === 45 || code === 48 ? "туман" : stars > .5 ? "звёзды" : "ночной город";
  ZONES[0].sub = `Книги до потолка, ${outside} за окном`;
  if (curZone === 0 && !SEAT.on) subEl.textContent = ZONES[0].sub;
  // подпись у окна читальни
  const h = HOT.find(o => o.userData.hot.zone === 0 && /^Окно/.test(o.userData.hot.label));
  if (h) { h.userData.hot.label = `Окно: ${WX_NOW.label}, ${Math.round(temp) > 0 ? "+" : ""}${Math.round(temp)}°`; if (h.userData.chip) h.userData.chip.textContent = h.userData.hot.label; }
}
async function fetchWeather() {
  const force = QS.get("wx");
  if (force) {
    const code = { rain: 63, snow: 73, storm: 95, clear: 0, fog: 45, drizzle: 53 }[force] ?? 3;
    Object.assign(WX_NOW, { ok: true, code, temp: force === "snow" ? -6 : 9, wind: 8, label: wxLabel(code) });
    applyWeather(code, WX_NOW.temp, 8);
    return;
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${WX_CITY.lat}&longitude=${WX_CITY.lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=sunset&forecast_days=1&timezone=${encodeURIComponent(WX_CITY.tz)}`;
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json(), c = j.current;
    Object.assign(WX_NOW, { ok: true, code: c.weather_code, temp: c.temperature_2m, wind: c.wind_speed_10m, label: wxLabel(c.weather_code) });
    const ss = j.daily && j.daily.sunset && j.daily.sunset[0];
    if (ss) { const [hh, mm] = ss.slice(11, 16).split(":").map(Number); SUN.set = hh + mm / 60; }
    applyWeather(WX_NOW.code, WX_NOW.temp, WX_NOW.wind);
    applyTime();
  } catch (e) {
    console.info("погода недоступна, остаётся сезонная:", e.message);
  }
}
fetchWeather();
setInterval(fetchWeather, 15 * 60 * 1000);
Object.assign(H3D, { weather: WX_NOW, applyWeather });

/* ================= Хэллоуин: бар украшен на одну ночь (31 октября, до 3:00 1 ноября) =================
   Проверить в другой день: ?holiday=halloween */
const HALLOWEEN = (() => {
  if (QS.get("holiday") === "halloween") return true;
  if (QS.get("holiday") === "off") return false;
  const d = nowDate();
  return (d.getMonth() === 9 && d.getDate() === 31) || (d.getMonth() === 10 && d.getDate() === 1 && d.getHours() < 3);
})();
const HW = { lanterns: [], bats: [] };
const HALLOWEEN_STORY = {
  name: "Хэллоуин", tagline: "Ночь, когда в Hacheden горят тыквы",
  facts: [["Дата", "ночь на 1 ноября"], ["Корни", "кельтский праздник Самайн"]],
  sections: [
    ["Откуда праздник", "Корни Хэллоуина — в кельтском празднике Самайн: так отмечали конец урожая и начало зимы. Верили, что в эту ночь граница между миром живых и миром духов становится тоньше. Само слово Halloween — сокращение от All Hallows' Eve, «канун Дня всех святых», который празднуют 1 ноября."],
    ["Почему тыква", "В Ирландии и Шотландии фонари с лицами вырезали из репы. По легенде, их носил с собой Скупой Джек, который обманул дьявола и был обречён скитаться с угольком в выдолбленной репе. Ирландские переселенцы в Америке в XIX веке взяли вместо репы тыкву — она больше и её легче вырезать."],
    ["В баре этой ночью", "Бармен советует что-нибудь тёмно-красное: горький «Негрони» или наш огненный «Hacheden». А тем, кто ищет тайное меню, он шепнёт: скотч, вишня, вермут и апельсин — коктейль с подходящим названием."]
  ]
};
if (HALLOWEEN) {
  /* резная тыква: рёбра, хвостик, светящееся лицо и мерцающий отблеск свечи внутри */
  const faceTex = canvasTex(256, 200, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 130);
    g.addColorStop(0, "#fff2a0"); g.addColorStop(.55, "#ffb030"); g.addColorStop(1, "#ff6a00");
    c.fillStyle = g;
    const tri = (pts) => { c.beginPath(); c.moveTo(...pts[0]); for (const p of pts.slice(1)) c.lineTo(...p); c.closePath(); c.fill(); };
    tri([[58, 78], [98, 78], [80, 42]]);
    tri([[158, 78], [198, 78], [176, 42]]);
    tri([[118, 112], [138, 112], [128, 94]]);
    c.beginPath(); c.moveTo(40, 128);
    const teeth = [[64, 150], [84, 136], [104, 156], [128, 138], [152, 156], [172, 136], [192, 150], [216, 128]];
    for (const [x, y] of teeth) c.lineTo(x, y);
    c.quadraticCurveTo(128, 196, 40, 128); c.fill();
  });
  const faceMat = basic({ map: faceTex, transparent: true, toneMapped: false, depthWrite: false });
  function lantern(x, y, z, s, rot, parent = world, label = null, act = null) {
    const g = group(x, y, z, parent); g.scale.setScalar(s); g.rotation.y = rot;
    const m = std({ color: 0xd8701a, roughness: .55, emissive: 0x3a1000, emissiveIntensity: .6 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; const p = mesh(new THREE.SphereGeometry(.06, 14, 10), m, Math.cos(a) * .045, .055, Math.sin(a) * .045, g); p.scale.set(.75, .9, .75); }
    mesh(new THREE.CylinderGeometry(.008, .012, .04, 6), std({ color: 0x3a3012 }), 0, .12, 0, g).rotation.z = .3;
    const f = mesh(new THREE.PlaneGeometry(.1, .078), faceMat, 0, .058, .092, g);
    f.userData.noHit = true;
    const glow = glowSprite(0xff8a20, .36, 0, .06, .11, g, .5);
    HW.lanterns.push({ g, glow, ph: Math.random() * 6 });
    if (label) hot(g, curZoneOf(x, z), label, act, { grow: .08 });
    return g;
  }
  const curZoneOf = (x, z) => x > 4 ? 2 : x < -4.5 && z < 0 ? 0 : z > 3 ? 3 : 1;
  // бар: на концах стойки
  lantern(-2.05, CT.top, -2.2, 1.9, .15, world, "Тыква: Хэллоуин", () => openCard(HALLOWEEN_STORY));
  lantern(2.35, CT.top, -2.25, 1.5, -.2);
  lantern(-2.35, CT.top, -2.3, 1.0, .4);
  // курилка: у камина
  if (FEAT.smoke) {
    lantern(7.45, .04, FP.z + 1.15, 1.5, -Math.PI / 2);
    lantern(7.7, 1.32, FP.z + .05, .7, -Math.PI / 2);
  }
  // читальня: на подоконнике
  if (FEAT.nook) {
    lantern(WIN.x - .55, WIN.sill + .005, -4.82, .9, 0);
    lantern(WIN.x + .58, WIN.sill + .005, -4.82, .7, -.15);
  }
  // сцена: по краям рампы
  if (FEAT.stage) {
    lantern(STG.x0 + .45, STG.h, STG.z0 + .18, 1.1, Math.PI);
    lantern(STG.x1 - .45, STG.h, STG.z0 + .18, 1.1, Math.PI);
  }
  // улица: у двери
  if (FEAT.street) {
    lantern(-1.45, 0, FZ + .6, 3.2, .1, street);
    lantern(.3, 0, FZ + .6, 2.6, -.15, street);
    lantern(-1.0, 0, FZ + .75, 1.7, .3, street);
  }

  /* летучие мыши: за окном читальни и над входом с улицы */
  const batMat = basic({ color: 0x050304, side: THREE.DoubleSide });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); wingShape.lineTo(.5, .32); wingShape.lineTo(1, .18);
  wingShape.quadraticCurveTo(.86, .02, .74, -.02); wingShape.quadraticCurveTo(.62, .1, .5, -.04); wingShape.quadraticCurveTo(.36, .08, .22, -.08); wingShape.lineTo(0, -.06);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  function bat(parent, s) {
    const g = new THREE.Group(); parent.add(g); g.scale.setScalar(s);
    const body = mesh(new THREE.SphereGeometry(.09, 10, 8), batMat, 0, 0, 0, g); body.scale.set(.8, 1.3, .5);
    for (const sd of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(.03, .08, 4), batMat, sd * .04, .13, 0, g); }
    const L = mesh(wingGeo, batMat, 0, .02, 0, g); L.scale.x = -1;
    const R2 = mesh(wingGeo, batMat, 0, .02, 0, g);
    g.userData.w = [L, R2];
    return g;
  }
  if (FEAT.nook) for (let i = 0; i < 4; i++) HW.bats.push({ g: bat(world, .11), kind: "win", ph: i * 1.7, sp: .35 + i * .07, fl: 9 + i });
  if (FEAT.street) for (let i = 0; i < 5; i++) HW.bats.push({ g: bat(street, .16), kind: "street", ph: i * 1.25, sp: .45 + i * .05, fl: 8 + i * .7 });
  onTick((t) => {
    for (const L of HW.lanterns) {
      const k = .78 + .12 * Math.sin(t * 9 + L.ph) + .08 * Math.sin(t * 23 + L.ph * 2);
      L.glow.material.opacity = .5 * k;
    }
    for (const B of HW.bats) {
      const a = t * B.sp + B.ph, fl = Math.sin(t * B.fl + B.ph);
      if (B.kind === "win") {
        if (curZone !== 0 && !flight) { B.g.visible = false; continue; }
        B.g.visible = true;
        // в пределах арочного окна, сразу за стеклом
        B.g.position.set(WIN.x + Math.sin(a * 1.3) * .55, WIN.sill + .85 + Math.sin(a * 2.1) * .35 + Math.cos(a * .7) * .2, -4.985);
        B.g.rotation.z = Math.sin(a * 1.3 + 1) * .25;
      } else {
        B.g.position.set(-.5 + Math.cos(a) * (1.7 + .3 * Math.sin(a * 2)), 2.75 + Math.sin(a * 1.7) * .4, FZ + 1.6 + Math.sin(a) * 1.0);
        B.g.rotation.y = -a + Math.PI / 2;
      }
      B.g.userData.w[0].rotation.y = fl * .9; B.g.userData.w[1].rotation.y = -fl * .9;
    }
  });
  /* реплики: бармен, швейцар, гости */
  BT_RANDOM.push("Счастливого Хэллоуина! Тыквы сегодня горят до самого закрытия.", "Говорят, в эту ночь даже кот из курилки ходит тише.", "Сегодня советую что-нибудь тёмно-красное. Например, «Негрони».");
  {
    const base = GREET;
    GREET = () => OWNER ? "Хозяин! Счастливого Хэллоуина, тыквы уже горят." : pickOne(["Счастливого Хэллоуина! Проходите, тыквы уже горят.", "Добрый вечер. В такую ночь у нас особенно уютно — проходите.", "Сладость или гадость? Шучу. Проходите, вас ждут."]);
    void base;
  }
  let shown = false;
  const showToast = () => { if (shown || !started || STREET.on) return; shown = true; toast("Сегодня Хэллоуин", "Бар украшен только на одну ночь. Нажмите на тыкву у стойки."); };
  setInterval(showToast, 2000);
}
Object.assign(H3D, { hw: HW, halloween: HALLOWEEN });

/* ================= облава сухого закона: редкое событие =================
   В дверь колотит полиция, за секунды из задней стойки поднимаются фальш-панели «чайного клуба»,
   свет приглушают, музыка смолкает; полицейские уходят — всё возвращается. Проверить: ?rare=raid */
const RAID = { on: false, done: false, since: 0, chance: QS.get("rare") === "raid" ? 1 : .15, panels: [] };
RAID.today = Math.random() < RAID.chance;
{
  const bays = [[-3.135, -1.095], [-1.005, 1.005], [1.095, 3.135]];
  const wood = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#3a1c10"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${20 + Math.random() * 40},${8 + Math.random() * 14},4,.35)`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * .3, y + 6, w * .6, y - 6, w, y + 3); g.stroke(); }
    g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = "rgba(255,200,140,.12)"; g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
  });
  const sign = canvasTex(512, 300, (g, w, h) => {
    g.fillStyle = "#1a0e08"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#c9944a"; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#e8c890"; g.textAlign = "center";
    g.font = "40px Forum, Georgia, serif"; g.fillText("КЛУБ ЛЮБИТЕЛЕЙ ЧАЯ", w / 2, 92);
    g.font = "64px Forum, Georgia, serif"; g.fillText(`«${BAR_NAME}»`, w / 2, 170);
    g.font = "24px Literata, Georgia, serif"; g.globalAlpha = .8; g.fillText("основан в 1921 году · только для членов клуба", w / 2, 232);
  });
  const mat = std({ map: wood, roughness: .6 });
  bays.forEach(([x0, x1], i) => {
    const g = group((x0 + x1) / 2, 0, BB.z0 + .37);
    mesh(new THREE.BoxGeometry(x1 - x0, 1.72, .025), mat, 0, 0, 0, g);
    if (i === 1) mesh(new THREE.PlaneGeometry(1.25, .73), std({ map: sign, roughness: .4 }), 0, .2, .014, g);
    else for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(.045, .04, .07, 16), std({ color: 0xf2ece0, roughness: .25 }), -.55 + k * .55, -.38, .05, g);   // чайные чашки на выступе
    if (i !== 1) mesh(new THREE.BoxGeometry(x1 - x0 - .1, .02, .12), mat, 0, -.43, .05, g);
    g.userData.y0 = 1.0 - .86 - .03; g.userData.y1 = BB.top + .86;
    g.position.y = g.userData.y0;
    g.visible = false;
    RAID.panels.push(g);
  });
}
function whistle() {
  const c = fx(); if (!c) return;
  const t = c.currentTime + .05, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o.type = "triangle"; o.frequency.value = 2650; lfo.frequency.value = 28; lg.gain.value = 220;
  lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .05); g.gain.setValueAtTime(.08, t + .45); g.gain.linearRampToValueAtTime(0, t + .5);
  g.gain.setValueAtTime(0, t + .6); g.gain.linearRampToValueAtTime(.08, t + .65); g.gain.setValueAtTime(.08, t + 1.3); g.gain.linearRampToValueAtTime(0, t + 1.4);
  o.connect(g).connect(c.destination); o.start(t); lfo.start(t); o.stop(t + 1.5); lfo.stop(t + 1.5);
}
function steps(n = 6, away = true) {
  const c = fx(); if (!c) return;
  const t0 = c.currentTime + .05;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * .42, o = c.createOscillator(), g = c.createGain(), v = away ? .35 * (1 - i / n) : .3;
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + .08);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .12);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + .14);
  }
}
async function playRaid() {
  if (RAID.on) return;
  RAID.on = true;
  const musicWas = Music.on;
  hintEl.textContent = "Кто-то громко колотит во входную дверь…";
  knock(); await wait(1.1); knock();
  bt.look = V3(0, 1.6, 4);
  await wait(.9);
  say(bt, "Облава! Тихо, все. Сегодня мы — клуб любителей чая.", 4);
  if (musicWas) setMusic(false);
  // свет приглушают, подсветка гаснет, панели поднимаются из задней стойки
  const lights = ["pendL", "pendC", "pendR"].map(k => LIGHTS[k]);
  const was = lights.map(l => l.intensity);
  lights.forEach(l => tween(l, { intensity: l.intensity * .45 }, 1.2));
  tween(SHUT, { back: .1, neon: .15, pendL: .45, pendC: .45, pendR: .45 }, 1.2);
  RAID.panels.forEach((g, i) => { g.visible = true; tween(g.position, { y: g.userData.y1 }, STILL ? 0 : 1.6 + i * .25, ease.io); });
  await wait(2.4);
  whistle();
  hintEl.textContent = "— Полиция! Проверка заведения!";
  steps(5, false);
  await wait(3.2);
  say(bt, "Добрый вечер, офицер. Здесь только чай. Хотите чашечку?", 4);
  await wait(4.4);
  hintEl.textContent = "Шаги удаляются…";
  steps(7, true);
  await wait(3.4);
  say(bt, "Ушли. В двадцатые так и было: бутылки прятали за фальш-стенами, и бар за минуту становился чем угодно — хоть чайной.", 6);
  RAID.panels.forEach((g, i) => tween(g.position, { y: g.userData.y0 }, STILL ? 0 : 1.4 + i * .2, ease.io).then(() => { g.visible = false; }));
  lights.forEach((l, i) => tween(l, { intensity: was[i] }, 1.4));
  tween(SHUT, { back: 1, neon: 1, pendL: 1, pendC: 1, pendR: 1 }, 1.4);
  await wait(1.6);
  applyTime();
  if (musicWas) setMusic(true);
  hintEl.textContent = ZONES[curZone].hint;
  bt.look = null;
  track("secret", "raid");
  RAID.on = false; RAID.done = true;
}
setInterval(() => {
  if (!RAID.today || RAID.done || RAID.on || !started || curZone !== 1 || busy || SEAT.on || modalOpen() || mixDlg.open || STREET.on || CLOSING.on || BT.busy) { RAID.since = 0; return; }
  RAID.since += 5;
  if (RAID.since >= (QS.get("rare") === "raid" ? 5 : 240)) playRaid();
}, 5000);
Object.assign(H3D, { raid: playRaid });

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

/* ================= единый кинематографичный облик: материалы, тени, фокус ================= */
/* материалы: дерево под лаком, кожа с бархатистым отблеском, камень и металл с честными отражениями */
function physFrom(m, extra) {
  const p = new THREE.MeshPhysicalMaterial({ map: m.map, color: m.color, roughness: m.roughness, metalness: m.metalness, envMapIntensity: m.envMapIntensity,
    emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, transparent: m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite });
  return Object.assign(p, extra);
}
const SWAP = new Map([
  [M.walnutGloss, physFrom(M.walnutGloss, { clearcoat: .7, clearcoatRoughness: .14, roughness: .32 })],
  [M.marble, physFrom(M.marble, { clearcoat: .9, clearcoatRoughness: .08, roughness: .28, envMapIntensity: 1.1 })],
  [M.leatherRed, physFrom(M.leatherRed, { sheen: .6, sheenRoughness: .45, sheenColor: new THREE.Color(0xff9a7a), roughness: .5 })],
  [M.leatherBrown, physFrom(M.leatherBrown, { sheen: .55, sheenRoughness: .5, sheenColor: new THREE.Color(0xe0a070), roughness: .55 })],
  [M.velvetGreen, physFrom(M.velvetGreen, { sheen: 1, sheenRoughness: .3, sheenColor: new THREE.Color(0x4a8a6a) })],
  [M.velvetRed, physFrom(M.velvetRed, { sheen: 1, sheenRoughness: .3, sheenColor: new THREE.Color(0xc04050) })],
  [glassMat, physFrom(glassMat, { clearcoat: 1, clearcoatRoughness: .02, ior: 1.5, specularIntensity: 1, envMapIntensity: 3 })],
  [MX.glass, physFrom(MX.glass, { clearcoat: 1, clearcoatRoughness: .02, ior: 1.5, specularIntensity: 1, envMapIntensity: 3.2 })]
]);
M.floor.envMapIntensity = 1.05; M.floor.roughness = .32;
M.walnut.envMapIntensity = .75;
M.brass.envMapIntensity = 1.7; M.chrome.envMapIntensity = 1.9;
world.traverse(o => {
  if (!o.isMesh) return;
  const s = SWAP.get(o.material);
  if (s) o.material = s;
});

/* тени: на высоком качестве — мягкие тени от заполняющего света зала (обновляются 10 раз в секунду);
   на всех уровнях — мягкие «контактные» пятна под людьми, чтобы никто не парил над полом */
const SHADOW = { on: POST.tier === 2, n: 0 };
const blobTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  gr.addColorStop(0, "rgba(0,0,0,.62)"); gr.addColorStop(.55, "rgba(0,0,0,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const blobMat = basic({ map: blobTex, transparent: true, depthWrite: false, opacity: .75 });
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function addBlob(F) {
  if (F._blob) return;
  const b = new THREE.Mesh(blobGeo, blobMat);
  b.position.set(0, .006 - (F.y0 || 0), 0);
  b.scale.setScalar(F.seated ? .55 : .7);
  b.renderOrder = 1;
  F.root.add(b); F._blob = b;
}
FIGS.forEach(addBlob);
if (SHADOW.on) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const L = LIGHTS.fill;
  L.castShadow = true;
  L.shadow.mapSize.set(512, 512);
  L.shadow.bias = -.003; L.shadow.normalBias = .02; L.shadow.radius = 4;
  L.shadow.camera.near = .25; L.shadow.camera.far = 9;
  world.traverse(o => { if (o.isMesh && !(o.material && o.material.isMeshBasicMaterial)) o.receiveShadow = true; });
  const caster = r => r.traverse(o => { if (o.isMesh && !o.material.transparent && !o.material.isMeshBasicMaterial) o.castShadow = true; });
  FIGS.forEach(F => caster(F.root));
  // табуреты, кресла, кафедра, столы — всё, что из кожи и металла
  world.traverse(o => { if (o.isMesh && (o.material === SWAP.get(M.leatherRed) || o.material === SWAP.get(M.leatherBrown) || o.material === M.chrome || o.material === M.brassDark)) o.castShadow = true; });
  for (const F of FIGS) if (F._blob) F._blob.material = blobMat;
  blobMat.opacity = .45;
  renderer.shadowMap.needsUpdate = true;
}
/* новые фигуры (живые посетители) тоже получают пятно и тень */
setInterval(() => {
  for (const F of FIGS) {
    if (F._blob) continue;
    addBlob(F);
    if (SHADOW.on) F.root.traverse(o => { if (o.isMesh && !o.material.transparent && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
  }
}, 3000);
/* тени отбрасывает только то, что рядом с заполняющим светом: дальние залы в карту теней не попадают */
const CASTERS = [];
if (SHADOW.on) world.traverse(o => { if (o.isMesh && o.castShadow) CASTERS.push(o); });
const _sp = V3();
function cullCasters() {
  const L = LIGHTS.fill.position;
  for (const o of CASTERS) { o.getWorldPosition(_sp); o.castShadow = o.visible && _sp.distanceTo(L) < 5.5; }
}
setInterval(() => { if (SHADOW.on && POST.tier === 2) { for (const F of FIGS) F.root.traverse(o => { if (o.isMesh && o.castShadow && !CASTERS.includes(o)) CASTERS.push(o); }); cullCasters(); } }, 1500);
onTick(() => {
  if (!SHADOW.on || POST.tier < 2) { if (renderer.shadowMap.enabled && POST.tier < 2) { renderer.shadowMap.enabled = false; LIGHTS.fill.castShadow = false; } return; }
  if (++SHADOW.n % 6 === 0) renderer.shadowMap.needsUpdate = true;
});

/* фокус: крупные планы — шоу бармена, разговор у стойки, дегустация в погребе */
const LOOKAT = { p: null };
const _fh = V3();
onTick(() => {
  if (SHOW.on) POST.focus(SHOW.focus, .0016);
  else if (SEAT.on) { bt.head.getWorldPosition(_fh); POST.focus(_fh.clone(), .0011); }
  else if (typeof CEL !== "undefined" && CEL.on && CEL.busy) { SOM.head.getWorldPosition(_fh); POST.focus(_fh.clone(), .0012); }
  else if (LOOKAT.p) POST.focus(LOOKAT.p, .0014);
  else POST.focus(null);
});

/* ================= камера и предметы: крупные планы, подсветка, понятное взаимодействие ================= */
/* крупный план: после нажатия камера мягко подъезжает к предмету, а потом возвращается на место */
const CLOSE = { on: false, until: 0, sawModal: false, root: null };
const NO_CLOSE = /^(Сесть за стойку|Барная карта|Атмосфера|Плеер|Бармен|Попросить сыграть|Сцена пока|Посетитель|Книга, которая торчит|Граммофон)/;
const _cb = new THREE.Box3(), _cc = V3(), _cs = V3(), _cray = new THREE.Raycaster();
const isIn = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
function closeupOf(root) {
  const h = root.userData.hot;
  if (NO_CLOSE.test(h.label) || DRINKS.some(d => d.name === h.label) || h.zone === 4 || h.zone === "street") return null;
  _cb.setFromObject(root);
  if (_cb.isEmpty()) return null;
  _cb.getCenter(_cc); _cb.getSize(_cs);
  const size = Math.max(_cs.x, _cs.y, _cs.z);
  if (size > 1.6 || size < .01 || _cc.y < -1) return null;
  // встаём между нынешней камерой и предметом: подходим, но не упираемся
  const from = V3(CAM.px, CAM.py, CAM.pz), dir = from.clone().sub(_cc);
  const dist = dir.length();
  let want = clamp(size * 2.6 + .55, .7, dist * .8);
  dir.normalize();
  // между предметом и камерой не должно быть кресел и стен: иначе подходим ближе или не подходим вовсе
  _cray.set(_cc, dir); _cray.far = want; _cray.near = size * .5; _cray.camera = camera;
  const hit = _cray.intersectObject(world, true).find(x => x.object.isMesh && x.object.visible && !x.object.material.transparent && !x.object.material.isMeshBasicMaterial && !isIn(x.object, root));
  if (hit) { if (hit.distance < .45) return null; want = hit.distance - .18; }
  const p = _cc.clone().addScaledVector(dir, want);
  p.y = lerp(p.y, _cc.y + .25, .5);
  return { px: p.x, py: p.y, pz: p.z, tx: _cc.x, ty: _cc.y, tz: _cc.z, fov: CAM.fov * .92, c: _cc.clone() };
}
function closeupEnd() {
  if (!CLOSE.on) return;
  CLOSE.on = false; LOOKAT.p = null;
  if (curZone !== 4 && !SEAT.on && !SHOW.on && !STREET.on && !flight) flyTo(framed(curZone, nudge), 1.4, 0);
}
{
  const base = activate;
  activate = async root => {
    const h = root.userData.hot;
    // нажатие: предмет чуть проседает и пружинит обратно
    if (h.grow && !h.noChip) { const s0 = h.base.clone(); root.scale.copy(s0).multiplyScalar(.93); tween(root.scale, { x: s0.x, y: s0.y, z: s0.z }, .35, ease.out); }
    pulseOf(root, 1);
    const sameZone = h.zone === curZone;
    await base(root);
    if (!sameZone || STILL || busy || SEAT.on || SHOW.on || STREET.on || (typeof CEL !== "undefined" && CEL.busy)) return;
    const s = closeupOf(root);
    if (!s) return;
    CLOSE.on = true; CLOSE.root = root; CLOSE.sawModal = false; CLOSE.until = NOW + 6500;
    LOOKAT.p = s.c;
    flyTo(s, 1.1, 0);
  };
}
onTick(() => {
  if (!CLOSE.on) return;
  const m = modalOpen() || document.querySelector("dialog.sheet[open]") || mixDlg.open;
  if (m) { CLOSE.sawModal = true; CLOSE.until = NOW + 900; return; }
  if (pointer && pointer.drag) { closeupEnd(); return; }
  if (NOW > CLOSE.until) closeupEnd();
});
{ const base = goZone; goZone = (...a) => { CLOSE.on = false; LOOKAT.p = null; return base(...a); }; }

/* подсветка: тёплое свечение у предмета под курсором, мягкий «пульс» доступных вещей, когда гость осматривается */
const GLOW = new Map();
function glowOf(root) {
  let g = GLOW.get(root);
  if (g) return g;
  const h = root.userData.hot;
  if (h.noChip || /^(Атмосфера|Плеер)/.test(h.label)) return null;
  _cb.setFromObject(root);
  if (_cb.isEmpty()) return null;
  _cb.getCenter(_cc); _cb.getSize(_cs);
  const size = Math.max(_cs.x, _cs.y, _cs.z);
  if (size > 2.2 || _cc.y < -1) return null;
  g = glowSprite(0xffc27a, Math.max(.25, size * 1.5), _cc.x, _cc.y, _cc.z, world, 0);
  g.material.depthTest = true; g.material.depthWrite = false;
  g.renderOrder = 3; g.userData.k = 0; g.userData.pulse = 0;
  GLOW.set(root, g);
  return g;
}
function pulseOf(root, v = .8) { const g = glowOf(root); if (g) g.userData.pulse = Math.max(g.userData.pulse, v); }
const IDLE = { t: 0, last: 0, mx: -1, my: -1 };
addEventListener("pointermove", e => { if (Math.abs(e.clientX - IDLE.mx) + Math.abs(e.clientY - IDLE.my) > 4) { IDLE.t = 0; IDLE.mx = e.clientX; IDLE.my = e.clientY; } }, { passive: true });
addEventListener("pointerdown", () => { IDLE.t = 0; }, { passive: true });
onTick((t, dt) => {
  if (!started || STREET.on || SHOW.on) { for (const g of GLOW.values()) g.material.opacity = 0; return; }
  // каждые ~14 секунд покоя — короткий пульс предметов этого зала (не чаще, чем нужно)
  IDLE.t += dt;
  if (IDLE.t > 14 && !SEAT.on && !modalOpen() && !mixDlg.open && !reduceMotion.matches) {
    IDLE.t = 0;
    let i = 0;
    for (const root of HOT) if (root.userData.hot.zone === curZone && !root.userData.hot.secret && root.visible !== false) { const g = glowOf(root); if (g) setTimeout(() => { g.userData.pulse = Math.max(g.userData.pulse, .55); }, (i++) * 120); }
  }
  for (const [root, g] of GLOW) {
    const d = root.userData.hot;
    const active = CLOSE.on && CLOSE.root === root;
    const want = d.zone !== curZone ? 0 : Math.max(d.h * .55, active ? .35 : 0, g.userData.pulse);
    g.userData.k += (want - g.userData.k) * Math.min(1, dt * 6);
    g.userData.pulse = Math.max(0, g.userData.pulse - dt * .9);
    g.material.opacity = g.userData.k * .5;
    g.visible = g.material.opacity > .004;
  }
});
/* на телефоне: короткое касание показывает название предмета рядом с пальцем */
canvas.addEventListener("pointerup", e => {
  if (e.pointerType === "mouse" || STREET.on) return;
  const root = pick(e.clientX, e.clientY);
  if (!root) return;
  tip.textContent = root.userData.hot.label;
  tip.style.transform = `translate(${Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8)}px, ${Math.max(8, e.clientY - 44)}px)`;
  tip.classList.add("show");
  setTimeout(() => tip.classList.remove("show"), 1300);
});
Object.assign(H3D, { close: CLOSE, closeupEnd });

/* ================= первое впечатление: неоновый логотип, пропуск вступления, знакомство с управлением ================= */
/* логотип зажигается по буквам, как настоящая неоновая трубка; потом по нему пробегает отблеск */
{
  const h1 = introTitle;
  if (!h1.classList.contains("off") && !STILL) {
    const txt = h1.textContent;
    h1.textContent = "";
    h1.classList.add("neon-in");
    h1.setAttribute("aria-label", txt);
    [...txt].forEach((ch, i) => {
      const s = document.createElement("span");
      s.className = "nl"; s.textContent = ch; s.setAttribute("aria-hidden", "true");
      s.style.animationDelay = (.35 + i * .13 + (i === 3 ? .5 : 0)) + "s";   // одна буква упрямится — так бывает с неоном
      h1.appendChild(s);
    });
    const sweep = document.createElement("i"); sweep.className = "nl-sweep"; sweep.setAttribute("aria-hidden", "true"); h1.appendChild(sweep);
  }
}
/* вход: интро не просто гаснет, а камера словно проходит сквозь него */
enter.addEventListener("click", () => { intro.classList.add("dive"); }, { capture: true });

/* «Пропустить вступление»: сразу внутрь, за стойку */
const skipBtn = document.createElement("button");
skipBtn.type = "button"; skipBtn.className = "skip-intro"; skipBtn.textContent = "Пропустить вступление";
skipBtn.hidden = true;
app.appendChild(skipBtn);
async function skipStreet() {
  if (!STREET.on) return;
  skipBtn.hidden = true;
  STREET.step = "inside";
  streetTalk([]);
  bubbleEl.classList.remove("show");
  SDOOR.eyes.visible = false;
  await fade(true, .45);
  flight = null;
  Music.room(1);
  setCam(framed(1));
  app.classList.remove("street");
  STREET.on = false;
  renderZoneUI(1);
  hintEl.textContent = ZONES[1].hint;
  SDOOR.g.rotation.y = 0;
  doorway.material.opacity = 0; STREET.doorStreak.material.opacity = 0;
  streetLights(false);
  street.visible = false;
  try { localStorage.setItem("hacheden-visited", "1"); } catch (e) {}
  await fade(false, .7);
}
skipBtn.addEventListener("click", skipStreet);
addEventListener("keydown", e => { if (e.key === "Escape" && STREET.on && !skipBtn.hidden) skipStreet(); });
onTick(() => { const want = STREET.on && started; if (skipBtn.hidden === want) skipBtn.hidden = !want; });

/* знакомство с управлением: три коротких подсказки при первом визите */
const COACH = [
  { t: "Осмотритесь", d: COARSE ? "Проведите пальцем по экрану — камера повернётся." : "Зажмите кнопку мыши и потяните — камера повернётся." },
  { t: "Всё живое", d: COARSE ? "Нажимайте на людей и предметы. Кнопки внизу дублируют всё, что есть в зале." : "Наведите на предмет — он подсветится. Нажмите, чтобы взаимодействовать. Кнопки внизу дублируют всё, что есть в зале." },
  { t: "Ваш вечер", d: "Внизу — залы бара. Справа — посетители, фото, музыка, журнал секретов и настройки. Барная карта — слева сверху." }
];
const coachEl = document.createElement("div");
coachEl.className = "coach"; coachEl.hidden = true; coachEl.setAttribute("role", "dialog"); coachEl.setAttribute("aria-label", "Знакомство с управлением");
app.appendChild(coachEl);
let coachI = 0;
function coachShow() {
  const c = COACH[coachI];
  coachEl.innerHTML = `<b>${c.t}</b><p>${c.d}</p><div class="coach-row"><span>${coachI + 1} / ${COACH.length}</span>
    <button class="clear" type="button" data-coach-skip>Не показывать</button><button class="make" type="button" data-coach-next>${coachI < COACH.length - 1 ? "Дальше" : "Понятно"}</button></div>`;
  coachEl.hidden = false;
  coachEl.classList.remove("in"); void coachEl.offsetWidth; coachEl.classList.add("in");
}
function coachEnd() { coachEl.hidden = true; try { localStorage.setItem("hacheden-coach", "1"); } catch (e) {} }
coachEl.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if ("coachSkip" in b.dataset) coachEnd();
  else if (++coachI < COACH.length) coachShow(); else coachEnd();
});
{
  let seen = false; try { seen = localStorage.getItem("hacheden-coach") === "1"; } catch (e) {}
  if (!seen) {
    const t = setInterval(() => {
      if (!started || STREET.on || busy || modalOpen()) return;
      clearInterval(t);
      setTimeout(coachShow, 1800);
    }, 1000);
  }
}
Object.assign(H3D, { skipStreet, coach: () => { coachI = 0; coachShow(); }, owner: OWNER });

/* ================= характер бармена: состояния и реплики по обстоятельствам =================
   Бармен не говорит случайных фраз «в пустоту»: каждая реплика опирается на то, что происходит —
   время, погоду, музыку, гостей, ваш прошлый визит и ваши действия. */
const MIND = { state: "fresh", lastLine: 0, said: new Set(), greeted: false, bottles: [], menuOpens: [], quietSince: 0, wasCellar: false, mixT: 0, mixKey: "", mixSaid: 0 };
function btState() {
  const h = hourNow();
  if (SHOW.on || BT.busy && !SEAT.on) return "working";
  if (SEAT.on) return "talking";
  if (h >= 1.5 && h < 3) return "tired";
  if (h >= 17 && h < 19) return "fresh";
  return "evening";
}
const myGuestName = () => { try { const n = localStorage.getItem("hacheden-name"); return n && n !== "Гость" ? n : ""; } catch (e) { return ""; } };
const favDrink = () => { const e = Object.entries(PROG.drinks).sort((a, b) => b[1] - a[1])[0]; return e && e[1] >= 2 ? COCKTAIL_BY_ID[e[0]] : null; };
/* реплика: не чаще раза в 40 секунд и без повторов за вечер */
function btLine(text, dur = 5, force = false) {
  if (!text) return false;
  if (!force && (NOW - MIND.lastLine < 40000 || MIND.said.has(text))) return false;
  if (curZone !== 1 || STREET.on || SHOW.on || modalOpen() || CLOSING.on || (bubble && bubble.F !== bt)) return false;
  MIND.lastLine = NOW; MIND.said.add(text);
  say(bt, text, dur);
  return true;
}
const pickLine = arr => arr[Math.floor(Math.random() * arr.length)];
/* что сказать, когда гость рядом и ничем не занят: из обстоятельств вечера */
function ambientLine() {
  const st = btState(), h = hourNow(), opts = [];
  if (st === "fresh") opts.push("Только открылись — лёд свежий, бутылки протёрты. Лучшее время, чтобы выбрать не спеша.");
  if (st === "tired") opts.push("Под утро руки сами помнят рецепты. Голова уже думает о кофе.", "Скоро последний заказ. Если хотели что-то попробовать — самое время.");
  if (h >= 23 || h < 1) opts.push("Полночь — время для чего-нибудь покрепче. Или для разговора.");
  if (WX_NOW.ok && WX_NOW.temp <= 2) opts.push(`На улице ${Math.round(WX_NOW.temp)}°. Горячий тодди или ирландский кофе — и вечер спасён.`);
  if (WEATHER.rain && WX_NOW.ok) opts.push("Дождь стучит по окнам читальни. Там сейчас особенно уютно.");
  if (WEATHER.snow) opts.push("Снег идёт. В такие вечера заказывают коньяк — и правильно делают.");
  if (Music.on && BAND_HERE) opts.push(`Слышите? «${Music.info().track.title}». Наш пианист сегодня в ударе.`);
  if (!Music.on && BAND_HERE) opts.push("Музыканты на сцене, но молчат. Попросите их сыграть — они не откажут.");
  if (LAST_DRINK && !SEAT.on) opts.push(LAST_DRINK.custom ? `Ваш «${LAST_DRINK.name}» я записал в блокнот. Хороший рецепт.` : `Как вам «${LAST_DRINK.name}»? Если что — повторю.`);
  if (FRIENDS.on && Object.keys(FRIENDS.peers).length > 1) opts.push("Сегодня людно. Люблю, когда за стойкой разговаривают.");
  if (typeof HALLOWEEN !== "undefined" && HALLOWEEN) opts.push("Счастливого Хэллоуина. Тыквы горят до самого закрытия.");
  if (!LAST_DRINK && MIND.quietSince && NOW - MIND.quietSince > 150000) opts.push("Вы давно смотрите на полки. Садитесь — подберу что-нибудь под настроение.");
  // редкие реплики: раз в несколько вечеров
  if (Math.random() < .04) opts.push("Знаете, за этой стойкой однажды сделали предложение руки и сердца. Ответ был «да». Коктейль — «Френч 75».", "Говорят, ночью кот из курилки проверяет, все ли бутылки на месте. Пока ни одной не пропало.");
  const fresh = opts.filter(o => !MIND.said.has(o));
  return fresh.length ? pickLine(fresh) : null;
}
/* приветствие: первый раз — знакомство, повторно — узнаёт и помнит, что вы пьёте */
function greetGuest() {
  if (MIND.greeted) return;
  MIND.greeted = true;
  const name = myGuestName(), fav = favDrink(), st = btState();
  let text;
  if (PROG.visits <= 1) text = `Добрый вечер${name ? ", " + name : ""}! Впервые у нас? Садитесь за стойку — подберу коктейль по настроению.`;
  else if (fav) text = `С возвращением${name ? ", " + name : ""}! Снова «${fav.name}»? Или сегодня попробуем что-то новое?`;
  else text = `С возвращением${name ? ", " + name : ""}! Рад видеть.`;
  if (st === "tired") text += " Правда, вы к самому закрытию.";
  setTimeout(() => btLine(text, 6, true), 1200);
}
setInterval(() => {
  if (!started || STREET.on) return;
  if (curZone === 1 && !MIND.greeted && !busy) greetGuest();
  MIND.state = btState();
  if (curZone === 1 && !LAST_DRINK && !SEAT.on && !busy) { if (!MIND.quietSince) MIND.quietSince = NOW; } else MIND.quietSince = 0;
  if (curZone !== 1 || busy || SEAT.on || BT.busy || mixDlg.open) return;
  if (NOW - MIND.lastLine > 75000 && Math.random() < .5) btLine(ambientLine());
}, 15000);

/* необычные действия гостя */
for (const root of HOT) {
  const h = root.userData.hot;
  if (h.zone !== 1 || !DRINKS.some(d => d.name === h.label)) continue;
  const base = h.act;
  h.act = () => {
    MIND.bottles = MIND.bottles.filter(t => NOW - t < 12000); MIND.bottles.push(NOW);
    base();
    if (MIND.bottles.length === 4) setTimeout(() => btLine("Вы как будто проводите инвентаризацию. Все на месте, честное слово.", 5, true), 2500);
  };
}
mixDlg.addEventListener("close", () => {
  MIND.menuOpens = MIND.menuOpens.filter(t => NOW - t < 30000); MIND.menuOpens.push(NOW);
  if (MIND.menuOpens.length === 4 && !busy) btLine("Не можете выбрать? Садитесь за стойку — помогу.", 5, true);
});
/* реакция на ингредиенты в шейкере: после паузы, по делу и не на каждое нажатие */
mixDlg.addEventListener("click", e => {
  if (!e.target.closest("[data-ing]")) return;
  MIND.mixT = NOW;
  clearTimeout(MIND.mixTO);
  MIND.mixTO = setTimeout(mixComment, 1700);
});
function mixComment() {
  const set = [...inShaker].sort(), key = set.join("+");
  if (!set.length || key === MIND.mixKey || NOW - MIND.mixSaid < 9000 || !mixDlg.open) return;
  MIND.mixKey = key;
  const has = i => set.includes(i);
  const known = COCKTAILS.find(c => !c.custom && c.need.length === set.length && c.need.every(i => has(i)));
  const almostSecret = SECRETS.find(s => !FOUND.has(s.id) && s.need.length === set.length + 1 && set.every(i => s.need.includes(i)));
  let text = null;
  if (known) text = `«${known.name}» — узнаю. Жмите «Смешать».`;
  else if (almostSecret && set.length >= 2) text = "Хм… кажется, я догадываюсь, к чему вы ведёте. Не хватает самой малости.";
  else if (set.length >= 6) text = "Многовато для одного бокала. Я бы оставил три-четыре — вкус будет чище.";
  else if (has("coconut") && (has("tonic") || has("soda") || has("cola"))) text = "Сливки с газировкой могут расслоиться. Лучше возьмите сок.";
  else if (has("campari") && !has("vermouthR") && !has("syrup") && !has("oj")) text = "Кампари горчит. Ему нужен друг — красный вермут или апельсин.";
  else if (has("wine") && has("cola")) text = "Вино с колой? В Стране басков вас бы поняли.";
  else if (set.every(i => ["lime", "lemon", "syrup", "mint", "soda", "tonic", "grenadine"].includes(i)) && set.length >= 2) text = "Без крепкого — это лимонад. Тоже хороший выбор.";
  if (text) { MIND.mixSaid = NOW; MIND.lastLine = NOW; say(bt, text, 5); }
}
/* после погреба */
onTick(() => {
  if (typeof CEL !== "undefined" && CEL.on) MIND.wasCellar = true;
  else if (MIND.wasCellar && curZone === 1 && !busy) { MIND.wasCellar = false; setTimeout(() => btLine("Вы были внизу? Тогда вы знаете о нас больше, чем говорите.", 5, true), 2500); }
});
Object.assign(H3D, { mind: MIND, btState, ambientLine });

/* ================= финал коктейля: подставка, запотевший бокал, эфирные масла цедры, круги от гарнира ================= */
const FIN = {};
FIN.coasterTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#efe4cc"; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#8a1428"; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 24, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#8a1428"; g.textAlign = "center"; g.textBaseline = "middle";
  fitFont(g, BAR_NAME, w - 70, 44, "Forum, Georgia, serif"); g.fillText(BAR_NAME, w / 2, h / 2 + 2);
  g.font = "16px Literata, Georgia, serif"; g.fillText("EST. 1921", w / 2, h / 2 + 40);
});
FIN.coasterMat = std({ map: FIN.coasterTex, roughness: .9 });
FIN.coasterGeo = new THREE.CylinderGeometry(.046, .046, .003, 36);
FIN.frostMat = std({ color: 0xf2f6fa, transparent: true, opacity: 0, roughness: .85, depthWrite: false, side: THREE.FrontSide });
FIN.mistTex = TEX.glow;
/* подставка ложится на стойку, бокал въезжает на неё и дальше они вместе */
{
  const base = STEP.serve;
  STEP.serve = async (st, c) => {
    const G = SHOW.glassV;
    if (!G) return base(st, c);
    const co = new THREE.Mesh(FIN.coasterGeo, FIN.coasterMat);
    co.position.copy(ST.serve).add(V3(0, .0016, 0));
    co.rotation.y = rr(0, 6);
    co.scale.setScalar(.01);
    co.userData.ing = true;
    world.add(co);
    tween(co.scale, { x: 1, y: 1, z: 1 }, SHOW.fast ? .001 : .25, ease.out);
    SND.tap();
    await base(st, c);
    if (co.parent === world) { co.userData.ing = false; G.g.attach(co); }
  };
}
/* запотевший бокал: коктейли «на ножке» подают ледяными — стекло покрывается испариной */
function frostGlass(G) {
  const glassMesh = G.body;
  if (!glassMesh || glassMesh.userData.frosted) return;
  glassMesh.userData.frosted = true;
  const f = new THREE.Mesh(glassMesh.geometry, FIN.frostMat.clone());
  f.scale.setScalar(1.012); f.renderOrder = 6;
  glassMesh.add(f);
  tween(f.material, { opacity: .28 }, SHOW.fast ? .001 : 2.2);
}
{
  const base = STEP.strain;
  STEP.strain = async (st, c) => {
    await base(st, c);
    if (SHOW.glassV && (c.cup === "coupe" || c.cup === "martini")) frostGlass(SHOW.glassV);
  };
}
/* эфирные масла: перед тем как положить цедру, бармен сжимает её над бокалом — облачко тончайших брызг */
function citrusMist(G, col) {
  if (SHOW.fast || reduceMotion.matches) return;
  const at = mouth(G, .05), N = 26, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) { pos.set([at.x, at.y, at.z], i * 3); vel.push(V3(rr(-.25, .25), rr(-.35, .05), rr(-.25, .25))); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, size: .006, map: FIN.mistTex, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }));
  world.add(pts);
  let t = 0;
  pts.userData.ing = true;
  const off = onTickTmp((tt, dt) => {
    t += dt;
    for (let i = 0; i < N; i++) { pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt; vel[i].y -= dt * .4; }
    geo.attributes.position.needsUpdate = true;
    pts.material.opacity = Math.max(0, .9 - t * 1.1);
    if (t > .9) { off(); world.remove(pts); geo.dispose(); pts.material.dispose(); }
  });
}
/* круги на поверхности, когда в бокал опускают оливку или вишню */
function ripple(G) {
  if (SHOW.fast) return;
  const s = surface(G);
  const r = mesh(new THREE.RingGeometry(.6, 1, 32), basic({ color: 0xffffff, transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }), s.x, s.y + .001, s.z);
  r.rotation.x = -Math.PI / 2; r.scale.setScalar(.004); r.userData.ing = true;
  tween(r.scale, { x: G.mouthR * G.scale * .9, y: G.mouthR * G.scale * .9, z: 1 }, .7, ease.out);
  tween(r.material, { opacity: 0 }, .8).then(() => { world.remove(r); r.geometry.dispose(); });
}
{
  const base = STEP.garnish;
  STEP.garnish = async (st, c) => {
    const G = SHOW.glassV;
    if (G && (c.garnish === "orange" || c.garnish === "lemon")) {
      shot("macro", mouth(G, .04));
      citrusMist(G, c.garnish === "orange" ? 0xffb04a : 0xfff07a);
      FSND.hiss && FSND.hiss();
      await ws(.5);
    }
    await base(st, c);
    if (G && (c.garnish === "olive" || c.garnish === "cherry")) ripple(G);
  };
}

/* гул зала зависит от того, сколько людей вокруг: к открытию тихо, ночью — полный зал */
Music.mix({ crowd: [0, .45, .7, 1][crowd] ?? .7 });
{
  const pc = playClosing;
  playClosing = async (...a) => { Music.mix({ crowd: 0 }); const r = await pc(...a); Music.mix({ crowd: [0, .45, .7, 1][crowd] ?? .7 }); return r; };
  const pr = playRaid;
  playRaid = async (...a) => { Music.mix({ crowd: .15 }); const r = await pr(...a); Music.mix({ crowd: [0, .45, .7, 1][crowd] ?? .7 }); return r; };
}
Object.assign(H3D, { closing: (...a) => playClosing(...a), raid: (...a) => playRaid(...a) });

/* ================= пенка от ананаса и долька ананаса на ободке =================
   Ананасовый сок, встряхнутый со льдом, даёт густую шелковистую пенку: после процеживания
   она поднимается над напитком и дальше держится на поверхности, опускаясь вместе с ней
   при каждом глотке. Гарнир — настоящая долька ананаса с коркой и листьями. */
const FOAM = { T: .0085 };
FOAM.tex = canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = "#f6ead4"; g.fillRect(0, 0, w, h);
  // пузырьки разного размера: тень по нижнему краю, блик сверху
  for (let i = 0; i < 1400; i++) {
    const x = rng() * w, y = rng() * h, r = rng() < .85 ? R(.8, 2.2) : R(2.6, 4.6);
    g.globalAlpha = R(.25, .5);
    g.strokeStyle = "#b89a74"; g.lineWidth = .9; g.beginPath(); g.arc(x, y + r * .15, r, .2, 2.9); g.stroke();
    g.globalAlpha = R(.5, .9);
    g.strokeStyle = "#ffffff"; g.lineWidth = .8; g.beginPath(); g.arc(x, y - r * .1, r * .75, 3.5, 5.9); g.stroke();
  }
  g.globalAlpha = 1;
}, { repeat: [4, 1] });
// купол: плоское дно, мягко скруглённый край и чуть выпуклая середина
FOAM.geo = lathe([[0, 0], [1, 0], [1, .38], [.95, .66], [.8, .85], [.5, .96], [0, 1]], 40);
FOAM.mat = std({ map: FOAM.tex, bumpMap: FOAM.tex, bumpScale: 1.2, roughness: .85 });
FOAM.proto = mesh(FOAM.geo, FOAM.mat, 0, -10, 0);   // для прогрева шейдера
FOAM.proto.visible = false;

const eggy = c => !!c && (PROGS()[c.id] || []).some(s => s[0] === "egg");
const foamy = c => !!c && (eggy(c) || c.need && c.need.includes("pineapple") && (PROGS()[c.id] || []).some(s => s[0] === "shake"));
// белковая пена почти белая и толще ананасовой
function foamColor(c) { return eggy(c) ? new THREE.Color(0xfbf6ea) : new THREE.Color(c.pour).lerp(new THREE.Color(0xfff6e6), .72); }
const foamT = c => eggy(c) ? .0125 : FOAM.T;
function addFoam(V, c) {
  if (V.foam) return V.foam;
  const m = new THREE.Mesh(FOAM.geo, FOAM.mat.clone());
  m.material.color.copy(foamColor(c));
  m.material.emissive.copy(m.material.color).multiplyScalar(.06);
  m.renderOrder = 4;
  m.visible = false;
  m.userData.k = 0;
  m.userData.T = foamT(c);
  V.g.add(m);
  V.foam = m;
  placeFoam(V);
  return m;
}
/* пенка всегда лежит на поверхности: толщина по готовности, к концу бокала тает */
function placeFoam(V) {
  const m = V.foam;
  if (!m) return;
  const f = clamp(V.ml / V.cap, 0, .94);
  const k = m.userData.k * clamp((f - .03) / .12, 0, 1);
  m.visible = V.liq.visible && k > .02;
  if (!m.visible) return;
  const top = V.y0 + f * (V.y1 - V.y0), t = (m.userData.T || FOAM.T) * k, r = V.r1 * .985;
  m.position.y = top - t * .3;
  m.scale.set(r, t, r);
  if (V.ride) for (const o of V.ride) o.position.y = top + t * .7 + o.userData.dy;
}
{
  const base = setLevel;
  setLevel = V => { base(V); if (V.foam) placeFoam(V); };
}
/* во время процеживания пенка набирается, после — поднимается и успокаивается */
{
  const base = STEP.strain;
  STEP.strain = async (st, c) => {
    const G = SHOW.glassV;
    if (!G || !foamy(c)) return base(st, c);
    const m = addFoam(G, c);
    const m0 = G.ml;
    const off = onTickTmp(() => { m.userData.k = Math.min(.4, Math.max(m.userData.k, (G.ml - m0) / G.cap)); placeFoam(G); });
    await base(st, c);
    off();
    if (SHOW.fast || reduceMotion.matches) { m.userData.k = 1; placeFoam(G); return; }
    // пена поднимается с лёгким «вздохом» и чуть оседает
    follow(mouth(G, .02));
    const done = onTickTmp(() => placeFoam(G));
    await tween(m.userData, { k: 1.12 }, 1.1, ease.out);
    await tween(m.userData, { k: 1 }, .5, ease.sine);
    done();
    placeFoam(G);
  };
}
/* если шоу пропустили целиком — у поданного бокала тоже есть пенка */
{
  const base = placeServed;
  placeServed = c => {
    base(c);
    if (!servedGlass || !foamy(c)) return;
    const L = servedGlass.userData.liq;
    if (!L) return;
    const r = L.mesh.geometry.parameters.radiusTop * .985;
    const m = new THREE.Mesh(FOAM.geo, FOAM.mat.clone());
    m.material.color.copy(foamColor(c));
    m.material.emissive.copy(m.material.color).multiplyScalar(.06);
    const T = foamT(c);
    m.position.y = L.y1 - T * .3;
    m.scale.set(r, T, r);
    servedGlass.add(m);
    if (typeof eggFinish === "function" && eggy(c)) eggFinish(servedGlass, m, L.y1 + T * .7, r, c);
  };
}

/* долька ананаса: сектор мякоти с коркой, надрез садится на ободок, листья веером */
const PINE = {
  flesh: std({ color: 0xf8e47e, roughness: .38, emissive: 0x4a4208 }),
  core: std({ color: 0xfbf0bc, roughness: .5, emissive: 0x262408 }),
  rind: std({ color: 0x7a5e22, roughness: .85, emissive: 0x100a02 }),
  leaf: std({ color: 0x3f7a2c, roughness: .55, emissive: 0x081a06, side: THREE.DoubleSide })
};
PINE.R = .034; PINE.A = .78; PINE.H = .011;
function pineWedge() {
  const g = new THREE.Group(), w = new THREE.Group();
  const R = PINE.R, A = PINE.A, H = PINE.H;
  // сектор в плоскости YZ: острие в начале координат, корка в сторону +z
  const sector = (r, h, mat) => {
    const geo = new THREE.CylinderGeometry(r, r, h, 16, 1, false, -A / 2, A);
    geo.rotateZ(Math.PI / 2);
    return mesh(geo, mat, 0, 0, 0, w);
  };
  sector(R, H * .94, PINE.rind);
  sector(R * .9, H, PINE.flesh);
  sector(R * .3, H * 1.04, PINE.core);
  // листья: тонкие заострённые пластинки из корки вверх и наружу
  for (let i = 0; i < 3; i++) {
    const lg = new THREE.ConeGeometry(.0042, .052 - i * .008, 4, 1);
    lg.translate(0, (.052 - i * .008) / 2, 0); lg.scale(1, 1, .22);
    const l = mesh(lg, PINE.leaf, 0, R * Math.sin(A * .22), R * .97, w);
    l.rotation.set(.35 + (i - 1) * .32, 0, (i - 1) * .12);
  }
  // наклон: мякоть смотрит внутрь бокала, корка — наружу и вверх; надрез на ободке
  w.rotation.x = -.55;
  w.position.set(0, -.006, -.016);
  g.add(w);
  world.add(g);
  return g;
}
{
  const base = garnishMesh;
  garnishMesh = kind => kind === "pineapple" ? pineWedge() : base(kind);
}
PINE.proto = pineWedge(); PINE.proto.position.y = -10; PINE.proto.visible = false;

/* ================= виски сауэр на белке: яйцо, сухой шейк, белая пена и три капли ангостуры =================
   Бармен берёт яйцо из латунной подставки, дважды стукает о край шейкера, разламывает скорлупу
   над ним и переливает желток из половинки в половинку — белок стекает в шейкер. Сухой шейк без льда
   взбивает белок, второй шейк со льдом охлаждает. Пена поднимается над напитком, на неё ложатся
   три капли ангостуры, а вишня садится на пену позади них. Пена, капли и вишня опускаются
   вместе с напитком при каждом глотке. */
const EGG = { H: .056, R: .0205, S: .028, parts: [] };
EGG.shell = std({ color: 0xf2e7d2, roughness: .62, side: THREE.DoubleSide });
EGG.inner = std({ color: 0xfbf7ee, roughness: .8, side: THREE.BackSide });
EGG.yolk = std({ color: 0xf3a21a, roughness: .22, emissive: 0x3a1c00 });
EGG.crackM = std({ color: 0x9a8a6c, roughness: .9 });
EGG.cupM = std({ color: 0xc9944a, metalness: 1, roughness: .28, envMapIntensity: 1.4, side: THREE.DoubleSide });
// профиль яйца: шире снизу, острее сверху; t от 0 (низ) до π (верх)
const eggPt = (t, k = 1) => [EGG.R * Math.sin(t) * (1 + .12 * Math.cos(t)) * k, EGG.H / 2 * (1 - Math.cos(t))];
function eggHalf(t0, t1) {
  const out = [], inn = [];
  for (let i = 0; i <= 12; i++) { const t = t0 + (t1 - t0) * i / 12; out.push(eggPt(t)); inn.push(eggPt(t, .93)); }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe(out.map(([r, y]) => [Math.max(r, 1e-4), y]), 28), EGG.shell));
  const yc = EGG.H / 2;
  g.add(new THREE.Mesh(lathe(inn.map(([r, y]) => [Math.max(r, 1e-4), yc + (y - yc) * .97]), 24), EGG.inner));
  return g;
}
EGG.cupGeo = lathe([[0, 0], [.017, 0], [.0175, .003], [.007, .008], [.006, .015], [.012, .019], [.0172, .027], [.0186, .035], [.0178, .0355]], 28);
function makeEgg() {
  const b = eggHalf(0, Math.PI / 2), t = eggHalf(Math.PI / 2, Math.PI);
  b.add(t);
  const yolk = mesh(new THREE.SphereGeometry(.0105, 18, 12), EGG.yolk, 0, .012, 0, b);
  yolk.scale.set(1, .86, 1);
  const crack = new THREE.Mesh(new THREE.TorusGeometry(EGG.R * 1.002, .00032, 4, 40), EGG.crackM);
  crack.rotation.x = Math.PI / 2; crack.position.y = EGG.S; crack.visible = false;
  b.add(crack);
  world.add(b);
  return { b, t, yolk, crack };
}
EGG.proto = makeEgg(); EGG.proto.b.position.y = -10; EGG.proto.b.visible = false;
EGG.protoCup = mesh(EGG.cupGeo, EGG.cupM, 0, -10, 0); EGG.protoCup.visible = false;

/* капля ангостуры на пене: тёмная середина, мягкий край */
EGG.dropTex = canvasTex(64, 64, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, "rgba(86,20,12,1)"); r.addColorStop(.55, "rgba(102,28,16,.96)");
  r.addColorStop(.8, "rgba(128,46,26,.6)"); r.addColorStop(1, "rgba(150,70,40,0)");
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
EGG.dropM = std({ map: EGG.dropTex, transparent: true, depthWrite: false, roughness: .3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
EGG.dropGeo = new THREE.CircleGeometry(1, 28); EGG.dropGeo.rotateX(-Math.PI / 2);
EGG.protoDrop = mesh(EGG.dropGeo, EGG.dropM, 0, -10, 0); EGG.protoDrop.visible = false;
const DROP_X = [-.3, 0, .3];
/* foam — купол пены (масштаб r по сторонам), x — место по линии через центр, worldR — радиус капли */
function addDrop(foam, x, gs, spread = 0) {
  const d = mesh(EGG.dropGeo, EGG.dropM, x, 1 - .08 * Math.abs(x) + .03, 0, foam);
  d.renderOrder = 5;
  const s = .005 / (foam.scale.x * gs), sz = s * rr(.9, 1);
  d.rotation.y = rr(0, Math.PI);
  if (spread > 0 && !SHOW.fast) { d.scale.set(s * .35, 1, sz * .35); tween(d.scale, { x: s, z: sz }, spread, ease.out); }
  else d.scale.set(s, 1, sz);
  return d;
}

/* звуки: скорлупа о металл и глухой сухой шейк без льда */
SND.crack = loud => { if (SHOW.fast) return; noiseHit(0, .035, 2400, 4, loud ? .32 : .2); noiseHit(.012, .05, 5200, 2, loud ? .14 : .07, "highpass"); };
SND.slosh = (dur, hz) => { if (SHOW.fast) return; for (let i = 0; i < dur * hz * 2; i++) noiseHit(i / (hz * 2), .09, rr(420, 760), 2, .1); };

/* подставка для яйца ставится вместе с остальным реквизитом */
const EGGS = { cup: null, e: null };
function eggClear() {
  if (EGGS.cup) drop(EGGS.cup);
  if (EGGS.e) { drop(EGGS.e.b); drop(EGGS.e.t); drop(EGGS.e.yolk); }
  EGGS.cup = EGGS.e = null;
}
{
  const base = setupStation;
  setupStation = async c => {
    eggClear();
    if (eggy(c)) {
      station();
      const at = B(-.17, TOP(), .57);
      EGGS.cup = mesh(EGG.cupGeo, EGG.cupM, at.x, at.y, at.z);
      EGGS.e = makeEgg();
      EGGS.e.b.position.copy(at).add(V3(0, .028, 0));
      EGGS.e.b.scale.setScalar(1.25);
      EGGS.e.b.rotation.y = .4;
      for (const o of [EGGS.cup, EGGS.e.b]) { const y = o.position.y; o.position.y += .03; tween(o.position, { y }, SHOW.fast ? .001 : .35, ease.out); }
    }
    return base(c);
  };
}
{
  const base = cleanup;
  cleanup = (c, aborted) => { eggClear(); base(c, aborted); };
}

/* ---------- шаг: яйцо ---------- */
/* кисть держит половинку за торец: ладонь на конце яйца, пальцы вперёд — трещина посередине остаётся на виду */
const EGG_GRIP = (p, n) => ({ p, r: .028, f: V3(0, 0, 1), n, pose: "grip", along: .04 });
async function stepEgg(st) {
  const V = P.tin, R = bt.R, L = bt.L, E = EGGS.e;
  await jiggerPark();
  if (!E) return;
  const PIV = V3(0, EGG.S, 0);
  shot(choose(["macro", "low"]), EGGS.cup.position.clone().add(V3(0, .07, 0)));
  bt.look = EGGS.cup.position;
  await grip(R, E.b, EGG_GRIP(V3(0, .002, 0), V3(0, 1, 0)), .42);
  // поднимает яйцо и укладывает набок: острый конец — к левой руке
  const qH = Qz(-Math.PI / 2);
  await move(E.b, EGGS.cup.position.clone().add(V3(.03, .13, -.02)), { q: qH, dur: .55, arc: .03 });
  shot("top", mouth(V, .05), 1);
  follow(mouth(V, .04));
  bt.look = mouth(V);
  // два коротких удара экватором о дальний край шейкера
  const rim = mouth(V).add(V3(0, 0, V.mouthR * V.scale));
  const hit = V3(EGG.R, EGG.S, 0);
  const at = dy => posFor(E.b, hit, rim.clone().add(V3(0, dy, 0)), qH);
  await move(E.b, at(.04), { dur: .4, arc: .02 });
  for (let i = 0; i < 2; i++) {
    await move(E.b, at(.0015), { dur: .09, e: ease.in });
    SND.crack(i === 1);
    if (i === 1) E.crack.visible = true;
    await move(E.b, at(.028), { dur: .18, e: ease.out });
  }
  // над серединой шейкера: левая рука берёт верхнюю половинку
  const C = mouth(V, .085);
  await move(E.b, posFor(E.b, PIV, C, qH), { dur: .35, arc: .015 });
  await grip(L, E.t, EGG_GRIP(V3(0, EGG.H - .002, 0), V3(0, -1, 0)), .38);
  follow(C.clone().add(V3(0, -.01, 0)));
  world.attach(E.t);
  E.crack.visible = false;
  // скорлупа раскрывается, как книжка: обе половинки чашечками вверх
  const qB = Qz(-.22), qT = Qz(Math.PI + .22), cB = C.clone().add(V3(-.026, .004, 0)), cT = C.clone().add(V3(.026, .004, 0));
  const white = new THREE.Color(0xeeeedd);
  const from = V3(), mid = () => from.copy(cB).lerp(cT, .5).add(V3(0, -.004, 0));
  const opening = Promise.all([move(E.b, posFor(E.b, PIV, cB, qB), { q: qB, dur: .45 }), move(E.t, posFor(E.t, PIV, cT, qT), { q: qT, dur: .45 })]);
  await ws(.12);
  streamOn(v => v.copy(mid()), v => v.copy(surface(V)), white, .85);
  SND.pour(.7);
  await opening;
  await ws(.25);
  // желток переходит из половинки в половинку, белок стекает вниз
  for (let pass = 0; pass < 2; pass++) {
    const src = pass ? E.t : E.b, dst = pass ? E.b : E.t, cs = pass ? cT : cB;
    const qTip = pass ? Qz(Math.PI + .22 + .95) : Qz(-.22 - .95), qBack = pass ? qT : qB;
    await tiltAbout(src, PIV, qTip, .32);
    world.attach(E.yolk);
    const end = dst.localToWorld(V3(0, pass ? .012 : .043, 0)), p0 = E.yolk.position.clone();
    await waitTicks(.32, k => { E.yolk.position.lerpVectors(p0, end, ease.io(k)); E.yolk.position.y += Math.sin(Math.PI * k) * .012; });
    dst.attach(E.yolk);
    SND.plop();
    streamOn(v => v.copy(src.localToWorld(V3(pass ? -EGG.R * .9 : EGG.R * .9, EGG.S, 0))), v => v.copy(surface(V)), white, .6);
    await ws(.3);
    await tiltAbout(src, PIV, qBack, .28);
    streamOn(v => v.copy(mid()), v => v.copy(surface(V)), white, .5);
    await ws(.15);
  }
  streamOff();
  V.ml += st[1] || 20;
  // скорлупу — вниз, под стойку
  bt.look = null;
  await Promise.all([
    move(E.b, B(-.12, TOP() - .3, .16), { dur: .5, e: ease.in, arc: .02 }),
    move(E.t, B(.12, TOP() - .3, .16), { dur: .5, e: ease.in, arc: .02 })
  ]);
  letGo(R); letGo(L);
  drop(E.b); drop(E.t);
  EGGS.e = null;
  await Promise.all([rest(R), rest(L)]);
}

/* ---------- шаг: капли ангостуры на пену ---------- */
async function stepDrops(st) {
  const G = SHOW.glassV, n = st[1] || 3;
  await jiggerPark();
  if (!G || !G.foam) return;
  const F = G.foam;
  shot("top", mouth(G, -.01), 1);
  const b = await bottleUp("bitters", `${n} капли на пену`);
  const top = V3(0, b.userData.top, 0), q = Qz(-2.4);
  follow(mouth(G, -.01));
  bt.look = mouth(G);
  const spots = DROP_X.slice(0, n);
  for (let i = 0; i < spots.length; i++) {
    F.updateMatrixWorld(true);
    const land = F.localToWorld(V3(spots[i], 1, 0));
    const over = posFor(b, top, land.clone().add(V3(0, .075, 0)), q);
    await move(b, over, { q, dur: i ? .26 : .45, arc: i ? 0 : .03 });
    await ws(.12);
    await move(b, over.clone().add(V3(0, -.012, 0)), { dur: .08, e: ease.in });
    const d = mesh(new THREE.SphereGeometry(.0028, 10, 8), EGG.dropM.clone(), 0, 0, 0);
    d.material.map = null; d.material.color.set(0x5a160c); d.material.transparent = false; d.material.depthWrite = true;
    b.localToWorld(d.position.copy(top));
    tween(d.position, { x: land.x, y: land.y, z: land.z }, SHOW.fast ? .001 : .2, ease.in).then(() => { drop(d); (F.userData.drops = F.userData.drops || []).push(addDrop(F, spots[i], G.scale, .6)); });
    await move(b, over, { dur: .14, e: ease.out });
    await ws(.18);
  }
  cardLayer(new THREE.Color(0x5a1a0c), 4);
  await ws(.35);
  await bottleDown(b);
  await ws(.35);
}

/* ---------- вишня садится на пену позади капель ---------- */
{
  const base = stepGarnish;
  stepGarnish = async c => {
    const G = SHOW.glassV;
    if (!G || !G.foam || !eggy(c) || c.garnish !== "cherry") return base(c);
    const R = bt.R, F = G.foam;
    shot(choose(["macro", "low"]), mouth(G, .06));
    bt.look = ST.tray;
    const gm = garnishMesh("cherry");
    place(gm, ST.tray.clone().add(V3(.03, .02, 0)));
    await grip(R, gm, PINCH(V3(0, .012, 0)), .42);
    const m = mouth(G);
    await move(gm, m.clone().add(V3(0, .2, 0)), { dur: .55, arc: .04 });
    bt.look = camera.position;
    follow(m.clone().add(V3(0, .1, 0)));
    await ws(rr(.5, .7));
    bt.look = m;
    F.updateMatrixWorld(true);
    const seat = F.localToWorld(V3(0, .96, -.56)).add(V3(0, .011 * .55, 0));
    await move(gm, seat.clone().add(V3(0, .05, 0)), { q: Qz(.12), dur: .45, e: ease.io });
    await move(gm, seat, { dur: .5, e: ease.out });
    SND.plop();
    letGo(R, "open");
    G.g.attach(gm);
    const t = F.scale.y, top = F.position.y + t * .3;
    gm.userData.dy = gm.position.y - (top + t * .7);
    (G.ride = G.ride || []).push(gm);
    await ws(.3);
    await rest(R);
  };
}

/* если шоу пропустили: капли на пене, вишня поверх пены */
function eggFinish(glass, foam, topY, r, c) {
  const hearts = !!c && (PROGS()[c.id] || []).some(st => st[0] === "hearts");
  DROP_X.forEach(x => { const d = addDrop(foam, x, 1.35); if (hearts) toHeart(d, 0); });
  const ch = glass.children.find(o => o.geometry && o.geometry.type === "SphereGeometry" && Math.abs((o.geometry.parameters.radius || 0) - .012) < 1e-6);
  if (ch) ch.position.set(0, topY + .012 * .45, -.56 * r);
}

/* шаги в общей программе, подписи и строки карточки */
/* ---------- шаг: шпажкой через капли — три сердечка ----------
   Бармен ведёт тонкую деревянную шпажку одной линией через середины капель: каждая капля
   вытягивается хвостиком по ходу шпажки и становится сердечком. */
EGG.heartTex = canvasTex(128, 128, (g, w, h) => {
  // сердечко остриём вправо (+x): лопасти слева, хвостик справа
  g.save(); g.translate(w / 2, h / 2);
  g.shadowColor = "rgba(120,40,22,.55)"; g.shadowBlur = 7;
  g.beginPath();
  for (let i = 0; i <= 96; i++) {
    const t = i / 96 * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const X = -y * 2.9 + 4, Y = x * 2.9;
    i ? g.lineTo(X, Y) : g.moveTo(X, Y);
  }
  g.closePath();
  const r = g.createRadialGradient(-12, 0, 0, -6, 0, 54);
  r.addColorStop(0, "rgba(84,18,10,1)"); r.addColorStop(.7, "rgba(100,26,14,.97)"); r.addColorStop(1, "rgba(130,44,24,.9)");
  g.fillStyle = r; g.fill();
  g.restore();
});
EGG.heartM = std({ map: EGG.heartTex, transparent: true, depthWrite: false, roughness: .3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
EGG.protoHeart = mesh(EGG.dropGeo, EGG.heartM, 0, -10, 0); EGG.protoHeart.visible = false;
EGG.pickM = std({ color: 0xd9bf8e, roughness: .6 });
/* капля превращается в сердечко: вытягивается по линии шпажки */
function toHeart(d, dur = .28) {
  const s = d.scale.z;
  d.material = EGG.heartM;
  d.rotation.y = 0;
  if (dur <= 0 || SHOW.fast) { d.scale.set(s * 2, 1, s * 1.7); return; }
  d.scale.set(s * 1.05, 1, s);
  tween(d.scale, { x: s * 2, z: s * 1.7 }, dur, ease.out);
}
async function stepHearts() {
  const G = SHOW.glassV, R = bt.R;
  await jiggerPark();
  if (!G || !G.foam || !(G.foam.userData.drops || []).length) return;
  const F = G.foam, drops = F.userData.drops.slice().sort((a, b) => a.position.x - b.position.x);
  // шпажка: тонкая палочка, остриё в начале координат
  const pick = new THREE.Group();
  const geo = new THREE.CylinderGeometry(.0015, .0003, .085, 6); geo.translate(0, .0425, 0);
  mesh(geo, EGG.pickM, 0, 0, 0, pick);
  world.add(pick);
  const q = Qz(.42);
  place(pick, ST.tray.clone().add(V3(.02, .03, 0)), q);
  shot("top", mouth(G, -.01), 1);
  bt.look = ST.tray;
  await grip(R, pick, PINCH(V3(0, .062, 0)), .4);
  F.updateMatrixWorld(true);
  const at = x => F.localToWorld(V3(x, 1 - .08 * Math.abs(x) + .02, 0));
  follow(mouth(G, -.01));
  bt.look = mouth(G);
  await move(pick, posFor(pick, V3(), at(-.62).add(V3(0, .04, 0)), q), { dur: .6, arc: .03 });
  await ws(.15);
  await move(pick, posFor(pick, V3(), at(-.62), q), { dur: .22, e: ease.out });
  // одна ровная линия через все капли
  const done = new Set();
  await waitTicks(2, k => {
    const x = -.62 + 1.24 * ease.io(k);
    F.updateMatrixWorld(true);
    pick.position.copy(posFor(pick, V3(), at(x), q));
    for (const d of drops) if (!done.has(d) && x > d.position.x - .06) { done.add(d); toHeart(d); }
  });
  for (const d of drops) if (!done.has(d)) toHeart(d, 0);
  await move(pick, posFor(pick, V3(), at(.62).add(V3(0, .05, 0)), q), { dur: .25, e: ease.out });
  bt.look = null;
  await move(pick, B(.14, TOP() - .3, .16), { dur: .5, e: ease.in, arc: .02 });
  letGo(R);
  drop(pick);
  await rest(R);
  await ws(.4);
}
Object.assign(STEP, { egg: stepEgg, drops: stepDrops, hearts: stepHearts });
{
  const base = stepCaption;
  stepCaption = (st, c) => {
    if (st[0] === "egg") return "Яичный белок: желток остаётся в скорлупе";
    if (st[0] === "shake" && st[1] === "dry") return "Сухой шейк без льда — белок взбивается в пену";
    if (st[0] === "ice" && st[1] === "tin" && eggy(c)) return "Теперь лёд — и второй шейк, чтобы охладить";
    if (st[0] === "drops") return "Три капли ангостуры на белую пену";
    if (st[0] === "hearts") return "Шпажкой одной линией через капли — три сердечка";
    if (st[0] === "garnish" && eggy(c) && c.garnish === "cherry") return "Вишня ложится на пену";
    return base(st, c);
  };
}
{
  const base = cardRow;
  cardRow = (st, c) => {
    if (st[0] === "egg") return { name: "Яичный белок", amt: `${st[1] || 20} мл`, col: "#f1ecd8" };
    if (st[0] === "shake" && st[1] === "dry") return { name: "Сухой шейк", amt: "без льда", tech: true };
    if (st[0] === "hearts") return { name: "Сердечки", amt: "шпажкой", tech: true };
    if (st[0] === "drops") return { name: NOM.bitters, amt: `${st[1] || 3} капли на пену`, col: "#" + liqOf("bitters").getHexString() };
    return base(st, c);
  };
}
Object.assign(H3D, { served: () => servedGlass });

/* ================= платформа заведений в 3D: места для брони, колода у камина, спешл недели на стойке,
   строчка в углях для квеста, бокал «для вас» от друга. Данные — src/venues/<бар>.js, интерфейс — src/shared/97-venue.js ================= */

/* ---------- маркеры мест: латунное кольцо на сиденье и ромбик над ним ---------- */
const SEAT_MARKS = [];
(() => {
  const ringMat = std({ color: 0xd6aa5c, metalness: 1, roughness: .3, emissive: 0x6a4010, emissiveIntensity: .6 });
  const gemMat = std({ color: 0xffd8a0, metalness: .6, roughness: .25, emissive: 0xd6902a, emissiveIntensity: 1.1 });
  for (const s of VX_SEATS) {
    const g = group(s.pos[0], s.pos[1], s.pos[2]);
    const ring = mesh(new THREE.TorusGeometry(.15, .007, 8, 40), ringMat, 0, .01, 0, g);
    ring.rotation.x = Math.PI / 2;
    const gem = mesh(new THREE.OctahedronGeometry(.032, 0), gemMat, 0, .34, 0, g);
    gem.scale.set(1, 1.5, 1);
    glowSprite(0xffb060, .32, 0, .34, 0, g, .5);
    // невидимая колонна побольше, чтобы попасть пальцем
    mesh(new THREE.CylinderGeometry(.17, .17, .45, 10), basic({ visible: false }), 0, .2, 0, g);
    g.userData.gem = gem; g.userData.ph = R(0, 6);
    g.visible = false;
    hot(g, s.zone, `Бронь: ${s.name}`, () => vxBook(s.id), { grow: .12 });
    SEAT_MARKS.push(g);
  }
  onTick((t, dt) => {
    for (const g of SEAT_MARKS) if (g.visible && !STILL) { const k = g.userData.gem; k.position.y = .34 + Math.sin(t * 1.6 + g.userData.ph) * .02; k.rotation.y += dt * .8; }
  });
})();
H3D.seats = () => {
  const on = vxO2O();
  for (const g of SEAT_MARKS) { g.visible = on; g.userData.hot.hidden = !on; }   // без брони у гостя нет и кнопок «Бронь: …» внизу
  if (typeof renderZoneUI === "function" && started) renderZoneUI(curZone);
};
H3D.seats();

/* ---------- афиша вечера: латунный стенд с ближайшим событием (VENUE.events) ----------
   Место задаёт заведение: VENUE.eventStand = { pos: [x, z], rot, zone, kind }; kind: "counter" — рама на стойке (по умолчанию,
   видна и на телефоне), "floor" — напольный мольберт для зала, где у входа есть место. */
const EVENT_STAND = (() => {
  const ev = vxNextEvent();
  if (!ev) return null;
  const S = Object.assign({ pos: [-.85, -2.25], rot: .14, zone: 1, kind: "counter" }, VENUE.eventStand || {});
  const ac = vxAccent(ev), F = VENUE.theme.fonts;
  const poster = canvasTex(512, 720, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#2a0c12"); bg.addColorStop(1, "#0e0406");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = ac; g.lineWidth = 6; g.strokeRect(16, 16, w - 32, h - 32);
    g.globalAlpha = .5; g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60); g.globalAlpha = 1;
    g.textAlign = "center";
    g.fillStyle = "#c2a784"; g.font = `italic 26px ${F.text}, Georgia, serif`; g.fillText("АФИША ВЕЧЕРА", w / 2, 96);
    g.fillStyle = ac; g.font = `34px ${F.display}, Georgia, serif`; g.fillText(vxEventDay(ev), w / 2, 168);
    g.font = `96px ${F.display}, Georgia, serif`; g.fillText(ev.time, w / 2, 280);
    g.fillStyle = "#f1e4cc";
    let size = 64; g.font = `${size}px ${F.display}, Georgia, serif`;
    let lines = vxWrap(g, ev.title, w - 80);
    while (lines.length > 3 && size > 36) { size -= 6; g.font = `${size}px ${F.display}, Georgia, serif`; lines = vxWrap(g, ev.title, w - 80); }
    let y = 380;
    lines.slice(0, 3).forEach(l => { g.fillText(l, w / 2, y); y += size * 1.1; });
    if (ev.lineup) { g.fillStyle = "#d6aa5c"; g.font = `italic 26px ${F.text}, Georgia, serif`; vxWrap(g, ev.lineup, w - 90).slice(0, 3).forEach(l => { y += 36; g.fillText(l, w / 2, y); }); }
    g.fillStyle = "#c2a784"; g.font = `22px ${F.text}, Georgia, serif`; g.fillText("нажмите, чтобы занять стол", w / 2, h - 58);
  });
  const onBar = S.kind !== "floor";
  const g = group(S.pos[0], onBar ? CT.top : 0, S.pos[1]);
  g.rotation.y = S.rot;
  if (onBar) {
    // настольная рама на стойке: латунь, наклон назад, опора сзади
    const frame = group(0, .235, 0, g);
    frame.rotation.x = -.16;
    box(-.175, .175, -.235, .235, -.01, 0, M.brass, frame, 0);
    mesh(new THREE.PlaneGeometry(.32, .45), basic({ map: poster }), 0, 0, .002, frame);
    const leg = mesh(new THREE.BoxGeometry(.02, .42, .008), M.brass, 0, .2, -.07, g);
    leg.rotation.x = .3;
    box(-.18, .18, 0, .012, -.03, .03, M.brass, g, 0);
    glowSprite(0xffc890, .55, 0, .26, .08, g, .1);
  } else {
    // напольный мольберт: три латунные ножки, полка и рама с афишей
    const leg = (x, z, rx, rz) => { const m = mesh(new THREE.CylinderGeometry(.011, .014, 1.72, 8), M.brass, x, .84, z, g); m.rotation.set(rx, 0, rz); };
    leg(-.3, .02, -.1, -.1); leg(.3, .02, -.1, .1); leg(0, -.3, .32, 0);
    box(-.36, .36, .9, .93, -.02, .07, M.brass, g, 0);
    const frame = group(0, 1.29, .02, g);
    frame.rotation.x = -.1;
    box(-.3, .3, -.4, .4, -.012, 0, M.brass, frame, 0);
    mesh(new THREE.PlaneGeometry(.54, .76), basic({ map: poster }), 0, 0, .002, frame);
    glowSprite(0xffc890, .9, 0, 1.34, .14, g, .12);
  }
  hot(g, S.zone, `Афиша: ${ev.title}`, () => vxEvent(ev), { grow: .04 });
  return { g, ev };
})();

/* ---------- колода вопросов на столике у камина ---------- */
(() => {
  if (!VENUE.deck) return;
  const back = canvasTex(256, 352, (g, w, h) => {
    g.fillStyle = "#3a0e16"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#d6aa5c"; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24);
    g.lineWidth = 2; g.strokeRect(26, 26, w - 52, h - 52);
    g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4); g.strokeRect(-44, -44, 88, 88); g.restore();
    g.fillStyle = "#d6aa5c"; g.font = "86px Forum, Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(VENUE.meta.name.charAt(0), w / 2, h / 2 + 4);
  });
  // столик курилки (центр в 6.05, край у кресел); нет курилки — колода лежит на стойке
  const deck = FEAT.smoke ? group(FP.x - 1.93 - .17, .481, FP.z + .06) : group(1.82, CT.top, -2.22);
  deck.rotation.y = FEAT.smoke ? .5 : -.35;
  const edge = std({ color: 0xe9dfcb, roughness: .8 });
  mesh(new THREE.BoxGeometry(.066, .024, .092), [edge, edge, std({ map: back, roughness: .55 }), edge, edge, edge], 0, .012, 0, deck);
  // верхняя карта чуть сдвинута — видно, что это колода
  const top = mesh(new THREE.PlaneGeometry(.066, .092), std({ map: back, roughness: .55 }), .006, .0255, -.004, deck);
  top.rotation.set(-Math.PI / 2, 0, .08);
  hot(deck, FEAT.smoke ? 2 : 1, "Колода вопросов", () => vxDeck(), { grow: .12 });
})();

/* ---------- спешл недели: табличка-домик на стойке ---------- */
(() => {
  const sp = vxSpecial();
  if (!sp) return;
  const tex = canvasTex(320, 220, (g, w, h) => {
    g.fillStyle = "#1c070b"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#d6aa5c"; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 1.5; g.strokeRect(18, 18, w - 36, h - 36);
    g.textAlign = "center"; g.fillStyle = "#c2a784"; g.font = "italic 24px Literata, Georgia, serif";
    g.fillText("Спешл недели", w / 2, 62);
    g.fillStyle = "#f1e4cc";
    let size = 54; g.font = `${size}px Forum, Georgia, serif`;
    while (g.measureText(sp.name).width > w - 50 && size > 28) { size -= 4; g.font = `${size}px Forum, Georgia, serif`; }
    g.fillText(sp.name, w / 2, 130);
    g.fillStyle = "#d6aa5c"; g.fillRect(w / 2 - 40, 156, 80, 2);
    g.fillStyle = "#c2a784"; g.font = "20px Literata, Georgia, serif"; g.fillText("спросите у бармена", w / 2, 188);
  });
  // если на этом месте стоит рама с афишей (по умолчанию так), табличка спешла отходит левее
  const tent = group(vxNextEvent() && !(VENUE.eventStand && VENUE.eventStand.kind === "floor") ? -1.55 : -.82, CT.top, -2.17);
  tent.rotation.y = .22;
  const face = std({ map: tex, roughness: .6 }), backMat = std({ color: 0x1c070b, roughness: .7 });
  for (const s of [1, -1]) {
    const p = mesh(new THREE.PlaneGeometry(.16, .11), s > 0 ? face : backMat, 0, .052, s * .018, tent);
    p.rotation.x = -s * .33;
    if (s < 0) p.rotation.y = Math.PI;
  }
  mesh(new THREE.BoxGeometry(.16, .004, .004), M.brass, 0, .104, 0, tent);
  hot(tent, 1, `Спешл недели: ${sp.name}`, () => openCard(sp, { info: true }), { grow: .1 });
})();

/* ---------- квест: камин показывает рецепт строчкой в углях ---------- */
const EMBER_WORDS = (() => {
  const tex = canvasTex(512, 96, (g, w, h) => {
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = "italic 40px Literata, Georgia, serif";
    g.shadowColor = "#ff7a20"; g.shadowBlur = 18; g.fillStyle = "#ffcf8a";
    g.fillText("джин · вермут · вишня · горечь", w / 2, h / 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.position.set(FP.x - .55, .62, FP.z);
  s.scale.set(.9, .17, 1);
  s.visible = false;
  world.add(s);
  return { s, t: -1 };
})();
onTick((t, dt) => {
  const E = EMBER_WORDS;
  if (E.t < 0) return;
  E.t += dt;
  E.s.material.opacity = clamp(Math.min(E.t / 1.2, (7 - E.t) / 1.5), 0, .95) * (.85 + Math.sin(E.t * 9) * .08);
  if (E.t > 7) { E.t = -1; E.s.visible = false; }
});
(() => {
  const fp = FEAT.smoke && HOT.find(h => h.userData.hot.zone === 2 && (h.userData.hot.label === "Подбросить дров" || h.userData.hot.label === "Свечи в камине"));
  if (!fp) return;
  const act = fp.userData.hot.act;
  fp.userData.hot.act = () => {
    act();
    if (vxQuestEmber()) { FIRE.boost = 2.2; EMBER_WORDS.s.visible = true; EMBER_WORDS.t = 0; }
  };
})();

/* ---------- бокал от друга: стоит у свободного табурета с табличкой «Для вас» ---------- */
const TREAT = { glass: null, card: null, armed: !!VX.treat, wait: 0 };
function treatClear() {
  for (const o of [TREAT.glass, TREAT.card]) if (o) drop(o);
  TREAT.glass = TREAT.card = null;
}
H3D.treatClear = treatClear;
onTick((t, dt) => {
  // бармен шепчет состав легенды, когда гость после камина приходит к стойке
  if (curZone === 1 && VX.quest === 2 && !VX.questTold && !busy && !BT.busy && !STREET.on && started) {
    const line = vxQuestBar();
    if (line) btLine(line, 8, true);
  }
  if (!TREAT.armed) return;
  const intro = document.querySelector(".intro");
  if (!started || STREET.on || busy || BT.busy || (intro && !intro.classList.contains("gone"))) return;
  TREAT.wait += dt;
  if (TREAT.wait < 1.2) return;
  TREAT.armed = false;
  (curZone === 1 ? Promise.resolve() : goZone(1)).then(() => {
    const c = vxTreatArrive();
    if (!c) return;
    treatClear();
    const x = SEAT_X + .1, z = -2.15;
    TREAT.glass = makeGlass(c.cup, c.pour, { garnish: c.garnish, ice: c.cup === "rocks" || c.cup === "highball", op: c.pourOp || .88 });
    TREAT.glass.position.set(x, CT.top, z);
    TREAT.glass.scale.setScalar(1.35);
    world.add(TREAT.glass);
    const tex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = "#efe4cc"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#a07a3a"; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = "#4a1a12"; g.textAlign = "center"; g.font = "italic 34px Literata, Georgia, serif"; g.fillText("Для вас", w / 2, 60);
      g.font = "20px Literata, Georgia, serif"; g.fillStyle = "#6a4a3a"; g.fillText("оставили коктейль", w / 2, 96);
    });
    TREAT.card = group(x + .2, CT.top, z + .02);
    TREAT.card.rotation.y = -.3;
    const p = mesh(new THREE.PlaneGeometry(.12, .06), std({ map: tex, roughness: .8 }), 0, .03, 0, TREAT.card);
    p.rotation.x = -.35;
  });
});

/* ---------- наклон телефона: лёгкий параллакс без разрешений (Android и браузеры, где датчик открыт) ---------- */
(() => {
  if (STILL || !("DeviceOrientationEvent" in window) || typeof DeviceOrientationEvent.requestPermission === "function") return;
  let b0 = null, g0 = null;
  addEventListener("deviceorientation", e => {
    if (e.beta == null || e.gamma == null || reduceMotion.matches || SET.saver) { GYRO.on = false; return; }
    if (b0 == null) { b0 = e.beta; g0 = e.gamma; }
    b0 += (e.beta - b0) * .004; g0 += (e.gamma - g0) * .004;   // со временем «ноль» подстраивается под то, как держат телефон
    GYRO.x = clamp((e.gamma - g0) / 25, -1, 1);
    GYRO.y = clamp((e.beta - b0) / 25, -1, 1);
    GYRO.on = true;
  }, { passive: true });
})();

/* ---------- для проверок: нажать предмет зала по подписи, узнать состояние маркеров и углей ---------- */
H3D.press = (zone, re) => { const h = HOT.find(o => o.userData.hot.zone === zone && new RegExp(re, "i").test(o.userData.hot.label)); if (h) h.userData.hot.act(); return h ? h.userData.hot.label : null; };
H3D.venue = () => ({ seats: SEAT_MARKS.filter(g => g.visible).length, ember: EMBER_WORDS.s.visible, treat: !!TREAT.glass });

/* ================= прогрев: все шейдеры собираются до входа, а не во время прогулки =================
   Видеокарта компилирует программу для каждого материала при первой встрече с ним — это и были
   подвисания в начале. Теперь всё, включая скрытые залы, реквизит шоу, тени и постобработку,
   собирается здесь, пока гость смотрит на заставку. */
(async () => {
  const hidden = [];
  scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  try {
    if (renderer.compileAsync && renderer.extensions.has("KHR_parallel_shader_compile")) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
  } catch (e) { console.warn("прогрев:", e && e.message); }
  hidden.forEach(o => { o.visible = false; });
  progress(.95);
  // проходы постобработки и карта теней: один кадр со всеми эффектами под заставкой
  try {
    const wasAp = POST.ap, wasTarget = POST.target;
    if (POST.tier === 2) { POST.target = V3(0, 1.3, -2.4); POST.ap = POST.apWant = .001; }
    if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
    POST.render(0);
    POST.ap = wasAp; POST.apWant = 0; POST.target = wasTarget;
    POST.render(0);
  } catch (e) { console.warn("прогрев эффектов:", e && e.message); }
  keepAll();   // всё построенное к этому моменту — общие детали: drop() их не освобождает
  WARM_DONE = true;
  progress(1);
  if (!closedNow && !started) { enter.disabled = false; if (document.activeElement === document.body) enter.focus({ preventScroll: true }); }
})();
