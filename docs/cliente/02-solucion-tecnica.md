Solución técnica de PaqueteOK explicada en lenguaje simple, preparada por Bexovar.

# Solución técnica

## La solución, en palabras simples

PaqueteOK es una **aplicación web** que se usa desde cualquier celular o computadora, sin instalar nada desde una tienda de apps. El conserje entra desde el navegador del teléfono; el residente no entra a ningún lado: recibe todo por WhatsApp.

Por detrás, la información de cada edificio vive en una base de datos común pero **aislada por edificio**: nadie de un consorcio puede ver los datos de otro. Cuando se registra un paquete, el sistema genera un código de retiro y un QR, y le pide a WhatsApp que le mande el mensaje al residente. Cuando el paquete se retira, se marca como entregado y se manda la confirmación.

Tres piezas hacen el trabajo:

- **La aplicación**: las pantallas de conserjería y de administración.
- **La base de datos**: donde se guardan edificios, unidades, residentes, paquetes y el registro de auditoría.
- **El servicio de WhatsApp**: el puente con la API oficial de Meta para enviar los avisos.

## Arquitectura

<div class="arch"><div class="row"><div class="card">Conserje<br/><small>navegador del celular</small></div><div class="card">Administrador<br/><small>panel web</small></div><div class="card">Residente<br/><small>WhatsApp</small></div></div><div class="down"></div><div class="row"><div class="card hub">PaqueteOK — Aplicación web (PWA)<br/><small>multi-edificio · roles · reglas de negocio</small></div></div><div class="down"></div><div class="row"><div class="card">Base de datos<br/><small>Postgres · datos aislados por edificio</small></div><div class="card">WhatsApp Cloud API<br/><small>plantillas aprobadas + QR</small></div><div class="card">Email<br/><small>enlaces de acceso</small></div></div></div>

El QR que recibe el residente **no apunta a una página web**: contiene directamente la credencial de retiro. Eso significa que no hay ningún sitio público que mantener ni que se pueda caer, y que reenviar el mensaje a un tercero (un familiar, un repartidor) sigue funcionando.

## Seguridad y privacidad

- **Aislamiento por edificio**: cada operación verifica, del lado del servidor, que el usuario pertenezca al edificio sobre el que actúa. Un consorcio nunca ve datos de otro.
- **Roles y accesos**: administrador, conserje y residente tienen permisos distintos. El acceso al panel es por **enlace mágico** enviado por email (sin contraseñas que se filtran o se olvidan).
- **WhatsApp oficial**: usamos la API de Meta Cloud con **plantillas pre-aprobadas**, no una sesión de WhatsApp Web. Las confirmaciones de entrega de Meta se verifican con firma criptográfica.
- **Auditoría completa**: cada cambio sobre un paquete (alta, retiro, cancelación) deja un registro de quién, qué y cuándo. Es el respaldo ante cualquier reclamo.
- **El QR como credencial**: el código de retiro es único por paquete y deja de ser válido una vez retirado.

## Infraestructura

La plataforma está pensada para desplegarse sobre infraestructura administrada (hosting de aplicación + base de datos serverless), lo que mantiene el costo bajo y elimina la necesidad de servidores propios. Sumar un edificio nuevo no agrega infraestructura: es la misma plataforma con un edificio más.
