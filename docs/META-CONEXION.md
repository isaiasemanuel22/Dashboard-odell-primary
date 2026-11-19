# Conectar Meta con Odell (WhatsApp, Instagram y Messenger)

Guía para Isaías, armada el 2026-11-19 con la cuenta revisada ese día y la
documentación oficial de Meta. Reglas: §28 de `BUSINESS-RULES.md`.
**Nunca pegues tokens ni claves en este archivo ni en el repo:** van solo en
las variables de entorno de Heroku.

## Cómo está hoy

| Qué | Dónde | Estado |
|-----|-------|--------|
| Portfolio que se usa | **ISA 3D** | Sin verificar |
| Página de Facebook | ISA 3D | Ok |
| Instagram `Odellprint3D` | Vinculado a esa página | Ok |
| Cuenta de WhatsApp «Isaias Odell» | Portfolio **Odell_print3D** (no en ISA 3D) | Es la app WhatsApp Business del celular, no Cloud API |
| App de desarrollador | — | No hay ninguna |
| Usuario del sistema | ISA 3D tiene «Conversions API System User» (de anuncios) | Falta uno para Odell |

## Paso 0 — Decidir el número de WhatsApp

Odell manda y recibe por **Cloud API**. Un número que está en la app del
celular no se puede usar así nomás:

- **(a) Número nuevo solo para Odell (recomendado).** Un chip aparte. Seguís
  usando tu número actual en el celular como hoy, y tu número personal puede
  recibir los avisos de Odell (`ALERTS_WHATSAPP_TO`).
- **(b) Pasar el número actual a Cloud API.** Deja de andar en la app del
  celular: se atiende solo desde Odell (Chats).
- **(c) Coexistencia (el mismo número en el celular y en Odell).** Según Meta
  se activa solo con «Embedded Signup», que pide ser Tech Provider; no está
  confirmado para Argentina ni para uso propio, y no sincroniza grupos,
  difusiones, etiquetas ni respuestas rápidas. No lo recomiendo por ahora.

Mientras decidís, todo se puede probar con el **número de prueba** de Meta.

## Paso 1 — Crear la app

1. Entrá a <https://developers.facebook.com/apps> → **Crear app**.
2. Caso de uso: **«Conectarte con clientes a través de WhatsApp»**. Elegí el
   portfolio **ISA 3D**.
3. Dentro de la app sumá también **Messenger** (con eso va Instagram).
4. En **Configuración › Básica** copiá la **clave secreta de la app** →
   `META_APP_SECRET`.

## Paso 2 — WhatsApp

1. En la app: **WhatsApp › Configuración de la API**.
2. Para probar: usá el número de prueba («From») y agregá tu celular como
   destinatario («To»). Meta te manda un código para confirmarlo.
3. Copiá el **identificador del número de teléfono** → `WHATSAPP_PHONE_NUMBER_ID`
   y el **identificador de la cuenta de WhatsApp Business** →
   `WHATSAPP_BUSINESS_ACCOUNT_ID`.
4. Cuando tengas el número definitivo (paso 0), agregalo ahí mismo con
   **Agregar número**, verificalo por SMS o llamada y reemplazá el
   `WHATSAPP_PHONE_NUMBER_ID`.

## Paso 3 — Usuario del sistema y token fijo

El token que muestra la pantalla de la API dura 24 h; Odell necesita uno fijo.

1. <https://business.facebook.com/settings> → portfolio **ISA 3D** →
   **Usuarios del sistema › Agregar**. Nombre: «Odell», rol **Administrador**.
2. **Asignar activos**: la app (control total), la cuenta de WhatsApp, la
   página y la cuenta de Instagram.
3. **Generar token**, elegí la app, vencimiento **Nunca** si aparece la opción
   (si no, el más largo, y anotá la fecha para renovarlo), y tildá:
   `business_management`, `whatsapp_business_management`,
   `whatsapp_business_messaging`, `pages_messaging`, `pages_manage_metadata`,
   `pages_read_engagement`, `instagram_basic`, `instagram_manage_messages`.
4. Ese token → `META_ACCESS_TOKEN`.
5. Token de la página (para Instagram y Messenger): en el Explorador de la
   Graph API, con el token del paso 4, consultá
   `GET /me/accounts` y copiá el `access_token` de la página de ISA 3D →
   `META_PAGE_ACCESS_TOKEN`, y su `id` → `META_PAGE_ID`.
6. Id de Instagram: `GET /{META_PAGE_ID}?fields=instagram_business_account`
   → `INSTAGRAM_ACCOUNT_ID`.
7. En la app de Instagram: **Configuración › Privacidad › Mensajes ›
   Herramientas conectadas → Permitir acceso a los mensajes**.

## Paso 4 — Cargar las variables en Heroku

Inventá una palabra cualquiera para `META_VERIFY_TOKEN` (no la uses en otro
lado). Después, con OK tuyo, se cargan en Heroku (`odell-dashboard-api`):

```text
META_APP_SECRET, META_VERIFY_TOKEN, META_ACCESS_TOKEN, META_PAGE_ACCESS_TOKEN,
WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, META_PAGE_ID,
INSTAGRAM_ACCOUNT_ID, ALERTS_WHATSAPP_TO (tu celular personal),
ANTHROPIC_API_KEY, RESEND_API_KEY, ALERTS_EMAIL_FROM, ALERTS_EMAIL_TO
```

Antes tiene que estar publicada la rama de Meta y agentes con
`db:push:heroku` (eso lo hace Claude con tu OK).

## Paso 5 — Webhooks

La URL la muestra Odell en **Ajustes › Integraciones** (botón Copiar):
`https://<backend>/api/meta/webhook`.

1. **WhatsApp**: en la app, **WhatsApp › Configuración › Webhook** → URL +
   `META_VERIFY_TOKEN` → **Verificar y guardar** → suscribir el campo
   **messages**.
2. **Messenger e Instagram**: **Messenger › Configuración** → misma URL y
   token → suscribir **messages** y **messaging_postbacks**, y en
   «Webhooks» agregar la página. Para Instagram, lo mismo en la sección de
   Instagram de Messenger.
3. Pasá la app a **modo Live** (arriba en el panel). Sin eso, Meta solo
   entrega mensajes de quienes tienen rol en la app.

Si Meta pide **revisión de la app** para Messenger o Instagram al pasar a Live,
avisá a Claude: se arma el texto y el video que pide la revisión.

## Paso 6 — Plantillas

En **WhatsApp Manager › Plantillas de mensajes › Crear**, categoría
**Utilidad**, idioma **Español (ARG)** (si no aparece, Español). Los nombres y
textos tienen que ser **exactamente** estos (el número entre llaves es lo que
completa Odell):

| Nombre | Texto |
|--------|-------|
| `presupuesto_enviado` | Hola {{1}}, te enviamos el presupuesto {{2}} por {{3}}. Si tenés dudas, respondé este mensaje. |
| `diseno_para_aprobar` | Hola {{1}}, ya está el diseño de tu pedido {{2}}. Respondé este mensaje para verlo y aprobarlo. |
| `pedido_listo` | Hola {{1}}, tu pedido {{2}} está listo para retirar. |
| `recordatorio_saldo` | Hola {{1}}, te recordamos que el pedido {{2}} tiene un saldo de {{3}}. |
| `aviso_odell` | Aviso de Odell: {{1}} |

Meta las revisa sola, en hasta 24 h. Odell muestra el estado de cada una en
Ajustes › Integraciones. Si cambia el idioma o algún texto, avisá: hay que
cambiarlo también en `backend/src/meta/meta.constants.ts`.

## Paso 7 — Probar

1. Desde tu celular escribile al número de prueba: el mensaje tiene que
   aparecer en **Chats**.
2. Respondé desde Odell y fijate que te llegue.
3. Con el agente apagado, mandá una plantilla desde un pedido.
4. Prendé el agente en **Ajustes › API y agentes** y hacé una consulta de un
   producto del catálogo.

## Costos y límites (al 2026-11-19)

- WhatsApp cobra por mensaje entregado; Argentina tiene tarifa propia en ARS.
  Las plantillas de utilidad se cobran también dentro de las 24 h desde el
  2026-10-01. Tabla: <https://business.whatsapp.com/products/platform-pricing#rates>.
- Sin verificar el negocio: hasta 250 personas distintas por día con mensajes
  que inicia Odell (plantillas). Verificando ISA 3D sube a 2.000.
- Agente de atención: tope de USD 20 por mes (Ajustes › API y agentes).

## Pendiente de confirmar

- Si el token del usuario del sistema ofrece «Nunca vence».
- Si Messenger e Instagram piden revisión de la app para uso propio.
- Si hace falta suscribir la cuenta de WhatsApp con `subscribed_apps` (si los
  mensajes no llegan después del paso 5, Claude lo hace con el token).
