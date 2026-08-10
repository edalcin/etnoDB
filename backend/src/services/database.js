/**
 * Database Service
 *
 * CRUD operations for evidence documents.
 * Persists the Evidence document (JSON) in `biocultdb_records.doc` (SQLite+JSON1,
 * ADR-005) and keeps the `biocultdb_records_fts` FTS5 table in sync inside the
 * same transaction as every write (insert/update/delete), per DA4.
 *
 * `query` contract accepted by findEvidences/countEvidences/searchEvidences:
 *   {
 *     status?: string,   // exact match on the generated `status` column
 *     ano?: number,       // exact match on the generated `ano` column
 *     fonte?: string,     // exact match on the generated `fonte` column
 *     text?: string,      // free-text search via FTS5 MATCH (titulo/autores/resumo/doi/comunidades)
 *     conditions?: [{ fields: string[], op: 'eq'|'contains', value: string }]
 *       // `fields` inside one condition are OR'd; each condition item is AND'd with the rest.
 *       // `fields` MUST come from FIELD_REGISTRY below (whitelist) — never raw JSON paths from callers.
 *   }
 */

const fs = require('fs');
const path = require('path');
const database = require('../shared/database');
const logger = require('../shared/logger');
const { createEvidence, updateEvidence, Status } = require('../models/Evidence');
const { expandLabels } = require('./vocabulary');

/**
 * Whitelist of searchable JSON paths and how to reach them from `doc`.
 * - root: scalar at the top level of the document
 * - root-array: array of scalars at the top level
 * - comunidade: scalar nested under each `comunidades[]` entry
 * - comunidade-array: array of scalars nested under each `comunidades[]` entry
 * - planta-array: array of scalars nested under each `comunidades[].plantas[]` entry
 */
const FIELD_REGISTRY = {
  titulo: { scope: 'root', path: '$.titulo' },
  autores: { scope: 'root-array', path: '$.autores' },
  resumo: { scope: 'root', path: '$.resumo' },
  DOI: { scope: 'root', path: '$.DOI' },
  'comunidades.nome': { scope: 'comunidade', path: '$.nome' },
  'comunidades.tipo': { scope: 'comunidade', path: '$.tipo' },
  'comunidades.estado': { scope: 'comunidade', path: '$.estado' },
  'comunidades.municipio': { scope: 'comunidade', path: '$.municipio' },
  'comunidades.local': { scope: 'comunidade', path: '$.local' },
  'comunidades.observacoes': { scope: 'comunidade', path: '$.observacoes' },
  'comunidades.atividadesEconomicas': { scope: 'comunidade-array', path: '$.atividadesEconomicas' },
  'comunidades.plantas.nomeCientifico': { scope: 'planta-array', path: '$.nomeCientifico' },
  'comunidades.plantas.nomeVernacular': { scope: 'planta-array', path: '$.nomeVernacular' },
  'comunidades.plantas.tipoUso': { scope: 'planta-array', path: '$.tipoUso' }
};

/**
 * Vocabulary-controlled fields: their raw label must expand to every synonym
 * naming the same Concept before comparison, so filters and facets agree
 * with the aggregations (ADR-003). Mirrors BioCultTermos' MONITORED_FIELDS —
 * `comunidades.plantas.nomeCientifico` stays OUT: taxonomic names have been
 * governed by the ICN, not BioCultTermos, since 2026-08-10.
 */
const VOCABULARY_CONTROLLED_FIELDS = new Set([
  'comunidades.tipo',
  'comunidades.atividadesEconomicas',
  'comunidades.plantas.nomeVernacular',
  'comunidades.plantas.tipoUso'
]);

const VALID_SORT_FIELDS = new Set(['titulo', 'autores', 'ano', 'status', 'createdAt']);

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

/**
 * Build a single comparison SQL fragment for a whitelisted field, pushing its
 * bound value onto `params`. Value is ALWAYS bound as a parameter, never
 * interpolated into the SQL text.
 * @param {string} field - Key from FIELD_REGISTRY
 * @param {'eq'|'contains'} op
 * @param {string} value
 * @param {Array} params
 * @returns {string}
 */
function buildFieldCondition(field, op, value, params) {
  const meta = FIELD_REGISTRY[field];
  if (!meta) {
    throw new Error(`Campo de busca não permitido: ${field}`);
  }

  const cmp = (expr) => {
    const labels = VOCABULARY_CONTROLLED_FIELDS.has(field) ? expandLabels(getDb(), value) : [value];
    const parts = labels.map((label) => {
      params.push(label);
      return op === 'contains'
        ? `LOWER(${expr}) LIKE '%' || LOWER(?) || '%'`
        : `LOWER(${expr}) = LOWER(?)`;
    });
    return parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0];
  };

  switch (meta.scope) {
    case 'root':
      return cmp(`json_extract(doc,'${meta.path}')`);
    case 'root-array':
      return `EXISTS (SELECT 1 FROM json_each(doc,'${meta.path}') je WHERE ${cmp('je.value')})`;
    case 'comunidade':
      return `EXISTS (SELECT 1 FROM json_each(doc,'$.comunidades') com WHERE ${cmp(`json_extract(com.value,'${meta.path}')`)})`;
    case 'comunidade-array':
      return `EXISTS (SELECT 1 FROM json_each(doc,'$.comunidades') com, json_each(com.value,'${meta.path}') ae WHERE ${cmp('ae.value')})`;
    case 'planta-array':
      return `EXISTS (SELECT 1 FROM json_each(doc,'$.comunidades') com, json_each(com.value,'$.plantas') pl, json_each(pl.value,'${meta.path}') pv WHERE ${cmp('pv.value')})`;
    default:
      throw new Error(`Escopo de busca desconhecido para campo: ${field}`);
  }
}

/**
 * Translate `query.conditions` into a single AND-joined SQL fragment
 * (each condition's `fields` OR'd together), pushing params in order.
 * @param {Array} conditions
 * @param {Array} params
 * @returns {string} SQL fragment, or '' if no usable conditions
 */
function buildConditionsClause(conditions, params) {
  if (!Array.isArray(conditions) || conditions.length === 0) return '';

  const groups = conditions
    .map((cond) => {
      if (!cond || !Array.isArray(cond.fields) || cond.fields.length === 0) return null;
      const value = cond.value;
      if (value === undefined || value === null || String(value).trim() === '') return null;
      const op = cond.op === 'contains' ? 'contains' : 'eq';

      const parts = cond.fields.map((field) => buildFieldCondition(field, op, String(value), params));
      return parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0];
    })
    .filter(Boolean);

  return groups.join(' AND ');
}

/**
 * Escape and tokenize free text into a safe FTS5 MATCH expression: each
 * whitespace-separated token becomes a quoted prefix query, OR'd together.
 * @param {string} text
 * @returns {string|null}
 */
function buildFtsMatchQuery(text) {
  const cleaned = String(text).trim();
  if (!cleaned) return null;

  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, '""')}"*`);

  return tokens.length ? tokens.join(' OR ') : null;
}

/**
 * Build the WHERE clause + positional params for a `query` object.
 * @param {Object} query
 * @returns {{ sql: string, params: Array }}
 */
function buildWhereClause(query = {}) {
  const clauses = [];
  const params = [];

  if (query.status !== undefined && query.status !== null && query.status !== '') {
    clauses.push('status = ?');
    params.push(query.status);
  }

  if (query.ano !== undefined && query.ano !== null && query.ano !== '') {
    clauses.push('ano = ?');
    params.push(Number(query.ano));
  }

  if (query.fonte !== undefined && query.fonte !== null && query.fonte !== '') {
    clauses.push('fonte = ?');
    params.push(query.fonte);
  }

  // Substring match on the same generated `fonte` column — lets Curadoria
  // filter "Extração por IA" as a category without listing every exact
  // "extração IA — <provedor>/<modelo>" string (ADR-002, ticket 05).
  if (query.fonteContains !== undefined && query.fonteContains !== null && query.fonteContains !== '') {
    clauses.push("fonte LIKE '%' || ? || '%'");
    params.push(query.fonteContains);
  }

  const conditionsClause = buildConditionsClause(query.conditions, params);
  if (conditionsClause) clauses.push(conditionsClause);

  if (query.text && String(query.text).trim().length > 0) {
    const ftsQuery = buildFtsMatchQuery(query.text);
    if (ftsQuery) {
      clauses.push(`id IN (SELECT id FROM ${database.TABLE}_fts WHERE ${database.TABLE}_fts MATCH ?)`);
      params.push(ftsQuery);
    }
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

/**
 * @param {{[field: string]: 1|-1}} sort
 * @returns {string} ORDER BY clause
 */
function buildOrderClause(sort) {
  const sortField = sort && VALID_SORT_FIELDS.has(Object.keys(sort)[0]) ? Object.keys(sort)[0] : 'createdAt';
  const direction = sort && sort[sortField] === 1 ? 'ASC' : 'DESC';

  switch (sortField) {
    case 'titulo':
      return `ORDER BY titulo ${direction}`;
    case 'ano':
      return `ORDER BY ano ${direction}`;
    case 'status':
      return `ORDER BY status ${direction}`;
    case 'autores':
      return `ORDER BY json_extract(doc,'$.autores[0]') ${direction}`;
    case 'createdAt':
    default:
      return `ORDER BY created_at ${direction}`;
  }
}

/**
 * Parse a `biocultdb_records` row into the full Evidence object.
 * @param {{id: string, doc: string, created_at: string, updated_at: string}} row
 * @returns {Object}
 */
function rowToEvidence(row) {
  const doc = JSON.parse(row.doc);
  return {
    ...doc,
    id: row.id,
    createdAt: doc.createdAt || row.created_at,
    updatedAt: doc.updatedAt || row.updated_at
  };
}

/**
 * Restrict an Evidence object to the requested Mongo-style projection
 * ({ field: 1, ... }); `id` is always kept. No-op when projection is empty.
 * @param {Object} evidence
 * @param {Object} projection
 * @returns {Object}
 */
function applyProjection(evidence, projection) {
  if (!projection || Object.keys(projection).length === 0) return evidence;

  const result = { id: evidence.id };
  for (const [key, include] of Object.entries(projection)) {
    if (include) result[key] = evidence[key];
  }
  return result;
}

/**
 * Build the searchable text extracted from an Evidence for the FTS5 row.
 * @param {Object} evidence
 * @returns {{titulo: string, autores: string, resumo: string, doi: string, comunidades: string}}
 */
function ftsRowFromEvidence(evidence) {
  const autores = Array.isArray(evidence.autores) ? evidence.autores.join(' ') : '';

  const comunidadesText = Array.isArray(evidence.comunidades)
    ? evidence.comunidades
        .map((com) => {
          const plantasText = Array.isArray(com.plantas)
            ? com.plantas
                .map((planta) =>
                  [
                    Array.isArray(planta.nomeCientifico) ? planta.nomeCientifico.join(' ') : '',
                    Array.isArray(planta.nomeVernacular) ? planta.nomeVernacular.join(' ') : '',
                    Array.isArray(planta.tipoUso) ? planta.tipoUso.join(' ') : ''
                  ]
                    .filter(Boolean)
                    .join(' ')
                )
                .join(' ')
            : '';

          return [
            com.nome,
            com.tipo,
            com.municipio,
            com.estado,
            com.local,
            Array.isArray(com.atividadesEconomicas) ? com.atividadesEconomicas.join(' ') : '',
            com.observacoes,
            plantasText
          ]
            .filter(Boolean)
            .join(' ');
        })
        .join(' ')
    : '';

  return {
    titulo: evidence.titulo || '',
    autores,
    resumo: evidence.resumo || '',
    doi: evidence.DOI || '',
    comunidades: comunidadesText
  };
}

/**
 * Check if an evidence with the same title and year already exists
 * @param {string} titulo - Evidence title
 * @param {number} ano - Publication year
 * @returns {Promise<Object|null>} Existing evidence or null
 */
async function checkDuplicateEvidence(titulo, ano) {
  try {
    const db = getDb();

    const row = db
      .prepare(`SELECT id, doc, created_at, updated_at FROM ${database.TABLE} WHERE titulo = ? COLLATE NOCASE AND ano = ? LIMIT 1`)
      .get(titulo, ano);

    if (!row) return null;

    logger.database(`Duplicate evidence found: "${titulo}" (${ano})`);
    return rowToEvidence(row);
  } catch (error) {
    logger.error('Failed to check duplicate evidence:', error.message);
    throw new Error(`Falha ao verificar duplicata: ${error.message}`);
  }
}

/**
 * Insert new evidence
 * @param {Object} evidenceData - Evidence data
 * @returns {Promise<Object>} Inserted document with id
 */
async function insertEvidence(evidenceData) {
  try {
    const db = getDb();
    const evidence = createEvidence(evidenceData);
    const docJson = JSON.stringify(evidence);
    const fts = ftsRowFromEvidence(evidence);

    const insertRecord = db.prepare(
      `INSERT INTO ${database.TABLE} (id, doc, created_at, updated_at) VALUES (?, ?, ?, ?)`
    );
    const insertFts = db.prepare(
      `INSERT INTO ${database.TABLE}_fts (id, titulo, autores, resumo, doi, comunidades) VALUES (?, ?, ?, ?, ?, ?)`
    );

    const runInTransaction = db.transaction(() => {
      insertRecord.run(evidence.id, docJson, evidence.createdAt, evidence.updatedAt);
      insertFts.run(evidence.id, fts.titulo, fts.autores, fts.resumo, fts.doi, fts.comunidades);
    });
    runInTransaction();

    logger.database(`Evidence inserted with ID: ${evidence.id}`);

    return evidence;
  } catch (error) {
    logger.error('Failed to insert evidence:', error.message);
    throw new Error(`Falha ao salvar evidência: ${error.message}`);
  }
}

/**
 * Find evidences by query
 * @param {Object} query - Structured query (see module doc)
 * @param {Object} options - Query options (projection, limit, skip, sort)
 * @returns {Promise<Array>} Array of evidences
 */
async function findEvidences(query = {}, options = {}) {
  try {
    const db = getDb();
    const { projection = {}, limit = 0, skip = 0, sort = { createdAt: -1 } } = options;

    const { sql: whereSql, params } = buildWhereClause(query);
    const orderSql = buildOrderClause(sort);

    let sql = `SELECT id, doc, created_at, updated_at FROM ${database.TABLE} ${whereSql} ${orderSql}`.trim();
    const finalParams = [...params];

    if (limit > 0) {
      sql += ' LIMIT ?';
      finalParams.push(limit);
      if (skip > 0) {
        sql += ' OFFSET ?';
        finalParams.push(skip);
      }
    } else if (skip > 0) {
      sql += ' LIMIT -1 OFFSET ?';
      finalParams.push(skip);
    }

    const rows = db.prepare(sql).all(...finalParams);
    const evidences = rows.map((row) => applyProjection(rowToEvidence(row), projection));

    logger.database(`Found ${evidences.length} evidences`);

    return evidences;
  } catch (error) {
    logger.error('Failed to find evidences:', error.message);
    throw new Error(`Falha ao buscar evidências: ${error.message}`);
  }
}

/**
 * Find evidence by ID
 * @param {string} id - Evidence ID
 * @returns {Promise<Object|null>} Evidence document or null
 */
async function findEvidenceById(id) {
  try {
    const db = getDb();
    const row = db
      .prepare(`SELECT id, doc, created_at, updated_at FROM ${database.TABLE} WHERE id = ?`)
      .get(id);

    if (row) {
      logger.database(`Found evidence with ID: ${id}`);
    } else {
      logger.database(`Evidence not found with ID: ${id}`);
    }

    return row ? rowToEvidence(row) : null;
  } catch (error) {
    logger.error('Failed to find evidence by ID:', error.message);
    throw new Error(`Falha ao buscar evidência: ${error.message}`);
  }
}

/**
 * Update evidence by ID
 * @param {string} id - Evidence ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object|null>} Updated evidence, or null if not found
 */
async function updateEvidenceById(id, updateData) {
  try {
    logger.database(`updateEvidenceById called with ID: ${id}`);

    const db = getDb();
    const existingRow = db.prepare(`SELECT doc FROM ${database.TABLE} WHERE id = ?`).get(id);

    if (!existingRow) {
      logger.error(`Evidence with ID ${id} NOT FOUND in database`);
      return null;
    }

    const existing = JSON.parse(existingRow.doc);
    const updated = updateEvidence({ ...existing, ...updateData, id });
    const docJson = JSON.stringify(updated);
    const fts = ftsRowFromEvidence(updated);

    const updateRecord = db.prepare(
      `UPDATE ${database.TABLE} SET doc = ?, updated_at = ? WHERE id = ?`
    );
    const deleteFts = db.prepare(`DELETE FROM ${database.TABLE}_fts WHERE id = ?`);
    const insertFts = db.prepare(
      `INSERT INTO ${database.TABLE}_fts (id, titulo, autores, resumo, doi, comunidades) VALUES (?, ?, ?, ?, ?, ?)`
    );

    const runInTransaction = db.transaction(() => {
      const result = updateRecord.run(docJson, updated.updatedAt, id);
      if (result.changes === 0) {
        throw new Error('Evidência não encontrada');
      }
      deleteFts.run(id);
      insertFts.run(id, fts.titulo, fts.autores, fts.resumo, fts.doi, fts.comunidades);
    });
    runInTransaction();

    logger.database(`Evidence updated successfully with ID: ${id}`);

    return updated;
  } catch (error) {
    logger.error(`Failed to update evidence ${id}:`, error.message);
    throw new Error(`Falha ao atualizar evidência: ${error.message}`);
  }
}

/**
 * Update evidence status only
 * @param {string} id - Evidence ID
 * @param {string} status - New status (pending|approved|rejected)
 * @param {string|null} justificativaRejeicao - Justification for rejection (only for 'rejected' status)
 * @returns {Promise<Object>} Updated evidence
 */
async function updateEvidenceStatus(id, status, justificativaRejeicao = null) {
  try {
    if (!Object.values(Status).includes(status)) {
      throw new Error('Status inválido');
    }

    const db = getDb();
    const existingRow = db.prepare(`SELECT doc FROM ${database.TABLE} WHERE id = ?`).get(id);

    if (!existingRow) {
      throw new Error('Evidência não encontrada');
    }

    const existing = JSON.parse(existingRow.doc);
    const updated = { ...existing, id, status, updatedAt: new Date().toISOString() };

    if (status === Status.REJECTED && justificativaRejeicao) {
      updated.justificativaRejeicao = justificativaRejeicao;
    } else {
      delete updated.justificativaRejeicao;
    }

    const docJson = JSON.stringify(updated);
    const fts = ftsRowFromEvidence(updated);

    const updateRecord = db.prepare(
      `UPDATE ${database.TABLE} SET doc = ?, updated_at = ? WHERE id = ?`
    );
    const deleteFts = db.prepare(`DELETE FROM ${database.TABLE}_fts WHERE id = ?`);
    const insertFts = db.prepare(
      `INSERT INTO ${database.TABLE}_fts (id, titulo, autores, resumo, doi, comunidades) VALUES (?, ?, ?, ?, ?, ?)`
    );

    const runInTransaction = db.transaction(() => {
      const result = updateRecord.run(docJson, updated.updatedAt, id);
      if (result.changes === 0) {
        throw new Error('Evidência não encontrada');
      }
      deleteFts.run(id);
      insertFts.run(id, fts.titulo, fts.autores, fts.resumo, fts.doi, fts.comunidades);
    });
    runInTransaction();

    logger.database(`Evidence status updated to "${status}" for ID: ${id}`);

    return updated;
  } catch (error) {
    logger.error('Failed to update evidence status:', error.message);
    throw new Error(`Falha ao atualizar status: ${error.message}`);
  }
}

/**
 * Delete evidence by ID
 * @param {string} id - Evidence ID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteEvidenceById(id) {
  try {
    const db = getDb();

    const deleteRecord = db.prepare(`DELETE FROM ${database.TABLE} WHERE id = ?`);
    const deleteFts = db.prepare(`DELETE FROM ${database.TABLE}_fts WHERE id = ?`);

    const runInTransaction = db.transaction(() => {
      const result = deleteRecord.run(id);
      if (result.changes === 0) {
        throw new Error('Evidência não encontrada');
      }
      deleteFts.run(id);
    });
    runInTransaction();

    logger.database(`Evidence deleted with ID: ${id}`);

    return true;
  } catch (error) {
    logger.error('Failed to delete evidence:', error.message);
    throw new Error(`Falha ao deletar evidência: ${error.message}`);
  }
}

/**
 * Count evidences by query
 * @param {Object} query - Structured query (see module doc)
 * @returns {Promise<number>} Count of documents
 */
async function countEvidences(query = {}) {
  try {
    const db = getDb();
    const { sql: whereSql, params } = buildWhereClause(query);

    const row = db.prepare(`SELECT COUNT(*) as n FROM ${database.TABLE} ${whereSql}`.trim()).get(...params);
    const count = row.n;

    logger.database(`Counted ${count} evidences`);

    return count;
  } catch (error) {
    logger.error('Failed to count evidences:', error.message);
    throw new Error(`Falha ao contar evidências: ${error.message}`);
  }
}

/**
 * Search evidences with pagination
 * @param {Object} query - Structured query (see module doc)
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Results per page
 * @returns {Promise<Object>} { evidences, total, page, totalPages }
 */
async function searchEvidences(query = {}, page = 1, limit = 50) {
  try {
    const skip = (page - 1) * limit;

    const [evidences, total] = await Promise.all([
      findEvidences(query, { limit, skip }),
      countEvidences(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.database(`Search returned ${evidences.length} of ${total} total evidences (page ${page}/${totalPages})`);

    return {
      evidences,
      total,
      page,
      limit,
      totalPages
    };
  } catch (error) {
    logger.error('Failed to search evidences:', error.message);
    throw new Error(`Falha na busca: ${error.message}`);
  }
}

const APP_CONFIG_TABLE = 'app_config';
const EXTRACTION_PROMPT_KEY = 'extraction_prompt';
const DEFAULT_EXTRACTION_PROMPT_PATH = path.join(__dirname, '../prompts/extraction-default.md');

/**
 * Read a config row from `app_config`.
 * @param {string} key
 * @returns {{value: string, updatedAt: string}|null}
 */
function getConfig(key) {
  const db = getDb();
  const row = db.prepare(`SELECT value, updated_at FROM ${APP_CONFIG_TABLE} WHERE key = ?`).get(key);
  return row ? { value: row.value, updatedAt: row.updated_at } : null;
}

/**
 * Upsert a config row in `app_config`, stamping `updated_at` on every write.
 * @param {string} key
 * @param {string} value
 * @returns {{value: string, updatedAt: string}}
 */
function setConfig(key, value) {
  const db = getDb();
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO ${APP_CONFIG_TABLE} (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, updatedAt);
  return { value, updatedAt };
}

function readDefaultExtractionPrompt() {
  return fs.readFileSync(DEFAULT_EXTRACTION_PROMPT_PATH, 'utf-8');
}

/**
 * Get the Extração por IA prompt (ADR-002 D6). Seeds `app_config` from the
 * versioned default file on first read — "primeiro boot" in practice is
 * "primeira leitura", since nothing writes to this key before the editor
 * screen loads it.
 * @returns {{value: string, updatedAt: string}}
 */
function getExtractionPrompt() {
  return getConfig(EXTRACTION_PROMPT_KEY) || setConfig(EXTRACTION_PROMPT_KEY, readDefaultExtractionPrompt());
}

/**
 * Save an edited Extração por IA prompt, preserved byte-for-byte.
 * @param {string} value
 * @returns {{value: string, updatedAt: string}}
 */
function saveExtractionPrompt(value) {
  return setConfig(EXTRACTION_PROMPT_KEY, value);
}

/**
 * Restore the Extração por IA prompt to the versioned default file.
 * @returns {{value: string, updatedAt: string}}
 */
function restoreDefaultExtractionPrompt() {
  return setConfig(EXTRACTION_PROMPT_KEY, readDefaultExtractionPrompt());
}

module.exports = {
  checkDuplicateEvidence,
  insertEvidence,
  findEvidences,
  findEvidenceById,
  updateEvidenceById,
  updateEvidenceStatus,
  deleteEvidenceById,
  countEvidences,
  searchEvidences,
  getExtractionPrompt,
  saveExtractionPrompt,
  restoreDefaultExtractionPrompt
};
