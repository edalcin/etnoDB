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
  logger.acquisition('Loading data entry form');

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
 * Handles nested arrays from HTML form (comunidades[0][plantas][0][field])
 * Converts comma-separated strings to arrays
 */
function parseFormData(formData) {
  // Check if comunidades is already parsed as JSON array
  if (Array.isArray(formData.comunidades)) {

    // Data is already in the correct format (sent as JSON)
    const reference = {
      titulo: formData.titulo?.trim() || '',
      autores: parseCommaSeparated(formData.autores).map(formatAuthorABNT),
      ano: parseInt(formData.ano) || 0,
      resumo: formData.resumo?.trim() || '',
      DOI: formData.DOI?.trim() || '',
      comunidades: formData.comunidades.map(com => ({
        nome: com.nome?.trim() || '',
        tipo: com.tipo?.trim() || '',
        municipio: com.municipio?.trim() || '',
        estado: formatStateName(com.estado || ''),
        local: com.local?.trim() || '',
        atividadesEconomicas: Array.isArray(com.atividadesEconomicas)
          ? com.atividadesEconomicas
          : parseCommaSeparated(com.atividadesEconomicas),
        observacoes: com.observacoes?.trim() || '',
        plantas: filterEmptyPlants((com.plantas || []).map(p => ({
          nomeCientifico: Array.isArray(p.nomeCientifico)
            ? p.nomeCientifico
            : parseCommaSeparated(p.nomeCientifico),
          nomeVernacular: (Array.isArray(p.nomeVernacular)
            ? p.nomeVernacular
            : parseCommaSeparated(p.nomeVernacular)).map(formatVernacularName),
          tipoUso: Array.isArray(p.tipoUso)
            ? p.tipoUso
            : parseCommaSeparated(p.tipoUso)
        })))
      }))
    };

    return reference;
  }

  // Original parsing for form-urlencoded format
  const reference = {
    titulo: formData.titulo?.trim() || '',
    autores: parseCommaSeparated(formData.autores).map(formatAuthorABNT),
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
      plantas: filterEmptyPlants(plantas)
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

/**
 * Convert author name to ABNT format
 * Format: SOBRENOME, N.
 * @param {string} author - Author name in any format
 * @returns {string} Author name in ABNT format
 */
function formatAuthorABNT(author) {
  if (!author || typeof author !== 'string') return '';

  author = author.trim();
  if (author.length === 0) return '';

  // Check if already in format "SOBRENOME, Nome" or "Sobrenome, Nome"
  if (author.includes(',')) {
    const [lastName, firstName] = author.split(',').map(part => part.trim());

    if (!firstName || firstName.length === 0) {
      // Only last name provided
      return lastName.toUpperCase();
    }

    // Extract first letter of first name
    const firstInitial = firstName.charAt(0).toUpperCase();
    return `${lastName.toUpperCase()}, ${firstInitial}.`;
  }

  // Format: "Nome Sobrenome" - need to reverse
  const parts = author.split(/\s+/).filter(p => p.length > 0);

  if (parts.length === 1) {
    // Only one word - treat as last name
    return parts[0].toUpperCase();
  }

  // Last part is the last name, rest is first names
  const lastName = parts[parts.length - 1];
  const firstNames = parts.slice(0, -1);
  const firstInitial = firstNames[0].charAt(0).toUpperCase();

  return `${lastName.toUpperCase()}, ${firstInitial}.`;
}

module.exports = router;
