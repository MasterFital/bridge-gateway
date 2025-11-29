# Ejemplos de Uso - Bridge.xyz API Gateway

Casos de uso completos con código para integrar Bridge.xyz en tus aplicaciones.

## Tabla de Contenidos

1. [E-commerce con Crypto Payments](#e-commerce-con-crypto-payments)
2. [Neobank con Tarjetas](#neobank-con-tarjetas)
3. [Remesas Internacionales](#remesas-internacionales)
4. [Payroll con Prefunded Accounts](#payroll-con-prefunded-accounts)
5. [Verificación KYC Completa](#verificación-kyc-completa)
6. [Virtual Accounts para Depósitos](#virtual-accounts-para-depósitos)

---

## E-commerce con Crypto Payments

Permite a tus clientes pagar con stablecoins y convertir automáticamente a fiat.

### Flujo

1. Cliente selecciona pago con crypto
2. Se genera liquidation address
3. Cliente envía USDC
4. Automáticamente se convierte a USD y se deposita en tu cuenta

### Implementación

```javascript
import { BridgeClient } from './bridge-client.js';

const bridge = new BridgeClient({
  baseUrl: 'https://tu-gateway.vercel.app',
  token: 'tu_token'
});

// 1. Obtener o crear customer
async function getOrCreateCustomer(email, name) {
  const [firstName, lastName] = name.split(' ');
  
  // Intentar buscar customer existente
  const customers = await bridge.listCustomers({ email });
  
  if (customers.data.data.length > 0) {
    return customers.data.data[0];
  }
  
  // Crear nuevo customer
  const result = await bridge.createCustomer({
    type: 'individual',
    first_name: firstName,
    last_name: lastName || 'N/A',
    email: email
  });
  
  return result.data;
}

// 2. Crear liquidation address para el pedido
async function createPaymentAddress(customerId, orderId, externalAccountId) {
  const result = await bridge.createLiquidationAddress(customerId, {
    chain: 'ethereum',
    currency: 'usdc',
    destination: {
      external_account_id: externalAccountId
    },
    metadata: {
      order_id: orderId
    }
  });
  
  return result.data;
}

// 3. Ejemplo completo de checkout
async function processCheckout(order) {
  const { email, customerName, amount, orderId } = order;
  
  // Obtener/crear customer
  const customer = await getOrCreateCustomer(email, customerName);
  
  // Tu cuenta bancaria para recibir fondos
  const merchantAccountId = 'ext_tu_cuenta';
  
  // Crear address de pago
  const paymentAddress = await createPaymentAddress(
    customer.id,
    orderId,
    merchantAccountId
  );
  
  return {
    paymentAddress: paymentAddress.address,
    chain: 'ethereum',
    currency: 'usdc',
    amountExpected: amount,
    orderId: orderId,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
  };
}

// Uso
const paymentInfo = await processCheckout({
  email: 'cliente@ejemplo.com',
  customerName: 'Juan Pérez',
  amount: '99.99',
  orderId: 'ORD-12345'
});

console.log(`
Envía exactamente $${paymentInfo.amountExpected} USDC a:
Dirección: ${paymentInfo.paymentAddress}
Red: Ethereum
`);
```

### Webhook para confirmar pago

```javascript
// En tu servidor
app.post('/webhooks/bridge', (req, res) => {
  const event = req.body;
  
  if (event.type === 'liquidation_address.funds_received') {
    const { amount, order_id } = event.data;
    
    // Marcar pedido como pagado
    markOrderAsPaid(order_id, amount);
    
    // Enviar confirmación al cliente
    sendPaymentConfirmation(order_id);
  }
  
  res.status(200).json({ received: true });
});
```

---

## Neobank con Tarjetas

Crea una experiencia de neobank con tarjetas virtuales respaldadas por stablecoins.

### Flujo

1. Usuario se registra y completa KYC
2. Se crea wallet con USDC
3. Usuario fondea su wallet
4. Se emite tarjeta virtual
5. Usuario gasta con la tarjeta

### Implementación

```javascript
import { BridgeClient } from './bridge-client.js';

const bridge = new BridgeClient({
  baseUrl: 'https://tu-gateway.vercel.app',
  token: 'tu_token'
});

// 1. Onboarding completo de usuario
async function onboardUser(userData) {
  // Crear customer
  const customer = await bridge.createCustomer({
    type: 'individual',
    first_name: userData.firstName,
    last_name: userData.lastName,
    email: userData.email,
    phone: userData.phone,
    address: {
      street_line_1: userData.street,
      city: userData.city,
      state: userData.state,
      postal_code: userData.postalCode,
      country: 'usa'
    },
    birth_date: userData.birthDate
  });
  
  // Crear KYC link con endorsements necesarios
  const kycLink = await bridge.createKycLink({
    customer_id: customer.data.id,
    type: 'individual',
    endorsements: ['base'],
    redirect_uri: 'https://tuapp.com/kyc-complete'
  });
  
  return {
    customerId: customer.data.id,
    kycUrl: kycLink.data.url
  };
}

// 2. Después de KYC aprobado, crear wallet y tarjeta
async function setupAccount(customerId) {
  // Crear wallet
  const wallet = await bridge.createWallet(customerId, {
    chain: 'ethereum',
    currency: 'usdc'
  });
  
  // Emitir tarjeta virtual
  const card = await bridge.createCard({
    customer_id: customerId,
    card_type: 'virtual',
    wallet_id: wallet.data.id
  });
  
  return {
    wallet: wallet.data,
    card: card.data
  };
}

// 3. Fondear cuenta (desde cuenta bancaria)
async function fundAccount(customerId, externalAccountId, walletId, amount) {
  const transfer = await bridge.createTransfer({
    amount: amount.toString(),
    on_behalf_of: customerId,
    source: {
      payment_rail: 'ach',
      currency: 'usd',
      external_account_id: externalAccountId
    },
    destination: {
      payment_rail: 'ethereum',
      currency: 'usdc',
      bridge_wallet_id: walletId
    }
  });
  
  return transfer.data;
}

// 4. Obtener balance
async function getBalance(customerId, walletId) {
  const wallet = await bridge.getWallet(customerId, walletId);
  return wallet.data.balance;
}

// 5. Congelar/descongelar tarjeta
async function toggleCardFreeze(cardId, freeze) {
  const card = await bridge.updateCard(cardId, {
    status: freeze ? 'frozen' : 'active'
  });
  return card.data;
}

// Ejemplo de uso completo
async function createNeobankAccount(userData) {
  // Paso 1: Onboarding
  const { customerId, kycUrl } = await onboardUser(userData);
  console.log(`Usuario registrado. Completar KYC en: ${kycUrl}`);
  
  // ... usuario completa KYC ...
  
  // Paso 2: Configurar cuenta (después de KYC aprobado)
  const { wallet, card } = await setupAccount(customerId);
  console.log(`Wallet creado: ${wallet.address}`);
  console.log(`Tarjeta emitida: ${card.last_four}`);
  
  return { customerId, wallet, card };
}
```

### Webhook para transacciones de tarjeta

```javascript
app.post('/webhooks/bridge', (req, res) => {
  const event = req.body;
  
  switch (event.type) {
    case 'card_transaction.pending':
      // Notificar transacción pendiente
      notifyUser(event.data.customer_id, {
        type: 'transaction_pending',
        amount: event.data.amount,
        merchant: event.data.merchant_name
      });
      break;
      
    case 'card_transaction.completed':
      // Actualizar balance en UI
      updateUserBalance(event.data.customer_id);
      break;
      
    case 'card_transaction.declined':
      // Notificar rechazo
      notifyUser(event.data.customer_id, {
        type: 'transaction_declined',
        reason: event.data.decline_reason
      });
      break;
  }
  
  res.status(200).json({ received: true });
});
```

---

## Remesas Internacionales

Envía dinero internacionalmente usando SEPA (Europa) o SPEI (México).

### Remesa US → Europa (SEPA)

```javascript
import { BridgeClient } from './bridge-client.js';

const bridge = new BridgeClient({
  baseUrl: 'https://tu-gateway.vercel.app',
  token: 'tu_token'
});

async function sendRemittanceToEurope(senderData, recipientData, amount) {
  // 1. Crear/obtener sender customer
  const sender = await bridge.createCustomer({
    type: 'individual',
    first_name: senderData.firstName,
    last_name: senderData.lastName,
    email: senderData.email,
    address: {
      street_line_1: senderData.street,
      city: senderData.city,
      state: senderData.state,
      postal_code: senderData.postalCode,
      country: 'usa'
    }
  });
  
  // 2. Crear KYC link con endorsement SEPA
  const kycLink = await bridge.createKycLink({
    customer_id: sender.data.id,
    type: 'individual',
    endorsements: ['base', 'sepa'],
    redirect_uri: 'https://tuapp.com/kyc-complete'
  });
  
  // ... después de KYC aprobado ...
  
  // 3. Agregar cuenta del remitente (US)
  const senderAccount = await bridge.createExternalAccount(sender.data.id, {
    account_type: 'us',
    account_number: senderData.accountNumber,
    routing_number: senderData.routingNumber,
    account_owner_name: `${senderData.firstName} ${senderData.lastName}`,
    currency: 'usd'
  });
  
  // 4. Agregar cuenta del destinatario (Europa)
  const recipientAccount = await bridge.createExternalAccount(sender.data.id, {
    account_type: 'iban',
    iban: recipientData.iban,
    bic_swift: recipientData.bic,
    account_owner_name: recipientData.name,
    currency: 'eur'
  });
  
  // 5. Crear transfer USD → EUR
  const transfer = await bridge.createTransfer({
    amount: amount.toString(),
    on_behalf_of: sender.data.id,
    source: {
      payment_rail: 'ach',
      currency: 'usd',
      external_account_id: senderAccount.data.id
    },
    destination: {
      payment_rail: 'sepa',
      currency: 'eur',
      external_account_id: recipientAccount.data.id
    }
  });
  
  return {
    transferId: transfer.data.id,
    status: transfer.data.status,
    amountSent: amount,
    estimatedReceived: transfer.data.destination_amount
  };
}

// Uso
const remittance = await sendRemittanceToEurope(
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    street: '123 Main St',
    city: 'Miami',
    state: 'FL',
    postalCode: '33101',
    accountNumber: '123456789',
    routingNumber: '021000021'
  },
  {
    name: 'María García',
    iban: 'ES9121000418450200051332',
    bic: 'CAIXESBBXXX'
  },
  500 // $500 USD
);

console.log(`Remesa enviada: ${remittance.transferId}`);
console.log(`Recibirá aproximadamente: €${remittance.estimatedReceived}`);
```

### Remesa US → México (SPEI)

```javascript
async function sendRemittanceToMexico(senderCustomerId, clabe, amount) {
  // Agregar cuenta CLABE del destinatario
  const recipientAccount = await bridge.createExternalAccount(senderCustomerId, {
    account_type: 'clabe',
    clabe: clabe,
    account_owner_name: 'Nombre Destinatario',
    currency: 'mxn'
  });
  
  // Crear transfer con SPEI
  const transfer = await bridge.createTransfer({
    amount: amount.toString(),
    on_behalf_of: senderCustomerId,
    source: {
      payment_rail: 'ach',
      currency: 'usd',
      external_account_id: 'ext_sender_account'
    },
    destination: {
      payment_rail: 'spei',
      currency: 'mxn',
      external_account_id: recipientAccount.data.id
    }
  });
  
  return transfer.data;
}
```

---

## Payroll con Prefunded Accounts

Paga a empleados usando prefunded accounts para transferencias instantáneas.

```javascript
import { BridgeClient } from './bridge-client.js';

const bridge = new BridgeClient({
  baseUrl: 'https://tu-gateway.vercel.app',
  token: 'tu_token'
});

// Verificar balance disponible
async function checkPrefundedBalance() {
  const accounts = await bridge.listPrefundedAccounts();
  return accounts.data.data.map(acc => ({
    id: acc.id,
    currency: acc.currency,
    balance: acc.available_balance
  }));
}

// Pagar a un empleado
async function payEmployee(employeeCustomerId, externalAccountId, amount, description) {
  // Usar prefunded account para pago instantáneo
  const prefundedAccounts = await bridge.listPrefundedAccounts();
  const usdAccount = prefundedAccounts.data.data.find(a => a.currency === 'usd');
  
  if (parseFloat(usdAccount.available_balance) < amount) {
    throw new Error('Balance insuficiente en prefunded account');
  }
  
  const transfer = await bridge.createTransfer({
    amount: amount.toString(),
    on_behalf_of: employeeCustomerId,
    source: {
      payment_rail: 'prefunded',
      currency: 'usd',
      prefunded_account_id: usdAccount.id
    },
    destination: {
      payment_rail: 'ach',
      currency: 'usd',
      external_account_id: externalAccountId
    },
    metadata: {
      type: 'payroll',
      description: description
    }
  });
  
  return transfer.data;
}

// Procesar nómina completa
async function processPayroll(employees) {
  const results = [];
  
  for (const employee of employees) {
    try {
      const payment = await payEmployee(
        employee.customerId,
        employee.bankAccountId,
        employee.amount,
        `Pago nómina - ${new Date().toISOString().slice(0, 7)}`
      );
      
      results.push({
        employeeId: employee.id,
        status: 'success',
        transferId: payment.id
      });
    } catch (error) {
      results.push({
        employeeId: employee.id,
        status: 'failed',
        error: error.message
      });
    }
  }
  
  return results;
}

// Uso
const payrollResults = await processPayroll([
  { id: 'emp1', customerId: 'cust_1', bankAccountId: 'ext_1', amount: 5000 },
  { id: 'emp2', customerId: 'cust_2', bankAccountId: 'ext_2', amount: 4500 },
  { id: 'emp3', customerId: 'cust_3', bankAccountId: 'ext_3', amount: 6000 }
]);

console.log('Resultados de nómina:', payrollResults);
```

---

## Verificación KYC Completa

Flujo completo de verificación KYC con manejo de estados.

```javascript
import { BridgeClient } from './bridge-client.js';

const bridge = new BridgeClient({
  baseUrl: 'https://tu-gateway.vercel.app',
  token: 'tu_token'
});

// Iniciar proceso KYC
async function initiateKYC(customerId, endorsements = ['base']) {
  const kycLink = await bridge.createKycLink({
    customer_id: customerId,
    type: 'individual',
    endorsements: endorsements,
    redirect_uri: 'https://tuapp.com/kyc-callback'
  });
  
  return {
    kycLinkId: kycLink.data.id,
    url: kycLink.data.url,
    expiresAt: kycLink.data.expires_at
  };
}

// Verificar estado del KYC
async function checkKYCStatus(kycLinkId) {
  const kycLink = await bridge.getKycLink(kycLinkId);
  
  return {
    status: kycLink.data.status,
    customer_id: kycLink.data.customer_id,
    endorsements: kycLink.data.endorsements
  };
}

// Manejar callback de KYC
async function handleKYCCallback(kycLinkId) {
  const status = await checkKYCStatus(kycLinkId);
  
  switch (status.status) {
    case 'approved':
      // KYC aprobado - habilitar funcionalidades
      await enableFullFeatures(status.customer_id);
      return { success: true, message: 'KYC aprobado' };
      
    case 'rejected':
      // KYC rechazado
      return { success: false, message: 'KYC rechazado. Contacta soporte.' };
      
    case 'incomplete':
      // Información faltante - reenviar a completar
      const newLink = await initiateKYC(status.customer_id);
      return { 
        success: false, 
        message: 'Información incompleta',
        retryUrl: newLink.url 
      };
      
    case 'under_review':
      return { success: null, message: 'En revisión. Te notificaremos pronto.' };
      
    default:
      return { success: null, message: 'Estado desconocido' };
  }
}

// Webhook para actualizaciones de KYC
function handleKYCWebhook(event) {
  switch (event.type) {
    case 'kyc_link.approved':
      console.log(`KYC aprobado para customer: ${event.data.customer_id}`);
      enableFullFeatures(event.data.customer_id);
      sendEmail(event.data.customer_id, 'kyc_approved');
      break;
      
    case 'kyc_link.rejected':
      console.log(`KYC rechazado para customer: ${event.data.customer_id}`);
      sendEmail(event.data.customer_id, 'kyc_rejected');
      break;
      
    case 'kyc_link.incomplete':
      console.log(`KYC incompleto para customer: ${event.data.customer_id}`);
      sendEmail(event.data.customer_id, 'kyc_incomplete');
      break;
  }
}
```

---

## Virtual Accounts para Depósitos

Recibe depósitos bancarios directamente a wallets crypto.

```javascript
import { BridgeClient } from './bridge-client.js';

const bridge = new BridgeClient({
  baseUrl: 'https://tu-gateway.vercel.app',
  token: 'tu_token'
});

// Crear cuenta virtual completa
async function createDepositAccount(customerId) {
  // 1. Crear wallet
  const wallet = await bridge.createWallet(customerId, {
    chain: 'ethereum',
    currency: 'usdc'
  });
  
  // 2. Crear virtual account apuntando al wallet
  const virtualAccount = await bridge.createVirtualAccount(customerId, {
    currency: 'usd',
    destination: {
      bridge_wallet_id: wallet.data.id
    }
  });
  
  return {
    wallet: {
      id: wallet.data.id,
      address: wallet.data.address,
      chain: 'ethereum',
      currency: 'usdc'
    },
    depositInfo: {
      accountNumber: virtualAccount.data.account_number,
      routingNumber: virtualAccount.data.routing_number,
      bankName: virtualAccount.data.bank_name,
      accountName: virtualAccount.data.account_name
    }
  };
}

// Obtener historial de depósitos
async function getDepositHistory(customerId, virtualAccountId) {
  const history = await bridge.getVirtualAccountHistory(
    customerId,
    virtualAccountId,
    { limit: 50 }
  );
  
  return history.data.data.map(tx => ({
    id: tx.id,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    createdAt: tx.created_at
  }));
}

// Desactivar cuenta virtual
async function deactivateDepositAccount(customerId, virtualAccountId) {
  await bridge.deactivateVirtualAccount(customerId, virtualAccountId);
  return { success: true };
}

// Uso
const account = await createDepositAccount('cust_abc123');

console.log(`
Para depositar USD que se convierte automáticamente a USDC:

Banco: ${account.depositInfo.bankName}
Número de cuenta: ${account.depositInfo.accountNumber}
Número de ruta: ${account.depositInfo.routingNumber}
Nombre: ${account.depositInfo.accountName}

Los fondos llegarán a tu wallet USDC:
${account.wallet.address}
`);
```

### Webhook para depósitos recibidos

```javascript
app.post('/webhooks/bridge', (req, res) => {
  const event = req.body;
  
  if (event.type === 'virtual_account.funds_received') {
    const { customer_id, amount, currency } = event.data;
    
    // Notificar al usuario
    notifyUser(customer_id, {
      type: 'deposit_received',
      message: `Depósito recibido: $${amount} ${currency}`,
      amount,
      currency
    });
    
    // Actualizar balance en UI
    refreshUserBalance(customer_id);
  }
  
  res.status(200).json({ received: true });
});
```

---

## Tips y Mejores Prácticas

### 1. Manejo de Errores

```javascript
async function safeApiCall(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error.status === 429) {
      // Rate limit - esperar y reintentar
      const waitTime = parseInt(error.headers?.['retry-after'] || '60');
      await new Promise(r => setTimeout(r, waitTime * 1000));
      return await fn();
    }
    
    if (error.status === 422) {
      // Error de validación
      console.error('Validation error:', error.data);
      throw new Error(`Validación fallida: ${error.message}`);
    }
    
    throw error;
  }
}

// Uso
const customer = await safeApiCall(() => 
  bridge.createCustomer({ ... })
);
```

### 2. Idempotencia

Para operaciones críticas, usa Idempotency Keys consistentes:

```javascript
const orderId = 'order_12345';
const idempotencyKey = `transfer_${orderId}`;

// El gateway genera automáticamente Idempotency-Key
// Pero puedes pasar el tuyo si necesitas control
```

### 3. Webhooks Robustos

```javascript
// Verificar firma del webhook (si configuraste WEBHOOK_SECRET)
function verifyWebhookSignature(payload, signature) {
  // Implementación según documentación de Bridge
  // RSA-PSS SHA-256
}

// Responder rápido y procesar async
app.post('/webhooks/bridge', async (req, res) => {
  // Responder inmediatamente
  res.status(200).json({ received: true });
  
  // Procesar en background
  setImmediate(() => {
    processWebhookEvent(req.body);
  });
});
```
