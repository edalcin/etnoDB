/**
 * Input Sanitization Utilities
 *
 * Provides functions to sanitize user input to prevent XSS and injection attacks
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - Input string
 * @returns {string} HTML-escaped string
 */
function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';

  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return str.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char]);
}

/**
 * Limit string length
 * @param {string} str - Input string
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Truncated string
 */
function limitLength(str, maxLength) {
  if (!str || typeof str !== 'string') return '';

  return str.slice(0, maxLength);
}

/**
 * Remove leading/trailing whitespace
 * @param {string} str - Input string
 * @returns {string} Trimmed string
 */
function trimWhitespace(str) {
  if (!str || typeof str !== 'string') return '';

  return str.trim();
}

/**
 * Sanitize string: trim, limit length, optionally escape HTML
 * @param {string} str - Input string
 * @param {Object} options - Sanitization options
 * @param {number} options.maxLength - Maximum length (default: Infinity)
 * @param {boolean} options.escapeHtml - Whether to escape HTML (default: false)
 * @returns {string} Sanitized string
 */
function sanitizeString(str, options = {}) {
  const { maxLength = Infinity, escapeHtml: shouldEscape = false } = options;

  if (!str || typeof str !== 'string') return '';

  let sanitized = trimWhitespace(str);

  if (maxLength < Infinity) {
    sanitized = limitLength(sanitized, maxLength);
  }

  if (shouldEscape) {
    sanitized = escapeHtml(sanitized);
  }

  return sanitized;
}

/**
 * Sanitize array of strings
 * @param {Array<string>} arr - Input array
 * @param {Object} options - Sanitization options (same as sanitizeString)
 * @returns {Array<string>} Sanitized array
 */
function sanitizeArray(arr, options = {}) {
  if (!Array.isArray(arr)) return [];

  return arr
    .map(item => sanitizeString(item, options))
    .filter(item => item.length > 0);
}

/**
 * Validate and sanitize MongoDB ObjectId
 * @param {string} id - Input ID
 * @returns {string|null} Valid ObjectId string or null
 */
function sanitizeObjectId(id) {
  if (!id || typeof id !== 'string') return null;

  // MongoDB ObjectId is 24 hex characters
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;

  const trimmed = trimWhitespace(id);

  if (!objectIdRegex.test(trimmed)) return null;

  return trimmed;
}

/**
 * Sanitize number input
 * @param {any} value - Input value
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum allowed value
 * @param {number} options.max - Maximum allowed value
 * @param {number} options.default - Default value if invalid
 * @returns {number} Sanitized number
 */
function sanitizeNumber(value, options = {}) {
  const { min = -Infinity, max = Infinity, default: defaultValue = 0 } = options;

  const num = parseInt(value, 10);

  if (isNaN(num)) return defaultValue;

  if (num < min) return min;
  if (num > max) return max;

  return num;
}

/**
 * Strip potentially dangerous characters from filenames
 * @param {string} filename - Input filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return '';

  // Remove path traversal attempts and dangerous characters
  return filename
    .replace(/\.\./g, '')
    .replace(/[\/\\:*?"<>|]/g, '')
    .trim();
}

module.exports = {
  escapeHtml,
  limitLength,
  trimWhitespace,
  sanitizeString,
  sanitizeArray,
  sanitizeObjectId,
  sanitizeNumber,
  sanitizeFilename
};
