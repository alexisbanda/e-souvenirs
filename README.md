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
```

### Ejecutar en Desarrollo

Para iniciar el servidor de desarrollo de Vite:

```bash
pnpm dev
```

## 📦 Despliegue

El proyecto está configurado para un despliegue automático en Netlify. Cada vez que se hace un `push` a la rama `master`, Netlify construirá y desplegará la última versión del sitio.

**Importante:** Asegúrate de configurar las variables de entorno (`STRIPE_SECRET_KEY` y `GEMINI_API_KEY`) en la configuración de tu sitio en Netlify para que las funciones serverless operen correctamente en producción.
