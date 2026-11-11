# E-commerce para PYMES con IA

Este proyecto es una solución de comercio electrónico moderna y completa, diseñada específicamente para pequeñas y medianas empresas (PYMES). Permite a los negocios gestionar sus productos, pedidos y clientes de forma centralizada, ofreciendo al mismo tiempo una experiencia de compra fluida y enriquecida con inteligencia artificial para la generación de ideas de productos.

## ✨ Características Principales

- **Gestión de Múltiples Empresas:** Plataforma multi-tenant donde cada empresa puede gestionar su propio catálogo, pedidos y personalización.
- **Catálogo de Productos Completo:** Soporte para productos con múltiples variantes, personalización y galería de imágenes.
- **Carrito de Compras y Checkout:** Flujo de compra con transferencia, efectivo o tarjeta (Payphone o Stripe, por tienda).
- **Panel de Administración:** Interfaz para administrar productos, categorías, pedidos, clientes y configuración de la empresa.
- **Autenticación y Perfiles de Usuario:** Gestión de cuentas para clientes y administradores.
- **🤖 Asistente de Ideas con IA:** Una función innovadora que utiliza IA generativa (Google Gemini) para ayudar a los clientes a crear conceptos de productos personalizados.
- **Despliegue Automatizado:** Integración con Netlify para un despliegue continuo desde GitHub.

## 🚀 Stack Tecnológico

- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Backend & Base de Datos:** Firebase (Firestore, Authentication, Storage)
- **Funciones Serverless:** Netlify Functions
- **Inteligencia Artificial:** Google Gemini API
- **Procesamiento de Pagos:** Payphone y Stripe
- **Hosting:** Netlify

## 🏁 Cómo Empezar

Sigue estos pasos para configurar y ejecutar el proyecto en tu entorno local.

### Prerrequisitos

- Node.js (v18 o superior)
- pnpm (o npm/yarn)
- Una cuenta de Firebase con un proyecto configurado.
- Una cuenta de Stripe.
- Una clave de API para Google Gemini.

### Instalación

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/alexisbanda/e-souvenirs.git
    cd e-souvenirs
    ```

2.  **Instala las dependencias:**
    ```bash
    pnpm install
    ```

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto y añade las siguientes variables con tus propias claves. Este archivo está ignorado por Git, por lo que tus claves permanecerán seguras.

```env
# Firebase - Obtenidas desde la consola de Firebase
VITE_FIREBASE_API_KEY="TU_API_KEY"
VITE_FIREBASE_AUTH_DOMAIN="TU_AUTH_DOMAIN"
VITE_FIREBASE_PROJECT_ID="TU_PROJECT_ID"
VITE_FIREBASE_STORAGE_BUCKET="TU_STORAGE_BUCKET"
VITE_FIREBASE_MESSAGING_SENDER_ID="TU_MESSAGING_SENDER_ID"
VITE_FIREBASE_APP_ID="TU_APP_ID"

# Stripe - Cuenta de la plataforma, solo para las tiendas con Stripe activado
STRIPE_SECRET_KEY="TU_CLAVE_SECRETA_DE_STRIPE"
STRIPE_WEBHOOK_SECRET="whsec_..."

# Origen de las URLs de vuelta del pago con tarjeta. Si falta, se usa URL (la define Netlify).
SITE_URL="https://tu-dominio.com"

# Resend - Correos del pedido (confirmación al comprador y aviso de venta a la tienda).
# Sin cualquiera de las dos, el pedido se crea igual pero no se envía ningún correo.
RESEND_API_KEY="re_..."
# Remitente en un dominio propio verificado en Resend (e-souvenirs.netlify.app no se puede verificar).
RESEND_FROM="Pedidos <pedidos@tu-dominio.com>"

# Google Gemini - Clave para las Netlify Functions
GEMINI_API_KEY="TU_API_KEY_DE_GEMINI"

# Opcional - Modelo de texto de la Gemini API usado para generar descripciones
# y conceptos. Por defecto: gemini-3.5-flash-lite. Permite cambiar de modelo
# sin tocar código, por ejemplo si el modelo por defecto da errores por alta
# demanda.
GEMINI_TEXT_MODEL="gemini-3.5-flash-lite"

# Opcional - Modelo de imagen de Vertex AI (Imagen) usado al generar conceptos
# con el proveedor GOOGLE_IMAGEN. Por defecto: imagen-4.0-fast-generate-001,
# que Google tiene marcado como deprecado (ver netlify/lib/ai-models.ts).
IMAGEN_MODEL="imagen-4.0-fast-generate-001"

# Cloudflare Turnstile - Protege las sugerencias de IA del registro de empresas.
# Sin estas dos variables, el registro de empresas no funciona.
VITE_TURNSTILE_SITE_KEY="TU_SITE_KEY_DE_TURNSTILE"
TURNSTILE_SECRET_KEY="TU_SECRET_KEY_DE_TURNSTILE"

# Opcional - Generaciones de conceptos por usuario y hora. Por defecto: 10. Un
# valor que no sea un entero positivo también usa 10.
AI_GENERATIONS_PER_HOUR="10"

# Opcional - Generaciones de conceptos por hora sumando todas las tiendas. Por
# defecto: 500. Un valor que no sea un entero positivo también usa 500. Al alcanzarlo,
# ninguna tienda puede generar hasta la hora siguiente.
AI_GLOBAL_GENERATIONS_PER_HOUR="500"
```

### Ejecutar en Desarrollo

Para iniciar el servidor de desarrollo de Vite:

```bash
pnpm dev
```

## 📦 Despliegue

El proyecto está configurado para un despliegue automático en Netlify. Cada vez que se hace un `push` a la rama `master`, Netlify construirá y desplegará la última versión del sitio.

**Importante:** Asegúrate de configurar las variables de entorno (`STRIPE_SECRET_KEY` y `GEMINI_API_KEY`) en la configuración de tu sitio en Netlify para que las funciones serverless operen correctamente en producción. `GEMINI_TEXT_MODEL` e `IMAGEN_MODEL` son opcionales: si no se definen, se usan los modelos por defecto `gemini-3.5-flash-lite` e `imagen-4.0-fast-generate-001`. El de texto es el vigente (se puede cambiar con `GEMINI_TEXT_MODEL` sin tocar código, por ejemplo si vuelve a dar errores por alta demanda); el de imagen está deprecado por Google y solo afecta a las empresas que usan el proveedor `GOOGLE_IMAGEN` (las que usan `PEXELS` no lo invocan).

**Sin `VITE_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` en Netlify, el registro de empresas deja de funcionar:** el formulario no puede pedir sugerencias y la función las rechaza. `VITE_TURNSTILE_SITE_KEY` se lee al compilar, así que después de añadirla hay que volver a desplegar. El widget de Turnstile debe tener autorizado cada dominio donde se use. `AI_GENERATIONS_PER_HOUR` (por usuario, 10 por defecto), `AI_COMPANY_GENERATIONS_PER_HOUR` (por empresa, entre todos sus usuarios, 100 por defecto) y `AI_GLOBAL_GENERATIONS_PER_HOUR` (sumando todas las tiendas, 500 por defecto) son opcionales. Al alcanzar el máximo global, ninguna tienda puede generar hasta la hora siguiente. Los contadores están en la colección `aiUsage` de Firestore, solo accesible desde el servidor. **Sin una política de TTL sobre `expiresAt` no se borran nunca:** consulta el checklist de despliegue.

### Pago con tarjeta

Cada tienda cobra con su propia cuenta de Payphone, o con la cuenta de Stripe de la plataforma si el superadmin lo activa. El servidor calcula el importe y crea la orden solo después de confirmar el pago con el proveedor. Sin proveedor configurado, el checkout no ofrece la tarjeta.

Para activarlo o desactivarlo en una tienda (escribe `paymentCredentials/{companyId}`, que ningún cliente puede leer, y `companies/{companyId}.cardProvider`):

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/la/cuenta-de-servicio.json   # o --service-account <ruta>
PAYPHONE_TOKEN="<token>" npm run payments:set-provider -- --company <id> --provider payphone --store-id <storeId> [--tax-rate 0.15]
npm run payments:set-provider -- --company <id> --provider stripe
npm run payments:set-provider -- --company <id> --disable
```

- `--tax-rate`: solo si los precios incluyen IVA; entonces se desglosa para Payphone. Sin él, todo el importe va como `amountWithoutTax`. También se admite `--token`, pero queda en el historial de la terminal.
- Payphone: el dominio de la tienda debe estar autorizado en la aplicación de Payphone. Si la confirmación falla al volver, Payphone revierte el pago a los 5 minutos y no se crea la orden.
- Stripe: define `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en Netlify y registra el webhook `https://<tu-dominio>/.netlify/functions/stripe-webhook` con el evento `checkout.session.completed` (y `checkout.session.async_payment_succeeded`). En local: `stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook`.
- `SITE_URL` (o `URL`, que define Netlify) es el origen de las URLs de vuelta; nunca se toma de la petición.

### Correos del pedido

Cada pedido nuevo (transferencia, efectivo o tarjeta) envía con [Resend](https://resend.com) dos correos: la confirmación al comprador (en el idioma por defecto de la tienda) y el aviso de venta a la tienda (en español), al correo de contacto de la tienda o, si no tiene, al del usuario administrador (`companies.adminUid` → `users/<uid>.email`). Los envía `netlify/lib/order-emails.ts` desde `create-order`, `confirm-card-payment` y `stripe-webhook`.

- `RESEND_API_KEY`: clave de la API de Resend. Sin ella no se envían correos (queda una línea en el log).
- `RESEND_FROM`: remitente, p. ej. `Pedidos <pedidos@tu-dominio.com>`. Debe ser de un dominio propio verificado en Resend: `e-souvenirs.netlify.app` no se puede verificar. Sin ella tampoco se envían correos. El comprador puede responder al correo y la respuesta llega al correo de contacto de la tienda.
- `URL` (la define Netlify): origen del enlace al pedido en el panel (`<URL>/admin/orders/<id>`) del aviso de venta. Sin ella el aviso va sin enlace.
- Cada correo se envía una sola vez por pedido: el pedido guarda `notifications.buyerEmailSentAt` y `notifications.sellerEmailSentAt`. Si Resend falla o no responde en 5 s, el pedido se crea igual, se borra la marca y el log registra solo el código del error.

### Reglas e índices de Firebase

Las reglas de Firestore y Storage y los índices viven en el repositorio (`firestore.rules`, `storage.rules`, `firestore.indexes.json`) y no se despliegan con Netlify. Para publicarlos:

```bash
firebase deploy --only firestore,storage --project e-souvenirs-b2270
```

Checklist de despliegue:

1. Antes de las reglas, comprueba que el código con `limit(1)` en la consulta de cupones ya está publicado en Netlify.
2. Ejecuta el comando en modo interactivo, sin `--non-interactive` ni `--force`.
3. Acepta el permiso que Storage necesita para leer Firestore, si la CLI lo pide: las reglas de Storage consultan `users`.
4. No aceptes borrar índices, si la CLI pregunta por índices que no están en `firestore.indexes.json`.
5. Activa una vez la política de TTL de los contadores de IA, que no se despliega con este comando. Sin ella, `aiUsage` crece sin límite:

   ```bash
   gcloud firestore fields ttls update expiresAt --collection-group=aiUsage --enable-ttl --project=e-souvenirs-b2270
   ```
6. Después, comprueba en producción:
   - el registro de una empresa nueva;
   - la subida de una imagen como administrador;
   - la aplicación de un cupón en el carrito;
   - el panel de `superadmin`;
   - el panel de `companyadmin`.

### Tests de reglas

Corren en el emulador con el proyecto `demo-e-souvenirs`, sin tocar datos reales. Requieren Java 21 o superior; `npx` descarga la versión fijada de `firebase-tools`.

```bash
npm run test:rules
```

`npm run check` no los incluye, así que no necesita el emulador.
