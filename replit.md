# Bridge.xyz API Gateway

## Overview

This project is a complete API Gateway for Bridge.xyz that acts as an intermediary between client applications and the official Bridge.xyz payment infrastructure API. The gateway provides a secure, centralized interface for managing cryptocurrency and fiat payment operations, including customer management, KYC verification, wallets, transfers, virtual accounts, liquidation addresses, and card provisioning.

The application implements **61+ endpoints** covering the complete Bridge.xyz API surface, with dual-layer authentication (Bridge API key + custom gateway token), rate limiting, and idempotency key support for safe operation handling.

## Key Files

| File | Description |
|------|-------------|
| `api/index.js` | Main Express server with 61+ endpoints for Vercel deployment |
| `bridge-client.js` | JavaScript client library for frontend integration |
| `vercel.json` | Vercel serverless configuration |
| `README.md` | Project documentation |
| `DEPLOYMENT.md` | Step-by-step Vercel deployment guide |
| `API-REFERENCE.md` | Complete API reference with examples |
| `EXAMPLES.md` | Use case examples with code |
| `.env.example` | Environment variables template |

## Quick Start

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your BRIDGE_API_KEY and MI_TOKEN_SECRETO

# 2. Install dependencies
npm install

# 3. Start development server
PORT=3001 node api/index.js

# 4. Test endpoints
curl http://localhost:3001/health
curl -H "x-api-token: your_token" http://localhost:3001/api/status
```

## Vercel Deployment

```bash
vercel env add BRIDGE_API_KEY
vercel env add MI_TOKEN_SECRETO
vercel --prod
```

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built as a React-based single-page application using modern tooling:

- **Framework**: React 18+ with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Build Tool**: Vite for fast development and optimized production builds
- **Form Handling**: React Hook Form with Zod validation via @hookform/resolvers

The frontend architecture follows a component-based pattern with:
- Reusable UI components in `client/src/components/ui/`
- Page components in `client/src/pages/`
- Custom hooks in `client/src/hooks/`
- Utility functions in `client/src/lib/`

Design system is centralized through Tailwind configuration with support for light/dark themes and consistent elevation/shadow patterns.

### Backend Architecture

The backend uses a Node.js/Express architecture with two deployment modes:

**Development Mode**:
- Express.js server (`server/index.ts`) with TypeScript
- Vite middleware for HMR (Hot Module Replacement)
- In-memory storage implementation for rapid prototyping

**Production Mode**:
- Serverless deployment via Vercel Functions (`api/index.js`)
- Single entry point handling all routes
- Stateless design for horizontal scalability

**API Gateway Pattern**:
The core gateway (`api/index.js`) implements:
- Request forwarding to Bridge.xyz API (`https://api.bridge.xyz/v0`)
- Dual authentication: validates custom token (`x-api-token`) before forwarding with Bridge API key
- Rate limiting: 100 requests per minute per IP address using in-memory store
- Automatic idempotency key generation for POST/PUT operations
- CORS support with configurable origins
- Webhook signature verification using HMAC-SHA256
- Comprehensive error handling and logging

### Data Storage Solutions

**Current Implementation**:
- In-memory storage (`server/storage.ts`) using Maps for development
- User schema defined with Drizzle ORM (`shared/schema.ts`)
- PostgreSQL configuration ready via Neon serverless driver

**Database Architecture**:
- Drizzle ORM for type-safe database operations
- PostgreSQL as the target production database (via `@neondatabase/serverless`)
- Schema-first approach with Drizzle Kit for migrations
- Zod integration for runtime validation of database inputs

The storage interface (`IStorage`) is abstracted to allow easy swapping between in-memory and database implementations without changing business logic.

### Authentication and Authorization

**Two-Layer Security Model**:

1. **Gateway Authentication**: Custom token validation via `x-api-token` header
   - Prevents unauthorized access to the gateway itself
   - Token configured via `MI_TOKEN_SECRETO` environment variable
   - Applied to all endpoints except `/health` and `/webhooks/bridge`

2. **Bridge API Authentication**: Official Bridge.xyz API key
   - Stored securely in `BRIDGE_API_KEY` environment variable
   - Never exposed to clients
   - Automatically injected into Bridge API requests via `Api-Key` header

**Webhook Security**:
- HMAC-SHA256 signature verification using `WEBHOOK_SECRET`
- Validates `Bridge-Signature` header against raw request body
- Protects against webhook replay and tampering attacks

### External Dependencies

**Third-Party APIs**:
- **Bridge.xyz API** (`https://api.bridge.xyz/v0`): Core payment infrastructure
  - Customer management and KYC
  - Wallet custody and blockchain operations
  - Fiat-to-crypto conversions (transfers)
  - Virtual account provisioning (ACH/wire routing)
  - Liquidation addresses (auto-conversion)
  - Card issuance and management
  - Exchange rate data

**NPM Packages**:

*Frontend*:
- `react`, `react-dom`: UI framework
- `wouter`: Client-side routing
- `@tanstack/react-query`: Server state management and caching
- `@radix-ui/*`: Headless UI components (accordion, dialog, dropdown, etc.)
- `tailwindcss`: Utility-first CSS framework
- `class-variance-authority`, `clsx`, `tailwind-merge`: CSS utility management
- `react-hook-form`, `@hookform/resolvers`, `zod`: Form handling and validation
- `date-fns`: Date manipulation
- `lucide-react`: Icon library

*Backend*:
- `express`: Web server framework
- `cors`: Cross-origin resource sharing middleware
- `@neondatabase/serverless`: PostgreSQL client for Neon
- `drizzle-orm`, `drizzle-zod`: Database ORM and validation
- `jsonwebtoken`: JWT handling (available but not actively used)
- `passport`, `passport-local`: Authentication strategies (configured but minimal usage)
- `express-session`, `connect-pg-simple`: Session management
- `multer`: File upload handling
- `nodemailer`: Email sending capability
- `stripe`: Stripe payment integration (available)
- `openai`, `@google/generative-ai`: AI service integrations
- `ws`: WebSocket support
- `uuid`, `nanoid`: Unique ID generation

*Development*:
- `typescript`, `tsx`: TypeScript runtime and compilation
- `vite`: Build tool and dev server
- `esbuild`: JavaScript bundler for production builds
- `@vitejs/plugin-react`: React support in Vite
- `@replit/*`: Replit-specific development tools (error overlay, cartographer, dev banner)
- `drizzle-kit`: Database migration tool

**Deployment Platform**:
- **Vercel**: Serverless function deployment
  - Functions configured in `vercel.json`
  - 30-second timeout, 1024MB memory allocation
  - Deployed to `iad1` region (US East)
  - Automatic HTTPS and global CDN distribution

**Database Service**:
- **Neon**: Serverless PostgreSQL
  - Connection via `DATABASE_URL` environment variable
  - Serverless driver for edge compatibility
  - Auto-scaling and pay-per-use pricing model