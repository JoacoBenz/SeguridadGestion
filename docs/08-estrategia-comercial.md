Documento interno de Bexovar. Estrategia de venta para PaqueteOK ante administradores de consorcios.

# Estrategia comercial — PaqueteOK

> **Documento interno — no enviar al cliente.** Es el guion de venta: a quién, cómo, con qué anclajes y respuestas. No comparte lógica de precios de costo (eso vive en `03-presupuesto.md`).

## A quién le vendemos

El comprador es el **administrador de consorcios** (no el edificio individual). Es quien gestiona la cartera de edificios y quien firma. Sus motivaciones:

- **Diferenciarse**: ofrecer un servicio moderno ("portero virtual") para ganar y retener consorcios frente a otros administradores.
- **Bajar fricción operativa**: menos llamados y reclamos de "no me avisaron / nunca llegó" que hoy terminan escalando a su oficina.
- **Imagen tech-forward** ante consejos de administración cada vez más exigentes.

Perfil de decisión: PyME, decisión concentrada en una o dos personas (titular del estudio + responsable operativo). Ciclo corto si se muestra valor concreto rápido.

### Mapa de stakeholders

| Rol | Qué le importa | Cómo lo movemos |
| --- | --- | --- |
| Titular del estudio administrador | Rentabilidad, retención de consorcios, diferenciación | ROI de cartera, multi-edificio sin costo de infra incremental |
| Responsable operativo / mesa de entradas | Menos llamados, menos quilombo con paquetes | Demo del flujo de 30 segundos en conserjería |
| Consejo de administración del edificio | Servicio al propietario, transparencia | Auditoría completa, aviso instantáneo por WhatsApp |
| Conserje / encargado | Que sea fácil y rápido, sin pelearse con apps | UI mobile-first, escaneo de QR, sin login engorroso |

## Demo en vivo (el corazón de la venta)

La venta se gana mostrando, no contando. Guion de demo (8–10 min) sobre el tenant sembrado `edificio-libertad`:

<div class="flow-h"><div class="node"><span class="num">1</span><span class="t">Registrar</span><span class="d">Elijo unidad, registro un paquete en 10 s</span></div><div class="sep"></div><div class="node"><span class="num">2</span><span class="t">WhatsApp</span><span class="d">Llega el aviso con QR + código al instante</span></div><div class="sep"></div><div class="node"><span class="num">3</span><span class="t">Retirar</span><span class="d">Escaneo el QR con la cámara, retiro confirmado</span></div><div class="sep"></div><div class="node"><span class="num">4</span><span class="t">Auditar</span><span class="d">Muestro el historial: quién, cuándo, qué</span></div></div>

Cierre de demo: "Esto que viste, multiplicado por todos los edificios de tu cartera, desde una sola plataforma."

## Anclaje de planes

Presentamos **dos planes** para que la decisión sea "cuál" y no "sí o no":

- **Esencial** (USD 21.100): el ancla baja. Núcleo de paquetes + WhatsApp + conserjería + admin básico.
- **Completo** (USD 28.200): el plan recomendado. Suma KPIs/reportes, superadmin multi-consorcio y Fase A (autorizaciones recurrentes + modo vacaciones). **Es el que empujamos**: solo ~34 % más caro por el doble de capacidades estratégicas (multi-edificio + diferenciación).

Técnica: presentar siempre Completo primero y bajar a Esencial como "si querés arrancar más acotado", nunca al revés.

## Reversión de riesgo

Bajamos el miedo del comprador:

- **Pago por hitos** (20/25/30/25): el cliente paga contra entregas verificables, no por adelantado.
- **Hito 1 chico** (20 %): el compromiso inicial es bajo.
- **UAT antes de producción**: valida en staging antes del último pago.
- **Núcleo ya probado**: PaqueteOK no es un experimento; el núcleo está construido y la Fase A en producción. Reduce el riesgo de "¿y si no funciona?".

## ROI (referencias del sector — estimaciones, no promesas)

> Todos los números de esta sección son **estimaciones ilustrativas** basadas en supuestos del sector, no compromisos de resultado. Se presentan al cliente claramente etiquetados como tales.

Supuestos ilustrativos para un administrador con **20 edificios**:

- Tiempo de portería por paquete: de ~3 min (cuaderno + llamado) a ~30 s (registro + WhatsApp). Estimación: **~2,5 min ahorrados por paquete**.
- Volumen: ~15 paquetes/día por edificio → ~300 paquetes/día en la cartera.
- Ahorro de tiempo de portería: ~12,5 h/día agregadas en la cartera (referencia, no facturable directo).
- Reclamos por paquete que escalan al estudio: supongamos 2/semana por edificio hoy → reducción estimada del 70 % con auditoría y aviso automático.

Valor para el administrador (ilustrativo):

| Variable | Hipótesis | Resultado estimado |
| --- | --- | --- |
| Inversión Completo | USD 28.200 una vez | — |
| Abono | USD 280/mes | USD 3.360/año |
| Consorcios retenidos por diferenciación | 1 consorcio/año que no se va | Honorarios de ese consorcio (>> abono) |
| Horas de oficina liberadas | ~3 h/sem en gestión de reclamos | Reasignables a captación |

Mensaje: "El sistema se paga si te ayuda a no perder un solo consorcio al año."

## Objeciones y respuestas

| Objeción | Respuesta |
| --- | --- |
| "Es caro." | "Es una inversión única que aplica a toda tu cartera. El costo por edificio baja con cada uno que sumás; la infraestructura no crece." |
| "Mis consorcios no lo van a usar." | "El residente no instala nada: recibe un WhatsApp. El conserje opera desde su celular. La barrera de adopción es casi cero." |
| "Ya tengo un sistema / un Excel." | "¿Tu Excel manda el aviso por WhatsApp con QR y te deja auditoría de quién retiró y cuándo? Eso es lo que elimina los reclamos." |
| "¿Y si WhatsApp deja de andar?" | "Usamos la API oficial de Meta con plantillas aprobadas, no un WhatsApp Web colgado. Y el código de retiro funciona aunque el residente borre el mensaje." |
| "Prefiero pagar todo al final." | "El esquema por hitos te protege a vos: pagás contra entregas que validás. El anticipo inicial es solo el 20 %." |
| "Necesito pensarlo." | "Perfecto. Te dejo el acceso a la demo sembrada por una semana para que lo pruebes con tu equipo operativo." |

## Métricas de respaldo (para la conversación)

> Referencias de sector, presentadas como estimaciones.

- Argentina supera los cientos de millones de envíos de e-commerce por año; el volumen de paquetes a edificios crece de forma sostenida.
- El tiempo de gestión manual de un paquete en portería ronda los 2–3 minutos (registro en cuaderno + intento de aviso). 
- Los reclamos por paquetes extraviados o "no avisados" son una fuente recurrente de fricción entre propietarios, encargados y administradores.

## Próximos pasos comerciales

1. Demo en vivo sobre el tenant sembrado.
2. Envío del paquete cliente (resumen ejecutivo + propuesta + inversión).
3. Acceso de prueba por una semana.
4. Firma + Hito 1 → arranque.
