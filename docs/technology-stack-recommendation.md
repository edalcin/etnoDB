# Technology Stack Recommendation for etnoDB Web Interface

**Date**: 2025-12-25
**Project**: Ethnobotanical Database Web Interface
**Constraints**: Docker image <500MB, <2s search response (1000 records), 10 concurrent users, Portuguese interface, responsive design

---

## Executive Summary

**Recommended Stack**:
- **Backend**: Node.js with Fastify
- **Frontend**: HTMX + Alpine.js + TailwindCSS
- **Multi-port Architecture**: Single Fastify instance with route-based separation
- **Testing**: Vitest + Playwright

**Estimated Docker Image**: 180-220MB (well under 500MB limit)

---

## 1. Backend Language/Framework Analysis

### Option A: Node.js with Fastify ⭐ RECOMMENDED

**Pros**:
- **Docker Image Size**: ~150-180MB (node:22-alpine base + dependencies)
- **MongoDB Integration**: Excellent - native async/await with official MongoDB Node.js driver
- **Performance**:
  - Fastify: ~30,000-40,000 req/sec (vs Express ~15,000)
  - Schema validation built-in (faster than middleware)
  - Low overhead for JSON operations
- **Development Speed**:
  - JavaScript on both frontend/backend
  - Large ecosystem of MongoDB libraries
  - Quick prototyping with JSON-native language
- **Portuguese Support**: UTF-8 native, excellent string handling
- **Learning Curve**: Low if team knows JavaScript

**Cons**:
- Slightly higher memory usage than Go (~50-80MB per instance)
- Requires careful async error handling

**Docker Image Estimate**: 180MB
```dockerfile
FROM node:22-alpine  # ~40MB base
# + node_modules ~100MB (fastify, mongodb, etc.)
# + application code ~10MB
# = ~150-180MB total
```

**Performance for Your Use Case**:
- MongoDB query (1000 records): ~100-300ms
- JSON serialization: ~50-100ms
- Network + Fastify overhead: ~10-20ms
- **Total**: ~200-500ms (well under 2s requirement)

---

### Option B: Python with FastAPI

**Pros**:
- **Docker Image Size**: ~250-350MB (python:3.12-slim base)
- **MongoDB Integration**: Good - motor (async) or pymongo drivers
- **Performance**:
  - FastAPI: ~20,000 req/sec
  - Excellent type hints with Pydantic
- **Development Speed**: Very fast with automatic API docs
- **Portuguese Support**: Excellent Unicode support

**Cons**:
- **Larger Docker image** (Python runtime is heavier)
- Slower JSON operations compared to Node.js
- Two-language stack (Python backend, JS frontend)
- Higher memory per worker (~80-120MB)

**Docker Image Estimate**: 300MB
```dockerfile
FROM python:3.12-slim  # ~120MB base
# + pip packages ~150MB (fastapi, motor, uvicorn, etc.)
# + application code ~10MB
# = ~280-320MB total
```

**Rejection Reason**: Larger Docker image and no significant advantages over Node.js for this JSON-heavy use case.

---

### Option C: Go

**Pros**:
- **Docker Image Size**: ~15-25MB (scratch or alpine base with compiled binary)
- **Performance**: Exceptional (~50,000+ req/sec)
- **Memory**: Very efficient (~10-30MB per instance)
- **MongoDB Integration**: Good with official mongo-go-driver

**Cons**:
- **Development Speed**: Slower than Node.js/Python
  - Verbose error handling
  - More boilerplate for web routes
  - Struct definitions for all data models
- **Nested JSON handling**: More complex than JavaScript
- **Learning Curve**: Steeper if team doesn't know Go
- **Ecosystem**: Smaller than Node.js for web development

**Docker Image Estimate**: 20MB
```dockerfile
FROM golang:1.22-alpine AS builder
# Build binary
FROM alpine:latest
# Copy binary
# = ~15-25MB total
```

**Rejection Reason**: While Docker image size is smallest, the development speed penalty is significant for a project requiring rapid iteration on nested JSON forms. The performance advantages are overkill for 10 concurrent users.

---

## 2. Frontend Framework Analysis

### Option A: HTMX + Alpine.js + TailwindCSS ⭐ RECOMMENDED

**Bundle Size**: ~50-80KB total
- HTMX: ~14KB gzipped
- Alpine.js: ~15KB gzipped
- TailwindCSS: ~20-50KB (purged)

**Pros**:
- **Minimal JavaScript**: Server-rendered HTML with progressive enhancement
- **Excellent Form Handling**: HTMX handles complex nested forms naturally
- **Responsive Design**: TailwindCSS provides mobile-first utilities
- **Portuguese Support**: No i18n library needed - all text is server-side
- **Development Speed**: Fast - HTML-first approach
- **SEO**: Excellent (server-rendered)
- **No Build Step**: Can run without bundler (or minimal with Vite)

**Cons**:
- Less structured than React/Vue for very complex UIs
- Smaller community than React

**Why This Works for Your Use Case**:
1. **Nested Forms**: HTMX can handle reference → communities → plants with progressive form building
2. **Card-Based UI**: Server renders cards, HTMX loads more on scroll
3. **Three Contexts**: Same codebase, different routes, minimal duplication
4. **Mobile Performance**: Minimal JS = fast load on mobile devices

**Example Architecture**:
```html
<!-- Acquisition: Dynamic nested form -->
<form hx-post="/api/references" hx-target="#result">
  <div id="communities">
    <button hx-get="/partials/community-form"
            hx-target="#communities"
            hx-swap="beforeend">
      Adicionar Comunidade
    </button>
  </div>
</form>

<!-- Presentation: Card-based search -->
<div hx-get="/api/search"
     hx-trigger="input delay:500ms"
     hx-target="#results">
  <input name="plant" placeholder="Buscar planta...">
</div>
```

---

### Option B: React

**Bundle Size**: ~150-200KB (React + React-DOM + state management)

**Pros**:
- Largest ecosystem
- Excellent component libraries for forms (React Hook Form)
- Strong TypeScript support

**Cons**:
- **Larger bundle**: 3-4x bigger than HTMX
- **Build complexity**: Requires bundler, transpilation
- **Overhead**: Overkill for server-rendered forms
- **i18n**: Needs additional library for Portuguese

**Rejection Reason**: Unnecessary complexity and larger bundle for primarily form-based UIs. The nested forms don't require React's virtual DOM.

---

### Option C: Vue 3

**Bundle Size**: ~80-120KB (Vue + composition API)

**Pros**:
- Smaller than React
- Good form handling
- Familiar template syntax

**Cons**:
- Still requires build step
- More complex than HTMX for this use case
- **SFC architecture** adds unnecessary abstraction for simple forms

**Rejection Reason**: Middle ground between React and HTMX, but doesn't excel at either extreme. HTMX is simpler for forms, React better for complex state.

---

### Option D: Svelte

**Bundle Size**: ~40-60KB (compiled)

**Pros**:
- Smallest modern framework bundle
- Compile-time optimization
- Reactive by default

**Cons**:
- Smaller ecosystem than React/Vue
- Still requires build step
- Less familiar to most developers

**Rejection Reason**: While bundle size is competitive with HTMX, it still requires a build step and doesn't offer significant advantages for form-heavy UIs.

---

## 3. Multi-Port Architecture Analysis

### Option A: Single Fastify Instance with Route-Based Separation ⭐ RECOMMENDED

**Architecture**:
```javascript
// server.js
const fastify = require('fastify')({ logger: true })

// Acquisition app on port 3000
const acquisition = require('fastify')()
acquisition.register(require('./apps/acquisition'))
fastify.register(acquisition, { prefix: '/acquisition' })

// Curation app on port 3001
const curation = require('fastify')()
curation.register(require('./apps/curation'))
fastify.register(curation, { prefix: '/curation' })

// Presentation app on port 3002
const presentation = require('fastify')()
presentation.register(require('./apps/presentation'))
fastify.register(presentation, { prefix: '/presentation' })

// Actually, better approach: separate listeners
const acqServer = require('fastify')()
acqServer.register(require('./apps/acquisition'))
acqServer.listen({ port: 3000, host: '0.0.0.0' })

const curServer = require('fastify')()
curServer.register(require('./apps/curation'))
curServer.listen({ port: 3001, host: '0.0.0.0' })

const preServer = require('fastify')()
preServer.register(require('./apps/presentation'))
preServer.listen({ port: 3002, host: '0.0.0.0' })
```

**Pros**:
- **Simplest**: No additional process management
- **Shared Code**: Database connection, models, utilities shared
- **Small Image**: Single Node.js runtime
- **Easy Development**: One `npm start` command
- **Resource Efficient**: ~80-120MB RAM total

**Cons**:
- All apps restart if one crashes (mitigated by proper error handling)

**Docker Setup**:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000 3001 3002
CMD ["node", "server.js"]
```

---

### Option B: Separate Processes with PM2

**Architecture**:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    { name: 'acquisition', script: './apps/acquisition/server.js' },
    { name: 'curation', script: './apps/curation/server.js' },
    { name: 'presentation', script: './apps/presentation/server.js' }
  ]
}
```

**Pros**:
- Process isolation (one crash doesn't affect others)
- Individual app monitoring

**Cons**:
- **Larger image**: PM2 adds ~20MB
- **More memory**: Each process has separate V8 instance (~80MB x 3 = 240MB)
- **Complexity**: Process management, shared code duplication

**Rejection Reason**: Overkill for 10 concurrent users. Process isolation benefits don't justify memory overhead.

---

### Option C: Nginx Reverse Proxy

**Architecture**:
```nginx
server {
  listen 80;
  location /acquisition { proxy_pass http://localhost:3000; }
  location /curation { proxy_pass http://localhost:3001; }
  location /presentation { proxy_pass http://localhost:3002; }
}
```

**Pros**:
- Professional approach for production
- Load balancing capabilities

**Cons**:
- **Larger image**: Nginx adds ~50-80MB
- **Unnecessary**: Requirement is different ports, not paths
- **Complexity**: Additional configuration layer

**Rejection Reason**: Requirement specifies "different ports", not path-based routing. Nginx adds size without benefit.

---

## 4. Testing Strategy

### Recommended Approach: Vitest + Playwright

**Unit Testing**: Vitest
- **Why**: Fast, native ESM support, Vite integration
- **Size**: Minimal (dev dependency only)
- **Speed**: ~2-3x faster than Jest

```javascript
// tests/unit/models/reference.test.js
import { describe, it, expect } from 'vitest'
import { validateReference } from '../../../src/models/reference.js'

describe('Reference validation', () => {
  it('accepts valid nested structure', () => {
    const ref = {
      titulo: 'Test',
      autores: ['Author'],
      ano: 2024,
      comunidades: [{ nome: 'Community', plantas: [...] }]
    }
    expect(validateReference(ref)).toBe(true)
  })
})
```

**Integration Testing**: Vitest + MongoDB Memory Server
```javascript
// tests/integration/api.test.js
import { beforeAll, afterAll, describe, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { buildApp } from '../../src/app.js'

let mongod, app

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  app = await buildApp({ mongoUrl: mongod.getUri() })
})

afterAll(async () => {
  await app.close()
  await mongod.stop()
})

describe('POST /api/references', () => {
  it('creates reference with nested communities', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/references',
      payload: { /* ... */ }
    })
    expect(response.statusCode).toBe(201)
  })
})
```

**E2E Testing**: Playwright
```javascript
// tests/e2e/acquisition.spec.js
import { test, expect } from '@playwright/test'

test('complete reference entry workflow', async ({ page }) => {
  await page.goto('http://localhost:3000')

  // Fill reference
  await page.fill('[name="titulo"]', 'Test Article')

  // Add community
  await page.click('button:has-text("Adicionar Comunidade")')
  await page.fill('[name="comunidades[0].nome"]', 'Test Community')

  // Add plant
  await page.click('button:has-text("Adicionar Planta")')
  await page.fill('[name="comunidades[0].plantas[0].nomeCientifico"]', 'Test plant')

  // Submit
  await page.click('button[type="submit"]')

  await expect(page.locator('.success-message')).toBeVisible()
})
```

**Why Not Jest**:
- Vitest is faster and has better ESM support
- Smaller footprint in dev environment
- Better TypeScript support

**Why Not Cypress**:
- Playwright is faster and more reliable
- Better multi-browser support
- Simpler API for form testing

---

## 5. Complete Stack Recommendation

### Final Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Docker Container                    │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │           Node.js 22 (Alpine)                  │ │
│  │                                                │ │
│  │  ┌──────────────────┐  Port 3000              │ │
│  │  │  Acquisition App │  (Fastify + HTMX)       │ │
│  │  └──────────────────┘                          │ │
│  │                                                │ │
│  │  ┌──────────────────┐  Port 3001              │ │
│  │  │  Curation App    │  (Fastify + HTMX)       │ │
│  │  └──────────────────┘                          │ │
│  │                                                │ │
│  │  ┌──────────────────┐  Port 3002              │ │
│  │  │ Presentation App │  (Fastify + HTMX)       │ │
│  │  └──────────────────┘                          │ │
│  │                                                │ │
│  │         ▼                                      │ │
│  │  ┌──────────────────┐                         │ │
│  │  │ Shared Services  │                         │ │
│  │  │ - MongoDB Driver │                         │ │
│  │  │ - Models         │                         │ │
│  │  │ - Validation     │                         │ │
│  │  └──────────────────┘                         │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                    ▼
         ┌──────────────────┐
         │  MongoDB          │
         │  (Separate        │
         │   Container)      │
         └──────────────────┘
```

### Project Structure

```
etnoDB/
├── src/
│   ├── apps/
│   │   ├── acquisition/
│   │   │   ├── routes.js        # Form endpoints
│   │   │   ├── views/           # HTMX templates
│   │   │   └── server.js        # Port 3000
│   │   ├── curation/
│   │   │   ├── routes.js        # Edit endpoints
│   │   │   ├── views/
│   │   │   └── server.js        # Port 3001
│   │   └── presentation/
│   │       ├── routes.js        # Search endpoints
│   │       ├── views/
│   │       └── server.js        # Port 3002
│   ├── shared/
│   │   ├── db.js                # MongoDB connection
│   │   ├── models/
│   │   │   └── reference.js     # Schema validation
│   │   └── utils/
│   │       └── validators.js
│   └── server.js                # Main entry (starts all 3 apps)
├── public/
│   ├── css/
│   │   └── tailwind.css
│   └── js/
│       ├── htmx.min.js
│       └── alpine.min.js
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── Dockerfile
├── .dockerignore
├── package.json
└── vitest.config.js
```

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:22-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Build (if needed for CSS purging)
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build  # Tailwind CSS purge

# Production
FROM base AS runner
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose ports
EXPOSE 3000 3001 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "src/server.js"]
```

### package.json

```json
{
  "name": "etnodb-web",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "build": "tailwindcss -i ./src/styles.css -o ./public/css/tailwind.css --minify",
    "test": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "fastify": "^5.2.0",
    "@fastify/view": "^10.0.1",
    "@fastify/static": "^7.0.4",
    "@fastify/formbody": "^8.0.1",
    "ejs": "^3.1.10",
    "mongodb": "^6.12.0",
    "pino": "^9.6.0"
  },
  "devDependencies": {
    "vitest": "^2.1.8",
    "playwright": "^1.49.1",
    "mongodb-memory-server": "^10.1.2",
    "tailwindcss": "^3.4.17"
  }
}
```

---

## 6. Performance Analysis

### Estimated Resource Usage

| Metric | Estimated Value | Requirement | Status |
|--------|----------------|-------------|---------|
| Docker Image Size | 180-220MB | <500MB | ✅ Pass (56% margin) |
| RAM Usage (idle) | 80-120MB | - | ✅ Excellent |
| RAM Usage (10 users) | 150-200MB | - | ✅ Excellent |
| Search Response (1000 records) | 200-500ms | <2s | ✅ Pass (75% margin) |
| Startup Time | <3s | - | ✅ Excellent |

### Benchmark Estimates (10 Concurrent Users)

**Scenario 1: Search Query**
```
MongoDB query (indexed): ~50-100ms
JSON serialization: ~30-50ms
HTMX rendering: ~20-30ms
Network: ~10-20ms
─────────────────────────────
Total: ~110-200ms ✅
```

**Scenario 2: Form Submission (2 communities, 5 plants)**
```
Parse form data: ~5-10ms
Validation: ~10-20ms
MongoDB insert: ~50-100ms
Confirmation render: ~10-20ms
─────────────────────────────
Total: ~75-150ms ✅
```

**Scenario 3: Curation Edit**
```
MongoDB findOne: ~20-40ms
Render edit form: ~30-50ms
─────────────────────────────
Total: ~50-90ms ✅
```

---

## 7. Development Timeline Estimate

### Phase 1: Project Setup (2-3 days)
- Docker configuration
- MongoDB connection
- Fastify app scaffolding
- HTMX + TailwindCSS integration

### Phase 2: Acquisition Interface (5-7 days)
- Reference form
- Dynamic community addition
- Nested plant forms
- Validation
- Form submission

### Phase 3: Presentation Interface (4-5 days)
- Search filters
- Card-based results
- Pagination/infinite scroll
- Responsive design

### Phase 4: Curation Interface (4-5 days)
- Reference list view
- Edit forms
- Status management
- Approval workflow

### Phase 5: Testing & Polish (3-4 days)
- Unit tests
- Integration tests
- E2E tests
- Performance optimization

**Total**: 18-24 days (3-4 weeks)

---

## 8. Alternative Stacks Considered

### Alternative 1: Python FastAPI + React
- **Why rejected**: Larger Docker image (~400MB), two-language stack, overkill frontend for forms
- **When to consider**: If team is strongly Python-focused and needs GraphQL

### Alternative 2: Go + HTMX
- **Why rejected**: Slower development speed for nested JSON handling outweighs Docker size benefits
- **When to consider**: If image size is critical (<100MB) and team knows Go well

### Alternative 3: Node.js Express + Vue
- **Why rejected**: Fastify is faster, Vue adds unnecessary build complexity
- **When to consider**: If team is already familiar with Express/Vue

### Alternative 4: Ruby on Rails
- **Why rejected**: Much larger Docker image (~500-700MB), slower performance
- **When to consider**: Never for this use case

---

## 9. Migration Path (If Needed)

If requirements change and a different stack becomes necessary:

### Easy Migrations:
- **HTMX → React**: Backend stays same, swap frontend (1-2 weeks)
- **Fastify → Express**: Similar API, mostly compatible (2-3 days)
- **MongoDB Driver → Mongoose**: Add ORM if needed (3-5 days)

### Hard Migrations:
- **Node.js → Python**: Rewrite entire backend (4-6 weeks)
- **Node.js → Go**: Rewrite entire backend (6-8 weeks)

---

## 10. Risks & Mitigations

### Risk 1: HTMX Learning Curve
- **Impact**: Medium
- **Likelihood**: Low
- **Mitigation**: Excellent documentation, simple mental model, fallback to Alpine.js for client logic

### Risk 2: MongoDB Connection Pooling
- **Impact**: High (performance)
- **Likelihood**: Low
- **Mitigation**: Use recommended pool size (10-20 connections), monitor with Fastify metrics

### Risk 3: Docker Image Size Creep
- **Impact**: Low (500MB limit has margin)
- **Likelihood**: Medium
- **Mitigation**: Use `.dockerignore`, multi-stage builds, regular audits

### Risk 4: Form Validation Complexity
- **Impact**: Medium
- **Likelihood**: Medium
- **Mitigation**: Use Fastify schema validation, test nested structures thoroughly

---

## 11. Conclusion

The **Node.js (Fastify) + HTMX + TailwindCSS** stack provides the optimal balance for your requirements:

✅ **Docker image size**: 180-220MB (well under 500MB)
✅ **Performance**: Sub-500ms response times (well under 2s)
✅ **Development speed**: Fast iteration on nested forms
✅ **Portuguese support**: Native UTF-8, no i18n complexity
✅ **Responsive design**: TailwindCSS mobile-first utilities
✅ **Multi-port architecture**: Simple single-process approach
✅ **MongoDB integration**: Excellent async driver support

This stack minimizes complexity while meeting all performance constraints, making it ideal for a small team building a specialized database interface.

---

## Appendix A: Quick Start Commands

```bash
# Development
npm install
npm run dev  # All 3 apps on ports 3000, 3001, 3002

# Testing
npm test              # Unit + integration tests
npm run test:e2e      # Playwright E2E tests

# Production
docker build -t etnodb-web .
docker run -p 3000:3000 -p 3001:3001 -p 3002:3002 \
  -e MONGO_URL=mongodb://mongo:27017/etnodb \
  etnodb-web
```

## Appendix B: Environment Variables

```bash
# .env.example
MONGO_URL=mongodb://localhost:27017/etnodb
NODE_ENV=production
LOG_LEVEL=info

# Ports (optional, defaults shown)
ACQUISITION_PORT=3000
CURATION_PORT=3001
PRESENTATION_PORT=3002
```

## Appendix C: Monitoring Recommendations

```javascript
// src/shared/metrics.js
import fastify from 'fastify'

export function setupMetrics(app) {
  app.addHook('onResponse', (request, reply, done) => {
    const responseTime = reply.getResponseTime()
    app.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: `${responseTime}ms`
    })
    done()
  })
}
```

---

**Document Version**: 1.0
**Last Updated**: 2025-12-25
**Author**: Technology Stack Analysis for etnoDB Project
