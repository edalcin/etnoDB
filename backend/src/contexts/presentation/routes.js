/**
 * Presentation Context Routes
 *
 * Routes for public search interface:
 * - GET /: Search page with filters and results
 */

const express = require('express');
const router = express.Router();
const { searchReferences } = require('../../services/database');
const { Status } = require('../../models/Reference');
const logger = require('../../shared/logger');

/**
 * GET / - Main search page with filters
 * Query parameters:
 * - comunidade: Community name (partial match)
 * - planta: Plant name - scientific or vernacular (partial match)
 * - estado: State (exact match)
 * - municipio: Municipality (exact match)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50)
 */
router.get('/', async (req, res) => {
  try {
    const {
      comunidade,
      planta,
      estado,
      municipio,
      page = 1,
      limit = 50
    } = req.query;

    // Build MongoDB query
    const query = buildSearchQuery({
      comunidade,
      planta,
      estado,
      municipio
    });

    logger.presentation('Search query:', JSON.stringify(query));

    // Execute search with pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;

    const searchResult = await searchReferences(query, pageNum, limitNum);

    logger.presentation(
      `Search returned ${searchResult.references.length} of ${searchResult.total} references (page ${pageNum})`
    );

    // Render search page with results
    res.render('index', {
      pageTitle: 'Busca Pública',
      contextName: 'Busca de Dados Etnobotânicos',
      contextDescription: 'Explore conhecimento tradicional sobre plantas',
      showNavigation: true,
      filters: {
        comunidade: comunidade || '',
        planta: planta || '',
        estado: estado || '',
        municipio: municipio || ''
      },
      results: searchResult.references,
      pagination: {
        page: searchResult.page,
        limit: searchResult.limit,
        total: searchResult.total,
        totalPages: searchResult.totalPages,
        hasNext: searchResult.page < searchResult.totalPages,
        hasPrev: searchResult.page > 1
      }
    });

  } catch (error) {
    logger.error('Search failed:', error.message);

    res.render('index', {
      pageTitle: 'Busca Pública',
      contextName: 'Busca de Dados Etnobotânicos',
      contextDescription: 'Explore conhecimento tradicional sobre plantas',
      showNavigation: true,
      filters: {
        comunidade: '',
        planta: '',
        estado: '',
        municipio: ''
      },
      results: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      },
      error: 'Erro ao realizar busca: ' + error.message
    });
  }
});

/**
 * Build MongoDB search query from filters
 * All filters use AND logic (all must match)
 * Only approved references are returned
 *
 * @param {Object} filters - Search filters
 * @returns {Object} MongoDB query
 */
function buildSearchQuery(filters) {
  const query = {
    status: Status.APPROVED  // Only show approved references
  };

  const conditions = [];

  // Community name filter (case-insensitive partial match)
  if (filters.comunidade && filters.comunidade.trim().length > 0) {
    conditions.push({
      'comunidades.nome': {
        $regex: sanitizeRegex(filters.comunidade),
        $options: 'i'
      }
    });
  }

  // Plant name filter (scientific OR vernacular, case-insensitive partial match)
  if (filters.planta && filters.planta.trim().length > 0) {
    const plantRegex = sanitizeRegex(filters.planta);
    conditions.push({
      $or: [
        {
          'comunidades.plantas.nomeCientifico': {
            $regex: plantRegex,
            $options: 'i'
          }
        },
        {
          'comunidades.plantas.nomeVernacular': {
            $regex: plantRegex,
            $options: 'i'
          }
        }
      ]
    });
  }

  // State filter (exact match, case-insensitive)
  if (filters.estado && filters.estado.trim().length > 0) {
    conditions.push({
      'comunidades.estado': {
        $regex: `^${sanitizeRegex(filters.estado)}$`,
        $options: 'i'
      }
    });
  }

  // Municipality filter (exact match, case-insensitive)
  if (filters.municipio && filters.municipio.trim().length > 0) {
    conditions.push({
      'comunidades.municipio': {
        $regex: `^${sanitizeRegex(filters.municipio)}$`,
        $options: 'i'
      }
    });
  }

  // Combine all conditions with AND
  if (conditions.length > 0) {
    query.$and = conditions;
  }

  return query;
}

/**
 * Sanitize regex input to prevent regex injection
 * Escapes special regex characters
 *
 * @param {string} str - Input string
 * @returns {string} Sanitized string
 */
function sanitizeRegex(str) {
  if (!str || typeof str !== 'string') return '';

  // Escape special regex characters
  return str.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = router;
