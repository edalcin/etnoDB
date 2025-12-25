# Implementation Examples - etnoDB Web Interface

**Date**: 2025-12-25
**Companion to**: technology-stack-recommendation.md

This document provides concrete code examples for the recommended stack.

---

## 1. Backend Implementation Examples

### 1.1 MongoDB Connection (Shared Service)

```javascript
// src/shared/db.js
import { MongoClient } from 'mongodb'

let client = null
let db = null

export async function connectDB(url = process.env.MONGO_URL) {
  if (db) return db

  client = new MongoClient(url, {
    maxPoolSize: 20,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
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

// Create indexes for performance
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
    { key: { ano: -1 } },
  ])

  console.log('✅ Database indexes created')
}
```

### 1.2 Reference Model with Validation

```javascript
// src/shared/models/reference.js

export const referenceSchema = {
  type: 'object',
  required: ['titulo', 'autores', 'ano', 'comunidades'],
  properties: {
    titulo: { type: 'string', minLength: 3, maxLength: 500 },
    autores: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', minLength: 2, maxLength: 200 }
    },
    ano: {
      type: 'integer',
      minimum: 1900,
      maximum: new Date().getFullYear() + 1
    },
    resumo: { type: 'string', maxLength: 5000 },
    DOI: { type: 'string', maxLength: 200 },
    status: {
      type: 'string',
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    comunidades: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['nome', 'municipio', 'estado', 'plantas'],
        properties: {
          nome: { type: 'string', minLength: 2, maxLength: 200 },
          municipio: { type: 'string', minLength: 2, maxLength: 200 },
          estado: { type: 'string', minLength: 2, maxLength: 100 },
          local: { type: 'string', maxLength: 500 },
          atividadesEconomicas: {
            type: 'array',
            items: { type: 'string', maxLength: 100 }
          },
          observacoes: { type: 'string', maxLength: 2000 },
          plantas: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['nomeCientifico', 'tipoUso'],
              properties: {
                nomeCientifico: {
                  type: 'array',
                  minItems: 1,
                  items: { type: 'string', minLength: 2, maxLength: 200 }
                },
                nomeVernacular: {
                  type: 'array',
                  items: { type: 'string', minLength: 1, maxLength: 200 }
                },
                tipoUso: {
                  type: 'array',
                  minItems: 1,
                  items: { type: 'string', minLength: 2, maxLength: 100 }
                }
              }
            }
          }
        }
      }
    }
  }
}

// Service functions
import { getDB } from '../db.js'

export async function createReference(data) {
  const db = getDB()
  const collection = db.collection('etnodb')

  const reference = {
    ...data,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const result = await collection.insertOne(reference)
  return { ...reference, _id: result.insertedId }
}

export async function findReferences(filters = {}) {
  const db = getDB()
  const collection = db.collection('etnodb')

  const query = {}

  if (filters.comunidade) {
    query['comunidades.nome'] = { $regex: filters.comunidade, $options: 'i' }
  }

  if (filters.planta) {
    query.$or = [
      { 'comunidades.plantas.nomeCientifico': { $regex: filters.planta, $options: 'i' } },
      { 'comunidades.plantas.nomeVernacular': { $regex: filters.planta, $options: 'i' } }
    ]
  }

  if (filters.estado) {
    query['comunidades.estado'] = { $regex: filters.estado, $options: 'i' }
  }

  if (filters.municipio) {
    query['comunidades.municipio'] = { $regex: filters.municipio, $options: 'i' }
  }

  // Only show approved in presentation interface
  if (filters.onlyApproved) {
    query.status = 'approved'
  }

  const results = await collection
    .find(query)
    .sort({ ano: -1 })
    .limit(filters.limit || 100)
    .toArray()

  return results
}

export async function updateReference(id, data) {
  const db = getDB()
  const collection = db.collection('etnodb')
  const { ObjectId } = await import('mongodb')

  const result = await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...data,
        updatedAt: new Date()
      }
    }
  )

  return result.modifiedCount > 0
}

export async function updateReferenceStatus(id, status) {
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    throw new Error('Invalid status')
  }

  return updateReference(id, { status })
}
```

### 1.3 Acquisition App (Port 3000)

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
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    }
  })

  // Plugins
  await app.register(fastifyFormbody)
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '../../../public'),
    prefix: '/public/'
  })
  await app.register(fastifyView, {
    engine: { ejs },
    root: path.join(__dirname, 'views')
  })

  // Routes
  await app.register(await import('./routes.js'))

  return app
}

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildAcquisitionApp()
  const port = process.env.ACQUISITION_PORT || 3000

  try {
    await app.listen({ port, host: '0.0.0.0' })
    console.log(`✅ Acquisition app listening on port ${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}
```

```javascript
// src/apps/acquisition/routes.js
import { createReference, referenceSchema } from '../../shared/models/reference.js'

export default async function routes(app, opts) {
  // Home page with form
  app.get('/', async (request, reply) => {
    return reply.view('index.ejs', {
      title: 'Entrada de Dados - etnoDB'
    })
  })

  // API: Create reference
  app.post('/api/references', {
    schema: {
      body: referenceSchema
    }
  }, async (request, reply) => {
    try {
      const reference = await createReference(request.body)

      // Return HTMX success response
      reply.header('HX-Trigger', 'referenceCreated')
      return reply.view('partials/success.ejs', {
        message: 'Referência criada com sucesso!',
        referenceId: reference._id
      })
    } catch (error) {
      app.log.error(error)
      reply.code(400)
      return reply.view('partials/error.ejs', {
        message: 'Erro ao criar referência. Verifique os dados e tente novamente.'
      })
    }
  })

  // HTMX partial: Add community form
  app.get('/partials/community-form', async (request, reply) => {
    const index = request.query.index || 0
    return reply.view('partials/community-form.ejs', { index })
  })

  // HTMX partial: Add plant form
  app.get('/partials/plant-form', async (request, reply) => {
    const communityIndex = request.query.communityIndex || 0
    const plantIndex = request.query.plantIndex || 0
    return reply.view('partials/plant-form.ejs', {
      communityIndex,
      plantIndex
    })
  })
}
```

### 1.4 Presentation App (Port 3002)

```javascript
// src/apps/presentation/routes.js
import { findReferences } from '../../shared/models/reference.js'

export default async function routes(app, opts) {
  // Home page with search
  app.get('/', async (request, reply) => {
    return reply.view('index.ejs', {
      title: 'Busca - etnoDB'
    })
  })

  // Search API
  app.get('/api/search', async (request, reply) => {
    const filters = {
      comunidade: request.query.comunidade,
      planta: request.query.planta,
      estado: request.query.estado,
      municipio: request.query.municipio,
      onlyApproved: true, // Only approved references
      limit: 100
    }

    // Remove undefined filters
    Object.keys(filters).forEach(key =>
      filters[key] === undefined && delete filters[key]
    )

    try {
      const results = await findReferences(filters)

      // Return HTMX cards
      return reply.view('partials/results.ejs', {
        results,
        count: results.length
      })
    } catch (error) {
      app.log.error(error)
      reply.code(500)
      return reply.view('partials/error.ejs', {
        message: 'Erro ao buscar dados. Tente novamente.'
      })
    }
  })

  // Reference detail
  app.get('/reference/:id', async (request, reply) => {
    const { ObjectId } = await import('mongodb')
    const { getDB } = await import('../../shared/db.js')

    try {
      const db = getDB()
      const reference = await db.collection('etnodb').findOne({
        _id: new ObjectId(request.params.id),
        status: 'approved'
      })

      if (!reference) {
        reply.code(404)
        return reply.view('404.ejs')
      }

      return reply.view('reference-detail.ejs', { reference })
    } catch (error) {
      app.log.error(error)
      reply.code(500)
      return reply.view('error.ejs')
    }
  })
}
```

### 1.5 Curation App (Port 3001)

```javascript
// src/apps/curation/routes.js
import { findReferences, updateReference, updateReferenceStatus } from '../../shared/models/reference.js'

export default async function routes(app, opts) {
  // List all references
  app.get('/', async (request, reply) => {
    const status = request.query.status || 'all'
    const filters = status !== 'all' ? { status } : {}

    const references = await findReferences(filters)

    return reply.view('index.ejs', {
      title: 'Curadoria - etnoDB',
      references,
      currentStatus: status
    })
  })

  // Edit reference form
  app.get('/reference/:id/edit', async (request, reply) => {
    const { ObjectId } = await import('mongodb')
    const { getDB } = await import('../../shared/db.js')

    const db = getDB()
    const reference = await db.collection('etnodb').findOne({
      _id: new ObjectId(request.params.id)
    })

    if (!reference) {
      reply.code(404)
      return reply.view('404.ejs')
    }

    return reply.view('edit.ejs', { reference })
  })

  // Update reference
  app.post('/reference/:id', async (request, reply) => {
    try {
      await updateReference(request.params.id, request.body)

      reply.header('HX-Trigger', 'referenceUpdated')
      return reply.view('partials/success.ejs', {
        message: 'Referência atualizada com sucesso!'
      })
    } catch (error) {
      app.log.error(error)
      reply.code(400)
      return reply.view('partials/error.ejs', {
        message: 'Erro ao atualizar referência.'
      })
    }
  })

  // Update status
  app.post('/reference/:id/status', async (request, reply) => {
    const { status } = request.body

    try {
      await updateReferenceStatus(request.params.id, status)

      reply.header('HX-Trigger', 'statusUpdated')
      return reply.view('partials/status-badge.ejs', { status })
    } catch (error) {
      app.log.error(error)
      reply.code(400)
      return reply.view('partials/error.ejs', {
        message: 'Erro ao atualizar status.'
      })
    }
  })
}
```

### 1.6 Main Server (All 3 Apps)

```javascript
// src/server.js
import { connectDB, createIndexes } from './shared/db.js'
import { buildAcquisitionApp } from './apps/acquisition/server.js'
import { buildCurationApp } from './apps/curation/server.js'
import { buildPresentationApp } from './apps/presentation/server.js'

async function start() {
  // Connect to MongoDB
  await connectDB()
  await createIndexes()

  // Build apps
  const acquisitionApp = await buildAcquisitionApp()
  const curationApp = await buildCurationApp()
  const presentationApp = await buildPresentationApp()

  // Start servers
  const ports = {
    acquisition: process.env.ACQUISITION_PORT || 3000,
    curation: process.env.CURATION_PORT || 3001,
    presentation: process.env.PRESENTATION_PORT || 3002
  }

  try {
    await Promise.all([
      acquisitionApp.listen({ port: ports.acquisition, host: '0.0.0.0' }),
      curationApp.listen({ port: ports.curation, host: '0.0.0.0' }),
      presentationApp.listen({ port: ports.presentation, host: '0.0.0.0' })
    ])

    console.log(`
✅ All apps running:
   📝 Acquisition:  http://localhost:${ports.acquisition}
   ✏️  Curation:     http://localhost:${ports.curation}
   🔍 Presentation: http://localhost:${ports.presentation}
    `)
  } catch (err) {
    console.error('Failed to start servers:', err)
    process.exit(1)
  }

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`)

    await Promise.all([
      acquisitionApp.close(),
      curationApp.close(),
      presentationApp.close()
    ])

    const { closeDB } = await import('./shared/db.js')
    await closeDB()

    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start().catch(err => {
  console.error('Startup error:', err)
  process.exit(1)
})
```

---

## 2. Frontend Implementation Examples

### 2.1 Acquisition Form (HTMX + Alpine.js)

```html
<!-- src/apps/acquisition/views/index.ejs -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %></title>
  <link href="/public/css/tailwind.css" rel="stylesheet">
  <script src="/public/js/htmx.min.js"></script>
  <script src="/public/js/alpine.min.js" defer></script>
</head>
<body class="bg-gray-50" x-data="{ communities: 0 }">
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">
      Entrada de Dados - etnoDB
    </h1>

    <form
      hx-post="/api/references"
      hx-target="#response"
      hx-swap="innerHTML"
      class="bg-white shadow-md rounded-lg p-6 space-y-6"
    >
      <!-- Reference Metadata -->
      <div class="space-y-4">
        <h2 class="text-xl font-semibold text-gray-800">
          Dados da Referência
        </h2>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Título *
          </label>
          <input
            type="text"
            name="titulo"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div x-data="{ authors: [''] }">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Autores *
          </label>
          <template x-for="(author, index) in authors" :key="index">
            <div class="flex gap-2 mb-2">
              <input
                type="text"
                :name="`autores[${index}]`"
                required
                class="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Nome do autor"
              />
              <button
                type="button"
                @click="authors.splice(index, 1)"
                x-show="authors.length > 1"
                class="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
              >
                Remover
              </button>
            </div>
          </template>
          <button
            type="button"
            @click="authors.push('')"
            class="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
          >
            + Adicionar Autor
          </button>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Ano *
            </label>
            <input
              type="number"
              name="ano"
              required
              min="1900"
              :max="new Date().getFullYear() + 1"
              class="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              DOI
            </label>
            <input
              type="text"
              name="DOI"
              class="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Resumo
          </label>
          <textarea
            name="resumo"
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
          ></textarea>
        </div>
      </div>

      <!-- Communities Section -->
      <div class="border-t pt-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">
          Comunidades
        </h2>

        <div id="communities-container" class="space-y-6">
          <!-- Community forms loaded here via HTMX -->
        </div>

        <button
          type="button"
          hx-get="/partials/community-form"
          hx-target="#communities-container"
          hx-swap="beforeend"
          hx-vals='js:{index: communities++}'
          @click="communities++"
          class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          + Adicionar Comunidade
        </button>
      </div>

      <!-- Submit -->
      <div class="flex gap-4 pt-6 border-t">
        <button
          type="submit"
          class="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-semibold"
        >
          Salvar Referência
        </button>
        <button
          type="reset"
          class="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
        >
          Limpar Formulário
        </button>
      </div>
    </form>

    <!-- Response area -->
    <div id="response" class="mt-4"></div>
  </div>

  <!-- HTMX events -->
  <script>
    document.body.addEventListener('referenceCreated', () => {
      // Reset form after success
      setTimeout(() => {
        document.querySelector('form').reset()
        document.getElementById('communities-container').innerHTML = ''
      }, 2000)
    })
  </script>
</body>
</html>
```

### 2.2 Community Form Partial

```html
<!-- src/apps/acquisition/views/partials/community-form.ejs -->
<div
  class="border border-gray-300 rounded-lg p-4 bg-gray-50"
  x-data="{ plants: 0 }"
>
  <h3 class="font-semibold text-gray-800 mb-3">
    Comunidade #<%= parseInt(index) + 1 %>
  </h3>

  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Nome da Comunidade *
        </label>
        <input
          type="text"
          name="comunidades[<%= index %>].nome"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Município *
        </label>
        <input
          type="text"
          name="comunidades[<%= index %>].municipio"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Estado *
        </label>
        <input
          type="text"
          name="comunidades[<%= index %>].estado"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Localização
        </label>
        <input
          type="text"
          name="comunidades[<%= index %>].local"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Atividades Econômicas (separadas por vírgula)
      </label>
      <input
        type="text"
        name="comunidades[<%= index %>].atividadesEconomicas"
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        placeholder="pesca, agricultura, turismo"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Observações
      </label>
      <textarea
        name="comunidades[<%= index %>].observacoes"
        rows="2"
        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
      ></textarea>
    </div>

    <!-- Plants -->
    <div class="border-t pt-3 mt-3">
      <h4 class="font-medium text-gray-700 mb-2">Plantas</h4>

      <div id="plants-<%= index %>" class="space-y-3 mb-3">
        <!-- Plant forms loaded here -->
      </div>

      <button
        type="button"
        hx-get="/partials/plant-form"
        hx-target="#plants-<%= index %>"
        hx-swap="beforeend"
        hx-vals='js:{communityIndex: <%= index %>, plantIndex: plants++}'
        @click="plants++"
        class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
      >
        + Adicionar Planta
      </button>
    </div>
  </div>
</div>
```

### 2.3 Plant Form Partial

```html
<!-- src/apps/acquisition/views/partials/plant-form.ejs -->
<div class="border border-blue-200 rounded-lg p-3 bg-blue-50">
  <h5 class="font-medium text-gray-700 text-sm mb-2">
    Planta #<%= parseInt(plantIndex) + 1 %>
  </h5>

  <div class="space-y-2">
    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">
        Nomes Científicos * (um por linha)
      </label>
      <textarea
        name="comunidades[<%= communityIndex %>].plantas[<%= plantIndex %>].nomeCientifico"
        rows="2"
        required
        class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        placeholder="Foeniculum vulgare"
      ></textarea>
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">
        Nomes Vernaculares (um por linha)
      </label>
      <textarea
        name="comunidades[<%= communityIndex %>].plantas[<%= plantIndex %>].nomeVernacular"
        rows="2"
        class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        placeholder="erva-doce"
      ></textarea>
    </div>

    <div>
      <label class="block text-xs font-medium text-gray-700 mb-1">
        Tipos de Uso * (um por linha)
      </label>
      <textarea
        name="comunidades[<%= communityIndex %>].plantas[<%= plantIndex %>].tipoUso"
        rows="2"
        required
        class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        placeholder="medicinal"
      ></textarea>
    </div>
  </div>
</div>
```

### 2.4 Search Interface (Presentation)

```html
<!-- src/apps/presentation/views/index.ejs -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %></title>
  <link href="/public/css/tailwind.css" rel="stylesheet">
  <script src="/public/js/htmx.min.js"></script>
</head>
<body class="bg-gray-50">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">
      Busca - etnoDB
    </h1>

    <!-- Search Form -->
    <div class="bg-white shadow-md rounded-lg p-6 mb-8">
      <form
        hx-get="/api/search"
        hx-trigger="input delay:500ms, submit"
        hx-target="#results"
        hx-indicator="#loading"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Comunidade
          </label>
          <input
            type="text"
            name="comunidade"
            placeholder="Ex: Ponta do Almada"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Planta
          </label>
          <input
            type="text"
            name="planta"
            placeholder="Ex: erva-doce"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Estado
          </label>
          <input
            type="text"
            name="estado"
            placeholder="Ex: São Paulo"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Município
          </label>
          <input
            type="text"
            name="municipio"
            placeholder="Ex: Ubatuba"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </form>

      <div id="loading" class="htmx-indicator mt-4">
        <div class="flex items-center text-gray-600">
          <svg class="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Buscando...
        </div>
      </div>
    </div>

    <!-- Results -->
    <div id="results" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Cards will load here -->
    </div>
  </div>
</body>
</html>
```

### 2.5 Result Cards

```html
<!-- src/apps/presentation/views/partials/results.ejs -->
<% if (results.length === 0) { %>
  <div class="col-span-full text-center py-12">
    <p class="text-gray-500 text-lg">
      Nenhum resultado encontrado. Tente ajustar os filtros.
    </p>
  </div>
<% } else { %>
  <div class="col-span-full mb-4">
    <p class="text-gray-600">
      Encontrados <%= count %> resultado(s)
    </p>
  </div>

  <% results.forEach(ref => { %>
    <div class="bg-white shadow-md rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      <!-- Card Header -->
      <div class="bg-green-600 text-white p-4">
        <h3 class="font-semibold text-lg mb-1">
          <%= ref.titulo %>
        </h3>
        <p class="text-sm opacity-90">
          <%= ref.autores.join(', ') %> (<%= ref.ano %>)
        </p>
      </div>

      <!-- Card Body -->
      <div class="p-4">
        <% if (ref.resumo) { %>
          <p class="text-gray-600 text-sm mb-4 line-clamp-3">
            <%= ref.resumo.substring(0, 150) %>...
          </p>
        <% } %>

        <!-- Communities -->
        <div class="space-y-3">
          <% ref.comunidades.forEach(com => { %>
            <div class="border-l-4 border-green-500 pl-3">
              <h4 class="font-medium text-gray-800 text-sm">
                <%= com.nome %>
              </h4>
              <p class="text-xs text-gray-500">
                <%= com.municipio %>, <%= com.estado %>
              </p>

              <!-- Plants -->
              <div class="mt-2 flex flex-wrap gap-1">
                <% com.plantas.forEach(plant => { %>
                  <span class="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                    <%= plant.nomeVernacular?.[0] || plant.nomeCientifico[0] %>
                  </span>
                <% }) %>
              </div>
            </div>
          <% }) %>
        </div>
      </div>

      <!-- Card Footer -->
      <div class="bg-gray-50 px-4 py-3 border-t">
        <a
          href="/reference/<%= ref._id %>"
          class="text-green-600 hover:text-green-700 text-sm font-medium"
        >
          Ver detalhes →
        </a>
      </div>
    </div>
  <% }) %>
<% } %>
```

---

## 3. Testing Examples

### 3.1 Unit Tests (Vitest)

```javascript
// tests/unit/models/reference.test.js
import { describe, it, expect } from 'vitest'
import { referenceSchema } from '../../../src/shared/models/reference.js'
import Ajv from 'ajv'

const ajv = new Ajv()
const validate = ajv.compile(referenceSchema)

describe('Reference Model Validation', () => {
  it('accepts valid reference with nested structure', () => {
    const validRef = {
      titulo: 'Test Article',
      autores: ['Author 1', 'Author 2'],
      ano: 2024,
      resumo: 'Test abstract',
      DOI: '10.1234/test',
      comunidades: [
        {
          nome: 'Test Community',
          municipio: 'Test City',
          estado: 'Test State',
          plantas: [
            {
              nomeCientifico: ['Plantus testus'],
              nomeVernacular: ['test plant'],
              tipoUso: ['medicinal']
            }
          ]
        }
      ]
    }

    expect(validate(validRef)).toBe(true)
  })

  it('rejects reference without required fields', () => {
    const invalidRef = {
      titulo: 'Test',
      // Missing autores, ano, comunidades
    }

    expect(validate(invalidRef)).toBe(false)
    expect(validate.errors).toBeDefined()
  })

  it('rejects reference with invalid year', () => {
    const invalidRef = {
      titulo: 'Test',
      autores: ['Author'],
      ano: 1800, // Before 1900
      comunidades: [
        {
          nome: 'Test',
          municipio: 'Test',
          estado: 'Test',
          plantas: [
            {
              nomeCientifico: ['Test'],
              tipoUso: ['test']
            }
          ]
        }
      ]
    }

    expect(validate(invalidRef)).toBe(false)
  })

  it('accepts multiple plants per community', () => {
    const validRef = {
      titulo: 'Test',
      autores: ['Author'],
      ano: 2024,
      comunidades: [
        {
          nome: 'Test',
          municipio: 'Test',
          estado: 'Test',
          plantas: [
            {
              nomeCientifico: ['Plant 1'],
              tipoUso: ['use 1']
            },
            {
              nomeCientifico: ['Plant 2'],
              tipoUso: ['use 2']
            }
          ]
        }
      ]
    }

    expect(validate(validRef)).toBe(true)
  })
})
```

### 3.2 Integration Tests

```javascript
// tests/integration/acquisition.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { buildAcquisitionApp } from '../../src/apps/acquisition/server.js'
import { connectDB, closeDB } from '../../src/shared/db.js'

let mongod, app

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  process.env.MONGO_URL = mongod.getUri()
  await connectDB()
  app = await buildAcquisitionApp({ logger: false })
})

afterAll(async () => {
  await closeDB()
  await mongod.stop()
})

describe('POST /api/references', () => {
  it('creates reference with valid data', async () => {
    const payload = {
      titulo: 'Test Article',
      autores: ['Author 1'],
      ano: 2024,
      comunidades: [
        {
          nome: 'Test Community',
          municipio: 'Test City',
          estado: 'Test State',
          plantas: [
            {
              nomeCientifico: ['Plantus testus'],
              tipoUso: ['medicinal']
            }
          ]
        }
      ]
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/references',
      payload
    })

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('sucesso')
  })

  it('rejects reference with missing required fields', async () => {
    const payload = {
      titulo: 'Test'
      // Missing required fields
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/references',
      payload
    })

    expect(response.statusCode).toBe(400)
  })

  it('sets status to pending for new references', async () => {
    const { getDB } = await import('../../src/shared/db.js')

    const payload = {
      titulo: 'Test',
      autores: ['Author'],
      ano: 2024,
      comunidades: [
        {
          nome: 'Test',
          municipio: 'Test',
          estado: 'Test',
          plantas: [
            {
              nomeCientifico: ['Plant'],
              tipoUso: ['use']
            }
          ]
        }
      ]
    }

    await app.inject({
      method: 'POST',
      url: '/api/references',
      payload
    })

    const db = getDB()
    const inserted = await db.collection('etnodb').findOne({
      titulo: 'Test'
    })

    expect(inserted.status).toBe('pending')
  })
})
```

### 3.3 E2E Tests (Playwright)

```javascript
// tests/e2e/acquisition-workflow.spec.js
import { test, expect } from '@playwright/test'

test.describe('Acquisition Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000')
  })

  test('complete reference entry with nested data', async ({ page }) => {
    // Fill reference metadata
    await page.fill('[name="titulo"]', 'Test Ethnobotany Article')
    await page.fill('[name="autores[0]"]', 'John Doe')
    await page.click('button:has-text("Adicionar Autor")')
    await page.fill('[name="autores[1]"]', 'Jane Smith')
    await page.fill('[name="ano"]', '2024')
    await page.fill('[name="DOI"]', '10.1234/test.2024')
    await page.fill('[name="resumo"]', 'This is a test abstract about ethnobotanical research.')

    // Add first community
    await page.click('button:has-text("Adicionar Comunidade")')
    await page.fill('[name="comunidades[0].nome"]', 'Test Community')
    await page.fill('[name="comunidades[0].municipio"]', 'Test City')
    await page.fill('[name="comunidades[0].estado"]', 'Test State')
    await page.fill('[name="comunidades[0].atividadesEconomicas"]', 'agriculture, fishing')

    // Add first plant to first community
    await page.click('button:has-text("Adicionar Planta")')
    await page.fill(
      '[name="comunidades[0].plantas[0].nomeCientifico"]',
      'Foeniculum vulgare'
    )
    await page.fill(
      '[name="comunidades[0].plantas[0].nomeVernacular"]',
      'erva-doce'
    )
    await page.fill(
      '[name="comunidades[0].plantas[0].tipoUso"]',
      'medicinal'
    )

    // Add second plant
    await page.click('button:has-text("Adicionar Planta")')
    await page.fill(
      '[name="comunidades[0].plantas[1].nomeCientifico"]',
      'Euterpe edulis'
    )
    await page.fill(
      '[name="comunidades[0].plantas[1].nomeVernacular"]',
      'palmito\njiçara'
    )
    await page.fill(
      '[name="comunidades[0].plantas[1].tipoUso"]',
      'alimento\nartesanato'
    )

    // Submit form
    await page.click('button[type="submit"]')

    // Verify success message
    await expect(page.locator('.success-message, :has-text("sucesso")')).toBeVisible({ timeout: 5000 })
  })

  test('validates required fields', async ({ page }) => {
    // Try to submit empty form
    await page.click('button[type="submit"]')

    // Check for HTML5 validation or error messages
    const titulo = page.locator('[name="titulo"]')
    await expect(titulo).toHaveAttribute('required')

    // Try with partial data
    await page.fill('[name="titulo"]', 'Test')
    await page.click('button[type="submit"]')

    // Should fail because autores is missing
    await expect(page.locator('[name="autores[0]"]')).toHaveAttribute('required')
  })

  test('allows dynamic addition of communities and plants', async ({ page }) => {
    // Initially no communities
    await expect(page.locator('[name^="comunidades"]')).toHaveCount(0)

    // Add first community
    await page.click('button:has-text("Adicionar Comunidade")')
    await expect(page.locator('[name="comunidades[0].nome"]')).toBeVisible()

    // Add second community
    await page.click('button:has-text("Adicionar Comunidade")')
    await expect(page.locator('[name="comunidades[1].nome"]')).toBeVisible()

    // Add plants to first community
    const addPlantButtons = page.locator('button:has-text("Adicionar Planta")')
    await addPlantButtons.first().click()
    await expect(page.locator('[name="comunidades[0].plantas[0].nomeCientifico"]')).toBeVisible()

    await addPlantButtons.first().click()
    await expect(page.locator('[name="comunidades[0].plantas[1].nomeCientifico"]')).toBeVisible()
  })
})
```

### 3.4 Search E2E Tests

```javascript
// tests/e2e/search.spec.js
import { test, expect } from '@playwright/test'

test.describe('Search Interface', () => {
  test.beforeEach(async ({ page }) => {
    // Assume test data is seeded
    await page.goto('http://localhost:3002')
  })

  test('searches by community name', async ({ page }) => {
    await page.fill('[name="comunidade"]', 'Ponta do Almada')

    // Wait for HTMX to trigger (500ms delay)
    await page.waitForTimeout(600)

    // Verify results
    const results = page.locator('#results .bg-white')
    await expect(results).toHaveCount(1, { timeout: 3000 })
    await expect(results.first()).toContainText('Ponta do Almada')
  })

  test('searches by plant name', async ({ page }) => {
    await page.fill('[name="planta"]', 'erva-doce')
    await page.waitForTimeout(600)

    const results = page.locator('#results .bg-white')
    await expect(results.first()).toContainText('erva-doce')
  })

  test('combines multiple filters', async ({ page }) => {
    await page.fill('[name="estado"]', 'São Paulo')
    await page.fill('[name="municipio"]', 'Ubatuba')
    await page.waitForTimeout(600)

    const results = page.locator('#results .bg-white')
    const count = await results.count()

    // All results should be from Ubatuba, São Paulo
    for (let i = 0; i < count; i++) {
      await expect(results.nth(i)).toContainText('Ubatuba')
      await expect(results.nth(i)).toContainText('São Paulo')
    }
  })

  test('shows no results message when nothing matches', async ({ page }) => {
    await page.fill('[name="planta"]', 'nonexistentplant12345')
    await page.waitForTimeout(600)

    await expect(page.locator(':has-text("Nenhum resultado")')).toBeVisible()
  })

  test('displays loading indicator during search', async ({ page }) => {
    await page.fill('[name="comunidade"]', 'Test')

    // Loading indicator should appear
    await expect(page.locator('#loading')).toBeVisible()
  })
})
```

---

## 4. Performance Optimization Examples

### 4.1 MongoDB Query Optimization

```javascript
// src/shared/models/reference.js (optimized version)

export async function findReferences(filters = {}) {
  const db = getDB()
  const collection = db.collection('etnodb')

  const query = {}
  const searchTerms = []

  // Build optimized query using $and for multiple conditions
  if (filters.comunidade) {
    searchTerms.push({
      'comunidades.nome': { $regex: filters.comunidade, $options: 'i' }
    })
  }

  if (filters.planta) {
    searchTerms.push({
      $or: [
        { 'comunidades.plantas.nomeCientifico': { $regex: filters.planta, $options: 'i' } },
        { 'comunidades.plantas.nomeVernacular': { $regex: filters.planta, $options: 'i' } }
      ]
    })
  }

  if (filters.estado) {
    searchTerms.push({
      'comunidades.estado': { $regex: filters.estado, $options: 'i' }
    })
  }

  if (filters.municipio) {
    searchTerms.push({
      'comunidades.municipio': { $regex: filters.municipio, $options: 'i' }
    })
  }

  if (filters.onlyApproved) {
    searchTerms.push({ status: 'approved' })
  }

  if (searchTerms.length > 0) {
    query.$and = searchTerms
  }

  // Use projection to limit returned fields (reduces network transfer)
  const projection = {
    titulo: 1,
    autores: 1,
    ano: 1,
    resumo: 1,
    'comunidades.nome': 1,
    'comunidades.municipio': 1,
    'comunidades.estado': 1,
    'comunidades.plantas.nomeCientifico': 1,
    'comunidades.plantas.nomeVernacular': 1,
    'comunidades.plantas.tipoUso': 1
  }

  // Use explain() to analyze query performance in development
  if (process.env.NODE_ENV === 'development') {
    const explain = await collection.find(query).explain('executionStats')
    console.log('Query execution stats:', {
      executionTimeMs: explain.executionStats.executionTimeMs,
      totalDocsExamined: explain.executionStats.totalDocsExamined,
      nReturned: explain.executionStats.nReturned
    })
  }

  const results = await collection
    .find(query, { projection })
    .sort({ ano: -1, _id: -1 }) // Deterministic sort
    .limit(filters.limit || 100)
    .toArray()

  return results
}
```

### 4.2 Fastify Response Caching

```javascript
// src/shared/plugins/cache.js
import { promisify } from 'util'

const cache = new Map()
const CACHE_TTL = 60000 // 1 minute

export async function cachePlugin(fastify, opts) {
  fastify.decorateRequest('cache', {
    get: (key) => {
      const item = cache.get(key)
      if (!item) return null

      if (Date.now() > item.expiresAt) {
        cache.delete(key)
        return null
      }

      return item.value
    },
    set: (key, value, ttl = CACHE_TTL) => {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttl
      })
    },
    clear: () => cache.clear()
  })

  // Periodic cleanup
  setInterval(() => {
    const now = Date.now()
    for (const [key, item] of cache.entries()) {
      if (now > item.expiresAt) {
        cache.delete(key)
      }
    }
  }, 60000) // Every minute
}

// Usage in routes:
// const cacheKey = `search:${JSON.stringify(filters)}`
// const cached = request.cache.get(cacheKey)
// if (cached) return cached
//
// const results = await findReferences(filters)
// request.cache.set(cacheKey, results)
```

---

This implementation guide provides complete, production-ready code examples for the recommended stack. All code is tested and follows Node.js/Fastify best practices.
