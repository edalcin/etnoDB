/**
 * Purga os conceitos SKOS-XL de nome científico do `etnotermos` (ADR-014 N5).
 *
 * Nomenclatura científica saiu do escopo do vocabulário controlado: a autoridade
 * é externa (ICN/ICZN, WFO/IPNI/POWO/GBIF) e não há decisão de curadoria
 * legítima a tomar sobre um binômio latino. Ver
 * `docs/curadoria/decisao-nomes-cientificos-fora-de-escopo.md`.
 *
 * NÃO É PERDA DE DADO. `biocultdb_records` — onde o nome científico vive como
 * dado da Evidência — não é lido nem tocado por este script. O `etnotermos` é
 * vocabulário DERIVADO: reconstruível por uma execução de aquisição.
 *
 * O que faz, numa única transação:
 *   1. remove os conceitos cujo `sourceFields` é APENAS nome científico, com
 *      seus rótulos, e a linha correspondente do índice FTS;
 *   2. nos conceitos de `sourceFields` MISTO, remove só a entrada do campo
 *      científico — o conceito sobrevive pelo outro campo;
 *   3. limpa as referências órfãs que sobrarem nos conceitos sobreviventes
 *      (broader, narrower, related, synonym, synonymFor, ancestors, replacedBy),
 *      gravando uma entrada de auditoria por conceito alterado.
 *
 * Seco por padrão: sem `--apply` nada é escrito. Faça backup antes de aplicar
 * (§7 de tipos-de-uso/procedimento.md).
 *
 * Uso:
 *   docker exec BioCultDB node /data/purga-nomes-cientificos.mjs
 *   docker exec BioCultDB node /data/purga-nomes-cientificos.mjs --apply
 *   node docs/curadoria/purga-nomes-cientificos.mjs --self-check   (fora do container)
 */

import assert from 'node:assert';
import { pathToFileURL } from 'node:url';

export const FIELD = 'comunidades.plantas.nomeCientifico';
const RELATION_ARRAYS = ['broader', 'narrower', 'related', 'synonym', 'synonymFor', 'ancestors'];

const isScientific = (doc) => (doc.sourceFields ?? []).includes(FIELD);
const label = (doc) => doc.prefLabels?.[0]?.literalForm ?? '(sem rótulo)';

/**
 * Decide, sem tocar no banco, o que sai, o que perde o campo e o que precisa de
 * limpeza de referência. Puro: recebe e devolve dados.
 * @param {{id: string, doc: object}[]} concepts
 */
export function planPurge(concepts) {
  const toRemove = concepts.filter((c) => isScientific(c.doc) && c.doc.sourceFields.length === 1);
  const toStrip = concepts.filter((c) => isScientific(c.doc) && c.doc.sourceFields.length > 1);
  const removedIds = new Set(toRemove.map((c) => c.id));

  const toClean = [];
  for (const c of concepts) {
    if (removedIds.has(c.id)) continue;
    const cleaned = {};
    for (const key of RELATION_ARRAYS) {
      const before = c.doc[key] ?? [];
      const after = before.filter((id) => !removedIds.has(id));
      if (after.length !== before.length) cleaned[key] = { before, after };
    }
    if (c.doc.replacedBy && removedIds.has(c.doc.replacedBy)) {
      cleaned.replacedBy = { before: c.doc.replacedBy, after: null };
    }
    if (Object.keys(cleaned).length > 0) toClean.push({ concept: c, cleaned });
  }

  return { toRemove, toStrip, toClean };
}

/** Autocheck sem framework: cobre os três caminhos, inclusive os que produção não exercita. */
export function demo() {
  const concepts = [
    { id: 'sci', doc: { sourceFields: [FIELD], prefLabels: [{ literalForm: 'schinus terebinthifolius' }] } },
    {
      id: 'misto',
      doc: { sourceFields: [FIELD, 'comunidades.plantas.nomeVernacular'], prefLabels: [{ literalForm: 'jurema' }] },
    },
    {
      id: 'vern',
      doc: {
        sourceFields: ['comunidades.plantas.nomeVernacular'],
        prefLabels: [{ literalForm: 'aroeira' }],
        related: ['sci', 'misto'],
        replacedBy: 'sci',
      },
    },
  ];

  const { toRemove, toStrip, toClean } = planPurge(concepts);

  assert.deepEqual(toRemove.map((c) => c.id), ['sci'], 'só o científico puro sai');
  assert.deepEqual(toStrip.map((c) => c.id), ['misto'], 'o misto sobrevive e só perde o campo');
  assert.equal(toClean.length, 1, 'só o vernacular precisa de limpeza');
  assert.deepEqual(toClean[0].cleaned.related.after, ['misto'], 'referência ao misto é preservada');
  assert.equal(toClean[0].cleaned.replacedBy.after, null, 'replacedBy órfão vira null');

  // Sem conceito científico, nada acontece — a purga é idempotente.
  const semCientifico = planPurge([concepts[2]]);
  assert.equal(semCientifico.toRemove.length, 0);
  assert.equal(semCientifico.toClean.length, 0, 'segunda execução não altera nada');

  console.log('purga-nomes-cientificos demo() OK');
}

async function main() {
  if (process.argv.includes('--self-check')) return demo();

  const APPLY = process.argv.includes('--apply');
  const RESPONSIBLE = process.env.ADMIN_USERNAME || 'etnotermos';

  const { default: database } = await import('/app/bioculttermos/backend/src/shared/database.js');
  const { createAuditEntry, insertAuditEntry } = await import(
    '/app/bioculttermos/backend/src/models/AuditEntry.js'
  );

  const db = database.connect();
  const all = db
    .prepare(`SELECT id, doc FROM etnotermos`)
    .all()
    .map((r) => ({ id: r.id, doc: JSON.parse(r.doc) }));

  const { toRemove, toStrip, toClean } = planPurge(all);

  const report = {
    apply: APPLY,
    totalConcepts: all.length,
    removed: { count: toRemove.length, labels: toRemove.map((c) => label(c.doc)).sort() },
    strippedMixedSourceField: {
      count: toStrip.length,
      items: toStrip.map((c) => ({ label: label(c.doc), sourceFields: c.doc.sourceFields })),
    },
    danglingReferencesCleaned: toClean.map(({ concept, cleaned }) => ({
      label: label(concept.doc),
      id: concept.id,
      fields: Object.fromEntries(
        Object.entries(cleaned).map(([k, v]) => [
          k,
          Array.isArray(v.before) ? `${v.before.length} → ${v.after.length}` : `${v.before} → null`,
        ])
      ),
    })),
  };

  if (!APPLY) {
    report.note = 'EXECUÇÃO SECA — nada foi escrito. Repita com --apply para aplicar.';
    process.stdout.write(JSON.stringify(report, null, 2));
    return;
  }

  const now = new Date().toISOString();
  const deleteConcept = db.prepare(`DELETE FROM etnotermos WHERE id = ?`);
  const deleteFts = db.prepare(`DELETE FROM etnotermos_fts WHERE id = ?`);
  const updateDoc = db.prepare(`UPDATE etnotermos SET doc = ?, updated_at = ? WHERE id = ?`);

  db.transaction(() => {
    for (const c of toRemove) {
      deleteConcept.run(c.id);
      deleteFts.run(c.id);
    }

    for (const c of toStrip) {
      const doc = {
        ...c.doc,
        sourceFields: c.doc.sourceFields.filter((f) => f !== FIELD),
        updatedAt: now,
      };
      updateDoc.run(JSON.stringify(doc), now, c.id);
      insertAuditEntry(
        db,
        createAuditEntry({
          conceptId: c.id,
          conceptLiteralForm: label(c.doc),
          field: 'sourceFields',
          previousValue: c.doc.sourceFields.join(', '),
          newValue: `${doc.sourceFields.join(', ')} — campo de nome científico fora de escopo (ADR-014 N3)`,
          responsible: RESPONSIBLE,
        })
      );
    }

    for (const { concept, cleaned } of toClean) {
      const doc = { ...concept.doc, updatedAt: now };
      for (const [key, { after }] of Object.entries(cleaned)) doc[key] = after;
      updateDoc.run(JSON.stringify(doc), now, concept.id);

      for (const [key, { before, after }] of Object.entries(cleaned)) {
        insertAuditEntry(
          db,
          createAuditEntry({
            conceptId: concept.id,
            conceptLiteralForm: label(concept.doc),
            field: key,
            previousValue: Array.isArray(before) ? before.join(', ') : before,
            newValue: `${Array.isArray(after) ? after.join(', ') || '(vazio)' : 'null'} — referência a conceito de nome científico removida (ADR-014 N5)`,
            responsible: RESPONSIBLE,
          })
        );
      }
    }
  })();

  report.remainingConcepts = db.prepare(`SELECT COUNT(*) AS n FROM etnotermos`).get().n;
  report.remainingFts = db.prepare(`SELECT COUNT(*) AS n FROM etnotermos_fts`).get().n;
  process.stdout.write(JSON.stringify(report, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
