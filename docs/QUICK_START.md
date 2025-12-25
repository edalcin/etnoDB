# Quick Start Guide - etnoDB Implementation

**Start Date**: 2025-12-25
**Stack**: Node.js + Fastify + HTMX
**Goal**: Get the project running in <1 hour

---

## Prerequisites

```bash
# Required
node --version  # v22.x or higher
npm --version   # v10.x or higher
docker --version  # v24.x or higher

# Optional (for development)
git --version
```

---

## 1. Project Initialization (10 minutes)

### Step 1.1: Create project structure

```bash
cd D:\git\etnoDB

# Create directories
mkdir -p src/apps/acquisition/views/partials
mkdir -p src/apps/curation/views/partials
mkdir -p src/apps/presentation/views/partials
mkdir -p src/shared/models
mkdir -p public/css public/js
mkdir -p tests/unit tests/integration tests/e2e

# Verify structure
ls -la src/
```

### Step 1.2: Initialize package.json

```bash
npm init -y
```

Edit `package.json`:
```json
{
  "name": "etnodb-web",
  "version": "1.0.0",
  "type": "module",
  "description": "Web interface for ethnobotanical database",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "build:css": "tailwindcss -i ./src/styles.css -o ./public/css/tailwind.css --minify",
    "test": "vitest",
    "test:e2e": "playwright test"
  },
  "keywords": ["ethnobotany", "mongodb", "fastify"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "fastify": "^5.2.0",
    "mongodb": "^6.12.0",
    "@fastify/view": "^10.0.1",
    "@fastify/static": "^7.0.4",
    "@fastify/formbody": "^8.0.1",
    "ejs": "^3.1.10",
    "pino": "^9.6.0",
    "pino-pretty": "^14.0.0"
  },
  "devDependencies": {
    "vitest": "^2.1.8",
    "@playwright/test": "^1.49.1",
    "mongodb-memory-server": "^10.1.2",
    "tailwindcss": "^3.4.17"
  }
}
```

### Step 1.3: Install dependencies

```bash
npm install
```

---

## 2. Download Frontend Libraries (5 minutes)

```bash
# Download HTMX
curl -o public/js/htmx.min.js https://unpkg.com/htmx.org@2.0.3/dist/htmx.min.js

# Download Alpine.js
curl -o public/js/alpine.min.js https://unpkg.com/alpinejs@3.14.3/dist/cdn.min.js

# Verify
ls -lh public/js/
```

---

## 3. Configure TailwindCSS (5 minutes)

### Step 3.1: Create tailwind.config.js

```javascript
// tailwind.config.js
export default {
  content: [
    './src/**/*.{html,ejs,js}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        }
      }
    },
  },
  plugins: [],
}
```

### Step 3.2: Create source CSS

```css
/* src/styles.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary {
    @apply px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-semibold transition-colors;
  }

  .btn-secondary {
    @apply px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors;
  }

  .input-field {
    @apply w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent;
  }

  .card {
    @apply bg-white shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow;
  }
}
```

### Step 3.3: Build CSS

```bash
npm run build:css
```

---

## 4. Create Database Connection (10 minutes)

```javascript
// src/shared/db.js
import { MongoClient } from 'mongodb'

let client = null
let db = null

export async function connectDB(url = process.env.MONGO_URL || 'mongodb://localhost:27017/etnodb') {
  if (db) return db

  client = new MongoClient(url, {
    maxPoolSize: 20,
    minPoolSize: 5,
  })

  await client.connect()
  db = client.db('etnodb')

  console.log('✅ Connected to MongoDB')
  return db
}

export function getDB() {
  if (!db) throw new Error('Database not initialized')
  return db
}

export async function closeDB() {
  if (client) {
    await client.close()
    client = null
    db = null
  }
}

export async function createIndexes() {
  const db = getDB()
  const collection = db.collection('etnodb')

  await collection.createIndexes([
    { key: { 'comunidades.nome': 1 } },
    { key: { 'comunidades.estado': 1 } },
    { key: { 'comunidades.municipio': 1 } },
    { key: { 'comunidades.plantas.nomeCientifico': 1 } },
    { key: { 'comunidades.plantas.nomeVernacular': 1 } },
    { key: { status: 1 } },
  ])

  console.log('✅ Database indexes created')
}
```

---

## 5. Create Reference Model (10 minutes)

Copy from `docs/implementation-examples.md` section 1.2:

```javascript
// src/shared/models/reference.js
// [Copy full content from implementation-examples.md]
```

---

## 6. Create Acquisition App (15 minutes)

### Step 6.1: Server file

```javascript
// src/apps/acquisition/server.js
import Fastify from 'fastify'
import fastifyView from '@fastify/view'
import fastifyStatic from '@fastify/static'
import fastifyFormbody from '@fastify/formbody'
import ejs from 'ejs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function buildAcquisitionApp(opts = {}) {
  const app = Fastify({
    logger: {
      level: opts.logLevel || 'info',
      transport: {
        target: 'pino-pretty'
      }
    }
  })

  await app.register(fastifyFormbody)
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '../../../public'),
    prefix: '/public/'
  })
  await app.register(fastifyView, {
    engine: { ejs },
    root: path.join(__dirname, 'views')
  })

  await app.register(await import('./routes.js'))

  return app
}
```

### Step 6.2: Routes file

Copy from `docs/implementation-examples.md` section 1.3

### Step 6.3: Views

Copy from `docs/implementation-examples.md` sections 2.1, 2.2, 2.3

---

## 7. Create Main Server (5 minutes)

```javascript
// src/server.js
import { connectDB, createIndexes } from './shared/db.js'
import { buildAcquisitionApp } from './apps/acquisition/server.js'

async function start() {
  await connectDB()
  await createIndexes()

  const acquisitionApp = await buildAcquisitionApp()

  const port = process.env.ACQUISITION_PORT || 3000

  await acquisitionApp.listen({ port, host: '0.0.0.0' })

  console.log(`
✅ Acquisition app running at http://localhost:${port}
  `)
}

start().catch(err => {
  console.error('Startup error:', err)
  process.exit(1)
})
```

---

## 8. Environment Configuration (5 minutes)

```bash
# .env
MONGO_URL=mongodb://localhost:27017/etnodb
NODE_ENV=development
LOG_LEVEL=info
ACQUISITION_PORT=3000
```

```bash
# .env.example (commit this)
MONGO_URL=mongodb://localhost:27017/etnodb
NODE_ENV=production
LOG_LEVEL=info
ACQUISITION_PORT=3000
CURATION_PORT=3001
PRESENTATION_PORT=3002
```

```bash
# .gitignore
node_modules/
.env
.env.local
npm-debug.log
coverage/
.vscode/
.DS_Store
dist/
*.log
```

---

## 9. Docker Configuration (10 minutes)

### Step 9.1: Dockerfile

```dockerfile
# Dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:css

FROM node:22-alpine
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY src ./src
COPY package.json ./

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000 3001 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000').catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
```

### Step 9.2: .dockerignore

```
node_modules
npm-debug.log
.git
.github
tests
*.test.js
*.spec.js
coverage
.env
.env.local
.vscode
README.md
docs
*.md
.DS_Store
```

### Step 9.3: docker-compose.yml (for development)

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: etnodb-mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_DATABASE: etnodb
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  web:
    build: .
    container_name: etnodb-web
    restart: unless-stopped
    ports:
      - "3000:3000"  # Acquisition
      - "3001:3001"  # Curation
      - "3002:3002"  # Presentation
    environment:
      MONGO_URL: mongodb://mongodb:27017/etnodb
      NODE_ENV: production
    depends_on:
      - mongodb

volumes:
  mongodb_data:
```

---

## 10. Test Run (5 minutes)

### Local development (with MongoDB running):

```bash
# Start MongoDB (if not running)
docker run -d -p 27017:27017 --name etnodb-mongo mongo:7

# Start app
npm run dev

# Open browser
# http://localhost:3000
```

### Docker development:

```bash
# Build and run
docker-compose up --build

# Open browser
# http://localhost:3000
```

### Verify:

1. App loads without errors
2. Can access form at http://localhost:3000
3. MongoDB connection successful
4. No console errors

---

## 11. Build Production Image (5 minutes)

```bash
# Build
docker build -t etnodb-web:latest .

# Check size
docker images etnodb-web:latest
# Should be ~140MB

# Run
docker run -p 3000:3000 \
  -e MONGO_URL=mongodb://host.docker.internal:27017/etnodb \
  etnodb-web:latest

# Test
curl http://localhost:3000
```

---

## 12. Next Steps

After completing quick start:

1. **Test acquisition form**
   - Fill out reference metadata
   - Add community
   - Add plants
   - Submit and verify in MongoDB

2. **Build presentation app** (Phase 3)
   - Copy structure from acquisition
   - Implement search routes
   - Create card views

3. **Build curation app** (Phase 4)
   - Copy structure from acquisition
   - Implement list/edit views
   - Add status management

4. **Add tests** (Phase 5)
   - Write unit tests for models
   - Add integration tests for routes
   - Create E2E tests for workflows

5. **Deploy to Unraid**
   - Push image to ghcr.io/edalcin/etnodb-web
   - Configure Unraid container
   - Set up port mappings

---

## Troubleshooting

### MongoDB connection fails

```bash
# Check MongoDB is running
docker ps | grep mongo

# Check connection string
echo $MONGO_URL

# Test connection
mongosh mongodb://localhost:27017/etnodb
```

### CSS not loading

```bash
# Rebuild CSS
npm run build:css

# Check file exists
ls -la public/css/tailwind.css

# Check browser console for 404s
```

### Docker image too large

```bash
# Check size breakdown
docker history etnodb-web:latest

# Verify .dockerignore is working
docker build --no-cache -t etnodb-web:test .
docker images etnodb-web:test
```

### Port already in use

```bash
# Find process using port
lsof -i :3000

# Kill process or use different port
export ACQUISITION_PORT=3010
npm run dev
```

---

## Useful Commands

```bash
# Development
npm run dev              # Start with auto-reload
npm run build:css        # Rebuild CSS
npm test                 # Run tests

# Docker
docker build -t etnodb-web .
docker run -p 3000:3000 etnodb-web
docker-compose up
docker-compose down

# MongoDB
docker exec -it etnodb-mongo mongosh
use etnodb
db.etnodb.find()

# Clean up
docker system prune -a
rm -rf node_modules
npm install
```

---

## Resources

- **Full implementation examples**: `docs/implementation-examples.md`
- **Technology decision**: `docs/TECHNOLOGY_DECISION.md`
- **Docker size analysis**: `docs/docker-size-comparison.md`
- **Project specification**: `specs/001-web-interface/spec.md`

---

**Estimated time to complete**: 60-90 minutes
**Result**: Working acquisition interface with MongoDB integration
**Next phase**: Implement presentation and curation apps
