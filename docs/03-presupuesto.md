Documento interno de Bexovar. Base de cálculo del modelo licencia + abono para PaqueteOK.

# Presupuesto interno — PaqueteOK

> **Documento interno — no enviar al cliente.** Contiene costos, márgenes y la lógica de amortización del producto. La versión para el cliente vive en `docs/cliente/03-inversion-*.md`.

## Modelo comercial: producto, no desarrollo a medida

PaqueteOK **ya está construido** (núcleo de paquetes, WhatsApp, conserjería, panel admin, multi-tenant y Fase A). Es un **activo de Bexovar**. Por lo tanto **no se cotiza como build desde cero**: se vende como producto, con dos componentes:

1. **Puesta en marcha** (pago único): trabajo real de implementación para *este* cliente — configuración, carga, branding/personalización, plantillas WhatsApp, capacitación y salida a producción.
2. **Abono mensual de cartera** (recurrente): hosting, mensajería, soporte, actualizaciones del producto.

> El desarrollo original (~836 h, ~USD 17.576 de costo interno) ya está hundido y es propiedad de Bexovar. Se **amortiza vendiéndolo muchas veces**: cada cliente nuevo es casi todo margen sobre ese activo. Cobrarle a un solo cliente el build completo lo haría invendible.

## Supuestos de cálculo

- Moneda de referencia: **USD**. Facturación en pesos al tipo de cambio del día.
- Tarifas de costo interno (USD/h): Senior 28, Semi-senior 20, UX 19, QA 16, PM 22.

## Puesta en marcha — horas y costo

### Plan Completo (~164 h)

| Tarea | Senior | SSr | UX | QA | PM | Horas | Costo (USD) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Configuración de plataforma para el estudio | 8 | 16 | — | — | — | 24 | 544 |
| Alta de edificios + carga inicial asistida | — | 16 | — | — | — | 16 | 320 |
| WhatsApp: plantillas, número, pruebas | 8 | 12 | — | — | — | 20 | 464 |
| Branding completo + personalización a medida | 6 | 30 | 12 | — | — | 48 | 996 |
| Activación KPIs / superadmin / autorizaciones | 6 | 14 | — | — | — | 20 | 448 |
| QA con datos reales + UAT + producción | 6 | — | — | 16 | — | 22 | 424 |
| Capacitación + documentación | 6 | — | — | — | 8 | 14 | 344 |
| **Total Completo** | 40 | 88 | 12 | 16 | 8 | **164** | **3.540** |

### Plan Esencial (~90 h)

Sin bolsa de personalización, menos edificios, sin activación de módulos avanzados.

| Concepto | Horas | Costo (USD) |
| --- | ---: | ---: |
| Configuración + alta de edificios + carga | 40 | 880 |
| WhatsApp (plantillas, número, pruebas) | 18 | 416 |
| QA + UAT + producción | 18 | 360 |
| Capacitación + documentación | 14 | 308 |
| **Total Esencial** | **90** | **~1.964** |

## Precio al cliente y margen (puesta en marcha)

| Plan | Horas | Costo interno | Precio al cliente | Margen $ | Margen % |
| --- | ---: | ---: | ---: | ---: | ---: |
| Esencial | 90 | 1.964 | **2.900** | 936 | 32 % |
| Completo | 164 | 3.540 | **4.900** | 1.360 | 28 % |

> El margen de la puesta en marcha es deliberadamente moderado: el negocio real es el **abono recurrente** y la **amortización del activo** ya construido. La puesta en marcha solo tiene que cubrir el trabajo de implementación con margen sano.

## Abono mensual — costo y margen

Costo de operación por instancia productiva (sirve a toda la cartera del estudio; multi-tenant, infraestructura compartida):

| Servicio | Costo interno / mes (USD) |
| --- | ---: |
| Vercel (hosting/app) | 20 |
| Neon (Postgres) | 19 |
| WhatsApp Cloud API (conversaciones) | 15 – 40 |
| Resend (email / magic links) | 0 – 20 |
| Dominio + monitoreo | 15 |
| **Total operación** | **~90 – 115** |

| Plan | Abono (USD/mes) | Costo op. | Margen recurrente |
| --- | ---: | ---: | --- |
| Esencial (hasta 10 edificios) | 240 | ~90–115 | ~USD 125–150/mes |
| Completo (hasta 20 edificios) | 390 | ~90–115 | ~USD 275–300/mes (incluye 3 h/mes de mejoras ≈ USD 60 de costo) |

- Edificio adicional sobre el tope: **USD 25/edificio/mes** al cliente (costo marginal real ínfimo: solo más mensajería).
- Reevaluar el tramo de WhatsApp si la cartera supera ~40 paquetes/día por edificio sostenidos.

## Economía a 12 meses (Completo, cartera de 20 edificios)

| Concepto | USD |
| --- | ---: |
| Ingreso puesta en marcha | 4.900 |
| Ingreso abono (12 × 390) | 4.680 |
| **Ingreso año 1** | **9.580** |
| Costo implementación | 3.540 |
| Costo operación (12 × ~105) | ~1.260 |
| **Margen bruto año 1** | **~4.780 (≈ 50 %)** |

> A partir del año 2, casi todo el abono es margen (solo costo de operación). Con varios clientes en la misma cartera de producto, el activo de desarrollo se amortiza rápido y el abono se vuelve renta recurrente.

## Hitos de cobro (puesta en marcha)

Esquema **50 / 50** (la puesta en marcha es chica; no se justifica fraccionar en cuatro):

| Hito | % | Esencial (USD) | Completo (USD) | Disparador |
| --- | ---: | ---: | ---: | --- |
| 1 — Firma + anticipo | 50 % | 1.450 | 2.450 | Contrato firmado; arranca la implementación |
| 2 — Producción | 50 % | 1.450 | 2.450 | Salida a producción + capacitación |

## Notas de riesgo

- WhatsApp depende de la **aprobación de plantillas por Meta** (1–5 días). Iniciar el alta en el Hito 1.
- Personalizaciones del Completo que excedan la bolsa de horas se cotizan aparte a tarifa de venta.
- El abono no incluye nuevas fases (B/C/D del roadmap): se cotizan como proyectos incrementales (ahí sí aplica tarifa de desarrollo).
