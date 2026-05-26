Documento interno de Bexovar. Desglose granular de gastos del proyecto PaqueteOK (implementación + operación + impuestos).

# Gastos — desglose granular

> **Documento interno — no enviar al cliente.** Detalla cada peso de costo: implementación, operación mensual (fija y variable), overhead, impuestos y comisiones, y el margen neto real por escenario. Todos los importes en USD salvo aclaración. Las tarifas de terceros y los impuestos son **estimaciones a confirmar** contra las facturas y el rate card vigente.

## 1. Costos directos de implementación (pago único)

Tarifas de **costo interno** (USD/h): Senior 28 · Semi-senior 20 · UX 19 · QA 16 · PM 22.

### Plan Completo

| Tarea | Rol · horas | Costo (USD) |
| --- | --- | ---: |
| Configuración de la plataforma para el estudio | Senior 8 + SSr 16 | 544 |
| Alta de edificios + carga inicial asistida | SSr 16 | 320 |
| WhatsApp: alta de plantillas, número emisor, pruebas | Senior 8 + SSr 12 | 464 |
| Branding completo + personalización a medida | Senior 6 + SSr 30 + UX 12 | 996 |
| Activación KPIs / superadmin / autorizaciones | Senior 6 + SSr 14 | 448 |
| QA con datos reales + UAT + producción | Senior 6 + QA 16 | 424 |
| Capacitación + documentación | Senior 6 + PM 8 | 344 |
| **Subtotal mano de obra (164 h)** | | **3.540** |

### Plan Esencial

| Tarea | Horas | Costo (USD) |
| --- | ---: | ---: |
| Configuración + alta de edificios + carga | 40 | 880 |
| WhatsApp (plantillas, número, pruebas) | 18 | 416 |
| QA + UAT + producción | 18 | 360 |
| Capacitación + documentación | 14 | 308 |
| **Subtotal mano de obra (90 h)** | | **1.964** |

### Terceros one-time (ambos planes)

| Concepto | Costo (USD) |
| --- | ---: |
| Dominio (.com, primer año) | 12 |
| Verificación de WhatsApp Business / Meta | 0 |
| Certificado SSL (incluido en hosting) | 0 |
| **Total terceros one-time** | **~12** |

> Costo directo total de puesta en marcha: **~3.552 (Completo)** y **~1.976 (Esencial)**.

## 2. Operación mensual — costos FIJOS de plataforma

Son **compartidos por toda la cartera** (la plataforma es multi-tenant: un solo despliegue sirve a todos los edificios del estudio). No escalan por edificio.

| Servicio | Plan | Costo (USD/mes) |
| --- | --- | ---: |
| Vercel | Pro | 20 |
| Neon (Postgres) | Launch | 19 |
| Resend (email / magic links) | tier bajo | 10 |
| Monitoreo de errores (Sentry) | dev/team | 0 – 15 |
| Uptime monitoring | básico | 0 – 7 |
| Dominio (prorrateado) | — | 1,5 |
| **Total fijo de plataforma** | | **~55 – 70** |

> Tomamos **USD 70/mes** como costo fijo de referencia para toda la cartera.

## 3. Operación mensual — costo VARIABLE (WhatsApp)

**Este es el costo que escala y el que hay que vigilar.** Se cobra por mensaje enviado.

- Tarifa estimada (plantilla *utility*, Argentina): **USD 0,03 por mensaje** — *a confirmar contra el rate card vigente de Meta; varía por categoría y país.*
- Mensajes por paquete: **2** (aviso de recepción + confirmación de retiro).

### Costo por edificio según volumen

| Paquetes/día | Paquetes/mes | Mensajes/mes | Costo/mes (USD) |
| ---: | ---: | ---: | ---: |
| 3 | 90 | 180 | 5,40 |
| 8 | 240 | 480 | 14,40 |
| 15 | 450 | 900 | 27,00 |

### Costo de WhatsApp para la cartera

| Escenario | Esencial (10 edificios) | Completo (20 edificios) |
| --- | ---: | ---: |
| Bajo (3 paq/día) | 54 | 108 |
| Medio (8 paq/día) | 144 | 288 |
| Alto (15 paq/día) | 270 | 540 |

## 4. Margen del abono por escenario

Costo total mensual = fijo (USD 70) + WhatsApp del escenario. Margen = abono − costo.

### Esencial — abono USD 240/mes

| Escenario | Costo op. | Margen | Margen % |
| --- | ---: | ---: | ---: |
| Bajo | 124 | +116 | 48 % |
| Medio | 214 | +26 | 11 % |
| Alto | 340 | **−100** | **pérdida** |

### Completo — abono USD 390/mes

| Escenario | Costo op. | Margen | Margen % |
| --- | ---: | ---: | ---: |
| Bajo | 178 | +212 | 54 % |
| Medio | 358 | +32 | 8 % |
| Alto | 610 | **−220** | **pérdida** |

> **Hallazgo crítico:** el abono plano es rentable a volumen bajo/medio pero **da pérdida a volumen alto**. El WhatsApp es el factor dominante. Sin un tope, una cartera con muchos paquetes nos hace perder plata cada mes.

## 5. Tope de uso justo (corrección recomendada)

Para proteger el margen sin complicar la oferta, el abono **incluye un cupo de notificaciones** y cobra el excedente:

| Plan | Notificaciones incluidas/mes (cartera) | Equivale a ~ | Excedente |
| --- | ---: | --- | --- |
| Esencial | 3.000 | ~1.500 paquetes/mes (~5 paq/día × 10 edif.) | USD 0,05 / notificación |
| Completo | 7.000 | ~3.500 paquetes/mes (~6 paq/día × 20 edif.) | USD 0,05 / notificación |

Con el cupo lleno: Esencial cuesta ~USD 160 (90 WhatsApp + 70 fijo) → margen **USD 80 (33 %)**; Completo cuesta ~USD 280 (210 + 70) → margen **USD 110 (28 %)**. El excedente se cobra a USD 0,05 sobre un costo de ~USD 0,03 → **+USD 0,02 de margen por mensaje** extra.

> Ya está reflejado como cláusula de "uso incluido" en `docs/cliente/03-inversion-*.md`.

## 6. Overhead e indirectos (prorrateados)

| Concepto | Estimación |
| --- | --- |
| Herramientas de desarrollo (repos, IDEs, CI) | ~USD 30/mes del estudio, prorrateado |
| Administración / contabilidad | ~5 % de la facturación |
| Preventa y comercial (demo, seguimiento) | no facturable; absorbido por margen |

Para el costeo, asignamos **~10 % de overhead** sobre los ingresos del proyecto.

## 7. Impuestos y comisiones (Argentina — estimaciones)

> Cliente **local** (administrador en Argentina): operación doméstica. Confirmar con el contador.

| Concepto | Estimación | Naturaleza |
| --- | --- | --- |
| IVA | 21 % | **Pass-through**: se factura aparte; los precios cotizados son **netos de IVA**. Neutral si el cliente toma crédito fiscal. |
| Ingresos Brutos (CABA, servicios) | ~4 % | Costo real sobre facturación |
| Comisión de cobro | 0 – 3 % | Según medio (transferencia 0 %; pasarela ~3 %) |
| Diferencia/spread de cambio USD→ARS | ~1 – 3 % | Riesgo al facturar en pesos al TC del día |
| Impuesto a las Ganancias | ~25 – 35 % | Sobre la utilidad neta, al cierre |

**Carga estimada sobre facturación antes de Ganancias: ~7 – 10 %.**

## 8. Margen neto real (después de operación, overhead e impuestos sobre facturación)

> Escenario **medio**, antes de Impuesto a las Ganancias. Precios netos de IVA.

### Puesta en marcha (única)

| | Esencial | Completo |
| --- | ---: | ---: |
| Precio | 2.900 | 4.900 |
| Mano de obra + terceros | −1.976 | −3.552 |
| Overhead (10 %) | −290 | −490 |
| Impuestos s/facturación (~9 %) | −261 | −441 |
| **Margen neto** | **~373 (13 %)** | **~417 (9 %)** |

### Abono mensual (escenario medio, con tope de uso)

| | Esencial | Completo |
| --- | ---: | ---: |
| Abono | 240 | 390 |
| Operación (fijo + WhatsApp dentro del cupo) | −160 | −280 |
| Overhead (10 %) | −24 | −39 |
| Impuestos s/facturación (~9 %) | −22 | −35 |
| **Margen neto recurrente** | **~34 (14 %)** | **~36 (9 %)** |

## 9. Lectura del negocio

- **La puesta en marcha casi no deja margen** después de impuestos: su función no es ganar, es **financiar la implementación y bajar la barrera de entrada**. El precio bajo es deliberado para vender.
- **El abono tampoco es donde está la gran ganancia mensual** una vez netos los impuestos; el verdadero retorno viene de:
  1. **Amortizar el activo ya construido** (~836 h / ~USD 17.576 de costo hundido) repitiendo el producto en **muchos clientes**. Cada cliente nuevo no vuelve a pagar ese desarrollo.
  2. **Escala**: el costo fijo de plataforma (USD 70/mes) es el mismo para 1 o 20 clientes que compartan despliegue; el margen por cliente sube con el segundo, tercero, etc.
- **Acción inmediata**: aplicar el tope de uso justo (sección 5). Sin él, un cliente de alto volumen es deficitario.
- **Revisar**: si la cartera del cliente es de alto volumen sostenido, subir el abono o mover WhatsApp a pass-through puro (costo + 30 %).

## 10. Resumen de gastos (una mirada)

| Categoría | Esencial | Completo |
| --- | ---: | ---: |
| Implementación (única) | ~1.976 | ~3.552 |
| Operación fija (mes) | ~70 | ~70 |
| Operación WhatsApp dentro del cupo (mes) | ~90 | ~210 |
| Overhead | ~10 % facturación | ~10 % facturación |
| Impuestos s/facturación | ~9 % | ~9 % |
| Activo amortizable (una vez, todo el catálogo) | ~17.576 de costo hundido | — |
