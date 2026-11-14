#!/usr/bin/env python3
"""Собирает сайт платформы: index.html и отдельные модули заведений в venues/.

index.html = шаблон src/page.html + общие части (src/shared/) + флагман Hacheden (данные и встроенная 3D-сцена).
Остальные бары в index.html не попадают — страница не растёт, сколько бы их ни было:
  venues/<id>.js        — данные бара (src/venues/<id>/venue.js): название, меню, афиша, сеть, привилегия…
                          Подгружается до общего кода, только когда открыт ?bar=<id>.
  venues/<id>.scene.js  — 3D-сцена бара: движок src/js + его залы src/venues/<id>/rooms (если они есть).
                          Без своих залов бар показывается на сцене базового заведения.

Залы склеиваются с движком по номерам в именах файлов (номер задаёт место зала среди файлов движка).
У бара со своими залами недостающие залы Hacheden заменяются заглушками из src/stubs/ (флаг выключается сам).
Зал Hacheden можно взять как есть, не копируя: перечислите имена файлов в src/venues/<id>/rooms/use.txt."""
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
S = ROOT / "src"
V = S / "venues"
OUT = ROOT / "venues"
read = lambda p: p.read_text(encoding="utf-8")
FLAGSHIP = "hacheden"
ID_RE = re.compile(r"^[a-z0-9-]{3,32}$")
IMPORT = re.compile(r'^import [^;]+ from "[^"]+";\n', re.M)


def scene_files(vid):
    """Файлы сцены заведения: движок + его залы (+ залы флагмана из use.txt, + заглушки вместо остальных), по имени."""
    files = {p.name: p for p in (S / "js").glob("*.js")}
    rooms = V / vid / "rooms" if vid != FLAGSHIP else V / FLAGSHIP / "rooms"
    own = {p.name: p for p in rooms.glob("*.js")}
    use = rooms / "use.txt"
    if vid != FLAGSHIP and use.exists():
        for name in read(use).split():
            src = V / FLAGSHIP / "rooms" / name
            assert src.exists(), f"{vid}/use.txt: у Hacheden нет зала {name}"
            own.setdefault(name, src)
    clash = set(own) & set(files)
    assert not clash, f"{vid}: зал и файл движка с одним именем: {sorted(clash)}"
    files.update(own)
    if vid != FLAGSHIP:
        for p in (V / FLAGSHIP / "rooms").glob("*.js"):
            if p.name in own:
                continue
            stub = S / "stubs" / p.name
            assert stub.exists(), f"{vid}: нет зала {p.name} и нет заглушки src/stubs/{p.name}"
            files[p.name] = stub
    return [files[n] for n in sorted(files)]


def scene(vid):
    """Текст модуля сцены: импорты наверх (по стандарту они и так поднимаются), затем код."""
    code = "\n".join(read(p) for p in scene_files(vid))
    imports = IMPORT.findall(code)
    return "".join(imports), IMPORT.sub("", code)


# старая раскладка (venues/<id>/scene.js) — убрать, чтобы не путалась с новой
if OUT.exists():
    for d in OUT.iterdir():
        if d.is_dir():
            shutil.rmtree(d)
OUT.mkdir(exist_ok=True)

venue_dirs = sorted(d for d in V.iterdir() if d.is_dir() and d.name != FLAGSHIP)
for d in venue_dirs:
    assert ID_RE.match(d.name), f"id заведения {d.name!r}: латиница, цифры и дефис, 3–32 знака"

# данные заведений — отдельные файлы
venue_files = []
for d in venue_dirs:
    if (d / "venue.js").exists():
        out = OUT / f"{d.name}.js"
        out.write_text(f"/* собрано tools/build.py — не править руками; исходник: src/venues/{d.name}/venue.js */\n"
                       + read(d / "venue.js"), encoding="utf-8")
        venue_files.append(d.name)
        print(f"venues/{d.name}.js", out.stat().st_size, "bytes")

# сцены заведений со своими залами
own_scenes = []
for d in venue_dirs:
    if (d / "rooms").is_dir():
        imp, code = scene(d.name)
        out = OUT / f"{d.name}.scene.js"
        out.write_text(f"/* собрано tools/build.py — не править руками; исходники: src/js и src/venues/{d.name}/rooms */\n" + imp + code, encoding="utf-8")
        own_scenes.append(d.name)
        print(f"venues/{d.name}.scene.js", out.stat().st_size, "bytes")
for old in OUT.glob("*.js"):
    if old.name.removesuffix(".scene.js").removesuffix(".js") not in venue_files + own_scenes:
        old.unlink()

imp, code = scene(FLAGSHIP)
# встроенная сцена флагмана; если у выбранного бара свой бандл — грузится он
module = imp + "if (SCENE_EXT) await import(SCENE_EXT);\nelse {\n" + code + "\n}\n"

js = lambda xs: repr(xs).replace("'", '"')
# часть A: реестр и флагман, затем загрузчик данных выбранного бара (обычный <script src>, до части B — как будто он был в странице)
loader = f"""  /* данные выбранного бара (?bar=<id>) — отдельным файлом venues/<id>.js, до общего кода */
  const VENUE_FILES = {js(venue_files)};
  (() => {{
    try {{
      const b = new URLSearchParams(location.search).get("bar");
      if (b && VENUE_ID_RE.test(b) && VENUE_FILES.includes(b)) document.write(`<script src="./venues/${{b}}.js"><\\/script>`);
    }} catch (e) {{}}
  }})();
"""
part_a = "\n".join([read(V / "00-registry.js"), read(V / f"{FLAGSHIP}.js"), loader])
# часть B: общие модули 0x-*.js, выбор бара, shared.js, модули 9x-*.js
mods = sorted((S / "shared").glob("[0-9]*.js"))
bundles = f"  const SCENE_BUNDLES = {js(own_scenes)};   /* заведения со своими залами (tools/build.py) */\n"
tail = sorted(p for p in V.glob("*.js") if p.name not in ("00-registry.js", f"{FLAGSHIP}.js"))   # zz-select.js и т. п.
part_b = "\n".join([read(p) for p in mods if p.name < "5"] + [bundles] + [read(p) for p in tail]
                   + [read(S / "shared" / "shared.js")] + [read(p) for p in mods if p.name >= "5"])
out = (read(S / "page.html")
       .replace("/*@@CSS@@*/", read(S / "shared" / "style.css"))
       .replace("<!--@@BUTTONS@@-->", read(S / "shared" / "buttons.html"))
       .replace("<!--@@HTML@@-->", read(S / "shared" / "dialogs.html"))
       .replace("/*@@SHARED_A@@*/", part_a)
       .replace("/*@@SHARED_B@@*/", part_b)
       .replace("/*@@SCENE@@*/", module))
assert "@@" not in out, re.findall(r".{20}@@.{20}", out)
(ROOT / "index.html").write_text(out, encoding="utf-8")
print("index.html", len(out.encode()), "bytes")
