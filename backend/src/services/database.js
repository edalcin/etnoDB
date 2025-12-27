/**
 * Database Service
 *
 * CRUD operations for reference documents
 * Abstracts MongoDB operations with error handling
 */

const { ObjectId } = require('mongodb');
const database = require('../shared/database');
const config = require('../shared/config');
const logger = require('../shared/logger');
const { createReference, updateReference, Status } = require('../models/Reference');

/**
 * Insert new reference
 * @param {Object} referenceData - Reference data
 * @returns {Promise<Object>} Inserted document with _id
 */
async function insertReference(referenceData) {
  try {
    const collection = database.getCollection(config.database.collection);
    const reference = createReference(referenceData);

    const result = await collection.insertOne(reference);

    logger.database(`Reference inserted with ID: ${result.insertedId}`);

    return {
      ...reference,
      _id: result.insertedId
    };
  } catch (error) {
    logger.error('Failed to insert reference:', error.message);
    throw new Error(`Falha ao salvar referência: ${error.message}`);
  }
}

/**
 * Find references by query
 * @param {Object} query - MongoDB query
 * @param {Object} options - Query options (projection, limit, skip, sort)
 * @returns {Promise<Array>} Array of references
 */
async function findReferences(query = {}, options = {}) {
  try {
    const collection = database.getCollection(config.database.collection);

    const {
      projection = {},
      limit = 0,
      skip = 0,
      sort = { createdAt: -1 }
    } = options;

    const cursor = collection
      .find(query, { projection })
      .sort(sort);

    if (skip > 0) cursor.skip(skip);
    if (limit > 0) cursor.limit(limit);

    const references = await cursor.toArray();

    logger.database(`Found ${references.length} references`);

    return references;
  } catch (error) {
    logger.error('Failed to find references:', error.message);
    throw new Error(`Falha ao buscar referências: ${error.message}`);
  }
}

/**
 * Find reference by ID
 * @param {string|ObjectId} id - Reference ID
 * @returns {Promise<Object|null>} Reference document or null
 */
async function findReferenceById(id) {
  try {
    const collection = database.getCollection(config.database.collection);
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const reference = await collection.findOne({ _id: objectId });

    if (reference) {
      logger.database(`Found reference with ID: ${id}`);
    } else {
      logger.database(`Reference not found with ID: ${id}`);
    }

    return reference;
  } catch (error) {
    logger.error('Failed to find reference by ID:', error.message);
    throw new Error(`Falha ao buscar referência: ${error.message}`);
  }
}

/**
 * Update reference by ID
 * @param {string|ObjectId} id - Reference ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated reference
 */
async function updateReferenceById(id, updateData) {
  try {
    logger.database(`updateReferenceById called with ID: ${id}`);
    logger.database(`ID type: ${typeof id}`);

    const collection = database.getCollection(config.database.collection);
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    logger.database(`Converted to ObjectId: ${objectId}`);
    logger.database(`Update data has ${updateData.comunidades?.length || 0} communities`);

    const updatedDoc = updateReference(updateData);

    logger.database(`Executing findOneAndUpdate for ObjectId: ${objectId}`);

    // Debug: Check if document exists BEFORE update
    const existsBefore = await collection.findOne({ _id: objectId });
    console.log('DEBUG: Document exists before update?', existsBefore ? 'YES' : 'NO');
    if (existsBefore) {
      console.log('DEBUG: Existing document ID:', existsBefore._id.toString());
    }

    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      { $set: updatedDoc },
      { returnDocument: 'after' }
    );

    console.log('DEBUG: findOneAndUpdate result:', result);
    console.log('DEBUG: result.value:', result?.value);
    console.log('DEBUG: result.ok:', result?.ok);
    console.log('DEBUG: result.lastErrorObject:', result?.lastErrorObject);

    logger.database(`findOneAndUpdate result: ${result ? 'found' : 'null'}`);
    logger.database(`result.value: ${result?.value ? 'exists' : 'null/undefined'}`);

    if (!result.value) {
      logger.error(`Reference with ID ${id} (ObjectId: ${objectId}) NOT FOUND in database`);
      throw new Error('Referência não encontrada');
    }

    logger.database(`Reference updated successfully with ID: ${id}`);

    return result.value;
  } catch (error) {
    logger.error(`Failed to update reference ${id}:`, error.message);
    throw new Error(`Falha ao atualizar referência: ${error.message}`);
  }
}

/**
 * Update reference status only
 * @param {string|ObjectId} id - Reference ID
 * @param {string} status - New status (pending|approved|rejected)
 * @returns {Promise<Object>} Updated reference
 */
async function updateReferenceStatus(id, status) {
  try {
    // Validate status
    if (!Object.values(Status).includes(status)) {
      throw new Error('Status inválido');
    }

    const collection = database.getCollection(config.database.collection);
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await collection.findOneAndUpdate(
      { _id: objectId },
      {
        $set: {
          status,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new Error('Referência não encontrada');
    }

    logger.database(`Reference status updated to "${status}" for ID: ${id}`);

    return result.value;
  } catch (error) {
    logger.error('Failed to update reference status:', error.message);
    throw new Error(`Falha ao atualizar status: ${error.message}`);
  }
}

/**
 * Delete reference by ID
 * @param {string|ObjectId} id - Reference ID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteReferenceById(id) {
  try {
    const collection = database.getCollection(config.database.collection);
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await collection.deleteOne({ _id: objectId });

    if (result.deletedCount === 0) {
      throw new Error('Referência não encontrada');
    }

    logger.database(`Reference deleted with ID: ${id}`);

    return true;
  } catch (error) {
    logger.error('Failed to delete reference:', error.message);
    throw new Error(`Falha ao deletar referência: ${error.message}`);
  }
}

/**
 * Count references by query
 * @param {Object} query - MongoDB query
 * @returns {Promise<number>} Count of documents
 */
async function countReferences(query = {}) {
  try {
    const collection = database.getCollection(config.database.collection);
    const count = await collection.countDocuments(query);

    logger.database(`Counted ${count} references`);

    return count;
  } catch (error) {
    logger.error('Failed to count references:', error.message);
    throw new Error(`Falha ao contar referências: ${error.message}`);
  }
}

/**
 * Search references with pagination
 * @param {Object} query - MongoDB query
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Results per page
 * @returns {Promise<Object>} { references, total, page, totalPages }
 */
async function searchReferences(query = {}, page = 1, limit = 50) {
  try {
    const skip = (page - 1) * limit;

    const [references, total] = await Promise.all([
      findReferences(query, { limit, skip }),
      countReferences(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.database(`Search returned ${references.length} of ${total} total references (page ${page}/${totalPages})`);

    return {
      references,
      total,
      page,
      limit,
      totalPages
    };
  } catch (error) {
    logger.error('Failed to search references:', error.message);
    throw new Error(`Falha na busca: ${error.message}`);
  }
}

module.exports = {
  insertReference,
  findReferences,
  findReferenceById,
  updateReferenceById,
  updateReferenceStatus,
  deleteReferenceById,
  countReferences,
  searchReferences
};
