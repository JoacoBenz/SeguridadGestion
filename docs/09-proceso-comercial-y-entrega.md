Documento interno de Bexovar. Proceso comercial y de entrega con compuertas y pagos atados a entregas.

# Proceso comercial y de entrega — PaqueteOK

> **Documento interno — no enviar al cliente.** Define el embudo, las compuertas (qué tiene que pasar para avanzar) y el calce entre cobros y entregas. La versión que ve el cliente es `docs/cliente/08-proceso-de-trabajo.md`.

## Principios

- **Nada de trabajo de fondo sin firma + anticipo.** El análisis funcional detallado arranca recién con el Hito 1 cobrado.
- **Cada etapa tiene una compuerta**: un criterio objetivo que habilita la siguiente. Si no se cumple, no se avanza ni se factura.
- **Los pagos calzan con entregas verificables**, no con el calendario.

## Embudo comercial con compuertas

<div class="flow-v"><div class="step"><span class="num">1</span><span class="body"><span class="ttl">Contacto y descubrimiento</span><span class="sub">Llamada inicial, entendimiento del estudio administrador y su cartera</span></span><span class="pay">Sin costo</span></div><div class="gate">Compuerta: hay dolor real y presupuesto</div><div class="step"><span class="num">2</span><span class="body"><span class="ttl">Demo en vivo</span><span class="sub">Recorrido del flujo sobre el tenant sembrado; se entrega acceso de prueba</span></span><span class="pay">Sin costo</span></div><div class="gate">Compuerta: el cliente ve el valor y pide propuesta</div><div class="step"><span class="num">3</span><span class="body"><span class="ttl">Propuesta enviada</span><span class="sub">Paquete cliente: resumen, propuesta, inversión Esencial/Completo</span></span><span class="pay">Sin costo</span></div><div class="gate">Compuerta: plan elegido y condiciones acordadas</div><div class="step"><span class="num">4</span><span class="body"><span class="ttl">Firma + anticipo</span><span class="sub">Contrato firmado y 20% cobrado. Recién acá arranca el análisis de fondo</span></span><span class="pay">Cobra 20%</span></div><div class="gate">Compuerta: anticipo acreditado</div><div class="step"><span class="num">5</span><span class="body"><span class="ttl">Descubrimiento + diseño</span><span class="sub">Relevamiento, modelo de datos, UX, alta de plantillas WhatsApp en Meta</span></span><span class="pay">Incluido H1</span></div><div class="gate">Compuerta: diseño aprobado por el cliente</div><div class="step"><span class="num">6</span><span class="body"><span class="ttl">Núcleo en pruebas</span><span class="sub">Paquetes + WhatsApp funcionando en entorno de prueba</span></span><span class="pay">Cobra 25%</span></div><div class="gate">Compuerta: demo del núcleo aceptada</div><div class="step"><span class="num">7</span><span class="body"><span class="ttl">UAT en staging</span><span class="sub">Conserjería + admin (+ superadmin/Fase A en Completo) para validación del cliente</span></span><span class="pay">Cobra 30%</span></div><div class="gate">Compuerta: UAT firmado, sin bloqueantes</div><div class="step"><span class="num">8</span><span class="body"><span class="ttl">Producción + hand-off</span><span class="sub">Puesta en producción, capacitación, documentación y arranque del abono</span></span><span class="pay">Cobra 25%</span></div></div>

## Reglas duras

1. **Firma + anticipo antes del análisis.** No se entrega análisis funcional, wireframes detallados ni modelo de datos sin el Hito 1 acreditado. El descubrimiento es trabajo facturable, no preventa.
2. **Plantillas de WhatsApp se inician en el Hito 1.** Dependen de aprobación de Meta (1–5 días). Arrancar tarde mete riesgo en la fecha de producción.
3. **Cada compuerta se documenta.** La aceptación de una etapa (demo del núcleo, UAT) queda por escrito (mail/acta). Sin aceptación no se factura el hito siguiente.
4. **Cambios de alcance = adenda.** Cualquier pedido fuera del alcance acordado se cotiza aparte a tarifa de venta antes de ejecutarse.
5. **El abono arranca al pasar a producción**, no antes.

## Mapeo cobros ↔ entregas

| Hito | % | Se cobra cuando… | Entrega verificable |
| --- | ---: | --- | --- |
| 1 | 20 % | Se firma el contrato | Acceso a backlog, kickoff agendado, alta de plantillas iniciada |
| 2 | 25 % | El núcleo corre en pruebas | Registro de paquete + aviso WhatsApp + retiro por QR/código demostrables |
| 3 | 30 % | Staging listo para UAT | Conserjería + panel admin operativos; el cliente valida con datos reales de prueba |
| 4 | 25 % | El sistema está en producción | URL productiva, capacitación dada, documentación entregada |

## Calce con las etapas de entrega (cara al cliente)

El embudo interno se traduce a 5 etapas que ve el cliente (ver `docs/cliente/07-plan-de-entrega.md`):

| Etapa cliente | Cubre internamente | Hito que dispara |
| --- | --- | --- |
| 1. Arranque y diseño | Pasos 4–5 | H1 (firma) |
| 2. Núcleo de paquetes | Paso 6 (parte) | — |
| 3. WhatsApp y conserjería | Paso 6 (cierre) | H2 |
| 4. Administración y validación | Paso 7 | H3 |
| 5. Producción y entrega | Paso 8 | H4 |

## Manejo de la relación post-entrega

- Reunión de cierre + entrega de documentación y credenciales.
- Período de garantía: 30 días de corrección de defectos sin cargo (no aplica a nuevas funcionalidades).
- El abono mensual cubre soporte continuo; las nuevas fases (B/C/D) se proponen como proyectos incrementales con su propio embudo desde el paso 3.
