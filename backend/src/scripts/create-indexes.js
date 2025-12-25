/**
 * MongoDB Index Creation Script
 *
 * Creates indexes for optimal query performance
 * Run once during deployment or database setup
 *
 * Usage: node backend/src/scripts/create-indexes.js
 */

const database = require('../shared/database');
const config = require('../shared/config');
const logger = require('../shared/logger');

/**
 * Index definitions based on data-model.md
 */
const indexes = [
  // Text search on title
  {
    name: 'titulo_text',
    spec: { titulo: 'text' },
    options: { default_language: 'portuguese' }
  },

  // Status filter for curation context
  {
    name: 'status_1',
    spec: { status: 1 },
    options: {}
  },

  // Recent references for curation list
  {
    name: 'createdAt_-1',
    spec: { createdAt: -1 },
    options: {}
  },

  // State filter for presentation search
  {
    name: 'comunidades.estado_1',
    spec: { 'comunidades.estado': 1 },
    options: {}
  },

  // Municipality filter for presentation search
  {
    name: 'comunidades.municipio_1',
    spec: { 'comunidades.municipio': 1 },
    options: {}
  },

  // Community name text search
  {
    name: 'comunidades.nome_text',
    spec: { 'comunidades.nome': 'text' },
    options: { default_language: 'portuguese' }
  },

  // Plant names text search (scientific and vernacular)
  {
    name: 'plantas_text',
    spec: {
      'comunidades.plantas.nomeCientifico': 'text',
      'comunidades.plantas.nomeVernacular': 'text'
    },
    options: { default_language: 'portuguese' }
  }
];

/**
 * Create all indexes
 */
async function createIndexes() {
  try {
    logger.info('Starting index creation...');

    // Connect to database
    await database.connect();
    const collection = database.getCollection(config.database.collection);

    // Create each index
    for (const index of indexes) {
      try {
        logger.info(`Creating index: ${index.name}`);

        await collection.createIndex(index.spec, {
          ...index.options,
          name: index.name
        });

        logger.info(`✓ Index created: ${index.name}`);
      } catch (error) {
        // Index might already exist
        if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
          logger.info(`Index already exists: ${index.name}`);
        } else {
          throw error;
        }
      }
    }

    // List all indexes
    const existingIndexes = await collection.indexes();
    logger.info(`\nTotal indexes on collection "${config.database.collection}": ${existingIndexes.length}`);

    existingIndexes.forEach(idx => {
      logger.info(`  - ${idx.name}`);
    });

    logger.info('\n✓ Index creation complete');

  } catch (error) {
    logger.error('Failed to create indexes:', error.message);
    throw error;
  } finally {
    // Close database connection
    await database.close();
  }
}

/**
 * Drop all custom indexes (useful for testing)
 */
async function dropIndexes() {
  try {
    logger.info('Dropping all custom indexes...');

    await database.connect();
    const collection = database.getCollection(config.database.collection);

    // Drop all indexes except _id
    await collection.dropIndexes();

    logger.info('✓ All custom indexes dropped');

  } catch (error) {
    logger.error('Failed to drop indexes:', error.message);
    throw error;
  } finally {
    await database.close();
  }
}

// Run script if executed directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'drop') {
    dropIndexes()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    createIndexes()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = { createIndexes, dropIndexes };
