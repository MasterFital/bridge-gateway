# Bridge.xyz API Gateway

API Gateway completo para Bridge.xyz que actúa como intermediario entre tus aplicaciones y la API oficial de Bridge. Implementa **61+ endpoints** cubriendo todas las funcionalidades de Bridge.

## Características

- **61+ Endpoints** - Customers, KYC, Wallets, Transfers, Cards, Virtual Accounts, y más
- **100% Documentación Oficial** - Apegado a la especificación de Bridge.xyz
- **Exportable a Vercel** - Listo para desplegar como serverless
- **Cliente JavaScript** - Biblioteca lista para usar en frontends
- **Rate Limiting** - 100 peticiones/minuto por IP
- **Idempotency Keys** - Automático para POST/PUT según especificaciones Bridge
- **Autenticación Dual** - API Key de Bridge + Token del gateway

## Inicio Rápido

### 1. Configurar Variables de Entorno

```bash
# Copiar el template
cp .env.example .env

# Editar con tus valores
BRIDGE_API_KEY=tu_api_key_de_bridge
MI_TOKEN_SECRETO=tu_token_secreto_seguro
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Iniciar el Servidor

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

### 4. Verificar Funcionamiento

```bash
# Health check
curl http://localhost:3000/health

# Status completo
curl -H "x-api-token: tu_token_secreto" http://localhost:3000/api/status
```

## Desplegar en Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Configurar secrets
vercel secrets add bridge-api-key "tu_api_key"
vercel secrets add mi-token-secreto "tu_token"

# Desplegar
vercel --prod
```

Ver [DEPLOYMENT.md](DEPLOYMENT.md) para guía completa.

## Endpoints Disponibles

### Monitoring
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check del gateway |
| GET | `/api/status` | Status completo (gateway + Bridge) |

### Customers API (8 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/customers` | Crear customer |
| GET | `/api/customers` | Listar customers |
| GET | `/api/customers/:id` | Obtener customer |
| PUT | `/api/customers/:id` | Actualizar customer |
| DELETE | `/api/customers/:id` | Eliminar customer |
| GET | `/api/customers/:id/kyc-link` | Obtener KYC link |
| GET | `/api/customers/:id/tos-link` | Obtener TOS link |
| POST | `/api/customers/tos-links` | Crear TOS link |

### KYC Links API (3 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/kyc-links` | Crear KYC link |
| GET | `/api/kyc-links` | Listar KYC links |
| GET | `/api/kyc-links/:id` | Obtener KYC link |

### External Accounts API (6 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/customers/:id/external-accounts` | Crear cuenta bancaria |
| GET | `/api/customers/:id/external-accounts` | Listar cuentas |
| GET | `/api/customers/:id/external-accounts/:accountId` | Obtener cuenta |
| PUT | `/api/customers/:id/external-accounts/:accountId` | Actualizar cuenta |
| DELETE | `/api/customers/:id/external-accounts/:accountId` | Eliminar cuenta |
| POST | `/api/customers/:id/external-accounts/:accountId/reactivate` | Reactivar cuenta |

### Bridge Wallets API (3 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/customers/:id/wallets` | Crear wallet |
| GET | `/api/customers/:id/wallets` | Listar wallets |
| GET | `/api/customers/:id/wallets/:walletId` | Obtener wallet |

### Transfers API (5 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/transfers` | Crear transfer |
| GET | `/api/transfers` | Listar transfers |
| GET | `/api/transfers/:id` | Obtener transfer |
| PUT | `/api/transfers/:id` | Actualizar transfer |
| DELETE | `/api/transfers/:id` | Cancelar transfer |

### Virtual Accounts API (7 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/customers/:id/virtual-accounts` | Crear virtual account |
| GET | `/api/customers/:id/virtual-accounts` | Listar virtual accounts |
| GET | `/api/customers/:id/virtual-accounts/:accountId` | Obtener virtual account |
| PUT | `/api/customers/:id/virtual-accounts/:accountId` | Actualizar virtual account |
| POST | `/api/customers/:id/virtual-accounts/:accountId/deactivate` | Desactivar |
| POST | `/api/customers/:id/virtual-accounts/:accountId/reactivate` | Reactivar |
| GET | `/api/customers/:id/virtual-accounts/:accountId/history` | Historial |

### Static Memos API (5 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/customers/:id/static-memos` | Crear static memo |
| GET | `/api/customers/:id/static-memos` | Listar static memos |
| GET | `/api/customers/:id/static-memos/:memoId` | Obtener static memo |
| PUT | `/api/customers/:id/static-memos/:memoId` | Actualizar static memo |
| GET | `/api/customers/:id/static-memos/:memoId/history` | Historial |

### Liquidation Addresses API (4 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/customers/:id/liquidation-addresses` | Crear address |
| GET | `/api/customers/:id/liquidation-addresses` | Listar addresses |
| GET | `/api/customers/:id/liquidation-addresses/:addressId` | Obtener address |
| PUT | `/api/customers/:id/liquidation-addresses/:addressId` | Actualizar address |

### Prefunded Accounts API (2 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/prefunded-accounts` | Listar prefunded accounts |
| GET | `/api/prefunded-accounts/:id` | Obtener prefunded account |

### Cards API (4 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/cards` | Emitir card |
| GET | `/api/cards` | Listar cards |
| GET | `/api/cards/:id` | Obtener card |
| PUT | `/api/cards/:id` | Actualizar card |

### Plaid Integration API (2 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/plaid/link-tokens` | Crear Plaid link token |
| POST | `/api/plaid/external-accounts` | Crear cuenta desde Plaid |

### Exchange Rates API (1 endpoint)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/exchange-rates` | Obtener tasas de cambio |

### Lists / Reference Data API (3 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/lists/currencies` | Listar currencies |
| GET | `/api/lists/chains` | Listar blockchains |
| GET | `/api/lists/countries` | Listar países |

### Webhooks Management API (8 endpoints)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/webhooks` | Crear webhook |
| GET | `/api/webhooks` | Listar webhooks |
| GET | `/api/webhooks/:id` | Obtener webhook |
| PUT | `/api/webhooks/:id` | Actualizar webhook |
| DELETE | `/api/webhooks/:id` | Eliminar webhook |
| GET | `/api/webhooks/:id/events` | Listar eventos |
| GET | `/api/webhooks/:id/logs` | Ver logs |
| POST | `/api/webhooks/:id/send` | Enviar test event |

### Webhook Receiver (1 endpoint)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/webhooks/bridge` | Recibir webhooks de Bridge |

## Uso del Cliente JavaScript

```javascript
import { BridgeClient } from './bridge-client.js';

const client = new BridgeClient({
  baseUrl: 'https://tu-gateway.vercel.app',
  token: 'tu_token_secreto'
});

// Crear customer
const customer = await client.createCustomer({
  type: 'individual',
  first_name: 'Juan',
  last_name: 'Pérez',
  email: 'juan@ejemplo.com'
});

// Crear wallet
const wallet = await client.createWallet(customer.data.id, {
  chain: 'ethereum',
  currency: 'usdc'
});

// Crear transfer (fiat → crypto)
const transfer = await client.fiatToCrypto({
  customerId: customer.data.id,
  amount: 100,
  externalAccountId: 'ext_abc123',
  walletId: wallet.data.id
});
```

## Helpers de Alto Nivel

El cliente incluye métodos de alto nivel para flujos comunes:

```javascript
// Onboarding completo (customer + KYC + wallet)
const result = await client.onboardCliente({
  type: 'individual',
  first_name: 'Juan',
  last_name: 'Pérez',
  email: 'juan@ejemplo.com',
  endorsements: ['base', 'sepa'],
  wallet: { chain: 'ethereum', currency: 'usdc' }
});

// Emitir tarjeta con wallet
const cardResult = await client.issueCardWithWallet({
  customerId: 'cust_123',
  cardType: 'virtual'
});

// Flujo completo de virtual account
const vaResult = await client.createVirtualAccountFlow({
  customerId: 'cust_123',
  currency: 'usd'
});
```

## Autenticación

### Headers Requeridos

```
x-api-token: tu_token_secreto_del_gateway
Content-Type: application/json
```

### Ejemplo con cURL

```bash
curl -X POST https://tu-gateway.vercel.app/api/customers \
  -H "Content-Type: application/json" \
  -H "x-api-token: tu_token_secreto" \
  -d '{
    "type": "individual",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@ejemplo.com"
  }'
```

## Formato de Respuestas

### Respuesta Exitosa
```json
{
  "success": true,
  "data": {
    "id": "cust_abc123",
    "type": "individual",
    "first_name": "Juan",
    "last_name": "Pérez"
  }
}
```

### Respuesta de Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El campo email es requerido"
  }
}
```

## Rate Limiting

- **Límite**: 100 peticiones por minuto por IP
- **Headers de respuesta**:
  - `X-RateLimit-Limit`: Límite máximo
  - `X-RateLimit-Remaining`: Peticiones restantes
  - `X-RateLimit-Reset`: Segundos hasta reset
- **Error 429**: Incluye header `Retry-After`

## Webhooks

### Configurar Webhook en Bridge Dashboard

1. Ir a [Bridge Dashboard](https://dashboard.bridge.xyz)
2. Configurar URL: `https://tu-gateway.vercel.app/webhooks/bridge`
3. Habilitar eventos deseados

### Eventos Soportados

- `customer.*` - Eventos de customers
- `kyc_link.*` - Eventos de KYC
- `transfer.*` - Eventos de transfers
- `card.*` - Eventos de cards
- `card_transaction.*` - Transacciones de cards
- `virtual_account.*` - Eventos de virtual accounts
- `static_memo.*` - Eventos de static memos
- `liquidation_address.*` - Eventos de liquidation addresses

## Variables de Entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `BRIDGE_API_KEY` | Sí | API Key de Bridge.xyz |
| `MI_TOKEN_SECRETO` | Sí | Token para proteger el gateway |
| `BRIDGE_URL` | No | URL de Bridge API (default: producción) |
| `WEBHOOK_SECRET` | No | Secret para validar webhooks |
| `RATE_LIMIT_MAX` | No | Límite de peticiones (default: 100) |
| `RATE_LIMIT_WINDOW` | No | Ventana en ms (default: 60000) |

## Documentación Adicional

- [DEPLOYMENT.md](DEPLOYMENT.md) - Guía de despliegue en Vercel
- [API-REFERENCE.md](API-REFERENCE.md) - Referencia técnica completa
- [EXAMPLES.md](EXAMPLES.md) - Casos de uso con código

## Soporte

- Documentación Bridge: https://docs.bridge.xyz
- Dashboard Bridge: https://dashboard.bridge.xyz

## Licencia

MIT
