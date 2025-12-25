/**
 * MongoDB Connection Module
 *
 * Manages MongoDB connection lifecycle with automatic reconnection
 */

const { MongoClient } = require('mongodb');
const config = require('./config');
const logger = require('./logger');

class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  /**
   * Connect to MongoDB
   * @returns {Promise<MongoClient>}
   */
  async connect() {
    if (this.isConnected && this.client) {
      logger.database('Already connected to MongoDB');
      return this.client;
    }

    try {
      logger.database(`Connecting to MongoDB at ${config.mongoUri}`);

      this.client = new MongoClient(config.mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await this.client.connect();

      // Verify connection
      await this.client.db('admin').command({ ping: 1 });

      this.db = this.client.db(config.database.name);
      this.isConnected = true;

      logger.database('Successfully connected to MongoDB');
      return this.client;
    } catch (error) {
      logger.error('MongoDB connection failed:', error.message);
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
  }

  /**
   * Get database instance
   * @returns {Db}
   */
  getDb() {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Get collection instance
   * @param {string} collectionName
   * @returns {Collection}
   */
  getCollection(collectionName = config.database.collection) {
    return this.getDb().collection(collectionName);
  }

  /**
   * Close MongoDB connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this.client && this.isConnected) {
      logger.database('Closing MongoDB connection');
      await this.client.close();
      this.isConnected = false;
      this.client = null;
      this.db = null;
      logger.database('MongoDB connection closed');
    }
  }

  /**
   * Reconnect to MongoDB with retry logic
   * @param {number} maxRetries
   * @param {number} retryDelayMs
   * @returns {Promise<MongoClient>}
   */
  async reconnect(maxRetries = 5, retryDelayMs = 3000) {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        logger.database(`Reconnection attempt ${retries + 1}/${maxRetries}`);
        await this.connect();
        return this.client;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          logger.error(`Failed to reconnect after ${maxRetries} attempts`);
          throw error;
        }
        logger.database(`Retry in ${retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }
}

// Export singleton instance
module.exports = new Database();
