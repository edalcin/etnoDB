/**
 * Statistics Service
 *
 * SQL/JSON1 aggregation queries for dashboard statistics, replacing the former
 * MongoDB aggregation pipelines (ADR-005). All queries default to only
 * processing approved evidences (`filters.status` overrides the default).
 *
 * `filters` keeps the same shape the presentation routes already build
 * (`buildFilters` in contexts/presentation/routes.js), so callers are
 * unchanged:
 *   {
 *     status?: string,                          // default Status.APPROVED
 *     ano?: number | { $gte?: number, $lte?: number },
 *     'comunidades.estado'?: string,
 *     'comunidades.tipo'?: string
 *   }
 */

const database = require('../shared/database');
const logger = require('../shared/logger');
const { Status } = require('../models/Evidence');
const vocabulary = require('./vocabulary');

/**
 * Ensure the shared SQLite connection is open (idempotent, synchronous).
 * @returns {import('better-sqlite3').Database}
 */
function getDb() {
  if (!database.isConnected) {
    database.connect();
  }
  return database.getConnection();
}

function statusFilter(filters) {
  return filters.status !== undefined && filters.status !== null ? filters.status : Status.APPROVED;
}

/**
 * Append `ano`/`ano.$gte`/`ano.$lte` clauses (top-level generated column) to
 * an existing clauses/params accumulator.
 */
function anoClauses(filters, clauses, params) {
  if (filters.ano === undefined || filters.ano === null) return;

  if (typeof filters.ano === 'object') {
    if (filters.ano.$gte !== undefined && filters.ano.$gte !== null) {
      clauses.push('ano >= ?');
      params.push(Number(filters.ano.$gte));
    }
    if (filters.ano.$lte !== undefined && filters.ano.$lte !== null) {
      clauses.push('ano <= ?');
      params.push(Number(filters.ano.$lte));
    }
  } else {
    clauses.push('ano = ?');
    params.push(Number(filters.ano));
  }
}

/**
 * @param {Object} filters
 * @param {boolean} includeStatus - false for getEvidenceCountByStatus (wants all statuses)
 * @returns {{sql: string, params: Array}} WHERE clause (or '') + params
 */
function buildDocsWhere(filters = {}, includeStatus = true) {
  const clauses = [];
  const params = [];

  if (includeStatus) {
    clauses.push('status = ?');
    params.push(statusFilter(filters));
  }

  anoClauses(filters, clauses, params);

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

/**
 * `docs` CTE: documents matching status/ano filters.
 */
function docsCte(filters = {}, includeStatus = true) {
  const { sql: whereSql, params } = buildDocsWhere(filters, includeStatus);
  return {
    sql: `docs AS (SELECT id, doc, status, ano FROM ${database.TABLE} ${whereSql})`,
    params
  };
}

/**
 * `comunidades.estado`/`comunidades.tipo` filter fragment, ANDed onto a
 * `json_each(doc,'$.comunidades') AS com` clause (`com.value` = one community).
 */
function buildComunidadeFilter(filters = {}, { includeEstado = true, includeTipo = true } = {}) {
  const clauses = [];
  const params = [];

  if (includeEstado && filters['comunidades.estado']) {
    clauses.push("json_extract(com.value,'$.estado') = ?");
    params.push(filters['comunidades.estado']);
  }

  if (includeTipo && filters['comunidades.tipo']) {
    // Picking a Termo Preferencial in the facet has to find the Evidências that
    // recorded any other Rótulo of the same Concept, or the chart and the list
    // stop agreeing on how many there are (ADR-003).
    const labels = vocabulary.expandLabels(getDb(), filters['comunidades.tipo']);
    const placeholders = labels.map(() => 'LOWER(?)').join(', ');
    clauses.push(`LOWER(json_extract(com.value,'$.tipo')) IN (${placeholders})`);
    params.push(...labels);
  }

  return {
    sql: clauses.length ? `AND ${clauses.join(' AND ')}` : '',
    params
  };
}

/**
 * `comunidades` CTE: one row per (document, community) pair, filtered by
 * comunidades.estado/comunidades.tipo when present. Depends on `docs`.
 */
function comunidadesCte(filters = {}, comOptions) {
  const { sql: comWhere, params } = buildComunidadeFilter(filters, comOptions);
  return {
    sql: `comunidades AS (
      SELECT docs.id AS evidence_id, docs.doc AS evidence_doc, com.value AS comunidade
      FROM docs, json_each(docs.doc, '$.comunidades') AS com
      WHERE 1=1 ${comWhere}
    )`,
    params
  };
}

/**
 * Validate if author name is complete and valid
 * Valid authors must have:
 * - At least one word with 3+ letters (surname)
 * - Format like "SURNAME, N." or "SURNAME, Name" (comma + initial/name)
 * Invalid patterns:
 * - Only initials like "A., P." or "A. P."
 * - Single word without initial like "MOREIRA"
 * @param {string} author - Author name to validate
 * @returns {boolean} True if valid
 */
function isValidAuthor(author) {
  if (!author || typeof author !== 'string') return false;

  const trimmed = author.trim();

  // Too short to be valid
  if (trimmed.length < 4) return false;

  // Check if it's only initials (e.g., "A., P." or "A. P." or "A.,P.")
  // Pattern: only single letters followed by dots, commas, or spaces
  const onlyInitialsPattern = /^([A-ZÀ-Ú]\s*[.,]\s*)+$/i;
  if (onlyInitialsPattern.test(trimmed)) return false;

  // If no comma, it might be invalid (just a surname)
  if (!trimmed.includes(',')) {
    // Allow "Name Surname" format (at least 2 words, first with 2+ chars)
    const words = trimmed.split(/\s+/);
    if (words.length < 2) return false;
    // First word should be at least 2 characters (not just initial)
    if (words[0].replace(/[.,]/g, '').length < 2) return false;
  } else {
    // Has comma - check if it has proper surname before comma
    const beforeComma = trimmed.split(',')[0].trim();
    // Surname should have at least 3 letters
    if (beforeComma.replace(/[^a-zA-ZÀ-Úà-ú]/g, '').length < 3) return false;

    // After comma should have at least one letter (initial or name)
    const afterComma = trimmed.split(',')[1];
    if (!afterComma || !/[A-ZÀ-Úa-zà-ú]/.test(afterComma)) return false;
  }

  return true;
}

/**
 * Get top N most used plants across all communities
 * @param {number} limit - Number of results
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Array of {nomeCientifico, nomeVernacular, count, communityCount, evidenceCount}
 */
async function getTopPlants(limit = 10, filters = {}) {
  try {
    const db = getDb();
    const docs = docsCte(filters);
    const com = comunidadesCte(filters);

    const sql = `
      WITH ${docs.sql},
      ${com.sql},
      plantas AS (
        SELECT comunidades.evidence_id, comunidades.comunidade, pl.value AS planta
        FROM comunidades, json_each(comunidades.comunidade, '$.plantas') AS pl
      ),
      nomes AS (
        SELECT plantas.evidence_id, plantas.comunidade, plantas.planta, nc.value AS nomeCientifico
        FROM plantas, json_each(plantas.planta, '$.nomeCientifico') AS nc
        WHERE nc.value IS NOT NULL AND nc.value != ''
      )
      SELECT
        nomeCientifico,
        MAX(json_extract(planta,'$.nomeVernacular[0]')) AS nomeVernacular,
        COUNT(*) AS count,
        COUNT(DISTINCT json_extract(comunidade,'$.nome')) AS communityCount,
        COUNT(DISTINCT evidence_id) AS evidenceCount
      FROM nomes
      GROUP BY nomeCientifico
      ORDER BY count DESC
      LIMIT ?
    `;

    const rows = db.prepare(sql).all(...docs.params, ...com.params, limit);
    const result = rows.map((row) => ({
      nomeCientifico: row.nomeCientifico,
      nomeVernacular: row.nomeVernacular,
      count: row.count,
      communityCount: row.communityCount,
      evidenceCount: row.evidenceCount
    }));

    logger.database(`Top plants query returned ${result.length} results`);

    return result;
  } catch (error) {
    logger.error('Top plants aggregation failed:', error.message);
    throw error;
  }
}

/**
 * Get total number of unique communities
 * @param {Object} filters - Query filters
 * @returns {Promise<Object>} {total, byType}
 */
async function getCommunityCount(filters = {}) {
  try {
    const db = getDb();
    const docs = docsCte(filters);
    const com = comunidadesCte(filters);

    // `comunidades.tipo` is Vocabulário Controlado too: fold each type into its
    // Termo Preferencial before counting, so two labels of one Concept are one
    // slice (ADR-003). The fold has to happen after the DISTINCT-community
    // grouping, hence the outer join over `grouped`.
    const mapped = vocabulary.hasLabelMap(db);
    const tipo = vocabulary.labelMapJoin('grouped.tipo', 'lm_tipo', mapped);

    const sql = `
      WITH ${docs.sql},
      ${com.sql},
      grouped AS (
        SELECT
          json_extract(comunidade,'$.nome') AS nome,
          json_extract(comunidade,'$.estado') AS estado,
          COALESCE(json_extract(comunidade,'$.municipio'), '') AS municipio,
          MAX(json_extract(comunidade,'$.tipo')) AS tipo
        FROM comunidades
        GROUP BY nome, estado, municipio
      )
      SELECT
        grouped.tipo AS tipo,
        ${mapped ? 'lm_tipo.concept_id' : 'NULL'} AS conceptId,
        ${mapped ? 'lm_tipo.pref_label' : 'NULL'} AS prefLabel
      FROM grouped
      ${tipo.join}
    `;

    const rows = db.prepare(sql).all(...docs.params, ...com.params);
    logger.database('Community count aggregation completed');

    if (rows.length === 0) {
      return { total: 0, byType: [] };
    }

    // Agregar contagem por tipo. A community whose Concept has no publicly
    // showable label still counts in the total, but never names a slice —
    // CARE access levels outrank the chart.
    const typeCount = {};
    rows.forEach((row) => {
      if (row.conceptId !== null && row.prefLabel === null) return;
      const tipoLabel = row.prefLabel || row.tipo || 'Não especificado';
      typeCount[tipoLabel] = (typeCount[tipoLabel] || 0) + 1;
    });

    const byType = Object.entries(typeCount).map(([tipoLabel, count]) => ({ tipo: tipoLabel, count }));

    return {
      total: rows.length,
      byType
    };
  } catch (error) {
    logger.error('Community count failed:', error.message);
    throw error;
  }
}

/**
 * Get evidence count by status
 * @param {Object} filters - Query filters
 * @returns {Promise<Object>} {approved, pending, rejected, total}
 */
async function getEvidenceCountByStatus(filters = {}) {
  try {
    const db = getDb();

    // Remove status filter for this query (we want counts for all statuses)
    const { status, ...otherFilters } = filters;
    const docs = docsCte(otherFilters, false);
    const hasComFilter = Boolean(otherFilters['comunidades.estado'] || otherFilters['comunidades.tipo']);

    let sql;
    let params;

    if (hasComFilter) {
      const comFilter = buildComunidadeFilter(otherFilters);
      sql = `
        WITH ${docs.sql}
        SELECT status, COUNT(*) AS count FROM (
          SELECT DISTINCT docs.id AS id, docs.status AS status
          FROM docs, json_each(docs.doc, '$.comunidades') AS com
          WHERE 1=1 ${comFilter.sql}
        )
        GROUP BY status
      `;
      params = [...docs.params, ...comFilter.params];
    } else {
      sql = `
        WITH ${docs.sql}
        SELECT status, COUNT(*) AS count FROM docs GROUP BY status
      `;
      params = docs.params;
    }

    const rows = db.prepare(sql).all(...params);

    const counts = {
      approved: 0,
      pending: 0,
      rejected: 0,
      total: 0
    };

    rows.forEach((row) => {
      counts[row.status] = row.count;
      counts.total += row.count;
    });

    logger.database('Evidence count by status completed');
    return counts;
  } catch (error) {
    logger.error('Evidence count by status failed:', error.message);
    throw error;
  }
}

/**
 * Get top authors by number of publications
 * @param {number} limit - Number of results
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Array of {author, count, samplePublications}
 */
async function getTopAuthors(limit = 10, filters = {}) {
  try {
    const db = getDb();
    const docs = docsCte(filters);
    const hasComFilter = Boolean(filters['comunidades.estado'] || filters['comunidades.tipo']);

    let qualifyingCte;
    let qualifyingParams;

    if (hasComFilter) {
      const comFilter = buildComunidadeFilter(filters);
      qualifyingCte = `qualifying AS (
        SELECT DISTINCT docs.id AS evidence_id, docs.doc AS doc
        FROM docs, json_each(docs.doc, '$.comunidades') AS com
        WHERE 1=1 ${comFilter.sql}
      )`;
      qualifyingParams = comFilter.params;
    } else {
      qualifyingCte = `qualifying AS (SELECT id AS evidence_id, doc FROM docs)`;
      qualifyingParams = [];
    }

    const sql = `
      WITH ${docs.sql},
      ${qualifyingCte},
      autores AS (
        SELECT qualifying.evidence_id, json_extract(qualifying.doc,'$.titulo') AS titulo, au.value AS autor
        FROM qualifying, json_each(qualifying.doc, '$.autores') AS au
        WHERE LENGTH(au.value) >= 4
      )
      SELECT
        autor,
        COUNT(*) AS count,
        (
          SELECT json_group_array(titulo)
          FROM (SELECT DISTINCT titulo FROM autores a2 WHERE a2.autor = autores.autor)
        ) AS publicationsJson
      FROM autores
      GROUP BY autor
      ORDER BY count DESC
      LIMIT ?
    `;

    const rows = db.prepare(sql).all(...docs.params, ...qualifyingParams, limit * 3);

    const candidates = rows.map((row) => ({
      author: row.autor,
      count: row.count,
      samplePublications: JSON.parse(row.publicationsJson || '[]').slice(0, 3)
    }));

    // Apply strict validation filter and limit
    const validAuthors = candidates.filter((item) => isValidAuthor(item.author)).slice(0, limit);

    logger.database(`Top authors query returned ${validAuthors.length} valid results (from ${candidates.length} raw)`);

    return validAuthors;
  } catch (error) {
    logger.error('Top authors failed:', error.message);
    throw error;
  }
}

/**
 * Get number of evidences by state (for heat map)
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Array of {state, count}
 */
async function getEvidencesByState(filters = {}) {
  try {
    const db = getDb();
    const docs = docsCte(filters);
    const com = comunidadesCte(filters, { includeEstado: false });

    const sql = `
      WITH ${docs.sql},
      ${com.sql}
      SELECT json_extract(comunidade,'$.estado') AS state, COUNT(DISTINCT evidence_id) AS count
      FROM comunidades
      GROUP BY state
      ORDER BY count DESC
    `;

    const rows = db.prepare(sql).all(...docs.params, ...com.params);
    logger.database(`Evidences by state returned ${rows.length} states`);

    return rows.map((row) => ({ state: row.state, count: row.count }));
  } catch (error) {
    logger.error('Evidences by state failed:', error.message);
    throw error;
  }
}

/**
 * Get number of unique communities by state (for heat map)
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Array of {state, count}
 */
async function getCommunitiesByState(filters = {}) {
  try {
    const db = getDb();
    const docs = docsCte(filters);
    const com = comunidadesCte(filters, { includeEstado: false });

    const sql = `
      WITH ${docs.sql},
      ${com.sql}
      SELECT state, COUNT(*) AS count FROM (
        SELECT DISTINCT
          json_extract(comunidade,'$.estado') AS state,
          json_extract(comunidade,'$.nome') AS nome,
          COALESCE(json_extract(comunidade,'$.municipio'), '') AS municipio
        FROM comunidades
      )
      GROUP BY state
      ORDER BY count DESC
    `;

    const rows = db.prepare(sql).all(...docs.params, ...com.params);
    logger.database(`Communities by state returned ${rows.length} states`);

    return rows.map((row) => ({ state: row.state, count: row.count }));
  } catch (error) {
    logger.error('Communities by state failed:', error.message);
    throw error;
  }
}

/**
 * Get number of unique plants by state (for heat map)
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Array of {state, count}
 */
async function getPlantsByState(filters = {}) {
  try {
    const db = getDb();
    const docs = docsCte(filters);
    const com = comunidadesCte(filters, { includeEstado: false });

    const sql = `
      WITH ${docs.sql},
      ${com.sql},
      plantas AS (
        SELECT comunidades.comunidade, pl.value AS planta
        FROM comunidades, json_each(comunidades.comunidade, '$.plantas') AS pl
      ),
      nomes AS (
        SELECT plantas.comunidade, nc.value AS nomeCientifico
        FROM plantas, json_each(plantas.planta, '$.nomeCientifico') AS nc
        WHERE nc.value IS NOT NULL AND nc.value != ''
      )
      SELECT state, COUNT(*) AS count FROM (
        SELECT DISTINCT json_extract(comunidade,'$.estado') AS state, nomeCientifico
        FROM nomes
      )
      GROUP BY state
      ORDER BY count DESC
    `;

    const rows = db.prepare(sql).all(...docs.params, ...com.params);
    logger.database(`Plants by state returned ${rows.length} states`);

    return rows.map((row) => ({ state: row.state, count: row.count }));
  } catch (error) {
    logger.error('Plants by state failed:', error.message);
    throw error;
  }
}

/**
 * Get top communities by number of plants
 * @param {number} limit - Number of results
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Array of {community, estado, municipio, plantCount}
 */
async function getTopCommunitiesByPlants(limit = 10, filters = {}) {
  try {
    const db = getDb();
    const docs = docsCte(filters);
    const com = comunidadesCte(filters);

    const sql = `
      WITH ${docs.sql},
      ${com.sql}
      SELECT
        json_extract(comunidade,'$.nome') AS community,
        json_extract(comunidade,'$.estado') AS estado,
        COALESCE(json_extract(comunidade,'$.municipio'), 'Não especificado') AS municipio,
        SUM(COALESCE(json_array_length(comunidade,'$.plantas'), 0)) AS plantCount
      FROM comunidades
      GROUP BY community, estado, municipio
      ORDER BY plantCount DESC
      LIMIT ?
    `;

    const rows = db.prepare(sql).all(...docs.params, ...com.params, limit);
    logger.database(`Top communities by plants returned ${rows.length} results`);

    return rows.map((row) => ({
      community: row.community,
      estado: row.estado,
      municipio: row.municipio,
      plantCount: row.plantCount
    }));
  } catch (error) {
    logger.error('Top communities by plants failed:', error.message);
    throw error;
  }
}

/**
 * Get evidences with most communities
 * @param {number} limit - Number of results
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Array of {titulo, autores, ano, communityCount}
 */
async function getTopEvidencesByCommunities(limit = 10, filters = {}) {
  try {
    const db = getDb();
    const docs = docsCte(filters);
    const comFilter = buildComunidadeFilter(filters);

    const sql = `
      WITH ${docs.sql}
      SELECT
        json_extract(doc,'$.titulo') AS titulo,
        json_extract(doc,'$.autores') AS autoresJson,
        ano,
        (
          SELECT COUNT(*) FROM json_each(doc,'$.comunidades') AS com WHERE 1=1 ${comFilter.sql}
        ) AS communityCount
      FROM docs
      ORDER BY communityCount DESC
      LIMIT ?
    `;

    const rows = db.prepare(sql).all(...docs.params, ...comFilter.params, limit);
    const result = rows.map((row) => ({
      titulo: row.titulo,
      autores: JSON.parse(row.autoresJson || '[]'),
      ano: row.ano,
      communityCount: row.communityCount
    }));

    logger.database(`Top evidences by communities returned ${result.length} results`);

    return result;
  } catch (error) {
    logger.error('Top evidences by communities failed:', error.message);
    throw error;
  }
}

/**
 * Get evidences with most plants
 * @param {number} limit - Number of results
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Array of {titulo, autores, ano, plantCount}
 */
async function getTopEvidencesByPlants(limit = 10, filters = {}) {
  try {
    const db = getDb();
    const docs = docsCte(filters);
    const comFilter = buildComunidadeFilter(filters);

    const sql = `
      WITH ${docs.sql}
      SELECT
        json_extract(doc,'$.titulo') AS titulo,
        json_extract(doc,'$.autores') AS autoresJson,
        ano,
        (
          SELECT COALESCE(SUM(json_array_length(com.value,'$.plantas')), 0)
          FROM json_each(doc,'$.comunidades') AS com
          WHERE 1=1 ${comFilter.sql}
        ) AS plantCount
      FROM docs
      ORDER BY plantCount DESC
      LIMIT ?
    `;

    const rows = db.prepare(sql).all(...docs.params, ...comFilter.params, limit);
    const result = rows.map((row) => ({
      titulo: row.titulo,
      autores: JSON.parse(row.autoresJson || '[]'),
      ano: row.ano,
      plantCount: row.plantCount
    }));

    logger.database(`Top evidences by plants returned ${result.length} results`);

    return result;
  } catch (error) {
    logger.error('Top evidences by plants failed:', error.message);
    throw error;
  }
}

/**
 * Get Sankey diagram data: community type -> use type relationships
 *
 * Both axes are Vocabulário Controlado, so both are folded into their Termo
 * Preferencial before anything is counted (ADR-003). Order matters: the Top-N
 * cut runs AFTER the fold, otherwise `alimentar` and `alimentação` compete for
 * separate slots and can push a genuinely distinct use out of the chart.
 *
 * @param {Object} filters - Query filters
 * @param {number} limitUsos - Limit to top N use types (default: 10)
 * @returns {Promise<Object>} { links, useTypeOrder, communityTypeOrder, variants }
 */
async function getSankeyData(filters = {}, limitUsos = 10) {
  try {
    const db = getDb();
    const docs = docsCte(filters);
    const com = comunidadesCte(filters);
    const baseParams = [...docs.params, ...com.params];

    const mapped = vocabulary.hasLabelMap(db);
    const uso = vocabulary.labelMapJoin('tu.value', 'lm_uso', mapped);
    const tipo = vocabulary.labelMapJoin(
      "json_extract(plantas.comunidade,'$.tipo')",
      'lm_tipo',
      mapped
    );

    // `usos` carries both forms: the preferred one drives every GROUP BY, the
    // raw one only feeds the tooltip that discloses what was merged.
    const usosCte = `
      plantas AS (
        SELECT comunidades.comunidade, pl.value AS planta
        FROM comunidades, json_each(comunidades.comunidade, '$.plantas') AS pl
      ),
      usos AS (
        SELECT
          COALESCE(${tipo.expr}, 'Não especificado') AS tipoComunidade,
          ${uso.expr} AS tipoUso,
          tu.value AS tipoUsoRaw
        FROM plantas
        ${tipo.join}, json_each(plantas.planta, '$.tipoUso') AS tu
        ${uso.join}
        WHERE tu.value IS NOT NULL AND tu.value != ''
          ${uso.where ? `AND ${uso.where}` : ''}
          ${tipo.where ? `AND ${tipo.where}` : ''}
      )
    `;

    // Top N use types by frequency — counted per concept, not per label.
    const topUsosRows = db
      .prepare(`
        WITH ${docs.sql}, ${com.sql}, ${usosCte}
        SELECT tipoUso, COUNT(*) AS total FROM usos GROUP BY tipoUso ORDER BY total DESC LIMIT ?
      `)
      .all(...baseParams, limitUsos);

    const useTypeOrder = topUsosRows.map((row) => row.tipoUso);

    if (useTypeOrder.length === 0) {
      return { links: [], useTypeOrder: [], communityTypeOrder: [], variants: {} };
    }

    const usoPlaceholders = useTypeOrder.map(() => '?').join(', ');

    const topCommunityRows = db
      .prepare(`
        WITH ${docs.sql}, ${com.sql}, ${usosCte}
        SELECT tipoComunidade, COUNT(*) AS total
        FROM usos
        WHERE tipoUso IN (${usoPlaceholders})
        GROUP BY tipoComunidade
        ORDER BY total DESC
      `)
      .all(...baseParams, ...useTypeOrder);

    const communityTypeOrder = topCommunityRows.map((row) => row.tipoComunidade);

    const links = db
      .prepare(`
        WITH ${docs.sql}, ${com.sql}, ${usosCte}
        SELECT
          tipoComunidade AS source,
          tipoUso AS target,
          COUNT(*) AS value
        FROM usos
        WHERE tipoUso IN (${usoPlaceholders})
        GROUP BY source, target
      `)
      .all(...baseParams, ...useTypeOrder);

    let variants = {};
    if (mapped) {
      const variantRows = db
        .prepare(`
          WITH ${docs.sql}, ${com.sql}, ${usosCte}
          SELECT DISTINCT tipoUso AS display, tipoUsoRaw AS raw
          FROM usos
          WHERE tipoUso IN (${usoPlaceholders})
        `)
        .all(...baseParams, ...useTypeOrder);
      variants = vocabulary.groupVariants(variantRows);
    }

    logger.database(`Sankey data returned ${links.length} connections (top ${limitUsos} use types)`);

    return {
      links,
      useTypeOrder,
      communityTypeOrder,
      variants
    };
  } catch (error) {
    logger.error('Sankey data aggregation failed:', error.message);
    throw error;
  }
}

/**
 * Get publications by year (for timeline chart)
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Array of {year, count}
 */
async function getPublicationsByYear(filters = {}) {
  try {
    const db = getDb();
    const docs = docsCte(filters);
    const hasComFilter = Boolean(filters['comunidades.estado'] || filters['comunidades.tipo']);

    let sql;
    let params;

    if (hasComFilter) {
      const comFilter = buildComunidadeFilter(filters);
      sql = `
        WITH ${docs.sql}
        SELECT ano AS year, COUNT(*) AS count FROM (
          SELECT DISTINCT docs.id AS id, docs.ano AS ano
          FROM docs, json_each(docs.doc, '$.comunidades') AS com
          WHERE 1=1 ${comFilter.sql}
        )
        GROUP BY ano
        ORDER BY ano ASC
      `;
      params = [...docs.params, ...comFilter.params];
    } else {
      sql = `
        WITH ${docs.sql}
        SELECT ano AS year, COUNT(*) AS count FROM docs GROUP BY ano ORDER BY ano ASC
      `;
      params = docs.params;
    }

    const rows = db.prepare(sql).all(...params);
    logger.database(`Publications by year returned ${rows.length} years`);

    return rows.map((row) => ({ year: row.year, count: row.count }));
  } catch (error) {
    logger.error('Publications by year failed:', error.message);
    throw error;
  }
}

module.exports = {
  getTopPlants,
  getCommunityCount,
  getEvidenceCountByStatus,
  getTopAuthors,
  getEvidencesByState,
  getCommunitiesByState,
  getPlantsByState,
  getTopCommunitiesByPlants,
  getTopEvidencesByCommunities,
  getTopEvidencesByPlants,
  getPublicationsByYear,
  getSankeyData
};
