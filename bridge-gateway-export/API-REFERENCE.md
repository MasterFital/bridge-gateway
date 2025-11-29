# API Reference - Bridge.xyz API Gateway

Documentación técnica completa de todos los endpoints del API Gateway.

## Información General

### URL Base
```
Desarrollo: http://localhost:3000
Producción: https://tu-proyecto.vercel.app
```

### Autenticación

Todos los endpoints (excepto `/health` y `/webhooks/bridge`) requieren el header:

```
x-api-token: tu_token_secreto
```

### Headers Comunes

```http
Content-Type: application/json
Accept: application/json
x-api-token: tu_token_secreto
```

### Formato de Respuestas

**Éxito:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción del error"
  }
}
```

### Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| 200 | Operación exitosa |
| 201 | Recurso creado |
| 400 | Error de validación |
| 401 | No autorizado |
| 404 | Recurso no encontrado |
| 422 | Error de procesamiento |
| 429 | Rate limit excedido |
| 500 | Error interno |

---

## Monitoring

### GET /health

Health check del gateway (no requiere autenticación).

**Response:**
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

### GET /api/status

Status completo verificando conexión con Bridge API.

**Response:**
```json
{
  "success": true,
  "data": {
    "gateway": {
      "status": "healthy",
      "version": "1.0.0",
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "bridge": {
      "status": "connected",
      "responseTime": "150ms",
      "apiVersion": "v0"
    },
    "configuration": {
      "bridgeUrl": "https://api.bridge.xyz/v0",
      "rateLimitMax": 100,
      "rateLimitWindow": "60000ms",
      "authEnabled": true
    }
  }
}
```

---

## Customers API

### POST /api/customers

Crear un nuevo customer.

**Request Body:**
```json
{
  "type": "individual",
  "first_name": "Juan",
  "last_name": "Pérez",
  "email": "juan@ejemplo.com",
  "phone": "+1234567890",
  "address": {
    "street_line_1": "123 Main St",
    "city": "Miami",
    "state": "FL",
    "postal_code": "33101",
    "country": "usa"
  },
  "birth_date": "1990-01-15",
  "tax_identification_number": "123-45-6789"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cust_abc123",
    "type": "individual",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@ejemplo.com",
    "status": "active",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### GET /api/customers

Listar todos los customers con paginación.

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| limit | number | Número de resultados (default: 10) |
| after | string | Cursor para paginación |

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "cust_abc123",
        "type": "individual",
        "first_name": "Juan",
        "last_name": "Pérez"
      }
    ],
    "has_more": true,
    "next_cursor": "cust_xyz789"
  }
}
```

### GET /api/customers/:id

Obtener un customer por ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cust_abc123",
    "type": "individual",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@ejemplo.com",
    "status": "active",
    "endorsements": {
      "base": {
        "status": "approved"
      }
    }
  }
}
```

### PUT /api/customers/:id

Actualizar un customer.

**Request Body:**
```json
{
  "email": "nuevo@ejemplo.com",
  "phone": "+1987654321"
}
```

### DELETE /api/customers/:id

Eliminar un customer.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cust_abc123",
    "deleted": true
  }
}
```

### GET /api/customers/:id/kyc-link

Obtener KYC link de un customer existente.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "kyc_abc123",
    "url": "https://verify.bridge.xyz/kyc/...",
    "status": "not_started",
    "expires_at": "2024-01-22T10:30:00.000Z"
  }
}
```

### GET /api/customers/:id/tos-link

Obtener TOS acceptance link.

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://bridge.xyz/tos/...",
    "version": "4/14/2024"
  }
}
```

### POST /api/customers/tos-links

Crear TOS link para nuevos customers.

**Request Body:**
```json
{
  "redirect_uri": "https://tuapp.com/callback"
}
```

---

## KYC Links API

### POST /api/kyc-links

Crear un KYC link.

**Request Body:**
```json
{
  "customer_id": "cust_abc123",
  "type": "individual",
  "endorsements": ["base", "sepa"],
  "redirect_uri": "https://tuapp.com/kyc-complete"
}
```

**Endorsements disponibles:**
- `base` - Verificación básica
- `sepa` - Transferencias SEPA (Europa)
- `spei` - Transferencias SPEI (México)
- `pix` - Transferencias PIX (Brasil)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "kyc_abc123",
    "url": "https://verify.bridge.xyz/kyc/...",
    "status": "not_started",
    "customer_id": "cust_abc123",
    "endorsements": ["base", "sepa"]
  }
}
```

### GET /api/kyc-links/:id

Obtener KYC link con status.

**Status posibles:**
- `not_started` - No iniciado
- `under_review` - En revisión
- `incomplete` - Información faltante
- `approved` - Aprobado
- `rejected` - Rechazado

---

## External Accounts API

### POST /api/customers/:id/external-accounts

Crear cuenta bancaria externa.

**Request Body (US Account):**
```json
{
  "account_type": "us",
  "account_number": "123456789",
  "routing_number": "021000021",
  "account_owner_name": "Juan Pérez",
  "currency": "usd"
}
```

**Request Body (IBAN):**
```json
{
  "account_type": "iban",
  "iban": "ES9121000418450200051332",
  "bic_swift": "CAIXESBBXXX",
  "account_owner_name": "Juan Pérez",
  "currency": "eur"
}
```

### POST /api/customers/:id/external-accounts/:accountId/reactivate

Reactivar cuenta desactivada.

---

## Bridge Wallets API

### POST /api/customers/:id/wallets

Crear wallet custodial.

**Request Body:**
```json
{
  "chain": "ethereum",
  "currency": "usdc"
}
```

**Chains soportadas:**
- `ethereum`
- `solana`
- `polygon`
- `base`
- `arbitrum`
- `optimism`

**Currencies soportadas:**
- `usdc`
- `usdt`
- `usdb`
- `eurc`
- `pyusd`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "wall_abc123",
    "chain": "ethereum",
    "currency": "usdc",
    "address": "0x1234...abcd",
    "balance": "0.00"
  }
}
```

---

## Transfers API

### POST /api/transfers

Crear un transfer.

**On-ramp (Fiat → Crypto):**
```json
{
  "amount": "100.00",
  "on_behalf_of": "cust_abc123",
  "source": {
    "payment_rail": "ach",
    "currency": "usd",
    "external_account_id": "ext_abc123"
  },
  "destination": {
    "payment_rail": "ethereum",
    "currency": "usdc",
    "bridge_wallet_id": "wall_xyz789"
  },
  "developer_fee": "1.00"
}
```

**Off-ramp (Crypto → Fiat):**
```json
{
  "amount": "100.00",
  "on_behalf_of": "cust_abc123",
  "source": {
    "payment_rail": "ethereum",
    "currency": "usdc",
    "bridge_wallet_id": "wall_xyz789"
  },
  "destination": {
    "payment_rail": "ach",
    "currency": "usd",
    "external_account_id": "ext_abc123"
  }
}
```

**Payment Rails:**
- `ach` - ACH (US)
- `wire` - Wire transfer (US)
- `sepa` - SEPA (Europe)
- `swift` - SWIFT (International)
- `spei` - SPEI (Mexico)
- `pix` - PIX (Brazil)
- `ethereum`, `solana`, `polygon`, `base` - Crypto

---

## Virtual Accounts API

### POST /api/customers/:id/virtual-accounts

Crear virtual account para recibir depósitos.

**Request Body:**
```json
{
  "currency": "usd",
  "destination": {
    "bridge_wallet_id": "wall_abc123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "va_abc123",
    "currency": "usd",
    "account_number": "1234567890",
    "routing_number": "021000021",
    "bank_name": "Bridge Bank",
    "status": "active"
  }
}
```

### GET /api/customers/:id/virtual-accounts/:accountId/history

Obtener historial de transacciones.

---

## Static Memos API

### POST /api/customers/:id/static-memos

Crear static memo para depósitos recurrentes.

**Request Body:**
```json
{
  "destination": {
    "bridge_wallet_id": "wall_abc123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sm_abc123",
    "memo": "BRIDGE-ABC123",
    "destination_address": "0x1234...abcd"
  }
}
```

---

## Liquidation Addresses API

### POST /api/customers/:id/liquidation-addresses

Crear address para conversión automática crypto → fiat/crypto.

**Request Body:**
```json
{
  "chain": "ethereum",
  "currency": "usdc",
  "destination": {
    "external_account_id": "ext_abc123"
  }
}
```

---

## Prefunded Accounts API

### GET /api/prefunded-accounts

Listar prefunded accounts del developer.

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "pfa_abc123",
        "currency": "usd",
        "available_balance": "10000.00"
      }
    ]
  }
}
```

---

## Cards API

### POST /api/cards

Emitir una card.

**Request Body:**
```json
{
  "customer_id": "cust_abc123",
  "card_type": "virtual",
  "wallet_id": "wall_xyz789"
}
```

**Card Types:**
- `virtual` - Tarjeta virtual
- `physical` - Tarjeta física

### PUT /api/cards/:id

Actualizar estado de la card.

**Request Body:**
```json
{
  "status": "frozen"
}
```

**Status posibles:**
- `active` - Activa
- `frozen` - Congelada
- `closed` - Cerrada

---

## Plaid Integration API

### POST /api/plaid/link-tokens

Crear Plaid link token para verificación bancaria.

**Request Body:**
```json
{
  "customer_id": "cust_abc123"
}
```

### POST /api/plaid/external-accounts

Crear external account desde token de Plaid.

**Request Body:**
```json
{
  "customer_id": "cust_abc123",
  "public_token": "public-sandbox-...",
  "account_id": "account_123"
}
```

---

## Exchange Rates API

### GET /api/exchange-rates

Obtener tasas de cambio.

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| from | string | Moneda origen |
| to | string | Moneda destino |

**Response:**
```json
{
  "success": true,
  "data": {
    "rates": {
      "usd_usdc": "1.0000",
      "eur_usdc": "1.0850"
    }
  }
}
```

---

## Lists / Reference Data API

### GET /api/lists/currencies

Listar currencies soportadas.

### GET /api/lists/chains

Listar blockchains soportadas.

### GET /api/lists/countries

Listar países soportados con rails disponibles.

---

## Webhooks Management API

### POST /api/webhooks

Crear webhook endpoint.

**Request Body:**
```json
{
  "url": "https://tuapp.com/webhooks/bridge",
  "enabled": false
}
```

### PUT /api/webhooks/:id

Habilitar/deshabilitar webhook.

**Request Body:**
```json
{
  "enabled": true
}
```

### POST /api/webhooks/:id/send

Enviar evento de prueba.

---

## Webhook Receiver

### POST /webhooks/bridge

Endpoint para recibir webhooks de Bridge (no requiere autenticación del gateway).

**Headers recibidos:**
```
X-Webhook-Signature: [firma RSA-PSS SHA-256]
Content-Type: application/json
```

**Eventos soportados:**
- `customer.created`, `customer.updated`, `customer.deleted`
- `kyc_link.created`, `kyc_link.approved`, `kyc_link.rejected`
- `transfer.created`, `transfer.pending`, `transfer.completed`, `transfer.failed`
- `card.created`, `card.activated`, `card.frozen`
- `card_transaction.pending`, `card_transaction.completed`, `card_transaction.declined`
- `virtual_account.created`, `virtual_account.funds_received`
- `static_memo.created`, `static_memo.funds_received`
- `liquidation_address.created`, `liquidation_address.funds_received`

---

## Rate Limiting

| Header | Descripción |
|--------|-------------|
| X-RateLimit-Limit | Límite máximo por ventana |
| X-RateLimit-Remaining | Peticiones restantes |
| X-RateLimit-Reset | Segundos hasta reset |
| Retry-After | Segundos a esperar (solo en 429) |

**Límite por defecto:** 100 peticiones por minuto por IP.

---

## Idempotency

Todas las peticiones POST y PUT incluyen automáticamente un `Idempotency-Key` (UUID v4).

Para usar tu propia key, incluye el header:
```
Idempotency-Key: tu-key-unica
```

Las keys expiran después de 24 horas.
