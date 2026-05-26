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

Vendemos PaqueteOK como **producto ya hecho**: puesta en marcha baja + abono mensual. Eso elimina el sticker shock del proyecto a medida. Presentamos **dos planes** para que la decisión sea "cuál" y no "sí o no":

- **Esencial** (puesta en marcha USD 2.900 + USD 240/mes, hasta 10 edificios): el ancla baja. Núcleo de paquetes + WhatsApp + conserjería + admin básico.
- **Completo** (puesta en marcha USD 4.900 + USD 390/mes, hasta 20 edificios): el plan recomendado. Suma KPIs/reportes, superadmin multi-consorcio, autorizaciones recurrentes + modo vacaciones y personalización a medida. **Es el que empujamos**.

Anclaje clave: el comprador compara contra "mandar a hacer un sistema" (decenas de miles de USD) o contra licencias por unidad. Una puesta en marcha de USD 4.900 + abono fijo es chica al lado de eso, y aplica a toda la cartera.

Técnica: presentar siempre Completo primero y bajar a Esencial como "si querés arrancar más acotado", nunca al revés.

## Reversión de riesgo

Bajamos el miedo del comprador:

- **Inversión inicial baja**: la puesta en marcha (USD 2.900 / 4.900) es una fracción de un desarrollo a medida. Sin un cheque grande de entrada.
- **Producto ya probado**: PaqueteOK no es un experimento; está construido y funcionando (incluida la Fase A). No financian un riesgo de desarrollo, acceden a algo que ya anda.
- **Pago 50/50** atado a entregas: 50 % al firmar, 50 % recién en producción. El cliente paga el grueso cuando ya lo está usando.
- **UAT antes de producción**: valida con datos reales antes del segundo pago.
- **Abono cancelable**: el compromiso recurrente es mes a mes, no un contrato atado a años.

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
| Puesta en marcha Completo | USD 4.900 una vez | — |
| Abono | USD 390/mes | USD 4.680/año |
| Costo todo incluido año 1 | 4.900 + 4.680 | ~USD 40/edificio/mes (20 edificios) |
| Consorcios retenidos por diferenciación | 1 consorcio/año que no se va | Honorarios de ese consorcio (>> abono) |
| Horas de oficina liberadas | ~3 h/sem en gestión de reclamos | Reasignables a captación |

Mensaje: "Por menos de lo que sale mandar a hacer un sistema, tenés la plataforma andando en toda tu cartera en un mes. Se paga si te ayuda a no perder un solo consorcio al año."

## Objeciones y respuestas

| Objeción | Respuesta |
| --- | --- |
| "Es caro." | "No estás pagando un desarrollo: el sistema ya está hecho. Pagás la puesta en marcha (USD 4.900) y un abono fijo. Aplicado a toda tu cartera, son ~USD 40 por edificio al mes el primer año, y la mitad después." |
| "Mis consorcios no lo van a usar." | "El residente no instala nada: recibe un WhatsApp. El conserje opera desde su celular. La barrera de adopción es casi cero." |
| "Ya tengo un sistema / un Excel." | "¿Tu Excel manda el aviso por WhatsApp con QR y te deja auditoría de quién retiró y cuándo? Eso es lo que elimina los reclamos." |
| "¿Y si WhatsApp deja de andar?" | "Usamos la API oficial de Meta con plantillas aprobadas, no un WhatsApp Web colgado. Y el código de retiro funciona aunque el residente borre el mensaje." |
| "Prefiero pagar todo al final." | "El esquema 50/50 te protege a vos: la mitad al firmar y la otra mitad recién cuando ya está en producción y la estás usando." |
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
4. Firma + anticipo (50 %) → arranque de la implementación.
