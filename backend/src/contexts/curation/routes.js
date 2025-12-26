/**
 * Curation Context Routes
 *
 * Routes for data curation workflow:
 * - GET /: List all references with status filter
 * - GET /reference/edit/:id: Edit reference form
 * - PUT /reference/update/:id: Update reference content
 * - POST /reference/status/:id: Update reference status only
 * - POST /reference/:id/community/add: Add community fragment (HTMX)
 * - POST /reference/:id/plant/add/:communityIndex: Add plant fragment (HTMX)
 */

const express = require('express');
const router = express.Router();
const { findReferences, findReferenceById, updateReferenceById, updateReferenceStatus } = require('../../services/database');
const { validateReference } = require('../../services/validation');
const { Status } = require('../../models/Reference');
const logger = require('../../shared/logger');

/**
 * GET / - List all references with optional status filter and sorting
 */
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 50, sort = 'createdAt', order = 'desc' } = req.query;

    // Build query
    const query = {};
    if (status && status !== 'all' && Object.values(Status).includes(status)) {
      query.status = status;
    }

    // Build sort object
    const validSortFields = ['titulo', 'autores', 'ano', 'status', 'createdAt'];
    const sortField = validSortFields.includes(sort) ? sort : 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj = { [sortField]: sortOrder };

    // Fetch references with pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;

    const references = await findReferences(query, {
      limit: limitNum,
      skip,
      sort: sortObj,
      projection: {
        titulo: 1,
        autores: 1,
        ano: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1
      }
    });

    logger.curation(`Listing ${references.length} references (status: ${status || 'all'}, sort: ${sortField} ${order})`);

    res.render('index', {
      pageTitle: 'Curadoria',
      contextName: 'Curadoria de Dados Etnobotânicos',
      contextDescription: 'Revisão e aprovação de referências científicas',
      showNavigation: true,
      references,
      statusFilter: status || 'all',
      sortField,
      sortOrder: order,
      success: req.query.success === 'true'
    });

  } catch (error) {
    logger.error('Failed to list references:', error.message);

    res.render('index', {
      pageTitle: 'Curadoria',
      contextName: 'Curadoria de Dados Etnobotânicos',
      contextDescription: 'Revisão e aprovação de referências científicas',
      showNavigation: true,
      references: [],
      statusFilter: 'all',
      sortField: 'createdAt',
      sortOrder: 'desc',
      success: false,
      error: 'Erro ao listar referências: ' + error.message
    });
  }
});

/**
 * GET /reference/edit/:id - Edit reference form
 */
router.get('/reference/edit/:id', async (req, res) => {
  try {
    const reference = await findReferenceById(req.params.id);

    if (!reference) {
      return res.status(404).render('error', {
        message: 'Referência não encontrada',
        error: {}
      });
    }

    logger.curation(`Editing reference: ${reference._id}`);

    res.render('edit', {
      pageTitle: 'Editar Referência',
      contextName: 'Curadoria de Dados Etnobotânicos',
      contextDescription: 'Edição de referência científica',
      showNavigation: true,
      reference,
      errors: null
    });

  } catch (error) {
    logger.error('Failed to load reference for editing:', error.message);

    res.status(500).render('error', {
      message: 'Erro ao carregar referência: ' + error.message,
      error: {}
    });
  }
});

/**
 * PUT /reference/update/:id - Update reference content
 */
router.put('/reference/update/:id', async (req, res) => {
  await handleReferenceUpdate(req, res);
});

/**
 * POST /reference/update/:id - Update reference content (alternative method)
 */
router.post('/reference/update/:id', async (req, res) => {
  await handleReferenceUpdate(req, res);
});

/**
 * Handle reference update (shared logic for PUT and POST)
 */
async function handleReferenceUpdate(req, res) {
  try {
    // Parse form data (reuse parseFormData from acquisition)
    const referenceData = parseFormData(req.body);

    // Validate reference data
    const validation = validateReference(referenceData);

    if (!validation.isValid) {
      logger.curation(`Validation failed: ${validation.errors.length} errors`);

      const reference = await findReferenceById(req.params.id);

      return res.render('edit', {
        pageTitle: 'Editar Referência',
        contextName: 'Curadoria de Dados Etnobotânicos',
        contextDescription: 'Edição de referência científica',
        showNavigation: true,
        reference: { ...reference, ...referenceData, _id: reference._id },
        errors: validation.errors
      });
    }

    // Update reference
    const updated = await updateReferenceById(req.params.id, referenceData);

    logger.curation(`Reference updated successfully: ${updated._id}`);

    // Redirect to list with success message
    res.redirect('/?success=true');

  } catch (error) {
    logger.error('Failed to update reference:', error.message);

    const reference = await findReferenceById(req.params.id);

    res.render('edit', {
      pageTitle: 'Editar Referência',
      contextName: 'Curadoria de Dados Etnobotânicos',
      contextDescription: 'Edição de referência científica',
      showNavigation: true,
      reference,
      errors: ['Erro ao atualizar: ' + error.message]
    });
  }
}

/**
 * POST /reference/status/:id - Update reference status only
 */
router.post('/reference/status/:id', async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !Object.values(Status).includes(status)) {
      throw new Error('Status inválido');
    }

    const updated = await updateReferenceStatus(req.params.id, status);

    logger.curation(`Reference status updated to "${status}": ${updated._id}`);

    // Redirect back to edit page
    res.redirect(`/reference/edit/${req.params.id}`);

  } catch (error) {
    logger.error('Failed to update status:', error.message);

    res.status(500).render('error', {
      message: 'Erro ao atualizar status: ' + error.message,
      error: {}
    });
  }
});

/**
 * POST /reference/:id/community/add - Add community form fragment (HTMX)
 */
router.post('/reference/:id/community/add', (req, res) => {
  const communityIndex = parseInt(req.body.communityIndex) || 0;

  logger.curation(`Adding community form fragment #${communityIndex}`);

  res.render('partials/community-form', {
    communityIndex,
    community: null,
    referenceId: req.params.id
  });
});

/**
 * POST /reference/:id/plant/add/:communityIndex - Add plant form fragment (HTMX)
 */
router.post('/reference/:id/plant/add/:communityIndex', (req, res) => {
  const communityIndex = parseInt(req.params.communityIndex);
  const plantIndex = parseInt(req.body.plantIndex) || 0;

  logger.curation(`Adding plant form fragment to community #${communityIndex}, plant #${plantIndex}`);

  res.render('partials/plant-form', {
    communityIndex,
    plantIndex,
    plant: null
  });
});

/**
 * Parse form data into reference structure
 * (Same logic as acquisition context)
 */
function parseFormData(formData) {
  const reference = {
    titulo: formData.titulo?.trim() || '',
    autores: parseCommaSeparated(formData.autores),
    ano: parseInt(formData.ano) || 0,
    resumo: formData.resumo?.trim() || '',
    DOI: formData.DOI?.trim() || '',
    status: formData.status || Status.PENDING,
    comunidades: []
  };

  const comunidadesData = {};

  Object.keys(formData).forEach(key => {
    const match = key.match(/^comunidades\[(\d+)\]\[(.+)\]$/);
    if (match) {
      const [, index, field] = match;
      const idx = parseInt(index);

      if (!comunidadesData[idx]) {
        comunidadesData[idx] = { plantas: {} };
      }

      const plantMatch = field.match(/^plantas\]\[(\d+)\]\[(.+)$/);
      if (plantMatch) {
        const [, plantIndex, plantField] = plantMatch;
        const pIdx = parseInt(plantIndex);

        if (!comunidadesData[idx].plantas[pIdx]) {
          comunidadesData[idx].plantas[pIdx] = {};
        }

        comunidadesData[idx].plantas[pIdx][plantField] = formData[key];
      } else {
        comunidadesData[idx][field] = formData[key];
      }
    }
  });

  Object.keys(comunidadesData).sort().forEach(idx => {
    const comunidade = comunidadesData[idx];

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
      tipo: comunidade.tipo?.trim() || '',
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

function parseCommaSeparated(str) {
  if (!str || typeof str !== 'string') return [];

  return str
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

module.exports = router;
