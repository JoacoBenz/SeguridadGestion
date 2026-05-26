"""Genera los PDF INTERNOS de Bexovar (no enviar al cliente).

Uso:  .pdfvenv/bin/python scripts/build_pdfs.py
Salida: pdf/
"""

from pathlib import Path

from _pdfkit import ROOT, build_pdf

DOCS = ROOT / "docs"
OUT = ROOT / "pdf"

KICKER = "Interno · PaqueteOK"

# filename -> (título de portada, subtítulo)
META = {
    "03-presupuesto.md": (
        "Presupuesto interno",
        "Horas, tarifas, costos y márgenes del proyecto",
    ),
    "08-estrategia-comercial.md": (
        "Estrategia comercial",
        "A quién le vendemos, cómo y con qué anclajes",
    ),
    "09-proceso-comercial-y-entrega.md": (
        "Proceso comercial y de entrega",
        "Embudo con compuertas y cobros atados a entregas",
    ),
    "10-gastos-granular.md": (
        "Gastos — desglose granular",
        "Implementación, operación, impuestos y márgenes netos",
    ),
}


def main() -> None:
    print("Internos →", OUT.relative_to(ROOT))
    for name, (title, subtitle) in META.items():
        md = DOCS / name
        if not md.exists():
            print(f"  ! falta {name}")
            continue
        out = OUT / (md.stem + ".pdf")
        build_pdf(md, out, KICKER, title, subtitle)


if __name__ == "__main__":
    main()
