#!/usr/bin/env python3
"""Собирает index.html: шаблон src/page.html + общие части из src/shared/
(данные напитков, карточки, музыка, книга рецептов, крупный план, барная карта)
+ 3D-сцена из src/js/*.js (склеиваются по порядку имён)."""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
S = ROOT / "src"
read = lambda p: p.read_text(encoding="utf-8")
scene = "\n".join(read(p) for p in sorted((S / "js").glob("*.js")))
# общие модули: 0x-*.js до shared.js (настройки, звук), 9x-*.js после (плеер, журнал, читальня)
mods = sorted((S / "shared").glob("[0-9]*.js"))
venues = [read(p) for p in sorted((S / "venues").glob("*.js"))]   # заведения: данные бара, палитра, места
shared = "\n".join([read(p) for p in mods if p.name < "5"] + venues + [read(S / "shared" / "shared.js")] + [read(p) for p in mods if p.name >= "5"])
out = (read(S / "page.html")
       .replace("/*@@CSS@@*/", read(S / "shared" / "style.css"))
       .replace("<!--@@BUTTONS@@-->", read(S / "shared" / "buttons.html"))
       .replace("<!--@@HTML@@-->", read(S / "shared" / "dialogs.html"))
       .replace("/*@@SHARED@@*/", shared)
       .replace("/*@@SCENE@@*/", scene))
assert "@@" not in out, re.findall(r".{20}@@.{20}", out)
(ROOT / "index.html").write_text(out, encoding="utf-8")
print("index.html", len(out.encode()), "bytes")
