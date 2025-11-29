# Guía de Despliegue en Vercel

Esta guía te llevará paso a paso para desplegar el Bridge.xyz API Gateway en Vercel como un backend serverless.

## Requisitos Previos

1. Cuenta en [Vercel](https://vercel.com)
2. [Node.js](https://nodejs.org) v18 o superior
3. API Key de [Bridge.xyz](https://dashboard.bridge.xyz)
4. Git instalado

## Paso 1: Preparar el Proyecto

### Clonar o Descargar

```bash
# Si tienes el repositorio
git clone tu-repositorio
cd bridge-api-gateway

# O simplemente copia estos archivos:
# - api/index.js
# - vercel.json
# - package.json
# - bridge-client.js
```

### Verificar Estructura

```
tu-proyecto/
├── api/
│   └── index.js          # Servidor principal
├── bridge-client.js      # Cliente JavaScript
├── vercel.json          # Configuración Vercel
├── package.json         # Dependencias
├── .env.example         # Template de variables
├── README.md            # Documentación
├── DEPLOYMENT.md        # Esta guía
├── API-REFERENCE.md     # Referencia técnica
└── EXAMPLES.md          # Casos de uso
```

## Paso 2: Instalar Vercel CLI

```bash
npm install -g vercel
```

## Paso 3: Iniciar Sesión en Vercel

```bash
vercel login
```

Sigue las instrucciones para autenticarte.

## Paso 4: Configurar Variables de Entorno

### Opción A: Usando Vercel CLI

```bash
# API Key de Bridge (REQUERIDO)
vercel env add BRIDGE_API_KEY

# Token de autenticación del gateway (REQUERIDO)
vercel env add MI_TOKEN_SECRETO

# URL de Bridge API (OPCIONAL - usa producción por defecto)
vercel env add BRIDGE_URL

# Secret para webhooks (OPCIONAL)
vercel env add WEBHOOK_SECRET
```

Cuando te pregunte el valor, ingresa cada uno:
- `BRIDGE_API_KEY`: Tu API key de Bridge.xyz
- `MI_TOKEN_SECRETO`: Un token seguro que generarás (ver abajo)
- `BRIDGE_URL`: `https://api.bridge.xyz/v0` (producción)

### Generar Token Seguro

```bash
# En Linux/Mac
openssl rand -hex 32

# En Windows (PowerShell)
[System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Resultado ejemplo:
# a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### Opción B: Usando Dashboard de Vercel

1. Ir a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Seleccionar tu proyecto (después de desplegarlo una vez)
3. Ir a **Settings** → **Environment Variables**
4. Agregar cada variable:
   - `BRIDGE_API_KEY` = tu_api_key
   - `MI_TOKEN_SECRETO` = tu_token_seguro
   - `BRIDGE_URL` = `https://api.bridge.xyz/v0`

## Paso 5: Desplegar

### Primera vez (vincular proyecto)

```bash
vercel
```

Responde a las preguntas:
- **Set up and deploy?** → Yes
- **Which scope?** → Tu cuenta o equipo
- **Link to existing project?** → No (primera vez)
- **Project name?** → bridge-api-gateway (o el que prefieras)
- **Directory?** → ./ (directorio actual)

### Despliegues posteriores

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

## Paso 6: Verificar Despliegue

### Health Check

```bash
curl https://tu-proyecto.vercel.app/health
```

Respuesta esperada:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0.0",
    "service": "bridge-api-gateway"
  }
}
```

### Status Completo

```bash
curl -H "x-api-token: tu_token_secreto" \
  https://tu-proyecto.vercel.app/api/status
```

Respuesta esperada:
```json
{
  "success": true,
  "data": {
    "gateway": {
      "status": "healthy",
      "version": "1.0.0"
    },
    "bridge": {
      "status": "connected",
      "responseTime": "150ms"
    }
  }
}
```

## Paso 7: Configurar Webhooks en Bridge

1. Ir a [Bridge Dashboard](https://dashboard.bridge.xyz)
2. Navegar a **Webhooks**
3. Crear nuevo webhook:
   - **URL**: `https://tu-proyecto.vercel.app/webhooks/bridge`
   - **Events**: Seleccionar los eventos que necesitas
4. Guardar y copiar el **Webhook Secret**
5. Agregar el secret en Vercel:
   ```bash
   vercel env add WEBHOOK_SECRET
   ```

## Configuración de vercel.json

El archivo `vercel.json` ya está configurado óptimamente:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    { "src": "/health", "dest": "/api/index.js" },
    { "src": "/webhooks/(.*)", "dest": "/api/index.js" },
    { "src": "/api/(.*)", "dest": "/api/index.js" },
    { "src": "/(.*)", "dest": "/api/index.js" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization, x-api-token, Api-Key, Idempotency-Key" }
      ]
    }
  ],
  "functions": {
    "api/index.js": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

## Dominios Personalizados

### Agregar Dominio

```bash
vercel domains add api.tudominio.com
```

O desde el dashboard:
1. **Settings** → **Domains**
2. Agregar dominio
3. Configurar DNS según instrucciones

### Configurar DNS

Agregar registro CNAME en tu proveedor DNS:
```
api.tudominio.com → cname.vercel-dns.com
```

## Monitoreo y Logs

### Ver Logs en Tiempo Real

```bash
vercel logs --follow
```

### Ver Logs en Dashboard

1. Ir a tu proyecto en Vercel
2. **Deployments** → Seleccionar deployment
3. **Functions** → Ver logs de cada función

## Límites de Vercel

| Recurso | Límite (Hobby) | Límite (Pro) |
|---------|----------------|--------------|
| Timeout | 10s | 60s |
| Memoria | 1024 MB | 3008 MB |
| Payload | 4.5 MB | 4.5 MB |
| Invocaciones | 100k/mes | Ilimitado |

Nuestro `vercel.json` configura:
- **maxDuration**: 30s (dentro del límite Pro)
- **memory**: 1024 MB

## Troubleshooting

### Error: "BRIDGE_API_KEY not configured"

```bash
# Verificar variable
vercel env ls

# Agregar si falta
vercel env add BRIDGE_API_KEY
```

### Error: "401 Unauthorized"

Verificar que estás enviando el header correcto:
```bash
curl -H "x-api-token: tu_token_aqui" https://...
```

### Error: "Function timeout"

El gateway tiene timeout de 30s. Si Bridge tarda más:
1. Verificar conectividad con Bridge
2. Considerar upgrade a Vercel Pro para mayor timeout

### Error: "Rate limit exceeded"

- Límite: 100 req/min por IP
- Esperar el tiempo indicado en `Retry-After`
- Considerar aumentar `RATE_LIMIT_MAX`

### Logs Vacíos

```bash
# Forzar rebuild
vercel --force

# Ver logs de build
vercel logs --type build
```

## Actualizar Deployment

```bash
# Hacer cambios en el código
# ...

# Desplegar nueva versión
vercel --prod
```

## Rollback

```bash
# Listar deployments
vercel ls

# Promover deployment anterior a producción
vercel promote [deployment-url]
```

## Eliminar Proyecto

```bash
# Eliminar de Vercel (mantiene código local)
vercel remove bridge-api-gateway
```

## Siguiente Paso

Una vez desplegado, consulta [EXAMPLES.md](EXAMPLES.md) para ver casos de uso completos.
