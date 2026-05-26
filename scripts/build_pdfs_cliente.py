"""Genera los PDF para el CLIENTE (paquete de propuesta de Bexovar).

Uso:  .pdfvenv/bin/python scripts/build_pdfs_cliente.py
Salida: pdf/cliente/
"""

from pathlib import Path

from _pdfkit import ROOT, build_pdf

DOCS = ROOT / "docs" / "cliente"
OUT = ROOT / "pdf" / "cliente"

KICKER = "Propuesta · PaqueteOK"

# filename -> (título de portada, subtítulo)
META = {
    "00-resumen-ejecutivo.md": (
        "Resumen ejecutivo",
        "PaqueteOK para la administración de edificios",
    ),
    "01-propuesta.md": (
        "Propuesta",
        "Digitalizar la gestión de paquetes del edificio",
    ),
    "02-solucion-tecnica.md": (
        "Solución técnica",
        "Cómo está construido PaqueteOK, en lenguaje simple",
    ),
    "05-funcionalidades.md": (
        "Funcionalidades",
        "Todo lo que hace el sistema",
    ),
    "06-como-funciona.md": (
        "Cómo funciona",
        "El recorrido del usuario, paso a paso",
    ),
    "07-plan-de-entrega.md": (
        "Plan de entrega",
        "Etapas, plazos y qué necesitamos de ustedes",
    ),
    "08-proceso-de-trabajo.md": (
        "Cómo trabajamos",
        "Proceso por etapas con aprobaciones",
    ),
    "03-inversion-esencial.md": (
        "Inversión — plan Esencial",
        "Presupuesto por módulo, pagos y condiciones",
    ),
    "03-inversion-completo.md": (
        "Inversión — plan Completo",
        "Presupuesto por módulo, pagos y condiciones",
    ),
    "propuesta-integral.md": (
        "Propuesta integral",
        "Problema, solución, plan e inversión en un solo documento",
    ),
}


def main() -> None:
    print("Cliente →", OUT.relative_to(ROOT))
    for name, (title, subtitle) in META.items():
        md = DOCS / name
        if not md.exists():
            print(f"  ! falta {name}")
            continue
        out = OUT / (md.stem + ".pdf")
        build_pdf(md, out, KICKER, title, subtitle)


if __name__ == "__main__":
    main()
