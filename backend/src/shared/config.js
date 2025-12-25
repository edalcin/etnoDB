/**
 * Configuration Loader
 *
 * Loads and validates environment variables from .env file
 */

require('dotenv').config();

const config = {
  // MongoDB Configuration
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/etnodb',

  // Application Ports
  ports: {
    acquisition: parseInt(process.env.PORT_ACQUISITION) || 3001,
    curation: parseInt(process.env.PORT_CURATION) || 3002,
    presentation: parseInt(process.env.PORT_PRESENTATION) || 3003,
  },

  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Database Configuration
  database: {
    name: 'etnodb',
    collection: 'etnodb',
  },
};

// Validate required configuration
const requiredConfig = [
  'mongoUri',
];

requiredConfig.forEach(key => {
  if (!config[key] && !config[key.split('.').reduce((obj, k) => obj?.[k], config)]) {
    throw new Error(`Missing required configuration: ${key}`);
  }
});

module.exports = config;
