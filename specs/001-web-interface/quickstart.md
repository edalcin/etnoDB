# Quickstart Guide: Ethnobotanical Database Web Interface

**Feature**: 001-web-interface
**Last Updated**: 2025-12-25

## Overview

This quickstart guide provides developers with everything needed to set up, develop, and deploy the ethnobotanical database web interface.

## Prerequisites

### Required Software

- **Node.js**: 20 LTS or higher ([Download](https://nodejs.org/))
- **npm**: 10.0+ (comes with Node.js)
- **Docker**: 24.0+ ([Download](https://www.docker.com/))
- **MongoDB**: 7.0+ (or use Docker Compose provided)
- **Git**: For version control

### Knowledge Requirements

- JavaScript/Node.js basics
- HTML/CSS fundamentals
- MongoDB query basics
- Docker fundamentals
- Express.js familiarity helpful but not required

---

## Quick Start (Development)

### 1. Clone Repository

```bash
git clone <repository-url>
cd etnoDB
git checkout main  # Always work on main branch per spec
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create `.env` file in project root:

```bash
# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/etnodb

# Application Ports
PORT_ACQUISITION=3001
PORT_CURATION=3002
PORT_PRESENTATION=3003

# Environment
NODE_ENV=development
```

### 4. Start Development Environment

**Option A: Docker Compose (Recommended)**

```bash
# Starts app + MongoDB in containers
docker-compose up
```

**Option B: Local Development**

```bash
# Terminal 1: Start MongoDB (if not using Docker)
mongod

# Terminal 2: Start application
npm run dev
```

### 5. Access the Application

- **Acquisition** (data entry): http://localhost:3001
- **Curation** (data editing): http://localhost:3002
- **Presentation** (public search): http://localhost:3003

---

## Project Structure

```
etnoDB/
├── backend/
│   ├── src/
│   │   ├── models/              # MongoDB data models
│   │   │   └── Reference.js     # Reference schema and validation
│   │   ├── services/            # Business logic
│   │   │   ├── database.js      # MongoDB connection
│   │   │   └── validation.js    # Data validation functions
│   │   ├── contexts/            # Three application contexts
│   │   │   ├── acquisition/     # Data entry context (port 3001)
│   │   │   │   ├── app.js       # Express app instance
│   │   │   │   ├── routes.js    # Route definitions
│   │   │   │   └── views/       # EJS templates
│   │   │   ├── curation/        # Data editing context (port 3002)
│   │   │   │   ├── app.js
│   │   │   │   ├── routes.js
│   │   │   │   └── views/
│   │   │   └── presentation/    # Public search context (port 3003)
│   │   │       ├── app.js
│   │   │       ├── routes.js
│   │   │       └── views/
│   │   ├── shared/              # Shared utilities
│   │   │   ├── config.js        # Configuration loader
│   │   │   └── logger.js        # Logging utility
│   │   └── server.js            # Main entry point (starts all 3 contexts)
│   └── tests/
│       ├── unit/                # Unit tests (services, models)
│       └── integration/         # MongoDB integration tests
├── frontend/
│   ├── src/
│   │   ├── shared/              # Shared frontend assets
│   │   │   ├── styles/          # Tailwind CSS configuration
│   │   │   └── scripts/         # Alpine.js components
│   │   ├── acquisition/         # Acquisition-specific assets
│   │   ├── curation/            # Curation-specific assets
│   │   └── presentation/        # Presentation-specific assets
│   └── dist/                    # Compiled CSS/JS (gitignored)
├── docker/
│   ├── Dockerfile               # Production container
│   └── docker-compose.yml       # Development environment
├── specs/                       # Feature specifications
│   └── 001-web-interface/
│       ├── spec.md              # Requirements specification
│       ├── plan.md              # Implementation plan
│       ├── research.md          # Technology decisions
│       ├── data-model.md        # Data model documentation
│       ├── quickstart.md        # This file
│       └── contracts/           # API contracts
├── docs/                        # Additional documentation
│   └── dataStructure.json       # MongoDB schema reference
├── .env.example                 # Environment variables template
├── package.json                 # Node.js dependencies
└── README.md                    # Project overview
```

---

## Development Workflow

### Running the Development Server

```bash
npm run dev
```

**What it does**:
- Starts all three Express apps (acquisition, curation, presentation)
- Enables hot-reload with nodemon (backend changes trigger restart)
- Watches Tailwind CSS files for changes (recompiles on save)
- Connects to MongoDB (local or Docker)

### Making Changes

**Backend Code**:
1. Edit files in `backend/src/`
2. Nodemon automatically restarts server
3. Refresh browser to see changes

**Frontend Templates (EJS)**:
1. Edit `.ejs` files in `backend/src/contexts/*/views/`
2. Refresh browser (no restart needed)

**Styles (Tailwind CSS)**:
1. Edit HTML classes or `frontend/src/shared/styles/custom.css`
2. Tailwind rebuilds CSS automatically
3. Refresh browser to see changes

### Testing

**Run All Tests**:
```bash
npm test
```

**Run Unit Tests Only**:
```bash
npm run test:unit
```

**Run Integration Tests Only**:
```bash
npm run test:integration
```

**Run Tests in Watch Mode**:
```bash
npm run test:watch
```

**Test Coverage**:
```bash
npm run test:coverage
```

---

## MongoDB Setup

### Option 1: Docker Compose (Recommended)

MongoDB starts automatically with `docker-compose up`. No manual setup needed.

### Option 2: Local MongoDB

**Create Database and Collection**:
```bash
mongosh
```

```javascript
use etnodb
db.createCollection("etnodb")
```

**Create Indexes** (run once):
```javascript
db.etnodb.createIndex({ titulo: "text" });
db.etnodb.createIndex({ status: 1 });
db.etnodb.createIndex({ createdAt: -1 });
db.etnodb.createIndex({ "comunidades.estado": 1 });
db.etnodb.createIndex({ "comunidades.municipio": 1 });
db.etnodb.createIndex({ "comunidades.nome": "text" });
db.etnodb.createIndex({
  "comunidades.plantas.nomeCientifico": "text",
  "comunidades.plantas.nomeVernacular": "text"
});
```

**Load Sample Data** (optional):
```javascript
db.etnodb.insertOne({
  titulo: "Diversity Of Plant Uses In Two Caiçara Communities",
  autores: ["HANAZAKI, N.", "TAMASHIRO, J. Y.", "LEITÃO-FILHO, H. F.", "BEGOSSI, A."],
  ano: 2000,
  resumo: "Caiçaras são habitantes nativos da costa atlântica...",
  DOI: "",
  status: "approved",
  comunidades: [
    {
      nome: "Ponta do Almada",
      municipio: "Ubatuba",
      estado: "São Paulo",
      local: "limite sul do Núcleo Picinguaba",
      atividadesEconomicas: ["pesca", "agricultura", "turismo"],
      observacoes: "É a menor das duas comunidades",
      plantas: [
        {
          nomeCientifico: ["Foeniculum vulgare"],
          nomeVernacular: ["erva-doce"],
          tipoUso: ["medicinal"]
        }
      ]
    }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
});
```

---

## Building for Production

### Build Docker Image

```bash
docker build -f docker/Dockerfile -t ghcr.io/edalcin/etnodb:latest .
```

**Multi-stage Build Process**:
1. **Stage 1**: Install dependencies, compile Tailwind CSS
2. **Stage 2**: Copy production files, exclude dev dependencies
3. **Result**: Optimized image (~120-180MB)

### Run Production Container Locally

```bash
docker run -d \
  --name etnodb \
  -p 3001:3001 \
  -p 3002:3002 \
  -p 3003:3003 \
  -e MONGO_URI=mongodb://host.docker.internal:27017/etnodb \
  -e NODE_ENV=production \
  ghcr.io/edalcin/etnodb:latest
```

### Push to GitHub Container Registry

```bash
docker push ghcr.io/edalcin/etnodb:latest
```

---

## Deployment to Unraid

### Prerequisites

- Unraid server with Docker support
- MongoDB container already running on Unraid
- Network connectivity between containers

### Deployment Steps

1. **Pull Image** in Unraid Docker UI:
   - Repository: `ghcr.io/edalcin/etnodb:latest`
   - Network: `bridge` or custom network with MongoDB

2. **Configure Environment Variables**:
   ```
   MONGO_URI=mongodb://<mongo-container-ip>:27017/etnodb
   NODE_ENV=production
   PORT_ACQUISITION=3001
   PORT_CURATION=3002
   PORT_PRESENTATION=3003
   ```

3. **Port Mapping**:
   - Container Port 3001 → Host Port 3001 (Acquisition)
   - Container Port 3002 → Host Port 3002 (Curation)
   - Container Port 3003 → Host Port 3003 (Presentation)

4. **Start Container**

5. **Access Contexts**:
   - Acquisition: `http://<unraid-ip>:3001`
   - Curation: `http://<unraid-ip>:3002`
   - Presentation: `http://<unraid-ip>:3003`

### Network Security

**Access Control** (handled at infrastructure level):
- Expose only port 3003 (presentation) to public network
- Restrict ports 3001 (acquisition) and 3002 (curation) to trusted network
- Use Unraid firewall rules or reverse proxy

---

## Common Tasks

### Add a New Route

**Example**: Add `/about` page to presentation context

1. **Edit `backend/src/contexts/presentation/routes.js`**:
```javascript
router.get('/about', (req, res) => {
  res.render('about', { title: 'Sobre' });
});
```

2. **Create `backend/src/contexts/presentation/views/about.ejs`**:
```html
<!DOCTYPE html>
<html>
  <head>
    <title><%= title %></title>
  </head>
  <body>
    <h1>Sobre o Projeto</h1>
    <p>Informações sobre a base de dados etnobotânica...</p>
  </body>
</html>
```

3. **Restart server** (or wait for nodemon to restart)

4. **Access**: http://localhost:3003/about

---

### Add a New Validation Rule

**Example**: Validate that year is not in the future

**Edit `backend/src/services/validation.js`**:
```javascript
function validateReference(data) {
  const errors = [];

  // ... existing validations ...

  // New validation: year must not be in the future
  const currentYear = new Date().getFullYear();
  if (data.ano > currentYear) {
    errors.push(`Ano não pode ser maior que ${currentYear}`);
  }

  return { isValid: errors.length === 0, errors };
}
```

---

### Add a New MongoDB Query

**Example**: Search by year range in presentation context

**Edit `backend/src/contexts/presentation/routes.js`**:
```javascript
router.get('/search/year-range', async (req, res) => {
  const { yearStart, yearEnd } = req.query;

  const query = {
    status: 'approved',
    ano: {
      $gte: parseInt(yearStart),
      $lte: parseInt(yearEnd)
    }
  };

  const results = await db.collection('etnodb').find(query).toArray();

  res.render('results', { results });
});
```

---

## Debugging

### Enable Debug Logging

**Set environment variable**:
```bash
DEBUG=etnodb:* npm run dev
```

**Add logging in code**:
```javascript
const debug = require('debug')('etnodb:acquisition');

debug('Processing reference submission', referenceData);
```

### MongoDB Query Debugging

**Log queries in development**:
```javascript
const mongodb = require('mongodb');
mongodb.Logger.setLevel('debug');
```

### Browser DevTools

- **Network Tab**: Inspect HTMX requests/responses
- **Console**: Check for JavaScript errors
- **Elements**: Inspect Alpine.js reactivity

---

## Performance Optimization

### Database

- **Ensure indexes exist** (see MongoDB Setup section)
- **Monitor slow queries**: Enable MongoDB profiling
  ```javascript
  db.setProfilingLevel(1, { slowms: 100 });
  db.system.profile.find().sort({ ts: -1 }).limit(5);
  ```

### Frontend

- **Tailwind CSS**: Purge unused styles in production
  ```javascript
  // tailwind.config.js
  module.exports = {
    content: ['./backend/src/contexts/**/*.ejs'],
    // ...
  };
  ```

### Docker Image

- **Minimize layers**: Combine RUN commands
- **Use .dockerignore**: Exclude `node_modules`, tests, docs
- **Multi-stage build**: Already implemented

---

## Troubleshooting

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3001`

**Solution**:
```bash
# Find process using port
lsof -i :3001  # Mac/Linux
netstat -ano | findstr :3001  # Windows

# Kill process or change port in .env
```

### MongoDB Connection Failed

**Error**: `MongoServerError: Authentication failed`

**Solution**:
- Check `MONGO_URI` in `.env`
- Verify MongoDB is running: `mongosh <connection-string>`
- Check network connectivity (Docker networks)

### HTMX Not Working

**Symptoms**: "Add Community" button doesn't add form blocks

**Solution**:
- Check browser console for errors
- Verify HTMX script is loaded: `<script src="https://unpkg.com/htmx.org@1.9.10"></script>`
- Inspect network tab for POST request/response

### Styles Not Updating

**Symptoms**: CSS changes not reflected in browser

**Solution**:
- Check Tailwind watch process is running
- Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
- Verify file is included in `tailwind.config.js` content array

---

## Additional Resources

### Documentation

- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/)
- [HTMX Documentation](https://htmx.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [EJS Template Syntax](https://ejs.co/#docs)

### Project-Specific Docs

- [Feature Spec](./spec.md) - Requirements and success criteria
- [Implementation Plan](./plan.md) - Technical approach
- [Data Model](./data-model.md) - MongoDB schema and validation
- [Research](./research.md) - Technology decision rationale
- [API Contracts](./contracts/) - Endpoint specifications

---

## Getting Help

### Issues

- Check existing documentation in `specs/001-web-interface/`
- Review API contracts for endpoint behavior
- Consult data-model.md for validation rules

### Contributing

- **Always commit to main branch** (per project requirement)
- Write tests for new functionality
- Follow existing code style (ESLint configuration)
- Update relevant documentation

---

## Next Steps

After completing this quickstart:

1. **Read the spec**: Understand functional requirements in [spec.md](./spec.md)
2. **Review contracts**: Familiarize yourself with API endpoints in [contracts/](./contracts/)
3. **Run tests**: Ensure everything works with `npm test`
4. **Explore code**: Navigate the project structure to understand organization
5. **Make a change**: Try adding a simple feature to get comfortable

---

## Summary

This quickstart guide covers:
- ✅ Development environment setup
- ✅ Project structure overview
- ✅ MongoDB configuration
- ✅ Development workflow
- ✅ Testing and debugging
- ✅ Production deployment
- ✅ Common tasks and troubleshooting

You're now ready to develop the ethnobotanical database web interface!
