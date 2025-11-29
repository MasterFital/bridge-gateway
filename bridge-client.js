/**
 * ============================================================================
 * BRIDGE.XYZ API GATEWAY - CLIENTE JAVASCRIPT
 * ============================================================================
 * 
 * Cliente JavaScript completo para integrar el Bridge API Gateway
 * en cualquier aplicación frontend o backend Node.js.
 * 
 * CARACTERÍSTICAS:
 * - Soporte para TODOS los 61+ endpoints del gateway
 * - Helpers de alto nivel para flujos comunes
 * - Manejo automático de errores
 * - Compatible con navegadores y Node.js
 * - TypeScript-ready con JSDoc
 * 
 * @author Bridge Gateway
 * @version 1.0.0
 * @license MIT
 */

class BridgeClient {
  /**
   * Crear instancia del cliente
   * @param {Object} config - Configuración del cliente
   * @param {string} config.baseUrl - URL base del gateway (ej: https://tu-gateway.vercel.app)
   * @param {string} config.token - Token de autenticación del gateway (x-api-token)
   */
  constructor(config) {
    if (!config.baseUrl) {
      throw new Error('baseUrl es requerido');
    }
    
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
  }

  /**
   * Hacer petición al gateway
   * @private
   */
  async request(method, path, body = null, options = {}) {
    const url = `${this.baseUrl}${path}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.token) {
      headers['x-api-token'] = this.token;
    }

    const fetchOptions = {
      method: method.toUpperCase(),
      headers,
      ...options
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error?.message || 'Error en la petición');
        error.code = data.error?.code || 'UNKNOWN_ERROR';
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      if (error.status) throw error;
      
      const networkError = new Error(`Error de red: ${error.message}`);
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
  }

  // ==========================================================================
  // HEALTH & STATUS
  // ==========================================================================

  /**
   * Verificar estado del gateway
   * @returns {Promise<Object>} Estado del gateway
   */
  async health() {
    return this.request('GET', '/health');
  }

  /**
   * Obtener status completo (gateway + Bridge)
   * @returns {Promise<Object>} Status completo
   */
  async status() {
    return this.request('GET', '/api/status');
  }

  // ==========================================================================
  // CUSTOMERS API
  // ==========================================================================

  /**
   * Crear nuevo customer
   * @param {Object} data - Datos del customer
   * @param {string} data.type - 'individual' o 'business'
   * @param {string} data.first_name - Nombre (individual)
   * @param {string} data.last_name - Apellido (individual)
   * @param {string} data.email - Email
   * @param {Object} [data.address] - Dirección
   * @returns {Promise<Object>} Customer creado
   */
  async createCustomer(data) {
    return this.request('POST', '/api/customers', data);
  }

  /**
   * Listar todos los customers
   * @param {Object} [params] - Parámetros de paginación
   * @param {number} [params.limit] - Límite de resultados
   * @param {string} [params.after] - Cursor para paginación
   * @returns {Promise<Object>} Lista de customers
   */
  async listCustomers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString ? `/api/customers?${queryString}` : '/api/customers';
    return this.request('GET', path);
  }

  /**
   * Obtener customer por ID
   * @param {string} customerId - ID del customer
   * @returns {Promise<Object>} Customer
   */
  async getCustomer(customerId) {
    return this.request('GET', `/api/customers/${customerId}`);
  }

  /**
   * Actualizar customer
   * @param {string} customerId - ID del customer
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Customer actualizado
   */
  async updateCustomer(customerId, data) {
    return this.request('PUT', `/api/customers/${customerId}`, data);
  }

  /**
   * Eliminar customer
   * @param {string} customerId - ID del customer
   * @returns {Promise<Object>} Confirmación
   */
  async deleteCustomer(customerId) {
    return this.request('DELETE', `/api/customers/${customerId}`);
  }

  /**
   * Obtener KYC link del customer
   * @param {string} customerId - ID del customer
   * @returns {Promise<Object>} KYC link
   */
  async getCustomerKycLink(customerId) {
    return this.request('GET', `/api/customers/${customerId}/kyc-link`);
  }

  /**
   * Obtener TOS link del customer
   * @param {string} customerId - ID del customer
   * @returns {Promise<Object>} TOS link
   */
  async getCustomerTosLink(customerId) {
    return this.request('GET', `/api/customers/${customerId}/tos-link`);
  }

  /**
   * Crear TOS link para nuevos customers
   * @param {Object} data - Datos del TOS link
   * @param {string} [data.redirect_uri] - URL de redirección
   * @returns {Promise<Object>} TOS link
   */
  async createTosLink(data = {}) {
    return this.request('POST', '/api/customers/tos-links', data);
  }

  // ==========================================================================
  // KYC LINKS API
  // ==========================================================================

  /**
   * Crear KYC link
   * @param {Object} data - Datos del KYC link
   * @param {string} data.customer_id - ID del customer
   * @param {string} [data.type] - 'individual' o 'business'
   * @param {string[]} [data.endorsements] - ['base', 'sepa', 'spei', 'pix']
   * @param {string} [data.redirect_uri] - URL de redirección
   * @returns {Promise<Object>} KYC link
   */
  async createKycLink(data) {
    return this.request('POST', '/api/kyc-links', data);
  }

  /**
   * Listar KYC links
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Lista de KYC links
   */
  async listKycLinks(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString ? `/api/kyc-links?${queryString}` : '/api/kyc-links';
    return this.request('GET', path);
  }

  /**
   * Obtener KYC link por ID
   * @param {string} kycLinkId - ID del KYC link
   * @returns {Promise<Object>} KYC link con status
   */
  async getKycLink(kycLinkId) {
    return this.request('GET', `/api/kyc-links/${kycLinkId}`);
  }

  // ==========================================================================
  // EXTERNAL ACCOUNTS API
  // ==========================================================================

  /**
   * Crear cuenta bancaria externa
   * @param {string} customerId - ID del customer
   * @param {Object} data - Datos de la cuenta
   * @param {string} data.account_type - 'us' o 'iban'
   * @param {string} [data.account_number] - Número de cuenta
   * @param {string} [data.routing_number] - Número de ruta (US)
   * @param {string} [data.iban] - IBAN (Europe)
   * @param {string} data.currency - Moneda (USD, EUR, etc.)
   * @returns {Promise<Object>} Cuenta creada
   */
  async createExternalAccount(customerId, data) {
    return this.request('POST', `/api/customers/${customerId}/external-accounts`, data);
  }

  /**
   * Listar cuentas del customer
   * @param {string} customerId - ID del customer
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Lista de cuentas
   */
  async listExternalAccounts(customerId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString 
      ? `/api/customers/${customerId}/external-accounts?${queryString}` 
      : `/api/customers/${customerId}/external-accounts`;
    return this.request('GET', path);
  }

  /**
   * Obtener cuenta por ID
   * @param {string} customerId - ID del customer
   * @param {string} accountId - ID de la cuenta
   * @returns {Promise<Object>} Cuenta
   */
  async getExternalAccount(customerId, accountId) {
    return this.request('GET', `/api/customers/${customerId}/external-accounts/${accountId}`);
  }

  /**
   * Actualizar cuenta
   * @param {string} customerId - ID del customer
   * @param {string} accountId - ID de la cuenta
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Cuenta actualizada
   */
  async updateExternalAccount(customerId, accountId, data) {
    return this.request('PUT', `/api/customers/${customerId}/external-accounts/${accountId}`, data);
  }

  /**
   * Eliminar cuenta
   * @param {string} customerId - ID del customer
   * @param {string} accountId - ID de la cuenta
   * @returns {Promise<Object>} Confirmación
   */
  async deleteExternalAccount(customerId, accountId) {
    return this.request('DELETE', `/api/customers/${customerId}/external-accounts/${accountId}`);
  }

  /**
   * Reactivar cuenta
   * @param {string} customerId - ID del customer
   * @param {string} accountId - ID de la cuenta
   * @returns {Promise<Object>} Cuenta reactivada
   */
  async reactivateExternalAccount(customerId, accountId) {
    return this.request('POST', `/api/customers/${customerId}/external-accounts/${accountId}/reactivate`);
  }

  // ==========================================================================
  // BRIDGE WALLETS API
  // ==========================================================================

  /**
   * Crear wallet custodial
   * @param {string} customerId - ID del customer
   * @param {Object} data - Datos del wallet
   * @param {string} data.chain - 'ethereum', 'solana', 'base', 'polygon'
   * @param {string} data.currency - 'usdc', 'usdt', 'usdb', 'eurc', 'pyusd'
   * @returns {Promise<Object>} Wallet creado
   */
  async createWallet(customerId, data) {
    return this.request('POST', `/api/customers/${customerId}/wallets`, data);
  }

  /**
   * Listar wallets del customer
   * @param {string} customerId - ID del customer
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Lista de wallets
   */
  async listWallets(customerId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString 
      ? `/api/customers/${customerId}/wallets?${queryString}` 
      : `/api/customers/${customerId}/wallets`;
    return this.request('GET', path);
  }

  /**
   * Obtener wallet con balance
   * @param {string} customerId - ID del customer
   * @param {string} walletId - ID del wallet
   * @returns {Promise<Object>} Wallet con balance
   */
  async getWallet(customerId, walletId) {
    return this.request('GET', `/api/customers/${customerId}/wallets/${walletId}`);
  }

  // ==========================================================================
  // TRANSFERS API
  // ==========================================================================

  /**
   * Crear transfer
   * @param {Object} data - Datos del transfer
   * @param {number} data.amount - Monto
   * @param {Object} data.source - Origen
   * @param {Object} data.destination - Destino
   * @param {string} [data.developer_fee] - Comisión del desarrollador
   * @returns {Promise<Object>} Transfer creado
   */
  async createTransfer(data) {
    return this.request('POST', '/api/transfers', data);
  }

  /**
   * Listar transfers
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Lista de transfers
   */
  async listTransfers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString ? `/api/transfers?${queryString}` : '/api/transfers';
    return this.request('GET', path);
  }

  /**
   * Obtener transfer por ID
   * @param {string} transferId - ID del transfer
   * @returns {Promise<Object>} Transfer
   */
  async getTransfer(transferId) {
    return this.request('GET', `/api/transfers/${transferId}`);
  }

  /**
   * Actualizar transfer
   * @param {string} transferId - ID del transfer
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Transfer actualizado
   */
  async updateTransfer(transferId, data) {
    return this.request('PUT', `/api/transfers/${transferId}`, data);
  }

  /**
   * Cancelar transfer
   * @param {string} transferId - ID del transfer
   * @returns {Promise<Object>} Confirmación
   */
  async cancelTransfer(transferId) {
    return this.request('DELETE', `/api/transfers/${transferId}`);
  }

  // ==========================================================================
  // VIRTUAL ACCOUNTS API
  // ==========================================================================

  /**
   * Crear virtual account
   * @param {string} customerId - ID del customer
   * @param {Object} data - Datos de la cuenta virtual
   * @param {string} data.currency - 'usd', 'eur', 'mxn'
   * @param {Object} data.destination - Wallet destino
   * @returns {Promise<Object>} Virtual account creada
   */
  async createVirtualAccount(customerId, data) {
    return this.request('POST', `/api/customers/${customerId}/virtual-accounts`, data);
  }

  /**
   * Listar virtual accounts
   * @param {string} customerId - ID del customer
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Lista de virtual accounts
   */
  async listVirtualAccounts(customerId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString 
      ? `/api/customers/${customerId}/virtual-accounts?${queryString}` 
      : `/api/customers/${customerId}/virtual-accounts`;
    return this.request('GET', path);
  }

  /**
   * Obtener virtual account
   * @param {string} customerId - ID del customer
   * @param {string} accountId - ID de la cuenta
   * @returns {Promise<Object>} Virtual account
   */
  async getVirtualAccount(customerId, accountId) {
    return this.request('GET', `/api/customers/${customerId}/virtual-accounts/${accountId}`);
  }

  /**
   * Actualizar virtual account
   * @param {string} customerId - ID del customer
   * @param {string} accountId - ID de la cuenta
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Virtual account actualizada
   */
  async updateVirtualAccount(customerId, accountId, data) {
    return this.request('PUT', `/api/customers/${customerId}/virtual-accounts/${accountId}`, data);
  }

  /**
   * Desactivar virtual account
   * @param {string} customerId - ID del customer
   * @param {string} accountId - ID de la cuenta
   * @returns {Promise<Object>} Confirmación
   */
  async deactivateVirtualAccount(customerId, accountId) {
    return this.request('POST', `/api/customers/${customerId}/virtual-accounts/${accountId}/deactivate`);
  }

  /**
   * Reactivar virtual account
   * @param {string} customerId - ID del customer
   * @param {string} accountId - ID de la cuenta
   * @returns {Promise<Object>} Virtual account reactivada
   */
  async reactivateVirtualAccount(customerId, accountId) {
    return this.request('POST', `/api/customers/${customerId}/virtual-accounts/${accountId}/reactivate`);
  }

  /**
   * Obtener historial de virtual account
   * @param {string} customerId - ID del customer
   * @param {string} accountId - ID de la cuenta
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Historial
   */
  async getVirtualAccountHistory(customerId, accountId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString 
      ? `/api/customers/${customerId}/virtual-accounts/${accountId}/history?${queryString}` 
      : `/api/customers/${customerId}/virtual-accounts/${accountId}/history`;
    return this.request('GET', path);
  }

  // ==========================================================================
  // STATIC MEMOS API
  // ==========================================================================

  /**
   * Crear static memo
   * @param {string} customerId - ID del customer
   * @param {Object} data - Datos del static memo
   * @returns {Promise<Object>} Static memo creado
   */
  async createStaticMemo(customerId, data) {
    return this.request('POST', `/api/customers/${customerId}/static-memos`, data);
  }

  /**
   * Listar static memos
   * @param {string} customerId - ID del customer
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Lista de static memos
   */
  async listStaticMemos(customerId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString 
      ? `/api/customers/${customerId}/static-memos?${queryString}` 
      : `/api/customers/${customerId}/static-memos`;
    return this.request('GET', path);
  }

  /**
   * Obtener static memo
   * @param {string} customerId - ID del customer
   * @param {string} memoId - ID del memo
   * @returns {Promise<Object>} Static memo
   */
  async getStaticMemo(customerId, memoId) {
    return this.request('GET', `/api/customers/${customerId}/static-memos/${memoId}`);
  }

  /**
   * Actualizar static memo
   * @param {string} customerId - ID del customer
   * @param {string} memoId - ID del memo
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Static memo actualizado
   */
  async updateStaticMemo(customerId, memoId, data) {
    return this.request('PUT', `/api/customers/${customerId}/static-memos/${memoId}`, data);
  }

  /**
   * Obtener historial del static memo
   * @param {string} customerId - ID del customer
   * @param {string} memoId - ID del memo
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Historial
   */
  async getStaticMemoHistory(customerId, memoId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString 
      ? `/api/customers/${customerId}/static-memos/${memoId}/history?${queryString}` 
      : `/api/customers/${customerId}/static-memos/${memoId}/history`;
    return this.request('GET', path);
  }

  // ==========================================================================
  // LIQUIDATION ADDRESSES API
  // ==========================================================================

  /**
   * Crear liquidation address
   * @param {string} customerId - ID del customer
   * @param {Object} data - Datos de la liquidation address
   * @param {string} data.chain - Chain de origen
   * @param {string} data.currency - Moneda de origen
   * @param {Object} data.destination - Destino (external_account o wallet)
   * @returns {Promise<Object>} Liquidation address creada
   */
  async createLiquidationAddress(customerId, data) {
    return this.request('POST', `/api/customers/${customerId}/liquidation-addresses`, data);
  }

  /**
   * Listar liquidation addresses
   * @param {string} customerId - ID del customer
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Lista de addresses
   */
  async listLiquidationAddresses(customerId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString 
      ? `/api/customers/${customerId}/liquidation-addresses?${queryString}` 
      : `/api/customers/${customerId}/liquidation-addresses`;
    return this.request('GET', path);
  }

  /**
   * Obtener liquidation address
   * @param {string} customerId - ID del customer
   * @param {string} addressId - ID de la address
   * @returns {Promise<Object>} Liquidation address
   */
  async getLiquidationAddress(customerId, addressId) {
    return this.request('GET', `/api/customers/${customerId}/liquidation-addresses/${addressId}`);
  }

  /**
   * Actualizar liquidation address
   * @param {string} customerId - ID del customer
   * @param {string} addressId - ID de la address
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Liquidation address actualizada
   */
  async updateLiquidationAddress(customerId, addressId, data) {
    return this.request('PUT', `/api/customers/${customerId}/liquidation-addresses/${addressId}`, data);
  }

  // ==========================================================================
  // PREFUNDED ACCOUNTS API
  // ==========================================================================

  /**
   * Listar prefunded accounts
   * @returns {Promise<Object>} Lista de prefunded accounts
   */
  async listPrefundedAccounts() {
    return this.request('GET', '/api/prefunded-accounts');
  }

  /**
   * Obtener prefunded account
   * @param {string} accountId - ID de la cuenta
   * @returns {Promise<Object>} Prefunded account con balance
   */
  async getPrefundedAccount(accountId) {
    return this.request('GET', `/api/prefunded-accounts/${accountId}`);
  }

  // ==========================================================================
  // CARDS API
  // ==========================================================================

  /**
   * Emitir card
   * @param {Object} data - Datos de la card
   * @param {string} data.customer_id - ID del customer
   * @param {string} data.card_type - 'virtual' o 'physical'
   * @param {string} data.wallet_id - ID del wallet para respaldo
   * @returns {Promise<Object>} Card emitida
   */
  async createCard(data) {
    return this.request('POST', '/api/cards', data);
  }

  /**
   * Listar cards
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Lista de cards
   */
  async listCards(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString ? `/api/cards?${queryString}` : '/api/cards';
    return this.request('GET', path);
  }

  /**
   * Obtener card
   * @param {string} cardId - ID de la card
   * @returns {Promise<Object>} Card
   */
  async getCard(cardId) {
    return this.request('GET', `/api/cards/${cardId}`);
  }

  /**
   * Actualizar card
   * @param {string} cardId - ID de la card
   * @param {Object} data - Datos a actualizar (status: 'active', 'frozen', 'closed')
   * @returns {Promise<Object>} Card actualizada
   */
  async updateCard(cardId, data) {
    return this.request('PUT', `/api/cards/${cardId}`, data);
  }

  // ==========================================================================
  // PLAID INTEGRATION API
  // ==========================================================================

  /**
   * Crear Plaid link token
   * @param {Object} data - Datos para el link token
   * @param {string} data.customer_id - ID del customer
   * @returns {Promise<Object>} Link token
   */
  async createPlaidLinkToken(data) {
    return this.request('POST', '/api/plaid/link-tokens', data);
  }

  /**
   * Crear external account desde Plaid
   * @param {Object} data - Datos del token de Plaid
   * @param {string} data.customer_id - ID del customer
   * @param {string} data.public_token - Public token de Plaid
   * @param {string} data.account_id - Account ID de Plaid
   * @returns {Promise<Object>} External account creada
   */
  async createPlaidExternalAccount(data) {
    return this.request('POST', '/api/plaid/external-accounts', data);
  }

  // ==========================================================================
  // EXCHANGE RATES API
  // ==========================================================================

  /**
   * Obtener tasas de cambio
   * @param {Object} [params] - Parámetros
   * @param {string} [params.from] - Moneda origen
   * @param {string} [params.to] - Moneda destino
   * @returns {Promise<Object>} Tasas de cambio
   */
  async getExchangeRates(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString ? `/api/exchange-rates?${queryString}` : '/api/exchange-rates';
    return this.request('GET', path);
  }

  // ==========================================================================
  // LISTS / REFERENCE DATA API
  // ==========================================================================

  /**
   * Listar currencies soportadas
   * @returns {Promise<Object>} Lista de currencies
   */
  async listCurrencies() {
    return this.request('GET', '/api/lists/currencies');
  }

  /**
   * Listar chains soportadas
   * @returns {Promise<Object>} Lista de chains
   */
  async listChains() {
    return this.request('GET', '/api/lists/chains');
  }

  /**
   * Listar países soportados
   * @returns {Promise<Object>} Lista de países
   */
  async listCountries() {
    return this.request('GET', '/api/lists/countries');
  }

  // ==========================================================================
  // WEBHOOKS MANAGEMENT API
  // ==========================================================================

  /**
   * Crear webhook
   * @param {Object} data - Datos del webhook
   * @param {string} data.url - URL del webhook
   * @param {boolean} [data.enabled] - Habilitado (default: false)
   * @returns {Promise<Object>} Webhook creado
   */
  async createWebhook(data) {
    return this.request('POST', '/api/webhooks', data);
  }

  /**
   * Listar webhooks
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Lista de webhooks
   */
  async listWebhooks(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString ? `/api/webhooks?${queryString}` : '/api/webhooks';
    return this.request('GET', path);
  }

  /**
   * Obtener webhook
   * @param {string} webhookId - ID del webhook
   * @returns {Promise<Object>} Webhook
   */
  async getWebhook(webhookId) {
    return this.request('GET', `/api/webhooks/${webhookId}`);
  }

  /**
   * Actualizar webhook
   * @param {string} webhookId - ID del webhook
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Webhook actualizado
   */
  async updateWebhook(webhookId, data) {
    return this.request('PUT', `/api/webhooks/${webhookId}`, data);
  }

  /**
   * Eliminar webhook
   * @param {string} webhookId - ID del webhook
   * @returns {Promise<Object>} Confirmación
   */
  async deleteWebhook(webhookId) {
    return this.request('DELETE', `/api/webhooks/${webhookId}`);
  }

  /**
   * Listar eventos pendientes del webhook
   * @param {string} webhookId - ID del webhook
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Lista de eventos
   */
  async listWebhookEvents(webhookId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString 
      ? `/api/webhooks/${webhookId}/events?${queryString}` 
      : `/api/webhooks/${webhookId}/events`;
    return this.request('GET', path);
  }

  /**
   * Ver logs de entrega del webhook
   * @param {string} webhookId - ID del webhook
   * @param {Object} [params] - Parámetros
   * @returns {Promise<Object>} Logs de entrega
   */
  async getWebhookLogs(webhookId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const path = queryString 
      ? `/api/webhooks/${webhookId}/logs?${queryString}` 
      : `/api/webhooks/${webhookId}/logs`;
    return this.request('GET', path);
  }

  /**
   * Enviar evento de prueba al webhook
   * @param {string} webhookId - ID del webhook
   * @param {Object} [data] - Datos del evento de prueba
   * @returns {Promise<Object>} Resultado del envío
   */
  async sendTestWebhook(webhookId, data = {}) {
    return this.request('POST', `/api/webhooks/${webhookId}/send`, data);
  }

  // ==========================================================================
  // HELPERS DE ALTO NIVEL
  // ==========================================================================

  /**
   * Onboarding completo de cliente
   * Crea customer, KYC link, y wallet en un solo paso
   * @param {Object} data - Datos del cliente
   * @param {string} data.type - 'individual' o 'business'
   * @param {string} data.first_name - Nombre
   * @param {string} data.last_name - Apellido
   * @param {string} data.email - Email
   * @param {string[]} [data.endorsements] - Endorsements para KYC
   * @param {string} [data.redirect_uri] - URL de redirección KYC
   * @param {Object} [data.wallet] - Configuración del wallet
   * @returns {Promise<Object>} Customer, KYC link, y wallet creados
   */
  async onboardCliente(data) {
    // 1. Crear customer
    const customerResponse = await this.createCustomer({
      type: data.type,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      ...data.customerData
    });

    const customerId = customerResponse.data.id;

    // 2. Crear KYC link
    const kycResponse = await this.createKycLink({
      customer_id: customerId,
      type: data.type,
      endorsements: data.endorsements || ['base'],
      redirect_uri: data.redirect_uri
    });

    // 3. Crear wallet si se especifica
    let walletResponse = null;
    if (data.wallet) {
      walletResponse = await this.createWallet(customerId, {
        chain: data.wallet.chain || 'ethereum',
        currency: data.wallet.currency || 'usdc'
      });
    }

    return {
      success: true,
      data: {
        customer: customerResponse.data,
        kycLink: kycResponse.data,
        wallet: walletResponse?.data || null
      }
    };
  }

  /**
   * Crear cuenta bancaria completa
   * Customer + External Account + Virtual Account
   * @param {Object} data - Datos
   * @returns {Promise<Object>} Cuenta completa
   */
  async createFullAccount(data) {
    const { customerId, externalAccount, virtualAccount } = data;

    // 1. Crear external account si se especifica
    let externalAccountResponse = null;
    if (externalAccount) {
      externalAccountResponse = await this.createExternalAccount(customerId, externalAccount);
    }

    // 2. Crear virtual account si se especifica
    let virtualAccountResponse = null;
    if (virtualAccount) {
      virtualAccountResponse = await this.createVirtualAccount(customerId, virtualAccount);
    }

    return {
      success: true,
      data: {
        externalAccount: externalAccountResponse?.data || null,
        virtualAccount: virtualAccountResponse?.data || null
      }
    };
  }

  /**
   * Conversión Fiat → Crypto (On-ramp)
   * @param {Object} data - Datos del transfer
   * @param {string} data.customerId - ID del customer
   * @param {number} data.amount - Monto en fiat
   * @param {string} data.externalAccountId - ID de la cuenta bancaria origen
   * @param {string} data.walletId - ID del wallet destino
   * @param {string} [data.developerFee] - Comisión del desarrollador
   * @returns {Promise<Object>} Transfer creado
   */
  async fiatToCrypto(data) {
    return this.createTransfer({
      amount: data.amount.toString(),
      on_behalf_of: data.customerId,
      source: {
        payment_rail: 'ach',
        currency: 'usd',
        external_account_id: data.externalAccountId
      },
      destination: {
        payment_rail: 'ethereum',
        currency: 'usdc',
        to_address: data.walletAddress || undefined,
        bridge_wallet_id: data.walletId || undefined
      },
      developer_fee: data.developerFee
    });
  }

  /**
   * Conversión Crypto → Fiat (Off-ramp)
   * @param {Object} data - Datos del transfer
   * @param {string} data.customerId - ID del customer
   * @param {number} data.amount - Monto en crypto
   * @param {string} data.walletId - ID del wallet origen
   * @param {string} data.externalAccountId - ID de la cuenta bancaria destino
   * @param {string} [data.developerFee] - Comisión del desarrollador
   * @returns {Promise<Object>} Transfer creado
   */
  async cryptoToFiat(data) {
    return this.createTransfer({
      amount: data.amount.toString(),
      on_behalf_of: data.customerId,
      source: {
        payment_rail: 'ethereum',
        currency: 'usdc',
        bridge_wallet_id: data.walletId
      },
      destination: {
        payment_rail: 'ach',
        currency: 'usd',
        external_account_id: data.externalAccountId
      },
      developer_fee: data.developerFee
    });
  }

  /**
   * Emitir card con wallet
   * Crea wallet y emite card en un solo paso
   * @param {Object} data - Datos
   * @param {string} data.customerId - ID del customer
   * @param {string} data.cardType - 'virtual' o 'physical'
   * @param {Object} [data.wallet] - Configuración del wallet
   * @returns {Promise<Object>} Wallet y card creados
   */
  async issueCardWithWallet(data) {
    // 1. Crear wallet
    const walletResponse = await this.createWallet(data.customerId, {
      chain: data.wallet?.chain || 'ethereum',
      currency: data.wallet?.currency || 'usdc'
    });

    // 2. Emitir card
    const cardResponse = await this.createCard({
      customer_id: data.customerId,
      card_type: data.cardType,
      wallet_id: walletResponse.data.id
    });

    return {
      success: true,
      data: {
        wallet: walletResponse.data,
        card: cardResponse.data
      }
    };
  }

  /**
   * Flujo completo de Virtual Account
   * Wallet + Virtual Account
   * @param {Object} data - Datos
   * @param {string} data.customerId - ID del customer
   * @param {string} data.currency - Moneda de la virtual account
   * @param {Object} [data.wallet] - Configuración del wallet
   * @returns {Promise<Object>} Wallet y virtual account
   */
  async createVirtualAccountFlow(data) {
    // 1. Crear wallet
    const walletResponse = await this.createWallet(data.customerId, {
      chain: data.wallet?.chain || 'ethereum',
      currency: data.wallet?.currency || 'usdc'
    });

    // 2. Crear virtual account
    const virtualAccountResponse = await this.createVirtualAccount(data.customerId, {
      currency: data.currency || 'usd',
      destination: {
        bridge_wallet_id: walletResponse.data.id
      }
    });

    return {
      success: true,
      data: {
        wallet: walletResponse.data,
        virtualAccount: virtualAccountResponse.data
      }
    };
  }
}

// Exportar para ES modules
export { BridgeClient };

// También disponible como default export
export default BridgeClient;
