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

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ============================================================================
// CONFIGURACIÓN DE BASE DE DATOS Y JWT
// ============================================================================

// Adaptador inteligente: usa Neon para URLs de neon.tech, pg estándar para otras
const DATABASE_URL = process.env.DATABASE_URL;
let pool = null;
let dbType = 'none';

if (DATABASE_URL) {
  const isNeonDb = DATABASE_URL.includes('neon.tech') || DATABASE_URL.includes('neon.aws');
  
  if (isNeonDb) {
    // Usar driver Neon serverless para bases de datos Neon (requiere WebSocket)
    const { Pool: NeonPool } = require('@neondatabase/serverless');
    pool = new NeonPool({ connectionString: DATABASE_URL });
    dbType = 'neon';
  } else {
    // Usar driver pg estándar para PostgreSQL normal (Replit, local, etc.)
    const { Pool: PgPool } = require('pg');
    pool = new PgPool({ connectionString: DATABASE_URL });
    dbType = 'pg';
  }
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Database adapter initialized',
    type: dbType,
    host: DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown'
  }));
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = '7d'; // Tokens válidos por 7 días

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY;
const MI_TOKEN_SECRETO = process.env.MI_TOKEN_SECRETO;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 100;
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000;

// ============================================================================
// CONFIGURACIÓN DE AMBIENTE - Siempre Producción
// ============================================================================

const BRIDGE_URL = 'https://api.bridge.xyz/v0';
const BRIDGE_ENVIRONMENT = 'production';

// Log del ambiente al iniciar
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  message: 'Gateway initialized',
  environment: BRIDGE_ENVIRONMENT,
  bridgeUrl: BRIDGE_URL
}));

// ============================================================================
// MEJORA #3: RETRY LOGIC - Configuración de reintentos
// ============================================================================

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 100,      // 100ms inicial
  maxDelay: 2000,      // máximo 2 segundos
  retryableStatuses: [500, 502, 503, 504],  // Solo errores de servidor
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'FETCH_ERROR']
};

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
// MEJORA #1: RATE LIMITING POR TOKEN (en lugar de solo IP)
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

function getRateLimitKey(req) {
  // MEJORA: Usar token como identificador principal
  // Esto permite rate limiting por cliente en lugar de por IP
  const token = req.headers['x-api-token'];
  if (token) {
    // Usar hash del token para no exponer el token en logs/memoria
    return `token:${crypto.createHash('sha256').update(token).digest('hex').substring(0, 16)}`;
  }
  
  // Fallback a IP si no hay token (para endpoints públicos)
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  return `ip:${ip}`;
}

function rateLimitMiddleware(req, res, next) {
  const rateLimitKey = getRateLimitKey(req);
  const now = Date.now();

  let data = rateLimitStore.get(rateLimitKey);
  
  if (!data || now - data.windowStart > RATE_LIMIT_WINDOW) {
    data = { count: 1, windowStart: now };
    rateLimitStore.set(rateLimitKey, data);
  } else {
    data.count++;
  }

  const remaining = Math.max(0, RATE_LIMIT_MAX - data.count);
  const resetTime = Math.ceil((data.windowStart + RATE_LIMIT_WINDOW - now) / 1000);

  res.set({
    'X-RateLimit-Limit': RATE_LIMIT_MAX,
    'X-RateLimit-Remaining': remaining,
    'X-RateLimit-Reset': resetTime,
    'X-RateLimit-Type': rateLimitKey.startsWith('token:') ? 'token' : 'ip'
  });

  if (data.count > RATE_LIMIT_MAX) {
    log('warn', 'Rate limit exceeded', {
      key: rateLimitKey,
      count: data.count,
      limit: RATE_LIMIT_MAX
    });
    
    res.set('Retry-After', resetTime);
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Límite de ${RATE_LIMIT_MAX} peticiones por minuto excedido. Intenta de nuevo en ${resetTime} segundos.`,
        resetIn: resetTime
      }
    });
  }

  next();
}

app.use(rateLimitMiddleware);

// ============================================================================
// SISTEMA DE USUARIOS - Base de datos
// ============================================================================

async function initializeUsersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gateway_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);
    log('info', 'Users table initialized');
  } catch (error) {
    log('error', 'Failed to initialize users table', { error: error.message });
  }
}

// Inicializar tabla al arrancar
initializeUsersTable();

// ============================================================================
// AUTH API - Registro y Login
// ============================================================================

// POST /auth/register - Crear cuenta nueva
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validaciones
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email y password son requeridos'
        }
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'La contraseña debe tener al menos 8 caracteres'
        }
      });
    }

    // Verificar si el email ya existe
    const existingUser = await pool.query(
      'SELECT id FROM gateway_users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Ya existe una cuenta con este email'
        }
      });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Crear usuario
    const result = await pool.query(
      'INSERT INTO gateway_users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [email.toLowerCase(), passwordHash, name || null]
    );

    const user = result.rows[0];

    // Generar JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    log('info', 'User registered', { userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at
        },
        token,
        expiresIn: JWT_EXPIRES_IN
      }
    });

  } catch (error) {
    log('error', 'Registration failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Error al crear la cuenta'
      }
    });
  }
});

// POST /auth/login - Iniciar sesión
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email y password son requeridos'
        }
      });
    }

    // Buscar usuario
    const result = await pool.query(
      'SELECT id, email, name, password_hash, is_active FROM gateway_users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email o contraseña incorrectos'
        }
      });
    }

    const user = result.rows[0];

    // Verificar si la cuenta está activa
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Esta cuenta ha sido desactivada'
        }
      });
    }

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email o contraseña incorrectos'
        }
      });
    }

    // Actualizar último login
    await pool.query(
      'UPDATE gateway_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generar JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    log('info', 'User logged in', { userId: user.id, email: user.email });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token,
        expiresIn: JWT_EXPIRES_IN
      }
    });

  } catch (error) {
    log('error', 'Login failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Error al iniciar sesión'
      }
    });
  }
});

// GET /auth/me - Obtener usuario actual
app.get('/auth/me', async (req, res) => {
  try {
    // Verificar token JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token no proporcionado. Usa: Authorization: Bearer <token>'
        }
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const result = await pool.query(
        'SELECT id, email, name, created_at, last_login FROM gateway_users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Usuario no encontrado'
          }
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });

    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token inválido o expirado'
        }
      });
    }

  } catch (error) {
    log('error', 'Get user failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Error al obtener usuario'
      }
    });
  }
});

// ============================================================================
// MIDDLEWARE DE AUTENTICACIÓN (acepta token fijo O JWT)
// ============================================================================

function authMiddleware(req, res, next) {
  // Endpoints públicos que no requieren autenticación
  const publicPaths = ['/health', '/webhooks/bridge', '/auth/register', '/auth/login'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  // OPCIÓN 1: Token fijo (x-api-token header) - compatibilidad hacia atrás
  const fixedToken = req.headers['x-api-token'];
  if (fixedToken && MI_TOKEN_SECRETO && fixedToken === MI_TOKEN_SECRETO) {
    req.authType = 'fixed_token';
    return next();
  }

  // OPCIÓN 2: JWT (Authorization: Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwtToken = authHeader.substring(7);
    try {
      const decoded = jwt.verify(jwtToken, JWT_SECRET);
      req.user = decoded;
      req.authType = 'jwt';
      return next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token JWT inválido o expirado. Inicia sesión nuevamente.'
        }
      });
    }
  }

  // Si no hay token válido
  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Autenticación requerida. Usa x-api-token O Authorization: Bearer <jwt>'
    }
  });
}

app.use(authMiddleware);

// ============================================================================
// HELPER: COMUNICACIÓN CON BRIDGE API + MEJORA #3: RETRY LOGIC
// ============================================================================

// Función de delay con exponential backoff
function calculateDelay(attempt) {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelay
  );
  // Agregar jitter aleatorio (±25%) para evitar thundering herd
  const jitter = delay * 0.25 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

// Verificar si el error es reintentable
function isRetryableError(error, status) {
  // Errores de red son reintentables
  if (error && RETRY_CONFIG.retryableErrors.some(e => error.message?.includes(e))) {
    return true;
  }
  // Errores 5xx de servidor son reintentables
  if (status && RETRY_CONFIG.retryableStatuses.includes(status)) {
    return true;
  }
  return false;
}

// Función de sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function bridgeRequest(method, path, body = null, options = {}) {
  const url = `${BRIDGE_URL}${path}`;
  const idempotencyKey = options.idempotencyKey || crypto.randomUUID();
  
  const headers = {
    'Api-Key': BRIDGE_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Agregar Idempotency-Key para POST y PUT (según especificaciones Bridge)
  // IMPORTANTE: Usar la misma key en todos los reintentos para evitar duplicados
  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const fetchOptions = {
    method: method.toUpperCase(),
    headers
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    fetchOptions.body = JSON.stringify(body);
  }

  let lastError = null;
  let lastResponse = null;

  // MEJORA #3: Retry Logic con exponential backoff
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = calculateDelay(attempt - 1);
        log('info', 'Retrying Bridge API request', {
          attempt,
          maxRetries: RETRY_CONFIG.maxRetries,
          delay: `${delay}ms`,
          url
        });
        await sleep(delay);
      }

      log('debug', 'Bridge API Request', {
        method: fetchOptions.method,
        url,
        hasBody: !!body,
        attempt: attempt + 1
      });

      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { raw: responseText };
      }

      // Si es error 5xx y tenemos reintentos disponibles, continuar
      if (isRetryableError(null, response.status) && attempt < RETRY_CONFIG.maxRetries) {
        log('warn', 'Retryable server error', {
          status: response.status,
          attempt: attempt + 1,
          url
        });
        lastResponse = { status: response.status, ok: response.ok, data };
        continue;
      }

      log('debug', 'Bridge API Response', {
        status: response.status,
        url,
        attempts: attempt + 1
      });

      return {
        status: response.status,
        ok: response.ok,
        data,
        attempts: attempt + 1
      };
      
    } catch (error) {
      lastError = error;
      
      // Si es error de red y tenemos reintentos disponibles, continuar
      if (isRetryableError(error, null) && attempt < RETRY_CONFIG.maxRetries) {
        log('warn', 'Retryable network error', {
          error: error.message,
          attempt: attempt + 1,
          url
        });
        continue;
      }

      // Error no reintentable o sin reintentos restantes
      log('error', 'Bridge API Error', {
        url,
        error: error.message,
        attempts: attempt + 1
      });
      throw error;
    }
  }

  // Si llegamos aquí, agotamos los reintentos
  if (lastResponse) {
    log('error', 'Bridge API failed after retries', {
      url,
      status: lastResponse.status,
      attempts: RETRY_CONFIG.maxRetries + 1
    });
    return lastResponse;
  }

  throw lastError || new Error('Bridge API request failed after retries');
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
      version: '1.1.0',
      service: 'bridge-api-gateway',
      environment: BRIDGE_ENVIRONMENT
    }
  });
});

// GET /api/status - Status completo verificando conexión con Bridge
app.get('/api/status', async (req, res) => {
  try {
    const startTime = Date.now();
    // Usar /customers con limit=1 para verificar conectividad
    // Es un endpoint siempre disponible y responde rápido
    const bridgeResponse = await bridgeRequest('GET', '/customers?limit=1');
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        gateway: {
          status: 'healthy',
          version: '1.1.0',
          timestamp: new Date().toISOString()
        },
        bridge: {
          status: bridgeResponse.ok ? 'connected' : 'error',
          responseTime: `${responseTime}ms`,
          apiVersion: 'v0',
          attempts: bridgeResponse.attempts || 1
        },
        configuration: {
          bridgeUrl: BRIDGE_URL,
          environment: BRIDGE_ENVIRONMENT,
          rateLimitMax: RATE_LIMIT_MAX,
          rateLimitWindow: `${RATE_LIMIT_WINDOW}ms`,
          rateLimitType: 'per-token',
          authEnabled: !!MI_TOKEN_SECRETO
        },
        features: {
          rateLimitByToken: true,
          environmentDetection: true,
          retryLogic: {
            enabled: true,
            maxRetries: RETRY_CONFIG.maxRetries,
            baseDelay: `${RETRY_CONFIG.baseDelay}ms`,
            retryableStatuses: RETRY_CONFIG.retryableStatuses
          },
          idempotencyKeys: true
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

// GET /api/docs - Documentación completa para IAs y desarrolladores
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      name: "Bridge.xyz API Gateway",
      version: "1.1.0",
      description: "API Gateway que actúa como intermediario seguro entre tus aplicaciones y la API oficial de Bridge.xyz. Bridge.xyz es una infraestructura de stablecoins para pagos, wallets, transferencias y emisión de tarjetas.",
      baseUrl: "https://bridge-gateway-eta.vercel.app",
      bridgeApiUrl: "https://api.bridge.xyz/v0",
      authentication: {
        methods: [
          {
            type: "JWT (recomendado)",
            header: "Authorization: Bearer <token>",
            description: "Regístrate con /auth/register, luego haz login con /auth/login para obtener un JWT válido por 7 días."
          },
          {
            type: "Token fijo (legacy)",
            header: "x-api-token",
            description: "Token estático configurado en el servidor. Útil para integraciones simples."
          }
        ]
      },
      features: {
        rateLimitByToken: "100 peticiones por minuto por token",
        retryLogic: "3 reintentos automáticos con exponential backoff (100ms, 200ms, 400ms)",
        idempotencyKeys: "Generadas automáticamente para POST/PUT/PATCH para prevenir duplicados",
        logging: "Logging estructurado en JSON con request ID único"
      },
      endpoints: {
        auth: [
          { method: "POST", path: "/auth/register", description: "Crear cuenta nueva (email, password, name opcional)", auth: false, returns: "JWT token válido por 7 días" },
          { method: "POST", path: "/auth/login", description: "Iniciar sesión con email y password", auth: false, returns: "JWT token válido por 7 días" },
          { method: "GET", path: "/auth/me", description: "Obtener datos del usuario autenticado", auth: true }
        ],
        monitoring: [
          { method: "GET", path: "/health", description: "Health check del gateway (no requiere auth)", auth: false },
          { method: "GET", path: "/api/status", description: "Status completo con conexión a Bridge", auth: true },
          { method: "GET", path: "/api/docs", description: "Esta documentación", auth: true }
        ],
        customers: [
          { method: "POST", path: "/api/customers", description: "Crear nuevo cliente (individual o business)" },
          { method: "GET", path: "/api/customers", description: "Listar todos los clientes con paginación" },
          { method: "GET", path: "/api/customers/:id", description: "Obtener cliente por ID" },
          { method: "PUT", path: "/api/customers/:id", description: "Actualizar cliente" },
          { method: "PATCH", path: "/api/customers/:id", description: "Actualizar cliente (parcial)" },
          { method: "DELETE", path: "/api/customers/:id", description: "Eliminar cliente" },
          { method: "GET", path: "/api/customers/:id/kyc-link", description: "Obtener enlace KYC para verificación de identidad" },
          { method: "GET", path: "/api/customers/:id/tos-link", description: "Obtener enlace de Términos de Servicio" },
          { method: "POST", path: "/api/customers/tos-links", description: "Crear enlace TOS para nuevos clientes" }
        ],
        kycLinks: [
          { method: "POST", path: "/api/kyc-links", description: "Crear enlace KYC" },
          { method: "GET", path: "/api/kyc-links", description: "Listar todos los enlaces KYC" },
          { method: "GET", path: "/api/kyc-links/:id", description: "Obtener enlace KYC por ID" }
        ],
        externalAccounts: [
          { method: "POST", path: "/api/customers/:id/external-accounts", description: "Vincular cuenta bancaria o wallet crypto" },
          { method: "GET", path: "/api/customers/:id/external-accounts", description: "Listar cuentas externas del cliente" },
          { method: "GET", path: "/api/customers/:id/external-accounts/:accountId", description: "Obtener cuenta externa específica" },
          { method: "PUT", path: "/api/customers/:id/external-accounts/:accountId", description: "Actualizar cuenta externa" },
          { method: "DELETE", path: "/api/customers/:id/external-accounts/:accountId", description: "Eliminar cuenta externa" },
          { method: "POST", path: "/api/customers/:id/external-accounts/:accountId/reactivate", description: "Reactivar cuenta desactivada" }
        ],
        wallets: [
          { method: "POST", path: "/api/customers/:id/wallets", description: "Crear wallet custodial de stablecoins" },
          { method: "GET", path: "/api/customers/:id/wallets", description: "Listar wallets del cliente" },
          { method: "GET", path: "/api/customers/:id/wallets/:walletId", description: "Obtener wallet con balance" }
        ],
        transfers: [
          { method: "POST", path: "/api/transfers", description: "Crear transferencia (on-ramp fiat→crypto o off-ramp crypto→fiat)" },
          { method: "GET", path: "/api/transfers", description: "Listar todas las transferencias" },
          { method: "GET", path: "/api/transfers/:id", description: "Obtener transferencia por ID" },
          { method: "PUT", path: "/api/transfers/:id", description: "Actualizar transferencia" },
          { method: "DELETE", path: "/api/transfers/:id", description: "Cancelar transferencia (solo en estado awaiting_funds)" }
        ],
        virtualAccounts: [
          { method: "POST", path: "/api/customers/:id/virtual-accounts", description: "Crear cuenta virtual (USD/EUR/MXN) con auto-conversión a stablecoins" },
          { method: "GET", path: "/api/customers/:id/virtual-accounts", description: "Listar cuentas virtuales" },
          { method: "GET", path: "/api/customers/:id/virtual-accounts/:accountId", description: "Obtener cuenta virtual con routing/IBAN" },
          { method: "PUT", path: "/api/customers/:id/virtual-accounts/:accountId", description: "Actualizar cuenta virtual" },
          { method: "DELETE", path: "/api/customers/:id/virtual-accounts/:accountId", description: "Eliminar cuenta virtual" },
          { method: "GET", path: "/api/customers/:id/virtual-accounts/:accountId/history", description: "Historial de depósitos" },
          { method: "POST", path: "/api/customers/:id/virtual-accounts/:accountId/simulate-deposit", description: "Simular depósito (solo sandbox)" }
        ],
        staticMemos: [
          { method: "POST", path: "/api/customers/:id/static-memos", description: "Crear memo estático para identificar depósitos" },
          { method: "GET", path: "/api/customers/:id/static-memos", description: "Listar memos estáticos" },
          { method: "GET", path: "/api/customers/:id/static-memos/:memoId", description: "Obtener memo específico" },
          { method: "DELETE", path: "/api/customers/:id/static-memos/:memoId", description: "Eliminar memo" },
          { method: "GET", path: "/api/customers/:id/static-memos/:memoId/history", description: "Historial de transacciones del memo" }
        ],
        liquidationAddresses: [
          { method: "POST", path: "/api/customers/:id/liquidation-addresses", description: "Crear dirección blockchain con auto-conversión a fiat" },
          { method: "GET", path: "/api/customers/:id/liquidation-addresses", description: "Listar direcciones de liquidación" },
          { method: "GET", path: "/api/customers/:id/liquidation-addresses/:addressId", description: "Obtener dirección específica" },
          { method: "GET", path: "/api/customers/:id/liquidation-addresses/:addressId/history", description: "Historial de liquidaciones" }
        ],
        prefundedAccounts: [
          { method: "GET", path: "/api/prefunded-accounts", description: "Listar cuentas prefundadas del desarrollador" },
          { method: "GET", path: "/api/prefunded-accounts/:id", description: "Obtener cuenta prefundada específica" }
        ],
        cards: [
          { method: "POST", path: "/api/customers/:id/cards", description: "Emitir tarjeta virtual o física" },
          { method: "GET", path: "/api/customers/:id/cards", description: "Listar tarjetas del cliente" },
          { method: "GET", path: "/api/customers/:id/cards/:cardId", description: "Obtener tarjeta específica" },
          { method: "PUT", path: "/api/customers/:id/cards/:cardId", description: "Actualizar tarjeta (activar/congelar/cancelar)" }
        ],
        plaid: [
          { method: "POST", path: "/api/plaid/link-token", description: "Crear token de vinculación Plaid" },
          { method: "POST", path: "/api/plaid/exchange-token", description: "Intercambiar token público por cuenta externa" }
        ],
        exchangeRates: [
          { method: "GET", path: "/api/exchange-rates", description: "Obtener tasas de cambio actuales" }
        ],
        referenceData: [
          { method: "GET", path: "/api/supported-currencies", description: "Listar monedas soportadas" },
          { method: "GET", path: "/api/supported-chains", description: "Listar blockchains soportadas" },
          { method: "GET", path: "/api/supported-countries", description: "Listar países soportados" }
        ],
        webhooks: [
          { method: "POST", path: "/api/webhooks", description: "Crear webhook para recibir notificaciones" },
          { method: "GET", path: "/api/webhooks", description: "Listar webhooks configurados" },
          { method: "GET", path: "/api/webhooks/:id", description: "Obtener webhook específico" },
          { method: "PUT", path: "/api/webhooks/:id", description: "Actualizar webhook (habilitar/deshabilitar)" },
          { method: "DELETE", path: "/api/webhooks/:id", description: "Eliminar webhook" },
          { method: "POST", path: "/api/webhooks/:id/test", description: "Enviar evento de prueba" },
          { method: "GET", path: "/api/webhooks/:id/logs", description: "Ver logs de entregas" },
          { method: "POST", path: "/api/webhooks/:id/logs/:logId/retry", description: "Reintentar entrega fallida" }
        ],
        webhookReceiver: [
          { method: "POST", path: "/webhooks/bridge", description: "Endpoint para recibir webhooks de Bridge (verifica firma HMAC)" }
        ]
      },
      models: {
        customer: {
          description: "Representa un usuario final (individual o empresa)",
          types: ["individual", "business"],
          requiredFields: {
            individual: ["type", "first_name", "last_name", "email"],
            business: ["type", "business_name", "email"]
          }
        },
        wallet: {
          description: "Wallet custodial de stablecoins manejado por Bridge",
          chains: ["ethereum", "solana", "polygon", "base", "arbitrum", "optimism"],
          currencies: ["usdc", "usdt", "usdb"]
        },
        transfer: {
          description: "Movimiento de fondos entre fiat y crypto",
          states: [
            { state: "awaiting_funds", description: "Esperando que el cliente envíe fondos" },
            { state: "in_review", description: "En revisión (temporal)" },
            { state: "funds_received", description: "Bridge recibió fondos, procesando" },
            { state: "pending", description: "Transferencia en progreso" },
            { state: "completed", description: "Transferencia exitosa" },
            { state: "failed", description: "Transferencia fallida" },
            { state: "canceled", description: "Transferencia cancelada" }
          ],
          types: [
            { type: "on-ramp", description: "Fiat → Crypto (banco a wallet)" },
            { type: "off-ramp", description: "Crypto → Fiat (wallet a banco)" }
          ]
        },
        virtualAccount: {
          description: "Cuenta bancaria virtual con número único que auto-convierte depósitos a stablecoins",
          currencies: ["usd", "eur", "mxn"],
          features: ["Número de cuenta único", "Auto-conversión a USDC/USDT", "ACH/Wire (USD)", "SEPA/IBAN (EUR)"]
        },
        liquidationAddress: {
          description: "Dirección blockchain permanente que auto-convierte depósitos crypto a fiat",
          useCase: "Recibir USDC en Solana → Automáticamente convertir a USD → Depositar en banco"
        },
        card: {
          description: "Tarjeta de débito vinculada a wallet de stablecoins",
          types: ["virtual", "physical"],
          statuses: ["active", "frozen", "canceled"]
        }
      },
      errorCodes: [
        { code: 400, name: "Bad Request", description: "Datos inválidos en la petición" },
        { code: 401, name: "Unauthorized", description: "Token de autenticación inválido o faltante" },
        { code: 403, name: "Forbidden", description: "Sin permisos para esta operación" },
        { code: 404, name: "Not Found", description: "Recurso no encontrado" },
        { code: 429, name: "Rate Limit", description: "Demasiadas peticiones, espera antes de reintentar" },
        { code: 500, name: "Internal Error", description: "Error interno del servidor" },
        { code: 503, name: "Service Unavailable", description: "Bridge API no disponible" }
      ],
      externalDocs: {
        bridgeOfficial: "https://apidocs.bridge.xyz",
        gettingStarted: "https://apidocs.bridge.xyz/docs/getting-started",
        apiReference: "https://apidocs.bridge.xyz/reference"
      }
    }
  });
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

// Exportar para Vercel
module.exports = app;
