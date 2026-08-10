/**
 * Vocabulary Service — folds synonymous labels into their Concept (ADR-003).
 *
 * The Apresentação counts Concepts, never Rótulos: `alimentar` and `alimentação`
 * are one Concept with two labels, so they must be one bar, one facet, one
 * filter. The rules that decide what "same Concept" means (pref/alt/hidden,
 * status, `replacedBy`, CARE access levels) live in BioCultTermos, which
 * publishes them as the `etnotermos_label_map` view on the shared unit SQLite
 * file. This module is the only place in BioCultDB that touches that view — it
 * never opens a concept document.
 *
 * BioCultDB stays runnable without BioCultTermos: when the view is absent
 * (single-app image, test suite, submodule not initialised) every helper
 * degrades to the raw-label behaviour the dashboard had before.
 */

const logger = require('../shared/logger');

const LABEL_MAP_VIEW = 'etnotermos_label_map';

/** Cached view-presence probe; `null` = not probed yet. */
let labelMapAvailable = null;

/**
 * Is the BioCultTermos label map reachable on this connection?
 * Probed once per process; call `resetLabelMapCache()` after swapping databases.
 * @param {import('better-sqlite3').Database} db
 * @returns {boolean}
 */
function hasLabelMap(db) {
  if (labelMapAvailable !== null) return labelMapAvailable;

  try {
    const row = db
      .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'view' AND name = ?")
      .get(LABEL_MAP_VIEW);
    labelMapAvailable = Boolean(row);
  } catch (error) {
    logger.error(`Label map probe failed: ${error.message}`);
    labelMapAvailable = false;
  }

  if (!labelMapAvailable) {
    logger.database(
      `${LABEL_MAP_VIEW} not found — vocabulary aggregation disabled, raw labels will be shown`
    );
  }

  return labelMapAvailable;
}

/** Forget the cached probe. Tests swap SQLite files between cases. */
function resetLabelMapCache() {
  labelMapAvailable = null;
}

/** The matching key. MUST stay identical to BioCultTermos' AcquisitionService. */
function labelKey(value) {
  return String(value).trim().toLowerCase();
}

/**
 * SQL fragments that turn a raw label expression into its Termo Preferencial.
 *
 * `where` drops rows whose Concept has no publicly showable label: aggregating
 * them under a `restricted`/`sacred` prefLabel would publish, on a public axis,
 * exactly what curation marked as reserved. Unmatched raw values are kept as
 * they were typed — the orphan on the axis is what pulls a curator to
 * BioCultTermos.
 *
 * @param {string} rawExpr - SQL expression yielding the raw label
 * @param {string} alias - unique alias for the joined view
 * @param {boolean} enabled - false when the view is absent
 * @returns {{join: string, expr: string, where: string}}
 */
function labelMapJoin(rawExpr, alias, enabled) {
  if (!enabled) {
    return { join: '', expr: rawExpr, where: '' };
  }

  return {
    join: `LEFT JOIN ${LABEL_MAP_VIEW} AS ${alias} ON ${alias}.label_key = lower(trim(${rawExpr}))`,
    expr: `COALESCE(${alias}.pref_label, ${rawExpr})`,
    where: `(${alias}.concept_id IS NULL OR ${alias}.pref_label IS NOT NULL)`
  };
}

/**
 * Every label that names the same Concept as `value` — the filter counterpart
 * of the aggregation above. Picking `alimentar` in a facet has to find the
 * Evidências that recorded `alimentação`, or the chart and the list stop
 * agreeing on how many there are.
 *
 * Returns lowercase keys; callers compare case-insensitively already.
 * Falls back to `[value]` when there is no view or no Concept.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} value
 * @returns {string[]}
 */
function expandLabels(db, value) {
  const raw = String(value);
  if (!hasLabelMap(db)) return [raw];

  const key = labelKey(raw);
  if (!key) return [raw];

  try {
    const rows = db
      .prepare(
        `SELECT sibling.label_key AS label_key
           FROM ${LABEL_MAP_VIEW} AS seed
           JOIN ${LABEL_MAP_VIEW} AS sibling ON sibling.concept_id = seed.concept_id
          WHERE seed.label_key = ?`
      )
      .all(key);

    if (rows.length === 0) return [raw];

    const labels = new Set(rows.map((row) => row.label_key));
    labels.add(key);
    return [...labels];
  } catch (error) {
    logger.error(`Label expansion failed for "${raw}": ${error.message}`);
    return [raw];
  }
}

/**
 * Raw labels that were folded into each Termo Preferencial, so a chart can say
 * what it merged instead of silently losing three bars.
 *
 * @param {Array<{display: string, raw: string}>} pairs
 * @returns {Object<string, string[]>} preferred label -> sorted raw variants
 */
function groupVariants(pairs) {
  const grouped = {};

  for (const { display, raw } of pairs) {
    if (!display || !raw) continue;
    if (!grouped[display]) grouped[display] = new Set();
    grouped[display].add(raw);
  }

  return Object.fromEntries(
    Object.entries(grouped)
      .filter(([display, variants]) => variants.size > 1 || !variants.has(display))
      .map(([display, variants]) => [display, [...variants].sort((a, b) => a.localeCompare(b, 'pt-BR'))])
  );
}

module.exports = {
  LABEL_MAP_VIEW,
  hasLabelMap,
  resetLabelMapCache,
  labelKey,
  labelMapJoin,
  expandLabels,
  groupVariants
};
