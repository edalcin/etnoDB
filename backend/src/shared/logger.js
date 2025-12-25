/**
 * Logger Utility
 *
 * Provides debug logging for different application contexts
 * Usage: DEBUG=etnodb:* npm run dev
 */

const debug = require('debug');

const loggers = {
  // Context-specific loggers
  acquisition: debug('etnodb:acquisition'),
  curation: debug('etnodb:curation'),
  presentation: debug('etnodb:presentation'),

  // Infrastructure loggers
  database: debug('etnodb:database'),
  server: debug('etnodb:server'),
  validation: debug('etnodb:validation'),

  // Generic logger
  info: debug('etnodb:info'),
  error: debug('etnodb:error'),
};

// Always enable error logging
loggers.error.enabled = true;

module.exports = loggers;
