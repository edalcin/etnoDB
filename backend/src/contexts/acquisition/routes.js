/**
 * Acquisition Context Routes
 *
 * Routes for data entry workflow:
 * - GET /: Main form page
 * - POST /community/add: Add community form fragment (HTMX)
 * - POST /plant/add/:communityIndex: Add plant form fragment (HTMX)
 * - POST /reference/submit: Submit complete reference
 */

const express = require('express');
const router = express.Router();
const { validateReference } = require('../../services/validation');
const { insertReference } = require('../../services/database');
const logger = require('../../shared/logger');

/**
 * GET / - Main data entry form
 */
router.get('/', (req, res) => {
  res.render('index', {
    pageTitle: 'Entrada de Dados',
    contextName: 'Entrada de Dados Etnobotânicos',
    contextDescription: 'Cadastro de referências científicas com dados de comunidades e plantas',
    showNavigation: true,
    errors: null,
    formData: null
  });
});

/**
 * POST /community/add - Return community form fragment for HTMX
 */
router.post('/community/add', (req, res) => {
  const communityIndex = parseInt(req.body.communityIndex) || 0;

  logger.acquisition(`Adding community form fragment #${communityIndex}`);

  res.render('partials/community-form', {
    communityIndex,
    community: null
  });
});

/**
 * POST /plant/add/:communityIndex - Return plant form fragment for HTMX
 */
router.post('/plant/add/:communityIndex', (req, res) => {
  const communityIndex = parseInt(req.params.communityIndex);
  const plantIndex = parseInt(req.body.plantIndex) || 0;

  logger.acquisition(`Adding plant form fragment to community #${communityIndex}, plant #${plantIndex}`);

  res.render('partials/plant-form', {
    communityIndex,
    plantIndex,
    plant: null
  });
});

/**
 * POST /reference/submit - Submit complete reference
 */
router.post('/reference/submit', async (req, res) => {
  try {
    logger.acquisition('Processing reference submission');

    // Parse form data into reference structure
    const referenceData = parseFormData(req.body);

    // Validate reference data
    const validation = validateReference(referenceData);

    if (!validation.isValid) {
      logger.acquisition(`Validation failed: ${validation.errors.length} errors`);

      return res.render('index', {
        pageTitle: 'Entrada de Dados',
        contextName: 'Entrada de Dados Etnobotânicos',
        contextDescription: 'Cadastro de referências científicas com dados de comunidades e plantas',
        showNavigation: true,
        errors: validation.errors,
        formData: req.body
      });
    }

    // Insert reference into database
    const inserted = await insertReference(referenceData);

    logger.acquisition(`Reference inserted successfully: ${inserted._id}`);

    // Render success page
    res.render('success', {
      pageTitle: 'Sucesso',
      contextName: 'Entrada de Dados Etnobotânicos',
      contextDescription: 'Cadastro de referências científicas',
      showNavigation: true,
      referenceId: inserted._id
    });

  } catch (error) {
    logger.error('Failed to submit reference:', error.message);

    res.render('index', {
      pageTitle: 'Entrada de Dados',
      contextName: 'Entrada de Dados Etnobotânicos',
      contextDescription: 'Cadastro de referências científicas',
      showNavigation: true,
      errors: ['Erro ao salvar: ' + error.message],
      formData: req.body
    });
  }
});

/**
 * Parse form data into reference structure
 * Handles nested arrays from HTML form (comunidades[0][plantas][0][field])
 * Converts comma-separated strings to arrays
 */
function parseFormData(formData) {
  // Parse basic reference fields
  const reference = {
    titulo: formData.titulo?.trim() || '',
    autores: parseCommaSeparated(formData.autores),
    ano: parseInt(formData.ano) || 0,
    resumo: formData.resumo?.trim() || '',
    DOI: formData.DOI?.trim() || '',
    comunidades: []
  };

  // Parse communities (nested structure)
  const comunidadesData = {};

  // Extract all community-related fields from flat form data
  Object.keys(formData).forEach(key => {
    const match = key.match(/^comunidades\[(\d+)\]\[(.+)\]$/);
    if (match) {
      const [, index, field] = match;
      const idx = parseInt(index);

      if (!comunidadesData[idx]) {
        comunidadesData[idx] = { plantas: {} };
      }

      // Check if it's a plant field
      const plantMatch = field.match(/^plantas\]\[(\d+)\]\[(.+)$/);
      if (plantMatch) {
        const [, plantIndex, plantField] = plantMatch;
        const pIdx = parseInt(plantIndex);

        if (!comunidadesData[idx].plantas[pIdx]) {
          comunidadesData[idx].plantas[pIdx] = {};
        }

        comunidadesData[idx].plantas[pIdx][plantField] = formData[key];
      } else {
        // Community field
        comunidadesData[idx][field] = formData[key];
      }
    }
  });

  // Convert to array structure
  Object.keys(comunidadesData).sort().forEach(idx => {
    const comunidade = comunidadesData[idx];

    // Parse plants array
    const plantas = [];
    Object.keys(comunidade.plantas).sort().forEach(pIdx => {
      const plant = comunidade.plantas[pIdx];

      plantas.push({
        nomeCientifico: parseCommaSeparated(plant.nomeCientifico),
        nomeVernacular: parseCommaSeparated(plant.nomeVernacular),
        tipoUso: parseCommaSeparated(plant.tipoUso)
      });
    });

    reference.comunidades.push({
      nome: comunidade.nome?.trim() || '',
      municipio: comunidade.municipio?.trim() || '',
      estado: comunidade.estado?.trim() || '',
      local: comunidade.local?.trim() || '',
      atividadesEconomicas: parseCommaSeparated(comunidade.atividadesEconomicas),
      observacoes: comunidade.observacoes?.trim() || '',
      plantas
    });
  });

  return reference;
}

/**
 * Convert comma-separated string to array
 * @param {string} str - Comma-separated string
 * @returns {Array<string>} Array of trimmed strings
 */
function parseCommaSeparated(str) {
  if (!str || typeof str !== 'string') return [];

  return str
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

module.exports = router;
