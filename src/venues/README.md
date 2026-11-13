# Заведения

Движок — `src/js/` (общий для всех баров). Всё, что отличает бар, — здесь.

## Новый бар
1. **Только данные** (тот же 3D-зал Hacheden, своё название, цены, контакты): файл `src/venues/<id>.js` с
   `VENUE_PATCHES.push({ id, base: "hacheden", make: base => ({ meta, menu, features, … }) })` — пример `demo-almaty.js`.
2. **Свои залы**: папка `src/venues/<id>/rooms/` с файлами залов под теми же номерами, что у Hacheden.
   `tools/build.py` соберёт для бара отдельный бандл `venues/<id>/scene.js` (движок + только его залы), и `?bar=<id>` загрузит его вместо встроенной сцены Hacheden.
   Нет сцены или погреба — не кладите файл: сборка подставит заглушку из `src/stubs/`, флаг выключится сам.

id бара: `^[a-z0-9-]{3,32}$` (это же имя комнаты живого бара и раздела статистики в Firebase).

## Флаги возможностей (`features`)
`cellar`, `stage`, `bartenderShow`, `booking`, `quests`, `liveBar` — по умолчанию включены.
Выключенное движок не показывает и не запускает: скрыты кнопка «Сцена» и вход в погреб, напиток подаётся без шоу, нет брони и пропуска, квеста и живого бара.

## Что залы обязаны дать движку
| Файл | Имена |
|---|---|
| `20-room.js` | `ROOM` (границы зала), `FILL_AT` (точки заполняющего света по залам), `W` (материалы стен), `floor`, свет через `point()` (`pendL/C/R`, `red`, `fire`, `lamp`, `window`, `fill`) |
| `30-bar.js` | `CT` (стойка), `BB` (задняя стенка), `heroes`, `neon`, `neonMat`, `neonTex`, `neonGlow`, `BACKLIT`, `pendants`, `STATIC_TOOLS` |
| `50-nook.js` | `NOOK`, `WIN`, `SECRET`, `rainMat`, `lightning`, `moth`, `toggleCandle` |
| `66-stage.js` | `BANDH`, `BAND_HERE`, `MUS`, `STG` (или заглушка) |
| `67-cellar.js` | `CEL`, `SOM`, `cellarCross` (или заглушка) |
| `69-street.js` | `STREET`, `street`, `streetIntro`, `streetLights`, `streetTalk`, `SHOT`, `SDOOR`, `doorway`, `FZ`, `GREET`, `PREC`, `greeted` |

Набор деталей для залов (материалы `M`, свет `point()`/`LIGHTS`, бутылки `BOTTLE`/`BGEO`, бокалы `CUPS`/`makeGlass`, затемнение `fade`) — `src/js/19-kit.js`; подача напитка на стойку — `src/js/31-serve.js`.
