# Bridge.xyz API Gateway - Technical Design Guidelines

## Project Type: Backend API Gateway
**Note:** This is a pure backend/API project with no visual interface. These guidelines focus on API design patterns and developer experience.

---

## API Design Principles

### 1. **Response Structure**
All API responses follow a consistent structure:
```
Success: { success: true, data: {...} }
Error: { success: false, error: "message", details: {...} }
```

### 2. **HTTP Status Codes**
- **200** - Successful GET/PATCH/DELETE
- **201** - Successful POST (creation)
- **400** - Bad request (missing required parameters)
- **401** - Authentication failed (invalid token)
- **404** - Resource not found
- **422** - Validation error (invalid data)
- **429** - Rate limit exceeded
- **500** - Internal server error

### 3. **Endpoint Naming Convention**
RESTful pattern:
- `/api/customers` - Collection
- `/api/customers/:id` - Specific resource
- `/api/customers/:id/wallets` - Nested resources

### 4. **Authentication Flow**
Two-layer security:
1. **Bridge API Key** - Stored in environment variable, never exposed
2. **Custom Token** - `x-api-token` header for client requests

### 5. **Error Messages**
- User-friendly error messages in Spanish
- Developer details in `details` object
- Preserve Bridge API error codes when relevant

---

## Documentation Standards

### README Structure
1. Quick start guide
2. Complete endpoint reference table
3. Authentication setup
4. Example requests/responses for each endpoint
5. Deployment instructions
6. Troubleshooting section

### API Reference Format
For each endpoint:
- **Method + Path**
- **Description** (in Spanish)
- **Required Headers**
- **Request Body Example**
- **Response Example**
- **Possible Error Codes**

---

## Client Library Design

### Method Naming
Spanish naming for clarity:
- `crearCliente()` not `createCustomer()`
- `obtenerWallet()` not `getWallet()`
- `listarTransfers()` not `listTransfers()`

### Helper Functions
High-level functions that combine multiple API calls:
- `onboardCliente()` - Create customer + wallet
- `fiatACrypto()` - Complete on-ramp flow
- `cryptoAFiat()` - Complete off-ramp flow

---

## File Organization

```
/
├── index.js              (Main server)
├── package.json          
├── vercel.json           
├── bridge-client.js      (Client library)
├── .env.example          
├── README.md             (Spanish)
├── DEPLOYMENT.md         (Vercel guide)
├── API-REFERENCE.md      (Complete endpoint docs)
└── EXAMPLES.md           (Use case examples)
```

---

## Logging Standards

Every request logged with:
- ISO 8601 timestamp
- HTTP method
- Path
- IP address
- Response status
- Response time (ms)

---

## Rate Limiting

- **100 requests per minute per IP**
- Sliding window implementation
- Return `Retry-After` header on 429 responses

---

## Vercel Optimization

- Serverless functions
- 30-second timeout
- Auto region selection
- Environment variable management via Vercel dashboard