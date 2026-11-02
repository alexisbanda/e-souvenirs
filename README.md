# E-commerce para PYMES con IA

Este proyecto es una solución de comercio electrónico moderna y completa, diseñada específicamente para pequeñas y medianas empresas (PYMES). Permite a los negocios gestionar sus productos, pedidos y clientes de forma centralizada, ofreciendo al mismo tiempo una experiencia de compra fluida y enriquecida con inteligencia artificial para la generación de ideas de productos.

## ✨ Características Principales

- **Gestión de Múltiples Empresas:** Plataforma multi-tenant donde cada empresa puede gestionar su propio catálogo, pedidos y personalización.
- **Catálogo de Productos Completo:** Soporte para productos con múltiples variantes, personalización y galería de imágenes.
- **Carrito de Compras y Checkout:** Flujo de compra intuitivo con integración de pagos a través de Stripe.
- **Panel de Administración:** Interfaz para administrar productos, categorías, pedidos, clientes y configuración de la empresa.
- **Autenticación y Perfiles de Usuario:** Gestión de cuentas para clientes y administradores.
- **🤖 Asistente de Ideas con IA:** Una función innovadora que utiliza IA generativa (Google Gemini) para ayudar a los clientes a crear conceptos de productos personalizados.
- **Despliegue Automatizado:** Integración con Netlify para un despliegue continuo desde GitHub.

## 🚀 Stack Tecnológico

- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Backend & Base de Datos:** Firebase (Firestore, Authentication, Storage)
- **Funciones Serverless:** Netlify Functions
- **Inteligencia Artificial:** Google Gemini API
- **Procesamiento de Pagos:** Stripe
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

# Stripe - Clave secreta para las Netlify Functions
STRIPE_SECRET_KEY="TU_CLAVE_SECRETA_DE_STRIPE"

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
```

### Ejecutar en Desarrollo

Para iniciar el servidor de desarrollo de Vite:

```bash
pnpm dev
```

## 📦 Despliegue

El proyecto está configurado para un despliegue automático en Netlify. Cada vez que se hace un `push` a la rama `master`, Netlify construirá y desplegará la última versión del sitio.

**Importante:** Asegúrate de configurar las variables de entorno (`STRIPE_SECRET_KEY` y `GEMINI_API_KEY`) en la configuración de tu sitio en Netlify para que las funciones serverless operen correctamente en producción. `GEMINI_TEXT_MODEL` e `IMAGEN_MODEL` son opcionales: si no se definen, se usan los modelos por defecto `gemini-3.5-flash-lite` e `imagen-4.0-fast-generate-001`. El de texto es el vigente (se puede cambiar con `GEMINI_TEXT_MODEL` sin tocar código, por ejemplo si vuelve a dar errores por alta demanda); el de imagen está deprecado por Google y solo afecta a las empresas que usan el proveedor `GOOGLE_IMAGEN` (las que usan `PEXELS` no lo invocan).

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
5. Después, comprueba en producción:
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
