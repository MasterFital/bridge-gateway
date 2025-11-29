/**
 * ============================================================================
 * BRIDGE.XYZ API GATEWAY - SERVIDOR PRINCIPAL
 * ============================================================================
 * 
 * API Gateway completo para Bridge.xyz que actúa como intermediario entre
 * tus aplicaciones y la API oficial de Bridge.
 * 
 * ENDPOINTS IMPLEMENTADOS: 61+
 * - Customers API (8 endpoints)
 * - KYC Links API (3 endpoints)
 * - External Accounts API (6 endpoints)
 * - Bridge Wallets API (3 endpoints)
 * - Transfers API (5 endpoints)
 * - Virtual Accounts API (7 endpoints)
 * - Static Memos API (5 endpoints)
 * - Liquidation Addresses API (4 endpoints)
 * - Prefunded Accounts API (2 endpoints)
 * - Cards API (4 endpoints)
 * - Plaid Integration API (2 endpoints)
 * - Exchange Rates API (1 endpoint)
 * - Lists/Reference Data API (3 endpoints)
 * - Webhooks Management API (8 endpoints)
 * - Webhook Receiver (1 endpoint)
 * - Monitoring (2 endpoints)
 * 
 * @author Bridge Gateway
 * @version 1.0.0
 * @license MIT
 */

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const BRIDGE_URL = process.env.BRIDGE_URL || 'https://api.bridge.xyz/v0';
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const MI_TOKEN_SECRETO = process.env.MI_TOKEN_SECRETO;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 100;
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000;

// ============================================================================
// MIDDLEWARES BASE
// ============================================================================

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-token', 'Api-Key', 'Idempotency-Key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// SISTEMA DE LOGGING
// ============================================================================

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data
  };
  console.log(JSON.stringify(logEntry));
}

// Middleware de logging para todas las peticiones
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  req.requestId = requestId;

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    log('info', 'Request processed', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.headers['user-agent']
    });
  });

  next();
});

// ============================================================================
// RATE LIMITING
// ============================================================================

const rateLimitStore = new Map();

function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanupRateLimitStore, RATE_LIMIT_WINDOW);

function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();

  let data = rateLimitStore.get(ip);
  
  if (!data || now - data.windowStart > RATE_LIMIT_WINDOW) {
    data = { count: 1, windowStart: now };
    rateLimitStore.set(ip, data);
  } else {
    data.count++;
  }

  const remaining = Math.max(0, RATE_LIMIT_MAX - data.count);
  const resetTime = Math.ceil((data.windowStart + RATE_LIMIT_WINDOW - now) / 1000);

  res.set({
    'X-RateLimit-Limit': RATE_LIMIT_MAX,
    'X-RateLimit-Remaining': remaining,
    'X-RateLimit-Reset': resetTime
  });

  if (data.count > RATE_LIMIT_MAX) {
    res.set('Retry-After', resetTime);
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Límite de ${RATE_LIMIT_MAX} peticiones por minuto excedido. Intenta de nuevo en ${resetTime} segundos.`
      }
    });
  }

  next();
}

app.use(rateLimitMiddleware);

// ============================================================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================================================

function authMiddleware(req, res, next) {
  // Endpoints públicos que no requieren autenticación
  const publicPaths = ['/health', '/webhooks/bridge'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  // Verificar token del gateway si está configurado
  if (MI_TOKEN_SECRETO) {
    const token = req.headers['x-api-token'];
    if (!token || token !== MI_TOKEN_SECRETO) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token de autenticación inválido o faltante. Incluye el header x-api-token.'
        }
      });
    }
  }

  // Verificar que BRIDGE_API_KEY esté configurado
  if (!BRIDGE_API_KEY) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONFIGURATION_ERROR',
        message: 'BRIDGE_API_KEY no está configurado en el servidor.'
      }
    });
  }

  next();
}

app.use(authMiddleware);

// ============================================================================
// HELPER: COMUNICACIÓN CON BRIDGE API
// ============================================================================

async function bridgeRequest(method, path, body = null, options = {}) {
  const url = `${BRIDGE_URL}${path}`;
  
  const headers = {
    'Api-Key': BRIDGE_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Agregar Idempotency-Key para POST y PUT (según especificaciones Bridge)
  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    headers['Idempotency-Key'] = options.idempotencyKey || crypto.randomUUID();
  }

  const fetchOptions = {
    method: method.toUpperCase(),
    headers
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    fetchOptions.body = JSON.stringify(body);
  }

  log('debug', 'Bridge API Request', {
    method: fetchOptions.method,
    url,
    hasBody: !!body
  });

  try {
    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    log('debug', 'Bridge API Response', {
      status: response.status,
      url
    });

    return {
      status: response.status,
      ok: response.ok,
      data
    };
  } catch (error) {
    log('error', 'Bridge API Error', {
      url,
      error: error.message
    });
    throw error;
  }
}

// Helper para enviar respuestas estandarizadas
function sendResponse(res, bridgeResponse) {
  if (bridgeResponse.ok) {
    return res.status(bridgeResponse.status).json({
      success: true,
      data: bridgeResponse.data
    });
  } else {
    return res.status(bridgeResponse.status).json({
      success: false,
      error: bridgeResponse.data
    });
  }
}

// ============================================================================
// ENDPOINTS DE MONITOREO
// ============================================================================

// GET /health - Health check del gateway
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      service: 'bridge-api-gateway'
    }
  });
});

// GET /api/status - Status completo verificando conexión con Bridge
app.get('/api/status', async (req, res) => {
  try {
    const startTime = Date.now();
    const bridgeResponse = await bridgeRequest('GET', '/developers/prefunded_accounts');
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        gateway: {
          status: 'healthy',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        },
        bridge: {
          status: bridgeResponse.ok ? 'connected' : 'error',
          responseTime: `${responseTime}ms`,
          apiVersion: 'v0'
        },
        configuration: {
          bridgeUrl: BRIDGE_URL,
          rateLimitMax: RATE_LIMIT_MAX,
          rateLimitWindow: `${RATE_LIMIT_WINDOW}ms`,
          authEnabled: !!MI_TOKEN_SECRETO
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: 'BRIDGE_UNREACHABLE',
        message: 'No se pudo conectar con Bridge API',
        details: error.message
      }
    });
  }
});

// ============================================================================
// CUSTOMERS API (8 endpoints)
// ============================================================================

// POST /api/customers - Crear customer
app.post('/api/customers', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', '/customers', req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers - Listar customers con paginación
app.get('/api/customers', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams ? `/customers?${queryParams}` : '/customers';
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id - Obtener customer por ID
app.get('/api/customers/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/customers/${req.params.id}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// PUT /api/customers/:id - Actualizar customer
app.put('/api/customers/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('PUT', `/customers/${req.params.id}`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// PATCH /api/customers/:id - Actualizar customer (parcial)
app.patch('/api/customers/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('PATCH', `/customers/${req.params.id}`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// DELETE /api/customers/:id - Eliminar customer
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('DELETE', `/customers/${req.params.id}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/kyc-link - Obtener KYC link del customer
app.get('/api/customers/:id/kyc-link', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/customers/${req.params.id}/kyc_link`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/tos-link - Obtener TOS acceptance link
app.get('/api/customers/:id/tos-link', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/customers/${req.params.id}/tos_link`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// POST /api/customers/tos-links - Crear TOS link para nuevos customers
app.post('/api/customers/tos-links', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', '/tos_links', req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// KYC LINKS API (3 endpoints)
// ============================================================================

// POST /api/kyc-links - Crear KYC link
app.post('/api/kyc-links', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', '/kyc_links', req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/kyc-links - Listar KYC links
app.get('/api/kyc-links', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams ? `/kyc_links?${queryParams}` : '/kyc_links';
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/kyc-links/:id - Obtener KYC link por ID
app.get('/api/kyc-links/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/kyc_links/${req.params.id}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// EXTERNAL ACCOUNTS API (6 endpoints)
// ============================================================================

// POST /api/customers/:id/external-accounts - Crear cuenta bancaria
app.post('/api/customers/:id/external-accounts', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', `/customers/${req.params.id}/external_accounts`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/external-accounts - Listar cuentas del customer
app.get('/api/customers/:id/external-accounts', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams 
      ? `/customers/${req.params.id}/external_accounts?${queryParams}` 
      : `/customers/${req.params.id}/external_accounts`;
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/external-accounts/:accountId - Obtener cuenta por ID
app.get('/api/customers/:id/external-accounts/:accountId', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/customers/${req.params.id}/external_accounts/${req.params.accountId}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// PUT /api/customers/:id/external-accounts/:accountId - Actualizar cuenta
app.put('/api/customers/:id/external-accounts/:accountId', async (req, res) => {
  try {
    const response = await bridgeRequest('PUT', `/customers/${req.params.id}/external_accounts/${req.params.accountId}`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// DELETE /api/customers/:id/external-accounts/:accountId - Eliminar cuenta
app.delete('/api/customers/:id/external-accounts/:accountId', async (req, res) => {
  try {
    const response = await bridgeRequest('DELETE', `/customers/${req.params.id}/external_accounts/${req.params.accountId}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// POST /api/customers/:id/external-accounts/:accountId/reactivate - Reactivar cuenta
app.post('/api/customers/:id/external-accounts/:accountId/reactivate', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', `/customers/${req.params.id}/external_accounts/${req.params.accountId}/reactivate`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// BRIDGE WALLETS API (3 endpoints)
// ============================================================================

// POST /api/customers/:id/wallets - Crear wallet custodial
app.post('/api/customers/:id/wallets', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', `/customers/${req.params.id}/wallets`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/wallets - Listar wallets del customer
app.get('/api/customers/:id/wallets', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams 
      ? `/customers/${req.params.id}/wallets?${queryParams}` 
      : `/customers/${req.params.id}/wallets`;
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/wallets/:walletId - Obtener wallet con balance
app.get('/api/customers/:id/wallets/:walletId', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/customers/${req.params.id}/wallets/${req.params.walletId}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// TRANSFERS API (5 endpoints)
// ============================================================================

// POST /api/transfers - Crear transfer
app.post('/api/transfers', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', '/transfers', req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/transfers - Listar transfers con paginación
app.get('/api/transfers', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams ? `/transfers?${queryParams}` : '/transfers';
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/transfers/:id - Obtener transfer por ID
app.get('/api/transfers/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/transfers/${req.params.id}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// PUT /api/transfers/:id - Actualizar transfer
app.put('/api/transfers/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('PUT', `/transfers/${req.params.id}`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// DELETE /api/transfers/:id - Cancelar transfer
app.delete('/api/transfers/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('DELETE', `/transfers/${req.params.id}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// VIRTUAL ACCOUNTS API (7 endpoints)
// ============================================================================

// POST /api/customers/:id/virtual-accounts - Crear virtual account
app.post('/api/customers/:id/virtual-accounts', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', `/customers/${req.params.id}/virtual_accounts`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/virtual-accounts - Listar virtual accounts
app.get('/api/customers/:id/virtual-accounts', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams 
      ? `/customers/${req.params.id}/virtual_accounts?${queryParams}` 
      : `/customers/${req.params.id}/virtual_accounts`;
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/virtual-accounts/:accountId - Obtener virtual account
app.get('/api/customers/:id/virtual-accounts/:accountId', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/customers/${req.params.id}/virtual_accounts/${req.params.accountId}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// PUT /api/customers/:id/virtual-accounts/:accountId - Actualizar virtual account
app.put('/api/customers/:id/virtual-accounts/:accountId', async (req, res) => {
  try {
    const response = await bridgeRequest('PUT', `/customers/${req.params.id}/virtual_accounts/${req.params.accountId}`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// POST /api/customers/:id/virtual-accounts/:accountId/deactivate - Desactivar
app.post('/api/customers/:id/virtual-accounts/:accountId/deactivate', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', `/customers/${req.params.id}/virtual_accounts/${req.params.accountId}/deactivate`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// POST /api/customers/:id/virtual-accounts/:accountId/reactivate - Reactivar
app.post('/api/customers/:id/virtual-accounts/:accountId/reactivate', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', `/customers/${req.params.id}/virtual_accounts/${req.params.accountId}/reactivate`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/virtual-accounts/:accountId/history - Historial
app.get('/api/customers/:id/virtual-accounts/:accountId/history', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams 
      ? `/customers/${req.params.id}/virtual_accounts/${req.params.accountId}/history?${queryParams}` 
      : `/customers/${req.params.id}/virtual_accounts/${req.params.accountId}/history`;
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// STATIC MEMOS API (5 endpoints)
// ============================================================================

// POST /api/customers/:id/static-memos - Crear static memo
app.post('/api/customers/:id/static-memos', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', `/customers/${req.params.id}/static_memos`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/static-memos - Listar static memos
app.get('/api/customers/:id/static-memos', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams 
      ? `/customers/${req.params.id}/static_memos?${queryParams}` 
      : `/customers/${req.params.id}/static_memos`;
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/static-memos/:memoId - Obtener static memo
app.get('/api/customers/:id/static-memos/:memoId', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/customers/${req.params.id}/static_memos/${req.params.memoId}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// PUT /api/customers/:id/static-memos/:memoId - Actualizar static memo
app.put('/api/customers/:id/static-memos/:memoId', async (req, res) => {
  try {
    const response = await bridgeRequest('PUT', `/customers/${req.params.id}/static_memos/${req.params.memoId}`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/static-memos/:memoId/history - Historial
app.get('/api/customers/:id/static-memos/:memoId/history', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams 
      ? `/customers/${req.params.id}/static_memos/${req.params.memoId}/history?${queryParams}` 
      : `/customers/${req.params.id}/static_memos/${req.params.memoId}/history`;
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// LIQUIDATION ADDRESSES API (4 endpoints)
// ============================================================================

// POST /api/customers/:id/liquidation-addresses - Crear liquidation address
app.post('/api/customers/:id/liquidation-addresses', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', `/customers/${req.params.id}/liquidation_addresses`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/liquidation-addresses - Listar addresses
app.get('/api/customers/:id/liquidation-addresses', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams 
      ? `/customers/${req.params.id}/liquidation_addresses?${queryParams}` 
      : `/customers/${req.params.id}/liquidation_addresses`;
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/customers/:id/liquidation-addresses/:addressId - Obtener address
app.get('/api/customers/:id/liquidation-addresses/:addressId', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/customers/${req.params.id}/liquidation_addresses/${req.params.addressId}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// PUT /api/customers/:id/liquidation-addresses/:addressId - Actualizar address
app.put('/api/customers/:id/liquidation-addresses/:addressId', async (req, res) => {
  try {
    const response = await bridgeRequest('PUT', `/customers/${req.params.id}/liquidation_addresses/${req.params.addressId}`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// PREFUNDED ACCOUNTS API (2 endpoints)
// ============================================================================

// GET /api/prefunded-accounts - Listar prefunded accounts
app.get('/api/prefunded-accounts', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', '/developers/prefunded_accounts');
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/prefunded-accounts/:id - Obtener prefunded account por ID
app.get('/api/prefunded-accounts/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/developers/prefunded_accounts/${req.params.id}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// CARDS API (4 endpoints)
// ============================================================================

// POST /api/cards - Emitir card
app.post('/api/cards', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', '/cards', req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/cards - Listar cards
app.get('/api/cards', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams ? `/cards?${queryParams}` : '/cards';
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/cards/:id - Obtener card por ID
app.get('/api/cards/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/cards/${req.params.id}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// PUT /api/cards/:id - Actualizar card
app.put('/api/cards/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('PUT', `/cards/${req.params.id}`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// PLAID INTEGRATION API (2 endpoints)
// ============================================================================

// POST /api/plaid/link-tokens - Crear Plaid link token
app.post('/api/plaid/link-tokens', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', '/plaid/link_tokens', req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// POST /api/plaid/external-accounts - Crear external account desde Plaid
app.post('/api/plaid/external-accounts', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', '/plaid/external_accounts', req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// EXCHANGE RATES API (1 endpoint)
// ============================================================================

// GET /api/exchange-rates - Obtener tasas de cambio
app.get('/api/exchange-rates', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams ? `/exchange_rates?${queryParams}` : '/exchange_rates';
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// LISTS / REFERENCE DATA API (3 endpoints)
// ============================================================================

// GET /api/lists/currencies - Listar currencies soportadas
app.get('/api/lists/currencies', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', '/lists/currencies');
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/lists/chains - Listar chains soportadas
app.get('/api/lists/chains', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', '/lists/chains');
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/lists/countries - Listar países soportados
app.get('/api/lists/countries', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', '/lists/countries');
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// WEBHOOKS MANAGEMENT API (8 endpoints)
// ============================================================================

// POST /api/webhooks - Crear webhook
app.post('/api/webhooks', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', '/webhooks', req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/webhooks - Listar webhooks
app.get('/api/webhooks', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams ? `/webhooks?${queryParams}` : '/webhooks';
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/webhooks/:id - Obtener webhook por ID
app.get('/api/webhooks/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('GET', `/webhooks/${req.params.id}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// PUT /api/webhooks/:id - Actualizar webhook
app.put('/api/webhooks/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('PUT', `/webhooks/${req.params.id}`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// DELETE /api/webhooks/:id - Eliminar webhook
app.delete('/api/webhooks/:id', async (req, res) => {
  try {
    const response = await bridgeRequest('DELETE', `/webhooks/${req.params.id}`);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/webhooks/:id/events - Listar upcoming events
app.get('/api/webhooks/:id/events', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams 
      ? `/webhooks/${req.params.id}/events?${queryParams}` 
      : `/webhooks/${req.params.id}/events`;
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// GET /api/webhooks/:id/logs - Ver delivery logs
app.get('/api/webhooks/:id/logs', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams 
      ? `/webhooks/${req.params.id}/logs?${queryParams}` 
      : `/webhooks/${req.params.id}/logs`;
    const response = await bridgeRequest('GET', path);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// POST /api/webhooks/:id/send - Enviar test event
app.post('/api/webhooks/:id/send', async (req, res) => {
  try {
    const response = await bridgeRequest('POST', `/webhooks/${req.params.id}/send`, req.body);
    sendResponse(res, response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
});

// ============================================================================
// WEBHOOK RECEIVER (recibir notificaciones de Bridge)
// ============================================================================

// POST /webhooks/bridge - Recibir webhook de Bridge
app.post('/webhooks/bridge', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;

  // Parsear el body si es necesario
  let event;
  try {
    event = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch (error) {
    log('error', 'Webhook parse error', { error: error.message });
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PAYLOAD', message: 'No se pudo parsear el payload del webhook' }
    });
  }

  // Validar firma si WEBHOOK_SECRET está configurado
  if (WEBHOOK_SECRET && signature) {
    // Bridge usa RSA-PSS SHA-256 para firmas
    // En producción, verificar la firma aquí
    log('info', 'Webhook signature received', { hasSignature: true });
  }

  // Procesar el evento
  const eventType = event.type || 'unknown';
  log('info', 'Webhook received', {
    type: eventType,
    id: event.id,
    timestamp: event.created_at
  });

  // Handler por tipo de evento
  switch (eventType) {
    // Customer events
    case 'customer.created':
    case 'customer.updated':
    case 'customer.deleted':
      log('info', 'Customer event', { customerId: event.data?.id, type: eventType });
      break;

    // KYC events
    case 'kyc_link.created':
    case 'kyc_link.approved':
    case 'kyc_link.rejected':
    case 'kyc_link.under_review':
    case 'kyc_link.incomplete':
      log('info', 'KYC event', { kycLinkId: event.data?.id, type: eventType });
      break;

    // Transfer events
    case 'transfer.created':
    case 'transfer.pending':
    case 'transfer.completed':
    case 'transfer.failed':
    case 'transfer.cancelled':
    case 'transfer.funds_received':
    case 'transfer.payment_submitted':
    case 'transfer.payment_completed':
      log('info', 'Transfer event', { transferId: event.data?.id, type: eventType });
      break;

    // External account events
    case 'external_account.created':
    case 'external_account.updated':
    case 'external_account.deleted':
      log('info', 'External account event', { accountId: event.data?.id, type: eventType });
      break;

    // Wallet events
    case 'bridge_wallet.created':
    case 'bridge_wallet.updated':
      log('info', 'Wallet event', { walletId: event.data?.id, type: eventType });
      break;

    // Card events
    case 'card.created':
    case 'card.activated':
    case 'card.frozen':
    case 'card.closed':
      log('info', 'Card event', { cardId: event.data?.id, type: eventType });
      break;

    // Card transaction events
    case 'card_transaction.pending':
    case 'card_transaction.completed':
    case 'card_transaction.declined':
    case 'card_transaction.refunded':
      log('info', 'Card transaction event', { transactionId: event.data?.id, type: eventType });
      break;

    // Virtual account events
    case 'virtual_account.created':
    case 'virtual_account.updated':
    case 'virtual_account.deactivated':
    case 'virtual_account.reactivated':
    case 'virtual_account.funds_received':
      log('info', 'Virtual account event', { accountId: event.data?.id, type: eventType });
      break;

    // Static memo events
    case 'static_memo.created':
    case 'static_memo.updated':
    case 'static_memo.funds_received':
      log('info', 'Static memo event', { memoId: event.data?.id, type: eventType });
      break;

    // Liquidation address events
    case 'liquidation_address.created':
    case 'liquidation_address.updated':
    case 'liquidation_address.funds_received':
      log('info', 'Liquidation address event', { addressId: event.data?.id, type: eventType });
      break;

    default:
      log('warn', 'Unknown webhook event type', { type: eventType });
  }

  // Responder con éxito (Bridge espera 200 OK)
  res.status(200).json({
    success: true,
    message: 'Webhook received',
    eventType
  });
});

// ============================================================================
// MANEJO DE ERRORES GLOBAL
// ============================================================================

// 404 - Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Ruta ${req.method} ${req.path} no encontrada`
    }
  });
});

// Error handler global
app.use((err, req, res, next) => {
  log('error', 'Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    path: req.path 
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor'
    }
  });
});

// ============================================================================
// INICIAR SERVIDOR (para desarrollo local)
// ============================================================================

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           BRIDGE.XYZ API GATEWAY v1.0.0                        ║
╠════════════════════════════════════════════════════════════════╣
║  Servidor iniciado en: http://localhost:${PORT}                  ║
║  Health check:         http://localhost:${PORT}/health           ║
║  Status:               http://localhost:${PORT}/api/status       ║
╠════════════════════════════════════════════════════════════════╣
║  Bridge API:           ${BRIDGE_URL}                    ║
║  Autenticación:        ${MI_TOKEN_SECRETO ? 'Habilitada' : 'Deshabilitada'}                           ║
║  Rate Limit:           ${RATE_LIMIT_MAX} req/min                              ║
╚════════════════════════════════════════════════════════════════╝
    `);
  });
}

// Exportar para Vercel (ES modules)
export default app;
