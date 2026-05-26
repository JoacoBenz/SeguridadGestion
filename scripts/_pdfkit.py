"""Motor compartido de generación de PDF con identidad Bexovar.

Cada PDF se arma con:
  - una portada de marca (banda ink + lockup dark + kicker + título + subtítulo)
  - el contenido del .md convertido a HTML
  - el CSS de marca (cabecera/pie corridos, tablas, diagramas de flujo, etc.)

Convención de los .md: se descarta todo lo previo al primer encabezado `# H1`;
ese H1 da el título por defecto y NO se vuelve a renderizar en el cuerpo (ya está
en la portada). Extensiones de markdown: tables, fenced_code, sane_lists, attr_list.
"""

from __future__ import annotations

import datetime
import re
from pathlib import Path

import markdown
from weasyprint import HTML

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets" / "brand"
LOCKUP_DARK = (BRAND / "bexovar-5a-lockup-dark.svg").resolve()

PROYECTO = "PaqueteOK"

MD_EXTENSIONS = ["tables", "fenced_code", "sane_lists", "attr_list"]

_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def fecha_es(d: datetime.date | None = None) -> str:
    d = d or datetime.date.today()
    return f"{d.day} de {_MESES[d.month - 1]} de {d.year}"


CSS = f"""
@page {{ size:A4; margin:20mm 17mm 18mm;
  @top-right{{content:element(rhead)}}
  @bottom-center{{content:"Bexovar · {PROYECTO}";font-size:7.5pt;color:#94A3B8}}
  @bottom-right{{content:"Pág. " counter(page) " / " counter(pages);font-size:7.5pt;color:#94A3B8}} }}
@page :first{{ @top-right{{content:none}} }}
body{{font-family:"Liberation Sans","DejaVu Sans",sans-serif;font-size:10.5pt;color:#1E293B;line-height:1.45}}
.rhead{{position:running(rhead);font-size:8pt;color:#64748B;letter-spacing:2px;font-weight:700}}
.cover{{background:#0F172A;color:#fff;border-radius:10px;padding:26px 28px;margin-bottom:18px}}
.cover img{{height:30px;display:block;margin-bottom:16px}}
.cover .kicker{{font-size:8.5pt;letter-spacing:3px;text-transform:uppercase;color:#38BDF8;font-weight:700}}
.cover h1{{font-size:26pt;color:#fff;margin:6px 0 8px;border:none;padding:0}}
.cover .sub{{font-size:11pt;color:#CBD5E1}}
.cover .meta{{font-size:8.5pt;color:#94A3B8;border-top:1px solid #1E293B;padding-top:12px;margin-top:16px;display:flex;justify-content:space-between}}
h1.body{{font-size:16pt;color:#0F172A}}
h2{{font-size:14.5pt;color:#0F172A;border-bottom:2px solid #0284C7;padding-bottom:5px;margin-top:18px}}
h3{{font-size:11.5pt;color:#0284C7;margin-bottom:4px}}
p{{margin:6px 0}}
ul,ol{{margin:6px 0 6px 4px}}
li{{margin:2px 0}}
table{{width:100%;border-collapse:collapse;font-size:9pt;margin:10px 0}}
th{{background:#0F172A;color:#fff;text-align:left;padding:7px 9px}}
td{{padding:6px 9px;border:1px solid #E2E8F0}}
tbody tr:nth-child(even){{background:#F1F5F9}}
blockquote{{padding:9px 14px;background:#F0F9FF;border-left:4px solid #0284C7;border-radius:0 6px 6px 0;margin:10px 0}}
code{{background:#F1F5F9;padding:1px 4px;border-radius:3px;font-size:9pt}}
.pagebreak{{break-before:page}}
/* flujo horizontal */
.flow-h{{display:flex;align-items:stretch;margin:14px 0;gap:4px}}
.flow-h .node{{flex:1;background:#F0F9FF;border:1px solid #BAE6FD;border-radius:12px;padding:12px 8px;text-align:center}}
.flow-h .node .num{{display:inline-block;width:26px;height:26px;border-radius:50%;background:#0284C7;color:#fff;font-weight:700;line-height:26px;margin-bottom:7px}}
.flow-h .node .t{{font-weight:700;color:#0F172A;font-size:9.5pt;display:block}}
.flow-h .node .d{{color:#475569;font-size:8pt;display:block;margin-top:3px}}
.flow-h .sep{{flex:0 0 14px;display:flex;align-items:center;justify-content:center}}
.flow-h .sep::after{{content:"";width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid #0284C7}}
/* embudo vertical con compuertas + tags de pago */
.flow-v{{margin:14px 0}}
.flow-v .step{{display:flex;align-items:center;gap:11px;background:#F8FAFC;border:1px solid #E2E8F0;border-left:4px solid #0284C7;border-radius:8px;padding:9px 12px}}
.flow-v .step .num{{flex:0 0 auto;width:25px;height:25px;border-radius:50%;background:#0F172A;color:#fff;font-weight:700;line-height:25px;text-align:center}}
.flow-v .step .body{{flex:1}}
.flow-v .step .ttl{{font-weight:700;color:#0F172A;display:block}}
.flow-v .step .sub{{color:#475569;font-size:8.5pt;display:block}}
.flow-v .step .pay{{flex:0 0 auto;background:#0284C7;color:#fff;font-size:8pt;font-weight:700;padding:3px 9px;border-radius:999px}}
.flow-v .gate{{display:flex;align-items:center;justify-content:center;gap:6px;color:#16A34A;font-size:8.5pt;font-weight:700;padding:4px 0}}
.flow-v .gate::before{{content:"";width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #16A34A}}
/* arquitectura por capas */
.arch .row{{display:flex;gap:8px;justify-content:center}}
.arch .card{{flex:1;background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:11px;text-align:center;font-size:9pt}}
.arch .hub{{background:#0F172A;color:#fff;border:none;flex:0 0 60%;font-weight:700}}
.arch .down{{display:flex;justify-content:center;padding:5px 0}}
.arch .down::after{{content:"";width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #0284C7}}
"""

_H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)


def split_h1(md_text: str) -> tuple[str | None, str]:
    """Devuelve (titulo_del_H1, cuerpo_posterior_al_H1).

    Descarta todo lo previo al primer H1 y el propio H1 (va en la portada).
    """
    m = _H1_RE.search(md_text)
    if not m:
        return None, md_text
    title = m.group(1).strip()
    body = md_text[m.end():].lstrip("\n")
    return title, body


def cover_html(kicker: str, title: str, subtitle: str) -> str:
    return f"""
    <div class="cover">
      <img src="file://{LOCKUP_DARK}" alt="Bexovar"/>
      <div class="kicker">{kicker}</div>
      <h1>{title}</h1>
      <div class="sub">{subtitle}</div>
      <div class="meta"><span>Preparado por Bexovar</span><span>{fecha_es()}</span></div>
    </div>
    <div class="rhead">{PROYECTO.upper()}</div>
    """


def build_pdf(md_path: Path, out_path: Path, kicker: str, title: str, subtitle: str) -> None:
    raw = md_path.read_text(encoding="utf-8")
    h1_title, body_md = split_h1(raw)
    final_title = title or h1_title or md_path.stem
    body_html = markdown.markdown(body_md, extensions=MD_EXTENSIONS)
    html = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"></head>
    <body>{cover_html(kicker, final_title, subtitle)}{body_html}</body></html>"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    HTML(string=html, base_url=str(ROOT)).write_pdf(
        out_path, stylesheets=[__import__("weasyprint").CSS(string=CSS)]
    )
    print(f"  ✓ {out_path.relative_to(ROOT)}")
