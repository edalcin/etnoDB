/**
 * Main Server Entry Point
 *
 * Initializes all three application contexts on separate ports:
 * - Port 3001: Acquisition (data entry)
 * - Port 3002: Curation (data editing and approval)
 * - Port 3003: Presentation (public search)
 */

const path = require('path');
const express = require('express');
const config = require('./shared/config');
const database = require('./shared/database');
const logger = require('./shared/logger');

// Import context applications
const acquisitionApp = require('./contexts/acquisition/app');
const presentationApp = require('./contexts/presentation/app');
const curationApp = require('./contexts/curation/app');

/**
 * Initialize and start all three contexts
 */
async function startServer() {
  try {
    logger.server('Starting etnoDB server...');

    // Connect to MongoDB
    logger.server('Connecting to database...');
    await database.connect();
    logger.server('Database connected successfully');

    // All three contexts are now implemented (Phase 3-5 complete)
    // acquisitionApp, presentationApp, and curationApp are all real

    // Start all three contexts
    const servers = [];

    // Acquisition context (port 3001)
    const acquisitionServer = acquisitionApp.listen(config.ports.acquisition, () => {
      logger.server(`Acquisition context running on port ${config.ports.acquisition}`);
      console.log(`✓ Acquisition (Data Entry): http://localhost:${config.ports.acquisition}`);
    });
    servers.push(acquisitionServer);

    // Curation context (port 3002)
    const curationServer = curationApp.listen(config.ports.curation, () => {
      logger.server(`Curation context running on port ${config.ports.curation}`);
      console.log(`✓ Curation (Data Review): http://localhost:${config.ports.curation}`);
    });
    servers.push(curationServer);

    // Presentation context (port 3003)
    const presentationServer = presentationApp.listen(config.ports.presentation, () => {
      logger.server(`Presentation context running on port ${config.ports.presentation}`);
      console.log(`✓ Presentation (Public Search): http://localhost:${config.ports.presentation}`);
    });
    servers.push(presentationServer);

    logger.server('All contexts started successfully');

    // Graceful shutdown handling
    const shutdown = async (signal) => {
      logger.server(`${signal} received, shutting down gracefully...`);

      // Close all HTTP servers
      const closePromises = servers.map(server => {
        return new Promise((resolve) => {
          server.close(() => {
            logger.server('HTTP server closed');
            resolve();
          });
        });
      });

      await Promise.all(closePromises);

      // Close database connection
      await database.close();
      logger.server('Database connection closed');

      logger.server('Shutdown complete');
      process.exit(0);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Create placeholder Express app (temporary until Phase 3-5)
 * @param {string} contextName - Name of the context
 * @param {string} displayName - Display name in Portuguese
 * @returns {Express} Express application
 */
function createPlaceholderApp(contextName, displayName) {
  const app = express();

  // Serve static files
  app.use('/styles', express.static(path.join(__dirname, '../../frontend/dist/styles')));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      context: contextName,
      timestamp: new Date().toISOString()
    });
  });

  // Placeholder home page
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${displayName} - etnoDB</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 800px;
            margin: 100px auto;
            padding: 20px;
            text-align: center;
          }
          h1 { color: #16a34a; }
          .status { color: #666; margin-top: 20px; }
          .links { margin-top: 30px; }
          .links a { margin: 0 10px; color: #16a34a; text-decoration: none; }
          .links a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>${displayName}</h1>
        <p>Contexto ${contextName} do etnoDB</p>
        <div class="status">
          <p>✓ Servidor rodando corretamente</p>
          <p>Aguardando implementação das funcionalidades (Fase 3-5)</p>
        </div>
        <div class="links">
          <a href="http://localhost:3001">Entrada de Dados</a>
          <a href="http://localhost:3002">Curadoria</a>
          <a href="http://localhost:3003">Busca Pública</a>
        </div>
      </body>
      </html>
    `);
  });

  return app;
}

// Start server if running directly
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
