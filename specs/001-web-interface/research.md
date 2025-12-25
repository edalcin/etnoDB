# Research & Technology Decisions

**Feature**: Ethnobotanical Database Web Interface
**Date**: 2025-12-25
**Status**: Complete

## Overview

This document captures technology decisions and research findings for the ethnobotanical database web interface implementation.

## Key Decisions

### 1. Backend Language & Framework

**Decision**: Node.js 20 LTS with Express.js

**Rationale**:
- **Docker Image Size**: Node.js Alpine base images are ~50MB, significantly smaller than Python (100-150MB) or Go compiled binaries with runtime dependencies
- **MongoDB Integration**: Excellent native driver support with mature ecosystem (Mongoose ODM available if needed)
- **Development Speed**: JavaScript/TypeScript allows code sharing between frontend and backend (validation, types, utilities)
- **Performance**: Adequate for stated requirements (<2s search, 10 concurrent users). Event-driven model suits I/O-bound MongoDB operations
- **Ecosystem**: Rich npm ecosystem for web development, good containerization support

**Alternatives Considered**:
- **Python FastAPI**: Larger Docker images (100-150MB), excellent for data science but overkill for this CRUD application
- **Go**: Best performance but steeper learning curve, less benefit for low-concurrency requirements, compiled binary + templates increases complexity
- **Bun/Deno**: Too cutting-edge for production Docker deployment on Unraid, potential compatibility issues

**Docker Image Size Estimate**: 120-180MB (Node.js Alpine + dependencies + static assets)

---

### 2. Frontend Framework

**Decision**: HTMX + Alpine.js + Tailwind CSS

**Rationale**:
- **Bundle Size**: HTMX (14KB) + Alpine.js (15KB) + Tailwind CSS (~10KB purged) = ~40KB total vs React (~140KB) or Vue (~100KB)
- **Simplicity**: Hypermedia-driven approach reduces JavaScript complexity, server-side rendering reduces client-side state management
- **Nested Forms**: HTMX handles complex form submissions naturally, ideal for hierarchical reference → communities → plants data structure
- **Responsive Design**: Tailwind CSS provides utility-first responsive design out of the box
- **Portuguese Support**: No i18n library needed initially, all text in HTML templates
- **Modern UI**: Tailwind enables clean, modern interfaces without heavy framework overhead

**Alternatives Considered**:
- **React**: Powerful but heavyweight (140KB+), adds build complexity, overkill for form-heavy application
- **Vue**: Lighter than React (100KB) but still requires build step and state management for nested forms
- **Vanilla JS**: Too low-level for responsive design and dynamic form management
- **Svelte**: Excellent compilation but less mature ecosystem, higher learning curve

**Architecture**: Server-side rendered HTML with HTMX for dynamic updates, Alpine.js for lightweight client-side interactivity (dropdowns, modals)

---

### 3. Multi-Port Architecture

**Decision**: Single Node.js process with separate Express apps per context, exposed on different ports

**Rationale**:
- **Simplicity**: Single process with shared MongoDB connection pool, shared models/services
- **Resource Efficiency**: Minimal overhead compared to separate processes or containers
- **Docker Image Size**: No need for process manager (PM2) or reverse proxy (nginx), reducing image size
- **Code Sharing**: Shared models, services, and utilities across all three contexts
- **Port Mapping**: Easy Docker port mapping (e.g., 3001:acquisition, 3002:curation, 3003:presentation)

**Implementation Pattern**:
```javascript
// backend/src/server.js
const acquisitionApp = require('./contexts/acquisition/app');
const curationApp = require('./contexts/curation/app');
const presentationApp = require('./contexts/presentation/app');

const PORTS = {
  acquisition: process.env.PORT_ACQUISITION || 3001,
  curation: process.env.PORT_CURATION || 3002,
  presentation: process.env.PORT_PRESENTATION || 3003
};

acquisitionApp.listen(PORTS.acquisition);
curationApp.listen(PORTS.curation);
presentationApp.listen(PORTS.presentation);
```

**Alternatives Considered**:
- **Separate Processes**: Requires PM2 or similar, increases complexity and Docker image size
- **Route-Based Separation**: Single port with /acquisition, /curation, /presentation routes - doesn't meet requirement for separate ports
- **Nginx Reverse Proxy**: Adds 10-20MB to image, unnecessary for simple port separation

---

### 4. Template Engine

**Decision**: EJS (Embedded JavaScript Templates)

**Rationale**:
- **Simplicity**: Familiar syntax for JavaScript developers, no DSL to learn
- **HTMX Integration**: Works seamlessly with HTMX partial rendering
- **Performance**: Fast rendering, caching support
- **Nested Data**: Easy to render hierarchical data structures (references → communities → plants)
- **Size**: Minimal footprint (~10KB)

**Alternatives Considered**:
- **Pug/Jade**: Terser syntax but steeper learning curve
- **Handlebars**: Good but slightly more verbose than EJS for JavaScript developers
- **React SSR**: Heavyweight for server-side rendering needs

---

### 5. MongoDB Driver

**Decision**: Official MongoDB Node.js Driver (not Mongoose)

**Rationale**:
- **Simplicity**: Direct access to MongoDB features without ODM abstraction layer
- **Existing Schema**: Database already exists with defined structure, no need for schema validation/migration features
- **Performance**: Lower overhead than Mongoose for simple CRUD operations
- **Bundle Size**: Native driver is lighter weight
- **Flexibility**: Easy to handle nested arrays in hierarchical data structure

**Alternatives Considered**:
- **Mongoose**: Excellent for schema validation and migrations, but overkill when database already exists with defined structure
- **Prisma**: Modern but adds significant complexity and Docker image bloat

---

### 6. Testing Strategy

**Decision**:
- **Unit Tests**: Jest (Node.js test runner)
- **Integration Tests**: Jest + mongodb-memory-server (in-memory MongoDB for testing)
- **E2E Tests**: Playwright (deferred to post-MVP)

**Rationale**:
- **Jest**: Zero-config test runner, excellent TypeScript support, built-in assertions and mocking
- **mongodb-memory-server**: Enables real MongoDB integration tests without external dependencies
- **Playwright**: Best-in-class E2E testing when needed, but not critical for initial implementation

**Test Coverage Goals**:
- Unit tests for services and models: 80%+
- Integration tests for MongoDB operations: Critical paths
- E2E tests: Deferred until core functionality stable

---

### 7. CSS Strategy

**Decision**: Tailwind CSS with JIT (Just-in-Time) compilation

**Rationale**:
- **Bundle Size**: Purged output typically <10KB for production
- **Responsive Design**: Built-in breakpoint system (sm, md, lg, xl) handles 320px-1920px requirement
- **Development Speed**: Utility-first approach accelerates UI development
- **Consistency**: Design system baked into framework
- **Card-Based UI**: Easy to create modern card layouts for presentation context

**Configuration**:
- JIT mode for development speed
- PurgeCSS for production builds
- Portuguese-friendly typography settings

---

### 8. Form Handling for Nested Data

**Decision**: HTMX + Server-side form processing with dynamic field addition

**Rationale**:
- **Nested Structure**: Reference → Communities (array) → Plants (array) requires dynamic form fields
- **HTMX Approach**: Use `hx-post` for partial updates, server returns HTML fragments for added communities/plants
- **UX**: "Add Community" button triggers HTMX request, server renders new community form block
- **Validation**: Server-side validation of entire hierarchy before MongoDB insert
- **No Client State**: Server maintains form state through partial rendering

**Example Pattern**:
```html
<!-- Add community button -->
<button hx-post="/acquisition/community/add"
        hx-target="#communities-list"
        hx-swap="beforeend">
  Adicionar Comunidade
</button>

<!-- Server returns new community form fragment -->
<div class="community-form">
  <!-- Community fields + "Add Plant" button with similar HTMX pattern -->
</div>
```

---

### 9. Search Implementation

**Decision**: MongoDB text indexes + aggregation pipeline

**Rationale**:
- **Performance**: Text indexes provide fast full-text search on community names, plant names
- **Flexibility**: Aggregation pipeline handles complex queries across nested arrays
- **State/Municipality Filter**: Simple field matching with indexes
- **Result Limit**: Pagination support through skip/limit
- **No External Search**: Avoids Elasticsearch/Algolia complexity and Docker image bloat

**Index Strategy**:
```javascript
// Text indexes
db.etnodb.createIndex({
  "comunidades.nome": "text",
  "comunidades.plantas.nomeCientifico": "text",
  "comunidades.plantas.nomeVernacular": "text"
});

// Field indexes for filters
db.etnodb.createIndex({ "comunidades.estado": 1 });
db.etnodb.createIndex({ "comunidades.municipio": 1 });
```

---

### 10. Container Strategy

**Decision**: Multi-stage Docker build with Node.js Alpine

**Rationale**:
- **Image Size**: Alpine Linux base minimizes footprint
- **Multi-stage**: Build stage compiles/processes assets, production stage includes only runtime dependencies
- **Single Container**: All three contexts in one image, different ports exposed
- **Layer Caching**: Optimized layer order for fast rebuilds

**Dockerfile Pattern**:
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build # Compile Tailwind CSS, minify assets

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY backend/src ./backend/src
ENV NODE_ENV=production
CMD ["node", "backend/src/server.js"]
```

**Estimated Final Size**: 120-180MB

---

### 11. Development Workflow

**Decision**: Docker Compose for local development with hot-reload

**Rationale**:
- **Environment Parity**: Development matches production container
- **MongoDB Integration**: docker-compose.yml includes MongoDB service for local testing
- **Hot Reload**: Bind mounts enable nodemon for backend, Tailwind watch for CSS
- **Port Exposure**: All three contexts accessible on localhost

**docker-compose.yml**:
```yaml
version: '3.8'
services:
  app:
    build: .
    volumes:
      - ./backend:/app/backend
      - ./frontend:/app/frontend
    ports:
      - "3001:3001"  # acquisition
      - "3002:3002"  # curation
      - "3003:3003"  # presentation
    environment:
      MONGO_URI: mongodb://mongo:27017/etnodb
    depends_on:
      - mongo

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

---

## Dependencies Summary

### Runtime Dependencies
- **Node.js**: 20 LTS (Alpine)
- **Express.js**: ~4.19.x (web framework)
- **MongoDB Driver**: ~6.3.x (database client)
- **EJS**: ~3.1.x (templating)
- **HTMX**: 1.9.x (frontend interactivity)
- **Alpine.js**: ~3.13.x (lightweight reactivity)

### Development Dependencies
- **Tailwind CSS**: ~3.4.x (CSS framework)
- **Jest**: ~29.7.x (testing)
- **mongodb-memory-server**: ~9.1.x (test database)
- **nodemon**: ~3.0.x (hot reload)
- **eslint**: ~8.56.x (linting)

### Total Package Count
- Production: ~25-30 packages
- Development: ~60-70 packages (not in Docker image)

---

## Performance Validation

### Expected Metrics vs Requirements

| Requirement | Target | Expected | Status |
|------------|--------|----------|---------|
| Docker image size | <500MB | 120-180MB | ✅ Well under limit |
| Search response | <2s | 100-300ms | ✅ MongoDB indexes should deliver sub-second |
| Concurrent users | 10 | 50+ | ✅ Node.js handles easily |
| Data entry time | <10min | 5-8min | ✅ HTMX forms streamline workflow |
| Responsive range | 320-1920px | Full support | ✅ Tailwind breakpoints cover range |

---

## Risk Mitigation

### Identified Risks

1. **HTMX Learning Curve**: Team unfamiliarity with hypermedia approach
   - **Mitigation**: Excellent documentation, simple mental model (server returns HTML)

2. **Nested Form Complexity**: Deeply nested reference → communities → plants
   - **Mitigation**: HTMX partial rendering, server-side state management simplifies client logic

3. **MongoDB Query Performance**: Searching nested arrays
   - **Mitigation**: Text indexes, aggregation pipeline optimization, result pagination

4. **Docker Image Size Creep**: Dependencies could balloon image
   - **Mitigation**: Multi-stage builds, production-only dependencies, regular audits

---

## Future Considerations

### Post-MVP Enhancements
- **Taxonomic Validation API Integration**: External APIs for plant name validation (deferred per spec)
- **Authentication**: JWT-based auth if access control needed (currently handled at network level)
- **Audit Trail**: Change history tracking (currently out of scope)
- **Data Export**: CSV/JSON download functionality
- **API Endpoints**: REST API for external integrations
- **Advanced Search**: Fuzzy matching, synonym support
- **Performance Monitoring**: Application-level observability

### Technology Evolution
- **TypeScript Migration**: Consider if team grows or codebase complexity increases
- **Svelte/Alpine Transition**: If client-side reactivity needs grow beyond Alpine capabilities
- **Caching Layer**: Redis if search performance becomes bottleneck (unlikely at current scale)

---

## Conclusion

The selected technology stack prioritizes:
1. **Docker image size** (120-180MB vs 500MB limit)
2. **Development simplicity** (JavaScript everywhere, minimal abstraction)
3. **Performance** (adequate for requirements without over-engineering)
4. **Maintainability** (proven technologies, minimal dependencies)

All "NEEDS CLARIFICATION" items from Technical Context are resolved and justified with concrete rationale.
