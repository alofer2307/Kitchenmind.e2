# KitchenMind — despliegue GitHub + Vercel

Este paquete está preparado para subirse con **la raíz del proyecto completa**. En GitHub, `package.json`, `app/`, `components/`, `services/`, `repositories/`, `providers/`, `drizzle/` y `public/` deben quedar al mismo nivel.

## 1. GitHub

Sube todo el contenido de este ZIP a la rama `main` del repositorio. No subas una carpeta externa adicional que deje `package.json` un nivel abajo.

El workflow `.github/workflows/verify.yml` ejecuta automáticamente:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

## 2. Variables en Vercel

En **Project Settings → Environment Variables**, agrega:

- `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` — las agrega la integración Turso de Vercel al conectar `kitchenmind-production` en Production. Para instalaciones antiguas sigue disponible Cloudflare D1 con sus tres variables originales.
- `KITCHENMIND_PLATFORM_OWNER_EMAIL`
- `KITCHENMIND_OWNER_PASSWORD` — contraseña inicial de la propietaria; mínimo 10 caracteres, una letra y un número.
- `KITCHENMIND_PLATFORM_MFA_KEY` — secreto aleatorio largo usado para proteger el MFA interno de Platform.
- `NEXT_PUBLIC_APP_URL` — URL pública final de Vercel, sin `/` al final.

Opcional para recuperación por correo:

- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`

No guardes valores reales en `.env.example` ni en GitHub.

## 3. Base de datos

KitchenMind conserva el esquema SQLite y las migraciones originales. El archivo `scripts/apply-d1-migrations.mjs` también reconoce Turso y aplica solo migraciones faltantes.

Con las variables anteriores cargadas en un entorno con Node, ejecuta una sola vez:

```bash
npm run db:migrate:remote
```

Si usas una base anterior, detectará las migraciones existentes y agregará la autenticación nativa `0012_native_auth_vercel.sql`.

## 4. Vercel

Importa el repositorio como proyecto Next.js. La configuración incluida usa:

- Install Command: `npm ci`
- Build Command: `npm run build`
- Framework: Next.js

Después del despliegue abre:

```text
/api/health
```

Debe responder `ready: true`. Si devuelve `503`, el JSON indica qué configuración o esquema falta sin mostrar secretos.

## 5. Primer acceso

Abre `/login` e inicia sesión con `KITCHENMIND_PLATFORM_OWNER_EMAIL` + `KITCHENMIND_OWNER_PASSWORD`. En el primer acceso se crea la credencial nativa y luego KitchenMind conserva el flujo MFA de Platform.

Los clientes ya no necesitan ChatGPT. Al abrir una invitación `/aceptar-invitacion?token=...` pueden crear su contraseña, aceptar la organización y entrar al onboarding.

## Nota de almacenamiento de evidencia

Los registros de Calidad siguen funcionando, pero **la carga/lectura binaria de evidencias** necesita conectar un almacenamiento de objetos compatible. El paquete deja esa función bloqueada de forma explícita en vez de guardar archivos de forma insegura o efímera en Vercel. Esto no afecta autenticación, Platform, prospectos, cotizaciones, onboarding, personal, turnos, asistencia, dispositivos ni dashboard.
