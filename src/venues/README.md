# Заведения

Движок — `src/js/` (общий для всех баров). Всё, что отличает бар, — здесь.
Флагман Hacheden встроен в `index.html`; остальные бары собираются в отдельные файлы и грузятся только по своему адресу
`?bar=<id>`, так что главная страница не растёт, сколько бы баров ни подключилось.

## Новый бар
Папка `src/venues/<id>/` (id: `^[a-z0-9-]{3,32}$` — это же имя комнаты живого бара и раздела статистики в Firebase):

1. `venue.js` — данные бара. На основе Hacheden: `VENUE_PATCHES.push({ id, base: "hacheden", make: base => ({ meta, menu, rooms, features, events, network, … }) })`,
   пример — `demo-almaty/venue.js`. Сборка кладёт его в `venues/<id>.js`; страница подгружает этот файл до общего кода, только когда открыт `?bar=<id>`.
2. `rooms/` — свои залы (необязательно). Файлы под теми же номерами, что у Hacheden; зал Hacheden можно взять без копирования —
   имя файла в `rooms/use.txt`. Сборка делает `venues/<id>.scene.js` (движок + только залы этого бара).
   Каких залов нет — сборка подставит заглушки из `src/stubs/`, флаг выключится сам. Минимум — зал и стойка:
   `demo-almaty/rooms/20-room.js` (камерная комната) + `use.txt` → `30-bar.js`.
   Без папки `rooms` бар показывается на 3D-сцене базового заведения.

После правок — `python3 tools/build.py`.

## Данные бара
- `meta`: `name`, `sign`, `slogan`, `intro` (текст на заставке), `city`, `district`, `address`, `hours`, `site`,
  `contacts` (`whatsapp` — номер без «+», `telegram` — имя без «@»), `currency`, `codePrefix` (префикс кода пропуска), `privilege`, `demo`.
- `rooms`: залы с `id` (`reading`, `bar`, `smoking`, `stage`), звуком и местами для брони.
- `events`: афиша — `{ title, date: "гггг-мм-дд", time: "чч:мм", lineup, desc, accent: "#rrggbb" }`. Ближайшее событие стоит в зале
  латунной рамой; по нажатию — карточка с «Занять стол на этот вечер» и «Карточка в сторис». `eventStand: { pos: [x, z], rot, zone, kind }` —
  куда её поставить (`kind: "counter"` — на стойку, `"floor"` — напольный мольберт).
- `network`: бары сети `{ id, name, tagline, district }` — футляр со спичечными коробками (кнопка в правом столбце), переход в один клик.
- `privilege`: что даёт барный пропуск. Код пропуска (`codePrefix` + номер) один на браузер гостя: он стоит в заявке на бронь и в карточке
  фирменного или авторского коктейля — хостес и бармен отмечают гостей, пришедших с платформы.

## Флаги возможностей (`features`)
`street`, `nook`, `smoke`, `stage`, `cellar` — залы (улица перед входом, читальня, курилка, сцена, погреб);
`bartenderShow`, `booking`, `quests`, `liveBar` — механики. По умолчанию всё включено; заглушка зала выключает свой флаг сама.
Выключенное движок не показывает и не запускает: скрыты кнопки залов (остался один бар — нет и переключателя), без улицы гость входит
сразу в зал, напиток подаётся без шоу, нет брони и пропуска, квеста и живого бара.

## Что залы обязаны дать движку
| Файл | Имена |
|---|---|
| `20-room.js` | `ROOM` (границы зала), `FILL_AT` (точки заполняющего света по залам), `W` (`nook`, `bar`, `smoke`), `floor`, свет через `point()` (`pendL/C/R`, `red`, `fire`, `lamp`, `window`, `fill` — все восемь, даже тёмные) |
| `30-bar.js` | `CT` (стойка), `BB` (задняя стенка), `heroes`, `neon`, `neonMat`, `neonTex`, `neonGlow`, `BACKLIT`, `pendants`, `STATIC_TOOLS` |
| `40-smoke.js` | `FIRE`, `FP`, `CAT`, `haze`, `smoke` (или заглушка) |
| `50-nook.js` | `NOOK`, `WIN`, `SECRET`, `rainMat`, `lightning`, `toggleCandle` (или заглушка) |
| `66-stage.js` | `BANDH`, `BAND_HERE`, `MUS`, `STG` (или заглушка) |
| `67-cellar.js` | `CEL`, `SOM`, `cellarCross` (или заглушка) |
| `69-street.js` | `STREET`, `street`, `streetIntro`, `streetLights`, `streetTalk`, `SHOT`, `SDOOR`, `doorway`, `FZ`, `GREET`, `PREC`, `greeted` (или заглушка) |

Набор деталей для залов (материалы `M`, свет `point()`/`LIGHTS`, бутылки `BOTTLE`/`BGEO`, бокалы `CUPS`/`makeGlass`, затемнение `fade`) — `src/js/19-kit.js`;
звуки (`fx`, `crackle`, `knock`) — `src/js/39-sfx.js`; подача напитка на стойку — `src/js/31-serve.js`. Залы обновляют себя сами через `onTick`.
