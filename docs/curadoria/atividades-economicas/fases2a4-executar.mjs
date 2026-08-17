/**
 * Fases 2 a 4 da curadoria de um Campo Semântico, pela API Admin.
 *
 * Lê o plano em JSON e executa, nesta ordem:
 *   Fase 2  rótulos ocultos nos alvos  →  depreciação das origens
 *   Fase 3  hierarquia (broader) e associação (related)
 *   Fase 4  definições / notas  →  ativação
 *
 * Toda escrita passa pela API Admin (porta 4001), que é onde vivem os invariantes:
 * ciclo hierárquico, reciprocidade broader/narrower, cascata de `ancestors`,
 * bloqueio otimista por `version` e trilha de auditoria. A resolução rótulo → id é
 * a única leitura direta no SQLite, e é somente leitura.
 *
 * Idempotente: cada operação confere o estado atual antes de escrever e devolve
 * `skip` quando o efeito já está no banco. `--dry-run` não escreve nada.
 *
 * A senha vem de `ADMIN_PASSWORD` no ambiente do container e nunca é impressa.
 *
 * Uso: docker exec BioCultDB node /data/fases2a4-executar.mjs /data/plano.json [--dry-run]
 */

import database from '/app/bioculttermos/backend/src/shared/database.js';
import { readFileSync } from 'fs';

const BASE = process.env.CURATION_ADMIN_URL || 'http://127.0.0.1:4001';
const USER = process.env.ADMIN_USERNAME;
const PASS = process.env.ADMIN_PASSWORD;
if (!USER || !PASS) throw new Error('ADMIN_USERNAME/ADMIN_PASSWORD ausentes no ambiente');
const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

const planPath = process.argv[2];
const DRY = process.argv.includes('--dry-run');
const plan = JSON.parse(readFileSync(planPath, 'utf8'));

const db = database.connect();

/** Resolve um rótulo preferencial exato para o id do conceito. */
const findId = db.prepare(
  `SELECT json_extract(e.doc,'$.id') AS id FROM etnotermos e
   WHERE EXISTS (SELECT 1 FROM json_each(coalesce(json_extract(e.doc,'$.prefLabels'),'[]')) je
                 WHERE json_extract(je.value,'$.literalForm') = ?)`
);
const getDoc = db.prepare(`SELECT doc FROM etnotermos WHERE id = ?`);

const SERVICE = plan.conceitosServico || {};
function idOf(label) {
  if (label === '__indeterminado__') return SERVICE.indeterminado;
  const row = findId.get(label);
  if (!row) throw new Error(`rótulo não resolvido: ${label}`);
  return row.id;
}
function docOf(label) {
  const row = getDoc.get(idOf(label));
  if (!row) throw new Error(`conceito não encontrado: ${label}`);
  return JSON.parse(row.doc);
}

const log = [];
function record(phase, op, subject, outcome, detail) {
  log.push({ phase, op, subject, outcome, detail });
  const mark = outcome === 'ok' ? '+' : outcome === 'skip' ? '=' : '!';
  console.log(`${mark} [${phase}] ${op} ${subject}${detail ? ' — ' + detail : ''}`);
}

async function call(method, path, body) {
  if (DRY) return { status: 0, json: { dryRun: true } };
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return { status: res.status, json };
}

// ─────────────────────────── Fase 2 — rótulos e depreciação ───────────────────────────

async function fase2() {
  for (const a of plan.absorcoes || []) {
    for (const targetLabel of a.hidden_in || []) {
      const target = docOf(targetLabel);
      const already = [...(target.hiddenLabels || []), ...(target.altLabels || []), ...(target.prefLabels || [])]
        .some((l) => l.literalForm === a.termo);
      if (already) { record(2, 'label:hidden', `${a.termo} → ${targetLabel}`, 'skip', 'rótulo já presente'); continue; }
      await call('POST', `/concepts/${target.id}/labels`, {
        version: target.version,
        literalForm: a.termo,
        language: 'por',
        type: 'hidden',
        accessLevel: 'public',
      });
      record(2, 'label:hidden', `${a.termo} → ${targetLabel}`, 'ok');
    }
  }
  for (const a of plan.absorcoes || []) {
    const origin = docOf(a.termo);
    if (origin.status === 'deprecated') { record(2, 'deprecate', a.termo, 'skip', 'já depreciado'); continue; }
    const replacedById = idOf(a.replacedBy);
    await call('POST', `/concepts/${origin.id}/deprecate`, {
      version: origin.version,
      replacedById,
    });
    record(2, 'deprecate', `${a.termo} → ${a.replacedBy}`, 'ok');
  }
}

// ─────────────────────────── Fase 3 — hierarquia e associação ───────────────────────────

async function fase3() {
  for (const { conceito, pai } of plan.broader || []) {
    const child = docOf(conceito);
    const parentId = idOf(pai);
    if ((child.broader || []).includes(parentId)) { record(3, 'broader', `${conceito} → ${pai}`, 'skip', 'já ligado'); continue; }
    await call('POST', `/concepts/${child.id}/broader`, { version: child.version, targetId: parentId });
    record(3, 'broader', `${conceito} → ${pai}`, 'ok');
  }
  for (const { a, b } of plan.related || []) {
    const left = docOf(a);
    const rightId = idOf(b);
    if ((left.related || []).includes(rightId)) { record(3, 'related', `${a} ↔ ${b}`, 'skip', 'já ligado'); continue; }
    await call('POST', `/concepts/${left.id}/related`, { version: left.version, targetId: rightId });
    record(3, 'related', `${a} ↔ ${b}`, 'ok');
  }
}

// ─────────────────────────── Fase 4 — notas e ativação ───────────────────────────

async function fase4() {
  for (const [label, notes] of Object.entries(plan.notas || {})) {
    const doc = docOf(label);
    const payload = {};
    for (const field of ['definition', 'scopeNote', 'historyNote', 'example']) {
      if (notes[field] !== undefined && doc[field] !== notes[field]) payload[field] = notes[field];
    }
    const fields = Object.keys(payload);
    if (fields.length === 0) { record(4, 'notes', label, 'skip', 'já idêntico'); continue; }
    await call('PUT', `/concepts/${doc.id}`, { version: doc.version, ...payload });
    record(4, 'notes', label, 'ok', fields.join(', '));
  }
  for (const label of plan.ativar || []) {
    const doc = docOf(label);
    if (doc.status !== 'candidate') { record(4, 'activate', label, 'skip', `status ${doc.status}`); continue; }
    await call('POST', `/concepts/${doc.id}/activate`, { version: doc.version });
    record(4, 'activate', label, 'ok');
  }
}

// ─────────────────────────── execução ───────────────────────────

const t0 = Date.now();
console.log(`campo=${plan.campoSemantico} plano=${planPath}${DRY ? ' (DRY-RUN)' : ''}`);
await fase2();
await fase3();
await fase4();

const tally = log.reduce((acc, e) => {
  const k = `${e.phase}:${e.op}:${e.outcome}`;
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
console.log('\n== resumo ==');
for (const [k, v] of Object.entries(tally).sort()) console.log(`${k} = ${v}`);
console.log(`escritas=${log.filter((e) => e.outcome === 'ok').length} ignoradas=${log.filter((e) => e.outcome === 'skip').length} tempo=${((Date.now() - t0) / 1000).toFixed(1)}s`);
