Documento interno de Bexovar. Proceso comercial y de entrega con compuertas y pagos atados a entregas.

# Proceso comercial y de entrega — PaqueteOK

> **Documento interno — no enviar al cliente.** Define el embudo, las compuertas (qué tiene que pasar para avanzar) y el calce entre cobros y entregas. La versión que ve el cliente es `docs/cliente/08-proceso-de-trabajo.md`.

## Principios

- **Vendemos un producto, no un build.** PaqueteOK ya existe; el cliente paga puesta en marcha + abono, no desarrollo a medida.
- **Nada de implementación sin firma + anticipo.** La configuración y carga arrancan recién con el 50 % cobrado.
- **Cada etapa tiene una compuerta**: un criterio objetivo que habilita la siguiente. Si no se cumple, no se avanza ni se factura.
- **El negocio es el abono recurrente.** La puesta en marcha cubre el trabajo de implementación; la renta está en el abono y en repetir el producto en muchos clientes.

## Embudo comercial con compuertas

<div class="flow-v"><div class="step"><span class="num">1</span><span class="body"><span class="ttl">Contacto y descubrimiento</span><span class="sub">Llamada inicial, entendimiento del estudio administrador y su cartera</span></span><span class="pay">Sin costo</span></div><div class="gate">Compuerta: hay dolor real y presupuesto</div><div class="step"><span class="num">2</span><span class="body"><span class="ttl">Demo en vivo</span><span class="sub">Recorrido del flujo sobre el tenant sembrado; se entrega acceso de prueba</span></span><span class="pay">Sin costo</span></div><div class="gate">Compuerta: el cliente ve el valor y pide propuesta</div><div class="step"><span class="num">3</span><span class="body"><span class="ttl">Propuesta enviada</span><span class="sub">Paquete cliente: resumen, propuesta, inversión Esencial/Completo</span></span><span class="pay">Sin costo</span></div><div class="gate">Compuerta: plan elegido y condiciones acordadas</div><div class="step"><span class="num">4</span><span class="body"><span class="ttl">Firma + anticipo</span><span class="sub">Contrato firmado y 50% cobrado. Recién acá arranca la implementación</span></span><span class="pay">Cobra 50%</span></div><div class="gate">Compuerta: anticipo acreditado</div><div class="step"><span class="num">5</span><span class="body"><span class="ttl">Configuración + carga + branding</span><span class="sub">Alta del estudio y edificios, carga de datos, branding, alta de plantillas WhatsApp</span></span><span class="pay">Incluido H1</span></div><div class="gate">Compuerta: configuración aprobada por el cliente</div><div class="step"><span class="num">6</span><span class="body"><span class="ttl">Validación (UAT)</span><span class="sub">El cliente prueba con datos reales y aprueba</span></span><span class="pay">Sin cobro</span></div><div class="gate">Compuerta: UAT firmado, sin bloqueantes</div><div class="step"><span class="num">7</span><span class="body"><span class="ttl">Producción + hand-off</span><span class="sub">Puesta en producción, capacitación, documentación y arranque del abono</span></span><span class="pay">Cobra 50%</span></div></div>

## Reglas duras

1. **Firma + anticipo antes de implementar.** No se configura nada ni se cargan datos sin el 50 % acreditado.
2. **Plantillas de WhatsApp se inician en el Hito 1.** Dependen de aprobación de Meta (1–5 días). Arrancar tarde mete riesgo en la fecha de producción.
3. **Cada compuerta se documenta.** La aceptación de una etapa (configuración, UAT) queda por escrito (mail/acta).
4. **Cambios de alcance = adenda.** Personalizaciones fuera de la bolsa de horas del plan se cotizan aparte a tarifa de venta antes de ejecutarse.
5. **El abono arranca al pasar a producción**, no antes.

## Mapeo cobros ↔ entregas

La puesta en marcha se cobra **50 / 50** (es un importe acotado; no se fracciona en cuatro).

| Hito | % | Se cobra cuando… | Entrega verificable |
| --- | ---: | --- | --- |
| 1 | 50 % | Se firma el contrato | Kickoff agendado, alta de plantillas iniciada, accesos provistos |
| 2 | 50 % | El sistema está en producción | URL productiva, edificios cargados, capacitación dada, documentación entregada |

> Entre ambos hitos no hay cobro: la implementación es corta (3–5 semanas). La renta sostenida llega por el **abono mensual**, que arranca en producción.

## Calce con las etapas de entrega (cara al cliente)

El embudo interno se traduce a 4 etapas que ve el cliente (ver `docs/cliente/07-plan-de-entrega.md`):

| Etapa cliente | Cubre internamente | Hito que dispara |
| --- | --- | --- |
| 1. Arranque y configuración | Pasos 4–5 | H1 (firma, 50 %) |
| 2. Carga y branding | Paso 5 (cierre) | — |
| 3. Validación (UAT) | Paso 6 | — |
| 4. Producción y capacitación | Paso 7 | H2 (producción, 50 %) |

## Manejo de la relación post-entrega

- Reunión de cierre + entrega de documentación y credenciales.
- Período de garantía: 30 días de corrección de defectos sin cargo (no aplica a nuevas funcionalidades).
- El abono mensual cubre soporte continuo y actualizaciones del producto; las nuevas fases (B/C/D) se proponen como proyectos incrementales con su propio embudo desde el paso 3.
