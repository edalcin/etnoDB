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

    // Debug: Log if communities are missing
    if (!referenceData.comunidades || referenceData.comunidades.length === 0) {
      logger.curation(`WARNING: No communities found in form data. Form keys: ${Object.keys(req.body).filter(k => k.includes('comunidades')).join(', ')}`);
    }

    // Validate reference data
    const validation = validateReference(referenceData);

    if (!validation.isValid) {
      logger.curation(`Validation failed: ${validation.errors.length} errors`);

      const reference = await findReferenceById(req.params.id);

      // Preserve original data when validation fails to avoid data loss
      // Only update metadata fields, keep communities from form data if they exist
      const preservedReference = {
        ...reference,
        titulo: referenceData.titulo || reference.titulo,
        autores: referenceData.autores || reference.autores,
        ano: referenceData.ano || reference.ano,
        resumo: referenceData.resumo !== undefined ? referenceData.resumo : reference.resumo,
        DOI: referenceData.DOI !== undefined ? referenceData.DOI : reference.DOI,
        // Keep communities from form if they exist, otherwise use original
        comunidades: (referenceData.comunidades && referenceData.comunidades.length > 0)
          ? referenceData.comunidades
          : reference.comunidades,
        _id: reference._id
      };

      return res.render('edit', {
        pageTitle: 'Editar Referência',
        contextName: 'Curadoria de Dados Etnobotânicos',
        contextDescription: 'Edição de referência científica',
        showNavigation: true,
        reference: preservedReference,
        errors: validation.errors
      });
    }

    // Filter empty plants before saving (only after validation passes)
    referenceData.comunidades = referenceData.comunidades.map(com => ({
      ...com,
      plantas: filterEmptyPlants(com.plantas)
    }));

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

  // Return HTML directly to avoid EJS include issues with nested partials
  const html = `
<div class="bg-gray-50 p-4 rounded border">
  <div class="flex items-center justify-between mb-3">
    <h5 class="text-sm font-semibold text-gray-700">Planta ${plantIndex + 1}</h5>
    <button
      type="button"
      class="text-red-600 hover:text-red-800 text-xs"
      @click="$el.closest('.bg-gray-50').remove()"
    >
      Remover
    </button>
  </div>

  <div class="space-y-3">
    <!-- Scientific Name -->
    <div>
      <label class="form-label text-sm" for="comunidades[${communityIndex}][plantas][${plantIndex}][nomeCientifico]">
        Nome Científico
        <span class="text-gray-500 text-xs">(separados por vírgula)</span>
      </label>
      <input
        type="text"
        id="comunidades[${communityIndex}][plantas][${plantIndex}][nomeCientifico]"
        name="comunidades[${communityIndex}][plantas][${plantIndex}][nomeCientifico]"
        class="form-input text-sm"
        placeholder="Foeniculum vulgare, Bidens pilosa L."
      >
    </div>

    <!-- Vernacular Name -->
    <div>
      <label class="form-label text-sm" for="comunidades[${communityIndex}][plantas][${plantIndex}][nomeVernacular]">
        Nome Vernacular
        <span class="text-gray-500 text-xs">(separados por vírgula)</span>
      </label>
      <input
        type="text"
        id="comunidades[${communityIndex}][plantas][${plantIndex}][nomeVernacular]"
        name="comunidades[${communityIndex}][plantas][${plantIndex}][nomeVernacular]"
        class="form-input text-sm"
        placeholder="erva-doce, picão, jiçara"
      >
    </div>

    <p class="text-xs text-gray-600 italic">* Pelo menos um nome (científico ou vernacular) é obrigatório</p>

    <!-- Type of Use -->
    <div>
      <label class="form-label text-sm" for="comunidades[${communityIndex}][plantas][${plantIndex}][tipoUso]">
        Tipo de Uso
        <span class="text-gray-500 text-xs">(separados por vírgula)</span>
      </label>
      <input
        type="text"
        id="comunidades[${communityIndex}][plantas][${plantIndex}][tipoUso]"
        name="comunidades[${communityIndex}][plantas][${plantIndex}][tipoUso]"
        class="form-input text-sm"
        placeholder="medicinal, alimentício, artesanato"
      >
    </div>
  </div>
</div>
  `;

  res.send(html);
});

/**
 * Filter out empty plants (plants without any names)
 * @param {Array} plantas - Array of plants
 * @returns {Array} Filtered array of plants
 */
function filterEmptyPlants(plantas) {
  return plantas.filter(plant => {
    const hasScientificName = Array.isArray(plant.nomeCientifico) &&
      plant.nomeCientifico.some(n => n && typeof n === 'string' && n.trim().length > 0);

    const hasVernacularName = Array.isArray(plant.nomeVernacular) &&
      plant.nomeVernacular.some(n => n && typeof n === 'string' && n.trim().length > 0);

    return hasScientificName || hasVernacularName;
  });
}

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
        nomeVernacular: parseCommaSeparated(plant.nomeVernacular).map(formatVernacularName),
        tipoUso: parseCommaSeparated(plant.tipoUso)
      });
    });

    reference.comunidades.push({
      nome: comunidade.nome?.trim() || '',
      tipo: comunidade.tipo?.trim() || '',
      municipio: comunidade.municipio?.trim() || '',
      estado: formatStateName(comunidade.estado || ''),
      local: comunidade.local?.trim() || '',
      atividadesEconomicas: parseCommaSeparated(comunidade.atividadesEconomicas),
      observacoes: comunidade.observacoes?.trim() || '',
      plantas: plantas  // Don't filter here - let validation catch empty plants
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

/**
 * Format vernacular names to lowercase with hyphens
 * @param {string} name - Vernacular name
 * @returns {string} Formatted vernacular name
 */
function formatVernacularName(name) {
  if (!name || typeof name !== 'string') return '';

  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Convert state abbreviation to full name
 * @param {string} state - State abbreviation or full name
 * @returns {string} Full state name
 */
function formatStateName(state) {
  if (!state || typeof state !== 'string') return '';

  const stateMap = {
    'AC': 'Acre',
    'AL': 'Alagoas',
    'AP': 'Amapá',
    'AM': 'Amazonas',
    'BA': 'Bahia',
    'CE': 'Ceará',
    'DF': 'Distrito Federal',
    'ES': 'Espírito Santo',
    'GO': 'Goiás',
    'MA': 'Maranhão',
    'MT': 'Mato Grosso',
    'MS': 'Mato Grosso do Sul',
    'MG': 'Minas Gerais',
    'PA': 'Pará',
    'PB': 'Paraíba',
    'PR': 'Paraná',
    'PE': 'Pernambuco',
    'PI': 'Piauí',
    'RJ': 'Rio de Janeiro',
    'RN': 'Rio Grande do Norte',
    'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia',
    'RR': 'Roraima',
    'SC': 'Santa Catarina',
    'SP': 'São Paulo',
    'SE': 'Sergipe',
    'TO': 'Tocantins'
  };

  const trimmed = state.trim().toUpperCase();

  // If it's a known abbreviation, convert it
  if (stateMap[trimmed]) {
    return stateMap[trimmed];
  }

  // Otherwise, return as-is (might already be full name)
  return state.trim();
}

module.exports = router;
