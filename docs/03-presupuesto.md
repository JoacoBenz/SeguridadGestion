Documento interno de Bexovar. Base de cálculo de horas, costos y márgenes para el proyecto PaqueteOK.

# Presupuesto interno — PaqueteOK

> **Documento interno — no enviar al cliente.** Contiene tarifas de costo, márgenes y la base de cálculo de los precios. La versión para el cliente vive en `docs/cliente/03-inversion-*.md`.

## Supuestos de cálculo

- Proyecto: PaqueteOK, plataforma multi-tenant de gestión de paquetes y portero virtual para administración de edificios.
- Moneda de referencia: **USD**. Facturación en pesos al tipo de cambio del día de cada hito.
- Estimación por **horas × tarifa de seniority** del mercado local (Argentina, software studio, 2026).
- Dos tarifarios:
  - **Tarifa de venta** (lo que se factura al cliente, valor de mercado).
  - **Tarifa de costo** (lo que le cuesta a Bexovar la hora del recurso, cargas incluidas).
- El precio al cliente se redondea por módulo a múltiplos de USD 100.

### Tarifas (USD / hora)

| Rol | Tarifa de venta | Tarifa de costo |
| --- | ---: | ---: |
| Tech Lead / Senior | 45 | 28 |
| Semi-senior (SSr) | 32 | 20 |
| Junior (Jr) | 22 | 13 |
| UX/UI | 30 | 19 |
| QA | 25 | 16 |
| PM (parcial) | 35 | 22 |

## Horas por módulo — alcance Completo

| # | Módulo | Senior | SSr | UX | QA | PM | Horas | Valor venta | Costo interno |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| M1 | Descubrimiento, UX y arquitectura | 16 | — | 48 | — | 16 | 80 | 2.720 | 1.712 |
| M2 | Fundaciones (multi-tenant, auth, infra) | 52 | 56 | — | — | — | 108 | 4.132 | 2.576 |
| M3 | Núcleo de paquetes (alta, código, QR, retiro, auditoría) | 28 | 92 | — | 24 | — | 144 | 4.804 | 3.008 |
| M4 | Notificaciones WhatsApp + webhook de estados | 26 | 56 | — | 16 | — | 98 | 3.362 | 2.104 |
| M5 | Conserjería (PWA mobile + scanner QR) | — | 64 | 16 | 16 | — | 96 | 2.928 | 1.840 |
| M6 | Panel de administración + KPIs/reportes | 12 | 80 | — | 20 | — | 112 | 3.600 | 2.256 |
| M7 | Superadmin (gestión de consorcios) | 10 | 28 | — | — | — | 38 | 1.346 | 840 |
| M8 | Autorizaciones recurrentes + modo vacaciones | 14 | 50 | — | 14 | — | 78 | 2.580 | 1.616 |
| M9 | QA integral, accesibilidad, PWA y capacitación | 18 | 24 | — | 40 | — | 82 | 2.578 | 1.624 |
| | **Totales Completo** | | | | | | **836** | **28.050** | **17.576** |

> En M2 las 52 h de Senior incluyen 12 h de DevOps (CI/CD, deploy Vercel + Neon) facturadas a tarifa Senior.

## Horas por módulo — alcance Esencial

El Esencial usa variantes reducidas de M4, M6 y M9 (sin webhook de estados, sin KPIs, QA acotado) y excluye M7 y M8.

| # | Módulo | Horas | Valor venta | Costo interno |
| --- | --- | ---: | ---: | ---: |
| M1 | Descubrimiento, UX y arquitectura | 80 | 2.720 | 1.712 |
| M2 | Fundaciones (multi-tenant, auth, infra) | 108 | 4.132 | 2.576 |
| M3 | Núcleo de paquetes | 144 | 4.804 | 3.008 |
| M4r | Notificaciones WhatsApp (sin webhook de estados) | 76 | 2.608 | 1.632 |
| M5 | Conserjería (PWA mobile + scanner QR) | 96 | 2.928 | 1.840 |
| M6r | Panel de administración (básico, sin KPIs) | 76 | 2.452 | 1.536 |
| M9r | QA y puesta en producción (acotado) | 46 | 1.434 | 904 |
| | **Totales Esencial** | **626** | **21.078** | **13.208** |

## Precio al cliente (redondeado) y margen

| Plan | Horas | Costo interno | Precio al cliente | Margen $ | Margen % |
| --- | ---: | ---: | ---: | ---: | ---: |
| Esencial | 626 | 13.208 | **21.100** | 7.892 | 37,4 % |
| Completo | 836 | 17.576 | **28.200** | 10.624 | 37,7 % |

> Precios al cliente redondeados por módulo (ver `docs/cliente/03-inversion-*.md`). El margen cubre estructura, riesgo de estimación (buffer ~10 %), gestión comercial y utilidad.

## Costos de operación (mensuales, recurrentes)

Costo interno de mantener el servicio corriendo por consorcio/instancia productiva:

| Servicio | Costo interno / mes (USD) |
| --- | ---: |
| Vercel (hosting/app) | 20 |
| Neon (Postgres serverless) | 19 |
| WhatsApp Cloud API (conversaciones utility) | 15 – 40 |
| Resend (email transaccional / magic links) | 0 – 20 |
| Dominio + monitoreo (uptime, errores) | 15 |
| **Total operación** | **~90 – 115** |

> El consumo de WhatsApp escala con el volumen de paquetes del edificio. Para un edificio mediano (~60 unidades, 15–25 paquetes/día) el costo de mensajería se mantiene en el piso del rango.

## Abono mensual al cliente

| Plan | Abono / mes (USD) | Cubre |
| --- | ---: | --- |
| Esencial | 180 | Hosting, mensajería base, soporte correctivo, parches de seguridad |
| Completo | 280 | Lo anterior + monitoreo proactivo, mejoras menores (bolsa 3 h/mes), prioridad de soporte |

> Margen del abono sobre el costo de operación (~USD 90–115): suficiente para cubrir soporte y dejar utilidad recurrente. Reevaluar el tramo de WhatsApp si un edificio supera ~40 paquetes/día sostenidos.

## Hitos de cobro (sobre el total del plan)

Esquema 20 / 25 / 30 / 25 atado a entregas (detalle en `docs/09-proceso-comercial-y-entrega.md`).

| Hito | % | Esencial (USD) | Completo (USD) | Disparador |
| --- | ---: | ---: | ---: | --- |
| 1 — Firma + anticipo | 20 % | 4.220 | 5.640 | Contrato firmado; habilita descubrimiento + diseño |
| 2 — Núcleo en pruebas | 25 % | 5.275 | 7.050 | Paquetes + WhatsApp funcionando en entorno de prueba |
| 3 — UAT en staging | 30 % | 6.330 | 8.460 | Conserjería + admin (+ superadmin/Fase A en Completo) listos para validación |
| 4 — Producción + hand-off | 25 % | 5.275 | 7.050 | Puesta en producción, capacitación y entrega |

## Notas de riesgo

- La estimación incluye un buffer implícito (~10 %) repartido en QA y fundaciones. Si el cliente pide cambios de alcance, se cotizan por separado a tarifa de venta.
- WhatsApp depende de la **aprobación de plantillas por Meta** (1–3 días texto; 3–5 días con header de imagen). No bloquea el desarrollo pero sí la salida a producción: iniciar el alta de plantillas en el Hito 1.
- El abono no incluye desarrollo de nuevas fases (B/C/D del roadmap): se cotizan como proyectos incrementales.
