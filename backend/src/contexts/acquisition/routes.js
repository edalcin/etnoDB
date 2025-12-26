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
  console.log('[DEBUG] GET / - Loading data entry form');
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
    console.log('\n========================================');
    console.log('[DEBUG] POST /reference/submit - FORM SUBMITTED');
    console.log('========================================');
    console.log('[DEBUG] Request body keys:', Object.keys(req.body));
    console.log('[DEBUG] Request body:', JSON.stringify(req.body, null, 2));
    logger.acquisition('Processing reference submission');

    // Parse form data into reference structure
    console.log('[DEBUG] About to parse form data...');
    const referenceData = parseFormData(req.body);
    console.log('[DEBUG] Form data parsed successfully!');

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
    console.log('\n========================================');
    console.log('[DEBUG] ERROR CAUGHT!');
    console.log('========================================');
    console.log('[DEBUG] Error message:', error.message);
    console.log('[DEBUG] Error stack:', error.stack);
    console.log('========================================\n');
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
  console.log('[DEBUG] parseFormData() called');

  // Check if comunidades is already parsed as JSON array
  if (Array.isArray(formData.comunidades)) {
    console.log('[DEBUG] Data already parsed as JSON! Using direct structure.');

    // Data is already in the correct format (sent as JSON)
    const reference = {
      titulo: formData.titulo?.trim() || '',
      autores: parseCommaSeparated(formData.autores).map(formatAuthorABNT),
      ano: parseInt(formData.ano) || 0,
      resumo: formData.resumo?.trim() || '',
      DOI: formData.DOI?.trim() || '',
      comunidades: formData.comunidades.map(com => ({
        nome: com.nome?.trim() || '',
        municipio: com.municipio?.trim() || '',
        estado: com.estado?.trim() || '',
        local: com.local?.trim() || '',
        atividadesEconomicas: Array.isArray(com.atividadesEconomicas)
          ? com.atividadesEconomicas
          : parseCommaSeparated(com.atividadesEconomicas),
        observacoes: com.observacoes?.trim() || '',
        plantas: (com.plantas || []).map(p => ({
          nomeCientifico: Array.isArray(p.nomeCientifico)
            ? p.nomeCientifico
            : parseCommaSeparated(p.nomeCientifico),
          nomeVernacular: Array.isArray(p.nomeVernacular)
            ? p.nomeVernacular
            : parseCommaSeparated(p.nomeVernacular),
          tipoUso: Array.isArray(p.tipoUso)
            ? p.tipoUso
            : parseCommaSeparated(p.tipoUso)
        }))
      }))
    };

    console.log('[DEBUG] Parsed communities (JSON):', reference.comunidades.length);
    console.log('[DEBUG] Full reference structure:', JSON.stringify(reference, null, 2));
    return reference;
  }

  // Original parsing for form-urlencoded format
  console.log('[DEBUG] Parsing form-urlencoded format');
  const comunidadeKeys = Object.keys(formData).filter(k => k.startsWith('comunidades'));
  console.log('[DEBUG] Community keys found:', comunidadeKeys.length, 'keys');
  console.log('[DEBUG] Community keys:', comunidadeKeys);

  // Parse basic reference fields
  const reference = {
    titulo: formData.titulo?.trim() || '',
    autores: parseCommaSeparated(formData.autores).map(formatAuthorABNT),
    ano: parseInt(formData.ano) || 0,
    resumo: formData.resumo?.trim() || '',
    DOI: formData.DOI?.trim() || '',
    comunidades: []
  };

  console.log('[DEBUG] Basic reference fields parsed:', {
    titulo: reference.titulo,
    autores: reference.autores,
    ano: reference.ano
  });

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

  console.log('[DEBUG] Parsed communities:', reference.comunidades.length);
  console.log('[DEBUG] Full reference structure:', JSON.stringify(reference, null, 2));

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
