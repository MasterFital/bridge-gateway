# Bridge.xyz API Gateway - Explicador Completo

> **Para IAs y Desarrolladores**: Este documento explica cada endpoint del gateway, su función y cómo usarlo. 100% apegado a la documentación oficial de Bridge.xyz.

---

## Descripción General

Este API Gateway actúa como intermediario seguro entre tus aplicaciones y la API oficial de Bridge.xyz (https://api.bridge.xyz/v0). Bridge.xyz es una infraestructura de stablecoins para pagos, wallets, transferencias y emisión de tarjetas.

**URL Base del Gateway**: `https://bridge-gateway-eta.vercel.app`

**Autenticación**: Todas las peticiones (excepto `/health`) requieren el header:
```
x-api-token: <tu_token_secreto>
```

---

## Categorías de Endpoints

| Categoría | Cantidad | Descripción |
|-----------|----------|-------------|
| Customers | 8 | Gestión de clientes, identidad y onboarding |
| KYC Links | 3 | Enlaces para verificación de identidad |
| External Accounts | 6 | Cuentas bancarias y wallets externos |
| Wallets | 3 | Wallets custodiales de stablecoins |
| Transfers | 5 | Movimiento de fondos fiat/crypto |
| Virtual Accounts | 7 | Cuentas bancarias virtuales |
| Static Memos | 5 | Identificadores únicos para depósitos |
| Liquidation Addresses | 4 | Direcciones blockchain con auto-conversión |
| Prefunded Accounts | 2 | Cuentas prefundadas |
| Cards | 4 | Emisión de tarjetas |
| Plaid | 2 | Integración con Plaid |
| Exchange Rates | 1 | Tasas de cambio |
| Webhooks | 8 | Notificaciones en tiempo real |
| Monitoreo | 2 | Health check y status |

---

## 1. CUSTOMERS API (Clientes)

Los Customers son la entidad central en Bridge. Representan usuarios finales (individuos o empresas) que realizarán operaciones financieras.

### POST /api/customers
**Crear un nuevo cliente**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "individual",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@ejemplo.com"
  }'
```

**Campos para Individual**:
- `type`: "individual"
- `first_name`: Nombre
- `last_name`: Apellido
- `email`: Correo electrónico

**Campos para Business**:
- `type`: "business"
- `business_name`: Nombre de la empresa
- `email`: Correo electrónico

---

### GET /api/customers
**Listar todos los clientes**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers \
  -H "x-api-token: <token>"
```

**Parámetros de paginación**:
- `limit`: Cantidad de resultados (default: 100)
- `offset`: Desplazamiento
- `starting_after`: Cursor para siguiente página
- `ending_before`: Cursor para página anterior

---

### GET /api/customers/:id
**Obtener un cliente específico**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123 \
  -H "x-api-token: <token>"
```

---

### PUT /api/customers/:id
**Actualizar un cliente**

```bash
curl -X PUT https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123 \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Juan Carlos"
  }'
```

---

### DELETE /api/customers/:id
**Eliminar un cliente**

```bash
curl -X DELETE https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123 \
  -H "x-api-token: <token>"
```

---

### GET /api/customers/:id/kyc-link
**Obtener enlace KYC del cliente**

Devuelve una URL donde el cliente puede completar su verificación de identidad (Know Your Customer).

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/kyc-link \
  -H "x-api-token: <token>"
```

---

### GET /api/customers/:id/tos-link
**Obtener enlace de Términos de Servicio**

Devuelve una URL donde el cliente puede aceptar los términos de servicio de Bridge.

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/tos-link \
  -H "x-api-token: <token>"
```

---

### POST /api/customers/tos-links
**Crear enlace TOS para nuevos clientes**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/tos-links \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "individual",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@ejemplo.com"
  }'
```

---

## 2. KYC LINKS API (Verificación de Identidad)

KYC (Know Your Customer) es el proceso de verificación de identidad requerido por regulaciones financieras.

### POST /api/kyc-links
**Crear enlace KYC**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/kyc-links \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_abc123",
    "type": "individual"
  }'
```

---

### GET /api/kyc-links
**Listar todos los enlaces KYC**

```bash
curl https://bridge-gateway-eta.vercel.app/api/kyc-links \
  -H "x-api-token: <token>"
```

---

### GET /api/kyc-links/:id
**Obtener enlace KYC específico**

```bash
curl https://bridge-gateway-eta.vercel.app/api/kyc-links/kyc_abc123 \
  -H "x-api-token: <token>"
```

---

## 3. EXTERNAL ACCOUNTS API (Cuentas Externas)

Las External Accounts son cuentas bancarias o wallets crypto que pertenecen al cliente y se vinculan a Bridge para enviar/recibir fondos.

### POST /api/customers/:id/external-accounts
**Vincular cuenta bancaria o wallet**

**Para cuenta bancaria (US ACH)**:
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/external-accounts \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "us_bank_account",
    "bank_name": "Chase",
    "account_number": "123456789",
    "routing_number": "021000021",
    "account_owner_name": "Juan Pérez"
  }'
```

**Para wallet crypto**:
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/external-accounts \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "crypto_wallet",
    "address": "0x1234...abcd",
    "chain": "ethereum"
  }'
```

---

### GET /api/customers/:id/external-accounts
**Listar cuentas externas del cliente**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/external-accounts \
  -H "x-api-token: <token>"
```

---

### GET /api/customers/:id/external-accounts/:accountId
**Obtener cuenta externa específica**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/external-accounts/ext_xyz789 \
  -H "x-api-token: <token>"
```

---

### PUT /api/customers/:id/external-accounts/:accountId
**Actualizar cuenta externa**

```bash
curl -X PUT https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/external-accounts/ext_xyz789 \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "bank_name": "Bank of America"
  }'
```

---

### DELETE /api/customers/:id/external-accounts/:accountId
**Eliminar cuenta externa**

```bash
curl -X DELETE https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/external-accounts/ext_xyz789 \
  -H "x-api-token: <token>"
```

---

### POST /api/customers/:id/external-accounts/:accountId/reactivate
**Reactivar cuenta externa desactivada**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/external-accounts/ext_xyz789/reactivate \
  -H "x-api-token: <token>"
```

---

## 4. WALLETS API (Wallets Custodiales)

Los Bridge Wallets son wallets de stablecoins custodiados por Bridge. Bridge maneja las llaves privadas y el gas automáticamente.

### POST /api/customers/:id/wallets
**Crear wallet custodial**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/wallets \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "solana",
    "currency": "usdc"
  }'
```

**Chains soportadas**:
- `ethereum`
- `solana`
- `polygon`
- `base`
- `arbitrum`
- `optimism`

**Currencies soportadas**:
- `usdc` - USD Coin
- `usdt` - Tether
- `usdb` - Bridge's native stablecoin

---

### GET /api/customers/:id/wallets
**Listar wallets del cliente**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/wallets \
  -H "x-api-token: <token>"
```

---

### GET /api/customers/:id/wallets/:walletId
**Obtener wallet con balance**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/wallets/wlt_xyz789 \
  -H "x-api-token: <token>"
```

**Respuesta incluye**:
- `address`: Dirección blockchain
- `chain`: Cadena
- `balance`: Balance actual
- `currency`: Moneda

---

## 5. TRANSFERS API (Transferencias)

Los Transfers mueven fondos entre cuentas fiat, wallets crypto y stablecoins. Es el corazón de Bridge.

### POST /api/transfers
**Crear transferencia**

**De banco a wallet (On-ramp)**:
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/transfers \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_abc123",
    "amount": "100.00",
    "source": {
      "type": "external_account",
      "external_account_id": "ext_bank123"
    },
    "destination": {
      "type": "wallet",
      "wallet_id": "wlt_xyz789",
      "currency": "usdc"
    }
  }'
```

**De wallet a banco (Off-ramp)**:
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/transfers \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_abc123",
    "amount": "100.00",
    "source": {
      "type": "wallet",
      "wallet_id": "wlt_xyz789"
    },
    "destination": {
      "type": "external_account",
      "external_account_id": "ext_bank123",
      "currency": "usd"
    }
  }'
```

---

### GET /api/transfers
**Listar todas las transferencias**

```bash
curl https://bridge-gateway-eta.vercel.app/api/transfers \
  -H "x-api-token: <token>"
```

**Filtros disponibles**:
- `customer_id`: Filtrar por cliente
- `status`: Filtrar por estado
- `limit`, `offset`: Paginación

---

### GET /api/transfers/:id
**Obtener transferencia específica**

```bash
curl https://bridge-gateway-eta.vercel.app/api/transfers/tfr_abc123 \
  -H "x-api-token: <token>"
```

**Estados de transferencia**:
| Estado | Descripción |
|--------|-------------|
| `awaiting_funds` | Esperando que el cliente envíe fondos |
| `in_review` | En revisión (temporal, se auto-resuelve) |
| `funds_received` | Bridge recibió fondos, procesando |
| `pending` | Transferencia en progreso |
| `completed` | Transferencia exitosa |
| `failed` | Transferencia fallida |
| `canceled` | Transferencia cancelada |

---

### PUT /api/transfers/:id
**Actualizar transferencia**

```bash
curl -X PUT https://bridge-gateway-eta.vercel.app/api/transfers/tfr_abc123 \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "developer_fee": "1.00"
  }'
```

---

### DELETE /api/transfers/:id
**Cancelar transferencia**

Solo se puede cancelar cuando está en estado `awaiting_funds`.

```bash
curl -X DELETE https://bridge-gateway-eta.vercel.app/api/transfers/tfr_abc123 \
  -H "x-api-token: <token>"
```

---

## 6. VIRTUAL ACCOUNTS API (Cuentas Virtuales)

Las Virtual Accounts son números de cuenta bancaria únicos asignados a cada cliente. Cuando alguien deposita en esa cuenta, los fondos se convierten automáticamente a stablecoins.

### POST /api/customers/:id/virtual-accounts
**Crear cuenta virtual**

**USD (ACH/Wire)**:
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/virtual-accounts \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "usd",
    "destination_wallet_id": "wlt_xyz789"
  }'
```

**EUR (SEPA/IBAN)**:
```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/virtual-accounts \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "eur",
    "destination_wallet_id": "wlt_xyz789"
  }'
```

---

### GET /api/customers/:id/virtual-accounts
**Listar cuentas virtuales**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/virtual-accounts \
  -H "x-api-token: <token>"
```

---

### GET /api/customers/:id/virtual-accounts/:accountId
**Obtener cuenta virtual específica**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/virtual-accounts/va_abc123 \
  -H "x-api-token: <token>"
```

**Respuesta incluye**:
- `account_number`: Número de cuenta
- `routing_number`: Número de ruta (USD)
- `iban`: IBAN (EUR)
- `currency`: Moneda
- `destination_wallet_id`: Wallet destino

---

### PUT /api/customers/:id/virtual-accounts/:accountId
**Actualizar cuenta virtual**

```bash
curl -X PUT https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/virtual-accounts/va_abc123 \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "destination_wallet_id": "wlt_nuevo789"
  }'
```

---

### DELETE /api/customers/:id/virtual-accounts/:accountId
**Eliminar cuenta virtual**

```bash
curl -X DELETE https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/virtual-accounts/va_abc123 \
  -H "x-api-token: <token>"
```

---

### GET /api/customers/:id/virtual-accounts/:accountId/history
**Historial de depósitos**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/virtual-accounts/va_abc123/history \
  -H "x-api-token: <token>"
```

---

### POST /api/customers/:id/virtual-accounts/:accountId/simulate-deposit
**Simular depósito (Solo Sandbox)**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/virtual-accounts/va_abc123/simulate-deposit \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "500.00"
  }'
```

---

## 7. STATIC MEMOS API (Memos Estáticos)

Los Static Memos son identificadores únicos que se usan como "memo" o "reference" en transferencias bancarias para identificar al depositante.

### POST /api/customers/:id/static-memos
**Crear memo estático**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/static-memos \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "destination_wallet_id": "wlt_xyz789"
  }'
```

---

### GET /api/customers/:id/static-memos
**Listar memos estáticos**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/static-memos \
  -H "x-api-token: <token>"
```

---

### GET /api/customers/:id/static-memos/:memoId
**Obtener memo específico**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/static-memos/memo_abc123 \
  -H "x-api-token: <token>"
```

---

### DELETE /api/customers/:id/static-memos/:memoId
**Eliminar memo**

```bash
curl -X DELETE https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/static-memos/memo_abc123 \
  -H "x-api-token: <token>"
```

---

### GET /api/customers/:id/static-memos/:memoId/history
**Historial de transacciones del memo**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/static-memos/memo_abc123/history \
  -H "x-api-token: <token>"
```

---

## 8. LIQUIDATION ADDRESSES API (Direcciones de Liquidación)

Las Liquidation Addresses son direcciones blockchain permanentes que auto-convierten cualquier depósito crypto a fiat y lo envían a una cuenta bancaria.

### POST /api/customers/:id/liquidation-addresses
**Crear dirección de liquidación**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/liquidation-addresses \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "solana",
    "currency": "usdc",
    "destination_external_account_id": "ext_bank123"
  }'
```

**Ejemplo de uso**: Creas una dirección Solana. Cada vez que alguien envía USDC a esa dirección, Bridge automáticamente lo convierte a USD y lo deposita en la cuenta bancaria vinculada.

---

### GET /api/customers/:id/liquidation-addresses
**Listar direcciones de liquidación**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/liquidation-addresses \
  -H "x-api-token: <token>"
```

---

### GET /api/customers/:id/liquidation-addresses/:addressId
**Obtener dirección específica**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/liquidation-addresses/liq_abc123 \
  -H "x-api-token: <token>"
```

---

### GET /api/customers/:id/liquidation-addresses/:addressId/history
**Historial de liquidaciones**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/liquidation-addresses/liq_abc123/history \
  -H "x-api-token: <token>"
```

---

## 9. PREFUNDED ACCOUNTS API (Cuentas Prefundadas)

Las Prefunded Accounts permiten a desarrolladores depositar fondos para cubrir transferencias de sus usuarios sin que estos tengan que esperar.

### GET /api/prefunded-accounts
**Listar cuentas prefundadas**

```bash
curl https://bridge-gateway-eta.vercel.app/api/prefunded-accounts \
  -H "x-api-token: <token>"
```

---

### GET /api/prefunded-accounts/:id
**Obtener cuenta prefundada específica**

```bash
curl https://bridge-gateway-eta.vercel.app/api/prefunded-accounts/pfa_abc123 \
  -H "x-api-token: <token>"
```

---

## 10. CARDS API (Tarjetas)

Bridge permite emitir tarjetas de débito virtuales y físicas vinculadas a wallets de stablecoins.

### POST /api/customers/:id/cards
**Emitir tarjeta**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/cards \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "virtual",
    "source_wallet_id": "wlt_xyz789"
  }'
```

**Tipos de tarjeta**:
- `virtual`: Tarjeta virtual para compras online
- `physical`: Tarjeta física (requiere dirección de envío)

---

### GET /api/customers/:id/cards
**Listar tarjetas del cliente**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/cards \
  -H "x-api-token: <token>"
```

---

### GET /api/customers/:id/cards/:cardId
**Obtener tarjeta específica**

```bash
curl https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/cards/card_abc123 \
  -H "x-api-token: <token>"
```

---

### PUT /api/customers/:id/cards/:cardId
**Actualizar tarjeta (activar/desactivar)**

```bash
curl -X PUT https://bridge-gateway-eta.vercel.app/api/customers/cust_abc123/cards/card_abc123 \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active"
  }'
```

**Estados disponibles**:
- `active`: Tarjeta activa
- `frozen`: Tarjeta congelada temporalmente
- `canceled`: Tarjeta cancelada permanentemente

---

## 11. PLAID INTEGRATION API

Plaid permite vincular cuentas bancarias de forma segura sin que el usuario comparta credenciales.

### POST /api/plaid/link-token
**Crear token de vinculación Plaid**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/plaid/link-token \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_abc123"
  }'
```

---

### POST /api/plaid/exchange-token
**Intercambiar token público por cuenta externa**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/plaid/exchange-token \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_abc123",
    "public_token": "public-sandbox-xxx"
  }'
```

---

## 12. EXCHANGE RATES API (Tasas de Cambio)

### GET /api/exchange-rates
**Obtener tasas de cambio actuales**

```bash
curl https://bridge-gateway-eta.vercel.app/api/exchange-rates \
  -H "x-api-token: <token>"
```

**Respuesta incluye**:
- Tasas USD/USDC
- Tasas EUR/USD
- Tasas MXN/USD
- Spreads aplicables

---

## 13. REFERENCE DATA API (Datos de Referencia)

### GET /api/supported-currencies
**Listar monedas soportadas**

```bash
curl https://bridge-gateway-eta.vercel.app/api/supported-currencies \
  -H "x-api-token: <token>"
```

---

### GET /api/supported-chains
**Listar blockchains soportadas**

```bash
curl https://bridge-gateway-eta.vercel.app/api/supported-chains \
  -H "x-api-token: <token>"
```

---

### GET /api/supported-countries
**Listar países soportados**

```bash
curl https://bridge-gateway-eta.vercel.app/api/supported-countries \
  -H "x-api-token: <token>"
```

---

## 14. WEBHOOKS API (Notificaciones)

Los Webhooks envían notificaciones HTTP a tu servidor cuando ocurren eventos importantes.

### POST /api/webhooks
**Crear webhook**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/webhooks \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://tu-servidor.com/webhook",
    "enabled": true,
    "events": ["transfer.completed", "transfer.failed", "customer.created"]
  }'
```

**Eventos disponibles**:
- `transfer.completed` - Transferencia completada
- `transfer.failed` - Transferencia fallida
- `transfer.pending` - Transferencia en progreso
- `customer.created` - Cliente creado
- `customer.kyc_approved` - KYC aprobado
- `customer.kyc_rejected` - KYC rechazado
- `wallet.created` - Wallet creado
- `virtual_account.deposit` - Depósito en cuenta virtual

---

### GET /api/webhooks
**Listar webhooks**

```bash
curl https://bridge-gateway-eta.vercel.app/api/webhooks \
  -H "x-api-token: <token>"
```

---

### GET /api/webhooks/:id
**Obtener webhook específico**

```bash
curl https://bridge-gateway-eta.vercel.app/api/webhooks/wh_abc123 \
  -H "x-api-token: <token>"
```

---

### PUT /api/webhooks/:id
**Actualizar webhook**

```bash
curl -X PUT https://bridge-gateway-eta.vercel.app/api/webhooks/wh_abc123 \
  -H "x-api-token: <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }'
```

---

### DELETE /api/webhooks/:id
**Eliminar webhook**

```bash
curl -X DELETE https://bridge-gateway-eta.vercel.app/api/webhooks/wh_abc123 \
  -H "x-api-token: <token>"
```

---

### POST /api/webhooks/:id/test
**Probar webhook**

Envía un evento de prueba a tu endpoint.

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/webhooks/wh_abc123/test \
  -H "x-api-token: <token>"
```

---

### GET /api/webhooks/:id/logs
**Ver logs de entregas**

```bash
curl https://bridge-gateway-eta.vercel.app/api/webhooks/wh_abc123/logs \
  -H "x-api-token: <token>"
```

---

### POST /api/webhooks/:id/logs/:logId/retry
**Reintentar entrega fallida**

```bash
curl -X POST https://bridge-gateway-eta.vercel.app/api/webhooks/wh_abc123/logs/log_xyz/retry \
  -H "x-api-token: <token>"
```

---

## 15. WEBHOOK RECEIVER (Receptor de Webhooks)

### POST /webhooks/bridge
**Recibir webhooks de Bridge**

Este endpoint recibe las notificaciones de Bridge.xyz y las procesa. Verifica la firma HMAC-SHA256 para seguridad.

**Headers requeridos por Bridge**:
- `Bridge-Signature`: Firma HMAC del payload

---

## 16. MONITOREO

### GET /health
**Health check del gateway**

No requiere autenticación.

```bash
curl https://bridge-gateway-eta.vercel.app/health
```

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.1.0",
    "service": "bridge-api-gateway",
    "environment": "production"
  }
}
```

---

### GET /api/status
**Status completo con conexión a Bridge**

```bash
curl https://bridge-gateway-eta.vercel.app/api/status \
  -H "x-api-token: <token>"
```

**Respuesta incluye**:
- Estado del gateway
- Estado de conexión con Bridge
- Tiempo de respuesta
- Configuración activa
- Features habilitados

---

## Características del Gateway

### Rate Limiting por Token
- **Límite**: 100 peticiones por minuto por token
- **Header**: `X-RateLimit-Type: token`
- Cada cliente con diferente token tiene su propio límite

### Retry Logic con Exponential Backoff
- **Reintentos**: 3 automáticos
- **Delays**: 100ms → 200ms → 400ms
- **Solo para**: Errores 500, 502, 503, 504 y errores de red
- **Idempotency Key**: Se mantiene igual en reintentos para evitar duplicados

### Idempotency Keys
- Generadas automáticamente con UUID v4
- Aplicadas a POST, PUT, PATCH
- Previenen operaciones duplicadas

### Logging Estructurado
- Formato JSON para fácil parsing
- Request ID único por petición
- Tiempos de respuesta registrados

---

## Códigos de Error Comunes

| Código | Significado |
|--------|-------------|
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - Token inválido |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no existe |
| 429 | Rate Limit - Demasiadas peticiones |
| 500 | Internal Error - Error del servidor |
| 503 | Service Unavailable - Bridge no disponible |

---

## Documentación Oficial

- **Bridge.xyz API Docs**: https://apidocs.bridge.xyz
- **Getting Started**: https://apidocs.bridge.xyz/docs/getting-started
- **API Reference**: https://apidocs.bridge.xyz/reference

---

**Versión del Gateway**: 1.1.0  
**Última actualización**: Noviembre 2024
