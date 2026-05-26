Propuesta integral de PaqueteOK para la administración de edificios, preparada por Bexovar.

# Propuesta integral — PaqueteOK

## El problema

En la conserjería de un edificio, el manejo de paquetes sigue siendo manual. Se anota en un cuaderno, se intenta llamar al departamento —que muchas veces no atiende—, se deja una nota bajo la puerta y el paquete se acumula en el palier durante días. Cuando algo sale mal, llega el reclamo: "no me avisaron", "nunca llegó", "me lo entregaron tarde". Sin registro, la portería queda sin respaldo y el conflicto escala a la administración.

Cuatro dolores concretos:

- **Cuaderno de papel**: se extravía, se daña, no permite búsquedas, no deja trazabilidad.
- **Llamadas sin respuesta**: el residente no atiende y el paquete espera días.
- **Reclamos sin evidencia**: la portería siempre sin respaldo documental.
- **Rotación de personal**: cada conserje nuevo aprende desde cero.

## Por qué un sistema

El residente actual espera resolver todo desde el celular. El volumen de paquetes que llegan a los edificios crece de forma sostenida con el e-commerce, y la portería no da abasto con métodos manuales.

> Las cifras de esta sección son **estimaciones de referencia del sector**, no promesas de resultado.

- Gestionar un paquete a mano lleva unos **2 a 3 minutos** (anotar + intentar avisar). Con PaqueteOK baja a **~30 segundos**.
- Un edificio mediano (~60 unidades) puede recibir **15 a 25 paquetes por día**.
- Los reclamos por paquetes "no avisados" o extraviados son una fuente recurrente de fricción entre propietarios, encargados y administradores.

<div class="flow-h"><div class="node"><span class="num">1</span><span class="t">Llega el paquete</span><span class="d">El conserje lo registra y elige la unidad</span></div><div class="sep"></div><div class="node"><span class="num">2</span><span class="t">Aviso al residente</span><span class="d">WhatsApp automático con código y QR</span></div><div class="sep"></div><div class="node"><span class="num">3</span><span class="t">Retiro</span><span class="d">Escaneo del QR o código en conserjería</span></div><div class="sep"></div><div class="node"><span class="num">4</span><span class="t">Confirmación</span><span class="d">Segundo WhatsApp con la hora del retiro</span></div></div>

## Cómo funciona

El conserje abre PaqueteOK en el navegador de su celular, registra el paquete y elige la unidad. El residente recibe al instante un **WhatsApp** con un código de retiro de seis caracteres y un QR —sin instalar ninguna app—. Para retirar, el conserje **escanea el QR** con la cámara o **tipea el código**. El residente recibe una confirmación con la hora exacta. Todo queda auditado.

Si el residente borra el mensaje, el código sigue valiendo. Si manda a un familiar o a un repartidor, reenvía el WhatsApp y el QR funciona igual. Si dice que "nunca le avisaron", el registro muestra cuándo se envió, se entregó y se leyó el aviso.

## Arquitectura

<div class="arch"><div class="row"><div class="card">Conserje<br/><small>navegador del celular</small></div><div class="card">Administrador<br/><small>panel web</small></div><div class="card">Residente<br/><small>WhatsApp</small></div></div><div class="down"></div><div class="row"><div class="card hub">PaqueteOK — Aplicación web (PWA)<br/><small>multi-edificio · roles · reglas de negocio</small></div></div><div class="down"></div><div class="row"><div class="card">Base de datos<br/><small>datos aislados por edificio</small></div><div class="card">WhatsApp Cloud API<br/><small>plantillas aprobadas + QR</small></div><div class="card">Email<br/><small>enlaces de acceso</small></div></div></div>

## Funcionalidades

**Conserjería**: registro en segundos, código y QR automáticos, lista de pendientes, retiro por QR o código, confirmación automática, autorizaciones del día y modo vacaciones a la vista *(Completo)*.

**Residente**: aviso por WhatsApp con código y QR, mensaje reenviable, confirmación de retiro, sin instalar nada ni registrarse.

**Administración**: unidades y residentes, historial de paquetes con filtros, cancelaciones auditadas, KPIs y reportes *(Completo)*, registro de auditoría completo.

**Multi-edificio** *(Completo)*: datos aislados por consorcio, alta de edificios y gestión centralizada de toda la cartera, sin infraestructura adicional por edificio.

## Resultados esperados (estimaciones)

> Ejemplo **ilustrativo** para un administrador con **20 edificios**. Los números son hipotéticos y sirven para dimensionar, no son un compromiso.

| Variable | Hipótesis | Resultado estimado |
| --- | --- | --- |
| Tiempo por paquete | de ~3 min a ~30 s | ~2,5 min ahorrados por paquete |
| Volumen de cartera | ~15 paquetes/día por edificio | ~300 paquetes/día |
| Reclamos que escalan al estudio | reducción estimada | hasta ~70 % menos con aviso + auditoría |
| Diferenciación | servicio moderno por consorcio | retención de cartera |

El mensaje de fondo: la inversión se justifica si ayuda a **no perder un solo consorcio al año** y a liberar horas de oficina hoy gastadas en resolver reclamos de paquetes.

## Plan de entrega

PaqueteOK ya está desarrollado: lo que sigue es una **implementación** de **3 a 5 semanas**, no un desarrollo desde cero. Cuatro etapas, cada una con una entrega que ustedes validan.

<div class="flow-v"><div class="step"><span class="num">1</span><span class="body"><span class="ttl">Arranque y configuración</span><span class="sub">Configuración de la plataforma + alta de plantillas WhatsApp · Semana 1</span></span><span class="pay">Firma · 50%</span></div><div class="gate">Avanzamos con su OK</div><div class="step"><span class="num">2</span><span class="body"><span class="ttl">Carga y branding</span><span class="sub">Alta de edificios, unidades y residentes; branding y personalización · Semana 2</span></span><span class="pay">—</span></div><div class="gate">Avanzamos con su OK</div><div class="step"><span class="num">3</span><span class="body"><span class="ttl">Validación (UAT)</span><span class="sub">Prueban con datos reales y aprueban · Semana 3</span></span><span class="pay">—</span></div><div class="gate">Avanzamos con su OK</div><div class="step"><span class="num">4</span><span class="body"><span class="ttl">Producción y capacitación</span><span class="sub">Salida a producción + capacitación + entrega · Semana 4–5</span></span><span class="pay">Producción · 50%</span></div></div>

## Inversión

PaqueteOK es un **producto ya desarrollado**: no pagan un desarrollo desde cero, sino una **puesta en marcha** sobre sus edificios más un **abono mensual** que mantiene el servicio. Precios en **USD**, facturados en pesos al tipo de cambio del día.

| | Esencial | Completo |
| --- | :---: | :---: |
| Núcleo de paquetes + WhatsApp | Sí | Sí |
| Conserjería mobile + retiro QR/código | Sí | Sí |
| Panel de administración | Básico | + KPIs y reportes |
| Edificios incluidos | hasta 10 | hasta 20 |
| Gestión multi-consorcio centralizada | — | Sí |
| Autorizaciones recurrentes + vacaciones | — | Sí |
| Personalización a medida | — | Sí |
| **Puesta en marcha (única)** | **USD 2.900** | **USD 4.900** |
| **Abono mensual** | USD 240 | USD 390 |

La puesta en marcha se abona **50 % al firmar y 50 % al pasar a producción**; el abono mensual arranca en producción. Para 20 edificios, el Completo equivale a **~USD 40 por edificio/mes el primer año** y a **~USD 20 a partir del segundo**, sin licencias por unidad ni infraestructura propia. El detalle está en los documentos de inversión Esencial y Completo.

## Por qué Bexovar

- **Producto ya probado**: PaqueteOK está construido y funcionando. No financian un desarrollo: acceden a una plataforma lista, con puesta en marcha rápida y bajo riesgo.
- **Pensado multi-edificio desde el origen**: escala a toda su cartera sin sumar infraestructura ni licencias por unidad.
- **Inversión baja y previsible**: puesta en marcha acotada + abono mensual fijo, en lugar de un proyecto de desarrollo costoso.
- **Tecnología sólida**: WhatsApp oficial de Meta, accesos sin contraseñas, auditoría completa y aislamiento por edificio.
- **Acompañamiento**: capacitación a su equipo, soporte continuo y actualizaciones del producto incluidas en el abono.

## Próximos pasos

1. **Demostración en vivo** sobre un edificio de ejemplo.
2. **Elección del plan** (Esencial o Completo) y acuerdo de condiciones.
3. **Firma y anticipo (50 %)** para arrancar.
4. **Puesta en marcha**: en 3 a 5 semanas, en producción.

Quedamos a disposición.
**Equipo Bexovar** · [email] · [teléfono]
