# Bridge.xyz API Gateway - Documentación Completa

> **IMPORTANTE PARA CUALQUIER IA QUE LEA ESTO:**
> - Esta documentación está 100% basada en la documentación oficial de Bridge.xyz (https://apidocs.bridge.xyz)
> - NO inventes endpoints que no existan aquí
> - NO modifiques los nombres de los campos
> - USA exactamente los formatos y estructuras documentados
> - La URL base del Gateway es: `https://bridge-gateway-eta.vercel.app`
> - La URL base de Bridge oficial es: `https://api.bridge.xyz/v0`

---

## ÍNDICE

1. [Autenticación del Gateway](#1-autenticación-del-gateway)
2. [Endpoints de Monitoreo](#2-endpoints-de-monitoreo)
3. [Customers API](#3-customers-api)
4. [KYC Links API](#4-kyc-links-api)
5. [External Accounts API](#5-external-accounts-api)
6. [Wallets API](#6-wallets-api)
7. [Transfers API](#7-transfers-api)
8. [Virtual Accounts API](#8-virtual-accounts-api)
9. [Static Memos API](#9-static-memos-api)
10. [Liquidation Addresses API](#10-liquidation-addresses-api)
11. [Prefunded Accounts API](#11-prefunded-accounts-api)
12. [Cards API](#12-cards-api)
13. [Plaid Integration API](#13-plaid-integration-api)
14. [Exchange Rates API](#14-exchange-rates-api)
15. [Reference Data API](#15-reference-data-api)
16. [Webhooks API](#16-webhooks-api)
17. [Códigos de Error](#17-códigos-de-error)
18. [Glosario de Términos](#18-glosario-de-términos)

---

## 1. AUTENTICACIÓN DEL GATEWAY

El Gateway soporta DOS métodos de autenticación:

### Método A: JWT (Recomendado para múltiples usuarios)

Cada usuario crea su cuenta y recibe un token JWT temporal.

#### POST /auth/register - Crear cuenta nueva

**Descripción:** Crea una nueva cuenta de usuario en el Gateway.

**URL:** `POST https://bridge-gateway-eta.vercel.app/auth/register`

**Headers requeridos:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña_minimo_8_caracteres",
  "name": "Nombre del Usuario"
}
```

**Campos del body:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| email | string | SÍ | Email único del usuario |
| password | string | SÍ | Contraseña (mínimo 8 caracteres) |
| name | string | NO | Nombre del usuario |

**Ejemplo con curl:**
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria@empresa.com",
    "password": "micontraseña123",
    "name": "María García"
  }'
```

**Respuesta exitosa (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "maria@empresa.com",
      "name": "María García",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  }
}
```

**Errores posibles:**
| Código | Error | Causa |
|--------|-------|-------|
| 400 | VALIDATION_ERROR | Email o password faltantes, o password menor a 8 caracteres |
| 409 | EMAIL_EXISTS | Ya existe una cuenta con ese email |
| 500 | REGISTRATION_FAILED | Error interno del servidor |

---

#### POST /auth/login - Iniciar sesión

**Descripción:** Inicia sesión y obtiene un token JWT.

**URL:** `POST https://bridge-gateway-eta.vercel.app/auth/login`

**Headers requeridos:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "tu_contraseña"
}
```

**Ejemplo con curl:**
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria@empresa.com",
    "password": "micontraseña123"
  }'
```

**Respuesta exitosa (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "maria@empresa.com",
      "name": "María García"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  }
}
```

**Errores posibles:**
| Código | Error | Causa |
|--------|-------|-------|
| 400 | VALIDATION_ERROR | Email o password faltantes |
| 401 | INVALID_CREDENTIALS | Email o contraseña incorrectos |
| 403 | ACCOUNT_DISABLED | La cuenta ha sido desactivada |

---

#### GET /auth/me - Obtener usuario actual

**Descripción:** Obtiene los datos del usuario autenticado.

**URL:** `GET https://bridge-gateway-eta.vercel.app/auth/me`

**Headers requeridos:**
```
Authorization: Bearer <tu_token_jwt>
```

**Ejemplo con curl:**
```bash
curl https://bridge-gateway-eta.vercel.app/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Respuesta exitosa (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "maria@empresa.com",
    "name": "María García",
    "created_at": "2024-01-15T10:30:00.000Z",
    "last_login": "2024-01-16T08:00:00.000Z"
  }
}
```

---

### Método B: Token Fijo (Legacy)

Token estático configurado en el servidor. Útil para integraciones simples.

**Header requerido:**
```
x-api-token: tu_token_secreto
```

**Ejemplo:**
```bash
curl https://bridge-gateway-eta.vercel.app/api/customers \
  -H "x-api-token: fa3d8ecaedb33d5d47713ef7c749953c061d06a082c1e0fa1d65e1cc9afec7e9"
```

---

### Cómo usar el token JWT en peticiones

Una vez que tienes el token (de register o login), úsalo así:

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

El token es válido por **7 días**. Después debes hacer login de nuevo.

---

## 2. ENDPOINTS DE MONITOREO

### GET /health - Health Check

**Descripción:** Verifica que el Gateway esté funcionando. NO requiere autenticación.

**URL:** `GET https://bridge-gateway-eta.vercel.app/health`

**Ejemplo:**
```bash
curl https://bridge-gateway-eta.vercel.app/health
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.2.0",
    "service": "bridge-api-gateway",
    "environment": "production"
  }
}
```

---

### GET /api/status - Status Completo

**Descripción:** Status completo del Gateway y conexión con Bridge API.

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/status`

**Requiere autenticación:** SÍ

**Ejemplo:**
```bash
curl https://bridge-gateway-eta.vercel.app/api/status \
  -H "Authorization: Bearer <tu_token>"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "gateway": {
      "status": "healthy",
      "version": "1.2.0",
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "bridge": {
      "status": "connected",
      "responseTime": "150ms",
      "apiVersion": "v0"
    },
    "configuration": {
      "bridgeUrl": "https://api.bridge.xyz/v0",
      "environment": "production",
      "rateLimitMax": 100,
      "rateLimitWindow": "60000ms",
      "rateLimitType": "per-token"
    }
  }
}
```

---

### GET /api/docs - Documentación JSON

**Descripción:** Devuelve la documentación completa en formato JSON para que IAs puedan leerla.

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/docs`

**Requiere autenticación:** SÍ

**Ejemplo:**
```bash
curl https://bridge-gateway-eta.vercel.app/api/docs \
  -H "Authorization: Bearer <tu_token>"
```

---

## 3. CUSTOMERS API

Los Customers son los usuarios finales que utilizan tu plataforma. Pueden ser **individuales** (personas) o **business** (empresas).

### Tipos de Customer

| Tipo | Descripción | Campos principales |
|------|-------------|-------------------|
| individual | Persona física | first_name, last_name, email, birth_date, residential_address |
| business | Empresa/Negocio | business_legal_name, email, registered_address, business_type |

### Estados de KYC (kyc_status)

| Estado | Significado |
|--------|-------------|
| not_started | KYC no iniciado |
| pending | Información enviada, en proceso |
| under_review | En revisión manual por Bridge |
| approved | KYC aprobado |
| active | Cliente activo (puede operar) |
| rejected | KYC rechazado |
| incomplete | Faltan documentos o información |

---

### POST /api/customers - Crear Customer

**Descripción:** Crea un nuevo cliente (individual o business).

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/customers`

**Headers requeridos:**
```
Authorization: Bearer <tu_token>
Content-Type: application/json
```

#### Crear Customer Individual (Persona)

**Body mínimo requerido:**
```json
{
  "type": "individual",
  "first_name": "Juan",
  "last_name": "Pérez",
  "email": "juan@ejemplo.com"
}
```

**Body completo para KYC (recomendado):**
```json
{
  "type": "individual",
  "first_name": "Juan",
  "last_name": "Pérez",
  "email": "juan@ejemplo.com",
  "birth_date": "1990-05-15",
  "residential_address": {
    "street_line_1": "Av. Reforma 123",
    "street_line_2": "Depto 4B",
    "city": "Ciudad de México",
    "subdivision": "CDMX",
    "postal_code": "06600",
    "country": "MEX"
  },
  "signed_agreement_id": "uuid-del-tos-firmado",
  "identifying_information": [
    {
      "type": "national_id",
      "issuing_country": "mex",
      "number": "CURP123456789"
    }
  ]
}
```

**Campos del Customer Individual:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| type | string | SÍ | Siempre "individual" |
| first_name | string | SÍ | Nombre(s) |
| last_name | string | SÍ | Apellido(s) |
| email | string | SÍ | Email único |
| birth_date | string | Para KYC | Fecha de nacimiento (YYYY-MM-DD) |
| residential_address | object | Para KYC | Dirección de residencia |
| signed_agreement_id | string | Para KYC | UUID del acuerdo TOS firmado |
| identifying_information | array | Para KYC | Documentos de identificación |

**Ejemplo curl:**
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers \
  -H "Authorization: Bearer <tu_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "individual",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@ejemplo.com",
    "birth_date": "1990-05-15"
  }'
```

**Respuesta exitosa (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "cust_abc123def456",
    "type": "individual",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@ejemplo.com",
    "kyc_status": "not_started",
    "requirements_due": ["external_account"],
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

#### Crear Customer Business (Empresa)

**Body mínimo:**
```json
{
  "type": "business",
  "business_legal_name": "Mi Empresa SA de CV",
  "email": "contacto@miempresa.com"
}
```

**Body completo para KYB:**
```json
{
  "type": "business",
  "business_legal_name": "Mi Empresa SA de CV",
  "email": "contacto@miempresa.com",
  "business_type": "corporation",
  "business_industry": "1153",
  "business_description": "Desarrollo de software",
  "registered_address": {
    "street_line_1": "Av. Insurgentes 500",
    "city": "Ciudad de México",
    "subdivision": "CDMX",
    "postal_code": "03100",
    "country": "MEX"
  },
  "signed_agreement_id": "uuid-del-tos-firmado",
  "estimated_annual_revenue_usd": "1000000_to_10000000",
  "expected_monthly_payments_usd": 50000,
  "source_of_funds": "business_revenue",
  "ultimate_beneficial_owners": [
    {
      "first_name": "Carlos",
      "last_name": "García",
      "birth_date": "1985-03-20",
      "email": "carlos@miempresa.com",
      "ownership_percentage": "51",
      "is_director": true,
      "has_control": true
    }
  ]
}
```

**Campos específicos de Business:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| business_legal_name | string | Nombre legal de la empresa |
| business_type | string | corporation, llc, partnership, sole_proprietorship |
| business_industry | string | Código de industria |
| registered_address | object | Dirección registrada |
| ultimate_beneficial_owners | array | Dueños con más del 25% |

---

### GET /api/customers - Listar Customers

**Descripción:** Lista todos los customers con paginación.

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers`

**Query Parameters:**
| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| limit | number | 10 | Cantidad por página (máx 100) |
| after | string | - | Cursor para siguiente página |
| before | string | - | Cursor para página anterior |

**Ejemplo:**
```bash
# Primeros 20 customers
curl "https://bridge-gateway-eta.vercel.app/api/customers?limit=20" \
  -H "Authorization: Bearer <tu_token>"

# Siguiente página
curl "https://bridge-gateway-eta.vercel.app/api/customers?limit=20&after=cust_xyz789" \
  -H "Authorization: Bearer <tu_token>"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "cust_abc123",
        "type": "individual",
        "first_name": "Juan",
        "last_name": "Pérez",
        "email": "juan@ejemplo.com",
        "kyc_status": "active"
      },
      {
        "id": "cust_def456",
        "type": "business",
        "business_legal_name": "Empresa XYZ",
        "email": "contacto@xyz.com",
        "kyc_status": "under_review"
      }
    ],
    "has_more": true,
    "cursor": "cust_def456"
  }
}
```

---

### GET /api/customers/:id - Obtener Customer

**Descripción:** Obtiene un customer específico por su ID.

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id`

**Ejemplo:**
```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123 \
  -H "Authorization: Bearer <tu_token>"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "cust_abc123",
    "type": "individual",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@ejemplo.com",
    "kyc_status": "active",
    "tos_status": "approved",
    "endorsements": {
      "base": {
        "status": "approved"
      }
    },
    "requirements_due": [],
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-16T08:00:00.000Z"
  }
}
```

---

### PUT /api/customers/:id - Actualizar Customer

**Descripción:** Actualiza la información de un customer.

**URL:** `PUT https://bridge-gateway-eta.vercel.app/api/customers/:id`

**IMPORTANTE:** Debes enviar TODOS los campos, no solo los que quieres actualizar.

**Ejemplo:**
```bash
curl -X PUT https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123 \
  -H "Authorization: Bearer <tu_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "individual",
    "first_name": "Juan Carlos",
    "last_name": "Pérez López",
    "email": "juancarlos@ejemplo.com",
    "birth_date": "1990-05-15"
  }'
```

---

### DELETE /api/customers/:id - Eliminar Customer

**Descripción:** Elimina un customer (solo si no tiene transacciones activas).

**URL:** `DELETE https://bridge-gateway-eta.vercel.app/api/customers/:id`

**Ejemplo:**
```bash
curl -X DELETE https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123 \
  -H "Authorization: Bearer <tu_token>"
```

---

### GET /api/customers/:id/kyc-link - Obtener Link de KYC

**Descripción:** Obtiene un enlace para que el customer complete su verificación de identidad (KYC) usando Persona.

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/kyc-link`

**Query Parameters opcionales:**
| Parámetro | Descripción |
|-----------|-------------|
| endorsement | Tipo de endorsement: "base", "sepa" |

**Ejemplo:**
```bash
curl "https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/kyc-link" \
  -H "Authorization: Bearer <tu_token>"

# Para SEPA/Euro
curl "https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/kyc-link?endorsement=sepa" \
  -H "Authorization: Bearer <tu_token>"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "kyc_link": "https://bridge.withpersona.com/verify?inquiry-template-id=...",
    "expires_at": "2024-01-16T10:30:00.000Z"
  }
}
```

**Uso:** Redirige al customer a esta URL para que complete su KYC.

---

### GET /api/customers/:id/tos-link - Obtener Link de TOS

**Descripción:** Obtiene un enlace para que el customer acepte los Términos de Servicio.

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/tos-link`

**Ejemplo:**
```bash
curl "https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/tos-link" \
  -H "Authorization: Bearer <tu_token>"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "tos_link": "https://dashboard.bridge.xyz/accept-tos?token=...",
    "expires_at": "2024-01-16T10:30:00.000Z"
  }
}
```

---

## 4. KYC LINKS API

### POST /api/kyc-links - Crear KYC Link

**Descripción:** Crea un enlace KYC para verificación de identidad.

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/kyc-links`

**Body:**
```json
{
  "customer_id": "cust_abc123",
  "type": "individual"
}
```

**Ejemplo:**
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/kyc-links \
  -H "Authorization: Bearer <tu_token>" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "cust_abc123", "type": "individual"}'
```

---

### GET /api/kyc-links - Listar KYC Links

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/kyc-links`

---

### GET /api/kyc-links/:id - Obtener KYC Link

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/kyc-links/:id`

---

## 5. EXTERNAL ACCOUNTS API

Las External Accounts son cuentas bancarias o wallets crypto que pertenecen al customer y se usan como origen o destino de transferencias.

### Tipos de External Account

| Tipo | Descripción |
|------|-------------|
| ach | Cuenta bancaria ACH (USA) |
| wire | Transferencia bancaria Wire |
| sepa | Cuenta SEPA (Europa) |
| crypto | Wallet de criptomonedas |

---

### POST /api/customers/:id/external-accounts - Crear External Account

**Descripción:** Vincula una cuenta bancaria o wallet crypto al customer.

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/customers/:id/external-accounts`

#### Crear cuenta bancaria ACH (USA):

```json
{
  "account_type": "us",
  "currency": "usd",
  "bank_name": "Chase Bank",
  "account_number": "123456789",
  "routing_number": "021000021",
  "account_owner_name": "Juan Pérez",
  "account_owner_type": "individual"
}
```

#### Crear cuenta IBAN (Europa):

```json
{
  "account_type": "iban",
  "currency": "eur",
  "iban": "DE89370400440532013000",
  "bic": "COBADEFFXXX",
  "account_owner_name": "Juan Pérez"
}
```

#### Crear wallet crypto:

```json
{
  "account_type": "crypto",
  "currency": "usdc",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8db42",
  "chain": "ethereum"
}
```

**Campos para cuenta bancaria:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| account_type | string | "us", "iban", "crypto" |
| currency | string | "usd", "eur", "mxn", "usdc", etc. |
| bank_name | string | Nombre del banco |
| account_number | string | Número de cuenta |
| routing_number | string | Número de routing (solo US) |
| iban | string | IBAN (solo Europa) |
| bic | string | BIC/SWIFT (solo Europa) |
| account_owner_name | string | Nombre del titular |

**Campos para wallet crypto:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| account_type | string | "crypto" |
| currency | string | "usdc", "usdt", "eth", etc. |
| address | string | Dirección del wallet |
| chain | string | "ethereum", "solana", "polygon", "base", etc. |

**Ejemplo:**
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/external-accounts \
  -H "Authorization: Bearer <tu_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "account_type": "crypto",
    "currency": "usdc",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8db42",
    "chain": "ethereum"
  }'
```

---

### GET /api/customers/:id/external-accounts - Listar External Accounts

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/external-accounts`

---

### GET /api/customers/:id/external-accounts/:accountId - Obtener External Account

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/external-accounts/:accountId`

---

### PUT /api/customers/:id/external-accounts/:accountId - Actualizar External Account

**URL:** `PUT https://bridge-gateway-eta.vercel.app/api/customers/:id/external-accounts/:accountId`

---

### DELETE /api/customers/:id/external-accounts/:accountId - Eliminar External Account

**URL:** `DELETE https://bridge-gateway-eta.vercel.app/api/customers/:id/external-accounts/:accountId`

---

## 6. WALLETS API

Los Wallets son cuentas custodiales de stablecoins manejadas por Bridge. El customer deposita y retira fondos, pero Bridge mantiene la custodia.

### Blockchains soportadas

| Chain | Nombre |
|-------|--------|
| ethereum | Ethereum Mainnet |
| polygon | Polygon |
| solana | Solana |
| base | Base |
| arbitrum | Arbitrum |
| optimism | Optimism |

### Monedas soportadas

| Currency | Nombre |
|----------|--------|
| usdc | USD Coin |
| usdt | Tether |
| usdb | Bridge USD |

---

### POST /api/customers/:id/wallets - Crear Wallet

**Descripción:** Crea un wallet custodial para el customer.

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/customers/:id/wallets`

**Body:**
```json
{
  "chain": "ethereum",
  "currency": "usdc"
}
```

**Ejemplo:**
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/wallets \
  -H "Authorization: Bearer <tu_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "solana",
    "currency": "usdc"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "wlt_xyz789",
    "customer_id": "cust_abc123",
    "chain": "solana",
    "currency": "usdc",
    "address": "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCNA9X4Uq",
    "balance": "0.00",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### GET /api/customers/:id/wallets - Listar Wallets

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/wallets`

---

### GET /api/customers/:id/wallets/:walletId - Obtener Wallet

**Descripción:** Obtiene un wallet con su balance actual.

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/wallets/:walletId`

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "wlt_xyz789",
    "customer_id": "cust_abc123",
    "chain": "solana",
    "currency": "usdc",
    "address": "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCNA9X4Uq",
    "balance": "1500.00",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 7. TRANSFERS API

Los Transfers son el corazón de Bridge: mueven dinero entre fiat y crypto.

### Tipos de Transfer

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| on-ramp | Fiat → Crypto | USD del banco → USDC en wallet |
| off-ramp | Crypto → Fiat | USDC del wallet → USD en banco |
| crypto-to-crypto | Crypto → Crypto | USDC Ethereum → USDC Solana |

### Estados de Transfer (state)

| Estado | Significado |
|--------|-------------|
| awaiting_funds | Esperando que el cliente envíe fondos |
| funds_received | Bridge recibió los fondos |
| in_review | En revisión (compliance) |
| pending | Procesando la transferencia |
| completed | Transferencia completada exitosamente |
| failed | Transferencia fallida |
| canceled | Transferencia cancelada |
| returned | Fondos devueltos |

---

### POST /api/transfers - Crear Transfer

**Descripción:** Crea una nueva transferencia.

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/transfers`

#### Ejemplo On-Ramp (USD → USDC):

```json
{
  "amount": "1000.00",
  "on_behalf_of": "cust_abc123",
  "source": {
    "payment_rail": "ach",
    "currency": "usd",
    "external_account_id": "ext_acc_123"
  },
  "destination": {
    "payment_rail": "ethereum",
    "currency": "usdc",
    "to_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8db42"
  },
  "developer_fee_percent": "1.0"
}
```

#### Ejemplo Off-Ramp (USDC → USD):

```json
{
  "amount": "500.00",
  "on_behalf_of": "cust_abc123",
  "source": {
    "payment_rail": "ethereum",
    "currency": "usdc",
    "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8db42"
  },
  "destination": {
    "payment_rail": "ach",
    "currency": "usd",
    "external_account_id": "ext_acc_456"
  }
}
```

**Campos del Transfer:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| amount | string | SÍ | Cantidad a transferir |
| on_behalf_of | string | SÍ | ID del customer |
| source | object | SÍ | Origen de los fondos |
| destination | object | SÍ | Destino de los fondos |
| developer_fee_percent | string | NO | Tu comisión (ej: "1.0" = 1%) |

**Campos de source/destination:**

| Campo | Descripción |
|-------|-------------|
| payment_rail | "ach", "wire", "sepa", "ethereum", "solana", "polygon", "base" |
| currency | "usd", "eur", "usdc", "usdt" |
| external_account_id | ID de la external account (para fiat) |
| to_address / from_address | Dirección blockchain (para crypto) |

**Ejemplo completo:**
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/transfers \
  -H "Authorization: Bearer <tu_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "1000.00",
    "on_behalf_of": "cust_abc123",
    "source": {
      "payment_rail": "ach",
      "currency": "usd",
      "external_account_id": "ext_acc_123"
    },
    "destination": {
      "payment_rail": "solana",
      "currency": "usdc",
      "to_address": "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCNA9X4Uq"
    },
    "developer_fee_percent": "0.5"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "tfr_abc123xyz",
    "state": "awaiting_funds",
    "amount": "1000.00",
    "source": {
      "payment_rail": "ach",
      "currency": "usd"
    },
    "destination": {
      "payment_rail": "solana",
      "currency": "usdc",
      "address": "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCNA9X4Uq"
    },
    "developer_fee": "5.00",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### GET /api/transfers - Listar Transfers

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/transfers`

**Query Parameters:**
| Parámetro | Descripción |
|-----------|-------------|
| limit | Cantidad por página |
| after | Cursor para paginación |
| customer_id | Filtrar por customer |
| state | Filtrar por estado |

**Ejemplo:**
```bash
curl "https://bridge-gateway-eta.vercel.app/api/transfers?limit=10&state=completed" \
  -H "Authorization: Bearer <tu_token>"
```

---

### GET /api/transfers/:id - Obtener Transfer

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/transfers/:id`

---

### DELETE /api/transfers/:id - Cancelar Transfer

**Descripción:** Cancela una transferencia. Solo funciona si está en estado `awaiting_funds`.

**URL:** `DELETE https://bridge-gateway-eta.vercel.app/api/transfers/:id`

**Ejemplo:**
```bash
curl -X DELETE https://bridge-gateway-eta.vercel.app/api/transfers/tfr_abc123xyz \
  -H "Authorization: Bearer <tu_token>"
```

---

## 8. VIRTUAL ACCOUNTS API

Las Virtual Accounts son cuentas bancarias virtuales que Bridge crea para tus customers. Cuando alguien deposita dinero en esa cuenta, automáticamente se convierte a stablecoins.

### Monedas soportadas

| Moneda | Rails disponibles |
|--------|------------------|
| usd | ACH, Wire |
| eur | SEPA |
| mxn | SPEI |

---

### POST /api/customers/:id/virtual-accounts - Crear Virtual Account

**Descripción:** Crea una cuenta virtual con número de cuenta único.

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/customers/:id/virtual-accounts`

**Body:**
```json
{
  "source_currency": "usd",
  "destination": {
    "payment_rail": "ethereum",
    "currency": "usdc",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8db42"
  }
}
```

**Ejemplo:**
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/virtual-accounts \
  -H "Authorization: Bearer <tu_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_currency": "usd",
    "destination": {
      "payment_rail": "solana",
      "currency": "usdc",
      "address": "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCNA9X4Uq"
    }
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "va_xyz789",
    "customer_id": "cust_abc123",
    "source_currency": "usd",
    "account_number": "8901234567",
    "routing_number": "021000021",
    "bank_name": "Bridge Bank",
    "bank_address": "123 Finance St, New York, NY 10001",
    "destination": {
      "payment_rail": "solana",
      "currency": "usdc",
      "address": "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCNA9X4Uq"
    },
    "status": "active",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Uso:** El customer puede dar estos datos bancarios (account_number, routing_number) a cualquier persona para recibir depósitos USD que se convierten automáticamente a USDC.

---

### GET /api/customers/:id/virtual-accounts - Listar Virtual Accounts

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/virtual-accounts`

---

### GET /api/customers/:id/virtual-accounts/:accountId - Obtener Virtual Account

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/virtual-accounts/:accountId`

---

### GET /api/customers/:id/virtual-accounts/:accountId/history - Historial de Depósitos

**Descripción:** Obtiene el historial de depósitos recibidos en la cuenta virtual.

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/virtual-accounts/:accountId/history`

---

### DELETE /api/customers/:id/virtual-accounts/:accountId - Eliminar Virtual Account

**URL:** `DELETE https://bridge-gateway-eta.vercel.app/api/customers/:id/virtual-accounts/:accountId`

---

## 9. STATIC MEMOS API

Los Static Memos son identificadores únicos para depósitos wire. El customer usa el memo cuando hace una transferencia wire, y Bridge identifica automáticamente a quién pertenece.

---

### POST /api/customers/:id/static-memos - Crear Static Memo

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/customers/:id/static-memos`

**Body:**
```json
{
  "source": {
    "currency": "usd",
    "payment_rail": "wire"
  },
  "destination": {
    "payment_rail": "ethereum",
    "currency": "usdc",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8db42"
  },
  "developer_fee_percent": "1.0"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "memo_abc123",
    "memo": "BRIDGE-A1B2C3D4",
    "bank_name": "Bridge Bank",
    "account_number": "123456789",
    "routing_number": "021000021",
    "bank_address": "123 Finance St, New York, NY 10001",
    "destination": {
      "payment_rail": "ethereum",
      "currency": "usdc",
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8db42"
    }
  }
}
```

**Uso:** El customer hace un wire transfer incluyendo "BRIDGE-A1B2C3D4" en el memo, y los fondos se convierten automáticamente a USDC.

---

### GET /api/customers/:id/static-memos - Listar Static Memos

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/static-memos`

---

### GET /api/customers/:id/static-memos/:memoId - Obtener Static Memo

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/static-memos/:memoId`

---

### GET /api/customers/:id/static-memos/:memoId/history - Historial de Transacciones

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/static-memos/:memoId/history`

---

### DELETE /api/customers/:id/static-memos/:memoId - Eliminar Static Memo

**URL:** `DELETE https://bridge-gateway-eta.vercel.app/api/customers/:id/static-memos/:memoId`

---

## 10. LIQUIDATION ADDRESSES API

Las Liquidation Addresses son direcciones blockchain que auto-convierten depósitos crypto a fiat. Cuando alguien envía USDC a esa dirección, automáticamente se convierte a USD y se deposita en el banco del customer.

---

### POST /api/customers/:id/liquidation-addresses - Crear Liquidation Address

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/customers/:id/liquidation-addresses`

**Body:**
```json
{
  "chain": "solana",
  "currency": "usdc",
  "destination": {
    "payment_rail": "ach",
    "currency": "usd",
    "external_account_id": "ext_acc_123"
  },
  "developer_fee_percent": "0.5"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "liq_abc123",
    "address": "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCNA9X4Uq",
    "chain": "solana",
    "currency": "usdc",
    "destination": {
      "payment_rail": "ach",
      "currency": "usd"
    },
    "status": "active"
  }
}
```

**Uso:** Cualquier USDC enviado a esa dirección Solana se convierte automáticamente a USD y se deposita en la cuenta bancaria.

---

### GET /api/customers/:id/liquidation-addresses - Listar Liquidation Addresses

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/liquidation-addresses`

---

### GET /api/customers/:id/liquidation-addresses/:addressId - Obtener Liquidation Address

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/liquidation-addresses/:addressId`

---

### GET /api/customers/:id/liquidation-addresses/:addressId/history - Historial de Liquidaciones

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/liquidation-addresses/:addressId/history`

---

## 11. PREFUNDED ACCOUNTS API

Las Prefunded Accounts son wallets del desarrollador (tú) que se usan para enviar pagos instantáneos sin esperar liquidación.

---

### GET /api/prefunded-accounts - Listar Prefunded Accounts

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/prefunded-accounts`

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pfa_abc123",
      "currency": "usd",
      "balance": "50000.00",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### GET /api/prefunded-accounts/:id - Obtener Prefunded Account

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/prefunded-accounts/:id`

---

## 12. CARDS API

Bridge permite emitir tarjetas de débito vinculadas a wallets de stablecoins.

### Tipos de tarjeta

| Tipo | Descripción |
|------|-------------|
| virtual | Tarjeta virtual (solo para compras online) |
| physical | Tarjeta física (se envía por correo) |

### Estados de tarjeta

| Estado | Descripción |
|--------|-------------|
| active | Tarjeta activa y funcional |
| frozen | Tarjeta congelada temporalmente |
| canceled | Tarjeta cancelada permanentemente |

---

### POST /api/customers/:id/cards - Emitir Tarjeta

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/customers/:id/cards`

**Body para tarjeta virtual:**
```json
{
  "card_type": "virtual",
  "wallet_id": "wlt_xyz789"
}
```

**Body para tarjeta física:**
```json
{
  "card_type": "physical",
  "wallet_id": "wlt_xyz789",
  "shipping_address": {
    "street_line_1": "Av. Reforma 123",
    "city": "Ciudad de México",
    "subdivision": "CDMX",
    "postal_code": "06600",
    "country": "MEX"
  }
}
```

---

### GET /api/customers/:id/cards - Listar Tarjetas

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/cards`

---

### GET /api/customers/:id/cards/:cardId - Obtener Tarjeta

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/customers/:id/cards/:cardId`

---

### PUT /api/customers/:id/cards/:cardId - Actualizar Tarjeta

**Descripción:** Actualiza el estado de la tarjeta (activar, congelar, cancelar).

**URL:** `PUT https://bridge-gateway-eta.vercel.app/api/customers/:id/cards/:cardId`

**Body para congelar:**
```json
{
  "status": "frozen"
}
```

**Body para cancelar:**
```json
{
  "status": "canceled"
}
```

---

## 13. PLAID INTEGRATION API

Plaid permite vincular cuentas bancarias de forma segura.

---

### POST /api/plaid/link-token - Crear Link Token

**Descripción:** Crea un token para iniciar el flujo de vinculación Plaid.

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/plaid/link-token`

**Body:**
```json
{
  "customer_id": "cust_abc123"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "link_token": "link-sandbox-abc123..."
  }
}
```

---

### POST /api/plaid/exchange-token - Intercambiar Token

**Descripción:** Intercambia el token público de Plaid por una external account.

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/plaid/exchange-token`

**Body:**
```json
{
  "customer_id": "cust_abc123",
  "public_token": "public-sandbox-abc123..."
}
```

---

## 14. EXCHANGE RATES API

### GET /api/exchange-rates - Obtener Tasas de Cambio

**Descripción:** Obtiene las tasas de cambio actuales.

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/exchange-rates`

**Query Parameters opcionales:**
| Parámetro | Descripción |
|-----------|-------------|
| source_currency | Moneda origen (ej: "usd") |
| destination_currency | Moneda destino (ej: "usdc") |

**Ejemplo:**
```bash
curl "https://bridge-gateway-eta.vercel.app/api/exchange-rates?source_currency=usd&destination_currency=usdc" \
  -H "Authorization: Bearer <tu_token>"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "source_currency": "usd",
    "destination_currency": "usdc",
    "rate": "0.9985",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 15. REFERENCE DATA API

### GET /api/supported-currencies - Monedas Soportadas

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/supported-currencies`

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {"code": "usd", "name": "US Dollar", "type": "fiat"},
    {"code": "eur", "name": "Euro", "type": "fiat"},
    {"code": "mxn", "name": "Mexican Peso", "type": "fiat"},
    {"code": "usdc", "name": "USD Coin", "type": "crypto"},
    {"code": "usdt", "name": "Tether", "type": "crypto"}
  ]
}
```

---

### GET /api/supported-chains - Blockchains Soportadas

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/supported-chains`

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {"id": "ethereum", "name": "Ethereum"},
    {"id": "solana", "name": "Solana"},
    {"id": "polygon", "name": "Polygon"},
    {"id": "base", "name": "Base"},
    {"id": "arbitrum", "name": "Arbitrum"},
    {"id": "optimism", "name": "Optimism"}
  ]
}
```

---

### GET /api/supported-countries - Países Soportados

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/supported-countries`

---

## 16. WEBHOOKS API

Los Webhooks te notifican cuando ocurren eventos (transferencia completada, KYC aprobado, etc.).

### Eventos disponibles

| Evento | Descripción |
|--------|-------------|
| customer.kyc.approved | KYC del customer aprobado |
| customer.kyc.rejected | KYC del customer rechazado |
| transfer.created | Transfer creado |
| transfer.completed | Transfer completado |
| transfer.failed | Transfer fallido |
| virtual_account.deposit | Depósito recibido en virtual account |

---

### POST /api/webhooks - Crear Webhook

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/webhooks`

**Body:**
```json
{
  "url": "https://tu-servidor.com/webhooks/bridge",
  "enabled_events": ["transfer.completed", "transfer.failed", "customer.kyc.approved"]
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": "wh_abc123",
    "url": "https://tu-servidor.com/webhooks/bridge",
    "enabled_events": ["transfer.completed", "transfer.failed", "customer.kyc.approved"],
    "status": "disabled",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**IMPORTANTE:** Los webhooks se crean en estado `disabled`. Debes habilitarlos con PUT.

---

### GET /api/webhooks - Listar Webhooks

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/webhooks`

---

### GET /api/webhooks/:id - Obtener Webhook

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/webhooks/:id`

---

### PUT /api/webhooks/:id - Actualizar Webhook

**Descripción:** Habilita/deshabilita un webhook o actualiza su configuración.

**URL:** `PUT https://bridge-gateway-eta.vercel.app/api/webhooks/:id`

**Body para habilitar:**
```json
{
  "status": "enabled"
}
```

---

### DELETE /api/webhooks/:id - Eliminar Webhook

**URL:** `DELETE https://bridge-gateway-eta.vercel.app/api/webhooks/:id`

---

### POST /api/webhooks/:id/test - Enviar Evento de Prueba

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/webhooks/:id/test`

---

### GET /api/webhooks/:id/logs - Ver Logs de Entregas

**URL:** `GET https://bridge-gateway-eta.vercel.app/api/webhooks/:id/logs`

---

### POST /api/webhooks/:id/logs/:logId/retry - Reintentar Entrega

**URL:** `POST https://bridge-gateway-eta.vercel.app/api/webhooks/:id/logs/:logId/retry`

---

### POST /webhooks/bridge - Recibir Webhooks de Bridge

**Descripción:** Endpoint para recibir webhooks de Bridge (verifica firma HMAC).

**URL:** `POST https://bridge-gateway-eta.vercel.app/webhooks/bridge`

**NO requiere autenticación del Gateway**, pero verifica la firma de Bridge.

---

## 17. CÓDIGOS DE ERROR

| Código HTTP | Código Error | Descripción |
|-------------|--------------|-------------|
| 400 | BAD_REQUEST | Datos inválidos en la petición |
| 401 | UNAUTHORIZED | Token de autenticación inválido o faltante |
| 403 | FORBIDDEN | Sin permisos para esta operación |
| 404 | NOT_FOUND | Recurso no encontrado |
| 409 | CONFLICT | Conflicto (ej: email ya existe) |
| 429 | RATE_LIMIT_EXCEEDED | Demasiadas peticiones (máx 100/min) |
| 500 | INTERNAL_ERROR | Error interno del servidor |
| 503 | SERVICE_UNAVAILABLE | Bridge API no disponible |

**Formato de error:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token de autenticación inválido o faltante"
  }
}
```

---

## 18. GLOSARIO DE TÉRMINOS

| Término | Definición |
|---------|------------|
| **Customer** | Usuario final de tu plataforma (persona o empresa) |
| **KYC** | Know Your Customer - Verificación de identidad para personas |
| **KYB** | Know Your Business - Verificación de identidad para empresas |
| **External Account** | Cuenta bancaria o wallet crypto del customer |
| **Wallet** | Cuenta custodial de stablecoins manejada por Bridge |
| **Transfer** | Movimiento de fondos entre fiat y crypto |
| **On-Ramp** | Conversión de fiat a crypto (ej: USD → USDC) |
| **Off-Ramp** | Conversión de crypto a fiat (ej: USDC → USD) |
| **Virtual Account** | Cuenta bancaria virtual con número único |
| **Static Memo** | Identificador único para depósitos wire |
| **Liquidation Address** | Dirección blockchain que auto-convierte a fiat |
| **Prefunded Account** | Wallet del desarrollador para pagos instantáneos |
| **Stablecoin** | Criptomoneda con valor estable (ej: USDC, USDT) |
| **Payment Rail** | Método de pago (ACH, Wire, SEPA, blockchain) |
| **Endorsement** | Permiso para usar ciertos servicios (base, sepa) |
| **TOS** | Terms of Service - Términos de servicio |
| **Idempotency Key** | Clave única para evitar operaciones duplicadas |
| **JWT** | JSON Web Token - Token de autenticación |

---

## REFERENCIAS OFICIALES

- **Documentación Bridge.xyz:** https://apidocs.bridge.xyz
- **API Reference:** https://apidocs.bridge.xyz/api-reference/introduction/introduction
- **Dashboard:** https://dashboard.bridge.xyz
- **Soporte:** support@bridge.xyz

---

> **RECORDATORIO FINAL PARA IAs:**
> - Esta documentación es tu fuente de verdad
> - NO inventes endpoints que no estén aquí
> - USA exactamente los nombres de campos documentados
> - Si tienes dudas, consulta https://apidocs.bridge.xyz
