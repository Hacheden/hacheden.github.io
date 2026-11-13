#!/usr/bin/env python3
"""Собирает index.html: шаблон src/page.html + общие части из src/shared/ и src/venues/
+ 3D-сцена: движок src/js/*.js и залы заведения src/venues/<id>/rooms/*.js,
склеенные по порядку имён файлов (номер в имени задаёт место зала среди файлов движка).

Hacheden — флагман: его сцена встроена в index.html, как и раньше.
Заведение со своими залами (папка src/venues/<id>/rooms) получает отдельный бандл venues/<id>/scene.js;
index.html грузит его вместо встроенной сцены, когда открыт ?bar=<id>. Так геометрия разных баров
не пересекается: в каждом бандле — движок и залы только одного заведения.
Если у заведения нет зала, который есть у Hacheden (например, сцены или погреба), вместо него
подставляется заглушка из src/stubs/ с тем же именем; без заглушки зал обязателен."""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
S = ROOT / "src"
read = lambda p: p.read_text(encoding="utf-8")
FLAGSHIP = "hacheden"
IMPORT = re.compile(r'^import [^;]+ from "[^"]+";\n', re.M)


def scene_files(vid):
    """Файлы сцены заведения: движок + его залы (+ заглушки вместо отсутствующих залов), по имени."""
    files = {p.name: p for p in (S / "js").glob("*.js")}
    own = {p.name: p for p in (S / "venues" / vid / "rooms").glob("*.js")}
    clash = set(own) & set(files)
    assert not clash, f"{vid}: зал и файл движка с одним именем: {sorted(clash)}"
    files.update(own)
    if vid != FLAGSHIP:
        for p in (S / "venues" / FLAGSHIP / "rooms").glob("*.js"):
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


# заведения со своими залами (кроме флагмана) — отдельные бандлы
own_scenes = sorted(d.name for d in (S / "venues").iterdir()
                    if d.is_dir() and d.name != FLAGSHIP and (d / "rooms").is_dir())
for vid in own_scenes:
    imp, code = scene(vid)
    out = ROOT / "venues" / vid / "scene.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(f"/* собрано tools/build.py — не править руками; исходники: src/js и src/venues/{vid}/rooms */\n" + imp + code, encoding="utf-8")
    print(f"venues/{vid}/scene.js", out.stat().st_size, "bytes")

imp, code = scene(FLAGSHIP)
# встроенная сцена флагмана; если у выбранного бара свой бандл — грузится он
module = imp + "if (SCENE_EXT) await import(SCENE_EXT);\nelse {\n" + code + "\n}\n"

# общие модули: 0x-*.js до shared.js (настройки, звук), 9x-*.js после (плеер, журнал, читальня)
mods = sorted((S / "shared").glob("[0-9]*.js"))
venues = [read(p) for p in sorted((S / "venues").glob("*.js"))]   # заведения: данные бара, палитра, места
bundles = f"  const SCENE_BUNDLES = {own_scenes!r};   /* заведения со своими залами (tools/build.py) */\n".replace("'", '"')
shared = "\n".join([read(p) for p in mods if p.name < "5"] + [bundles] + venues + [read(S / "shared" / "shared.js")] + [read(p) for p in mods if p.name >= "5"])
out = (read(S / "page.html")
       .replace("/*@@CSS@@*/", read(S / "shared" / "style.css"))
       .replace("<!--@@BUTTONS@@-->", read(S / "shared" / "buttons.html"))
       .replace("<!--@@HTML@@-->", read(S / "shared" / "dialogs.html"))
       .replace("/*@@SHARED@@*/", shared)
       .replace("/*@@SCENE@@*/", module))
assert "@@" not in out, re.findall(r".{20}@@.{20}", out)
(ROOT / "index.html").write_text(out, encoding="utf-8")
print("index.html", len(out.encode()), "bytes")
