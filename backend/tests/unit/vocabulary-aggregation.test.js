/**
 * Agregação por Conceito (ADR-003).
 *
 * A Apresentação conta Conceitos, nunca Rótulos: `alimentar` e `alimentação`
 * são um Conceito com dois Rótulos e devem ser uma faixa só no Sankey. As
 * regras de identidade vivem no BioCultTermos, publicadas na view
 * `etnotermos_label_map`.
 *
 * A DDL da view é lida do arquivo do submódulo em vez de copiada, para que uma
 * mudança lá quebre este teste em vez de passar despercebida. Sem o submódulo
 * inicializado, os casos que dependem da view são pulados — o mesmo cenário de
 * degradação que o próprio código trata.
 *
 * Rodar isolado:
 *   npx jest backend/tests/unit/vocabulary-aggregation.test.js
 */

process.env.SQLITE_DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const database = require('../../src/shared/database');
const { insertEvidence } = require('../../src/services/database');
const { getSankeyData, getCommunityCount } = require('../../src/services/statistics');
const vocabulary = require('../../src/services/vocabulary');
const { Status } = require('../../src/models/Evidence');

const TERMOS_DB_FILE = path.join(
  __dirname,
  '../../../bioculttermos/backend/src/shared/database.js'
);

/**
 * Extract the real `CREATE VIEW etnotermos_label_map` DDL from the BioCultTermos
 * source. Returns null when the submodule is not checked out.
 */
function readLabelMapDdl() {
  if (!fs.existsSync(TERMOS_DB_FILE)) return null;

  const src = fs.readFileSync(TERMOS_DB_FILE, 'utf8');
  const start = src.indexOf('function ensureLabelMapView');
  if (start === -1) return null;

  const open = src.indexOf('`', start);
  const close = src.indexOf('`);', open + 1);
  if (open === -1 || close === -1) return null;

  return src.slice(open + 1, close);
}

const labelMapDdl = readLabelMapDdl();

/** SKOS-XL label literal, public por default (mirrors Concept.js). */
function label(literalForm, accessLevel = 'public', language = 'por') {
  return { literalForm, accessLevel, language };
}

function seedConcept(db, id, doc) {
  db.prepare('INSERT INTO etnotermos (id, doc, created_at, updated_at) VALUES (?,?,?,?)').run(
    id,
    JSON.stringify({ id, ...doc }),
    '2026-01-01',
    '2026-01-01'
  );
}

/** Create the etnotermos table + the real view, then seed the fixture concepts. */
function installLabelMap() {
  const db = database.getConnection();

  db.exec(`
    CREATE TABLE IF NOT EXISTS etnotermos (
      id TEXT PRIMARY KEY, doc TEXT NOT NULL, created_at TEXT, updated_at TEXT
    );
  `);
  db.exec('DELETE FROM etnotermos;');

  // Um Conceito, sete Rótulos — o caso do painel.
  seedConcept(db, 'c-alimentar', {
    status: 'candidate',
    prefLabels: [label('alimentar')],
    altLabels: [label('alimentação'), label('alimento'), label('comida')],
    hiddenLabels: [label('alimentacao')]
  });
  seedConcept(db, 'c-medicinal', {
    status: 'active',
    prefLabels: [label('medicinal')],
    altLabels: [label('remédio')]
  });
  // Termo reservado: nenhum Rótulo público, não pode nomear eixo de gráfico.
  seedConcept(db, 'c-reservado', {
    status: 'active',
    prefLabels: [label('ritual-reservado', 'sacred')],
    altLabels: [label('uso-restrito', 'restricted')]
  });
  // Conceito aposentado aponta para o sucessor.
  seedConcept(db, 'c-velho', {
    status: 'deprecated',
    replacedBy: 'c-medicinal',
    prefLabels: [label('fitoterápico')]
  });

  db.exec(labelMapDdl);
  vocabulary.resetLabelMapCache();
}

function removeLabelMap() {
  const db = database.getConnection();
  db.exec('DROP VIEW IF EXISTS etnotermos_label_map;');
  db.exec('DROP TABLE IF EXISTS etnotermos;');
  vocabulary.resetLabelMapCache();
}

function community(nome, tipo, tiposUso) {
  return {
    nome,
    tipo,
    municipio: 'Ubatuba',
    estado: 'São Paulo',
    local: '',
    atividadesEconomicas: [],
    observacoes: '',
    plantas: tiposUso.map((uso) => ({
      nomeCientifico: ['Bidens pilosa'],
      nomeVernacular: ['picão'],
      tipoUso: [uso]
    }))
  };
}

function evidence(titulo, comunidades) {
  return {
    titulo,
    autores: ['SILVA, J.'],
    ano: 2020,
    resumo: 'Resumo de teste',
    DOI: '',
    status: Status.APPROVED,
    fonte: 'etnodb',
    comunidades
  };
}

function linkFor(result, source, target) {
  return result.links.find((l) => l.source === source && l.target === target);
}

beforeAll(() => {
  database.connect();
});

afterAll(() => {
  database.close();
});

beforeEach(() => {
  const db = database.getConnection();
  db.exec(`DELETE FROM ${database.TABLE};`);
  removeLabelMap();
});

const describeWithMap = labelMapDdl ? describe : describe.skip;

describeWithMap('Sankey — agregação por Termo Preferencial', () => {
  test('rótulos do mesmo Conceito viram uma única faixa, somando os valores', async () => {
    installLabelMap();
    await insertEvidence(
      evidence('E1', [
        community('C1', 'Caiçaras', ['alimentar', 'alimentação', 'Alimento', 'comida'])
      ])
    );

    const result = await getSankeyData({}, 10);

    expect(result.useTypeOrder).toEqual(['alimentar']);
    expect(result.links).toHaveLength(1);
    expect(linkFor(result, 'Caiçaras', 'alimentar').value).toBe(4);
  });

  test('o corte Top-N opera sobre Conceitos, não sobre Rótulos', async () => {
    installLabelMap();
    // Por rótulo: medicinal=3 vence, alimentar=2 e alimentação=2 perdem.
    // Por conceito: alimentar=4 vence. É o defeito que o corte antes da
    // agregação escondia.
    await insertEvidence(
      evidence('E1', [
        community('C1', 'Caiçaras', [
          'alimentar',
          'alimentar',
          'alimentação',
          'alimentação',
          'medicinal',
          'medicinal',
          'medicinal'
        ])
      ])
    );

    const result = await getSankeyData({}, 1);

    expect(result.useTypeOrder).toEqual(['alimentar']);
    expect(linkFor(result, 'Caiçaras', 'alimentar').value).toBe(4);
  });

  test('rótulo aposentado é contado sob o Conceito que o substituiu', async () => {
    installLabelMap();
    await insertEvidence(
      evidence('E1', [community('C1', 'Caiçaras', ['fitoterápico', 'medicinal', 'remédio'])])
    );

    const result = await getSankeyData({}, 10);

    expect(result.useTypeOrder).toEqual(['medicinal']);
    expect(linkFor(result, 'Caiçaras', 'medicinal').value).toBe(3);
  });

  test('valor sem Conceito aparece cru, sem virar balde', async () => {
    installLabelMap();
    await insertEvidence(
      evidence('E1', [community('C1', 'Caiçaras', ['tingimento', 'alimentação'])])
    );

    const result = await getSankeyData({}, 10);

    expect(result.useTypeOrder.sort()).toEqual(['alimentar', 'tingimento']);
    expect(linkFor(result, 'Caiçaras', 'tingimento').value).toBe(1);
  });

  test('Conceito sem nenhum Rótulo público não entra no gráfico', async () => {
    installLabelMap();
    await insertEvidence(
      evidence('E1', [community('C1', 'Caiçaras', ['ritual-reservado', 'uso-restrito', 'medicinal'])])
    );

    const result = await getSankeyData({}, 10);

    expect(result.useTypeOrder).toEqual(['medicinal']);
    expect(result.links.map((l) => l.target)).not.toContain('ritual-reservado');
    expect(result.links.map((l) => l.target)).not.toContain('uso-restrito');
    expect(linkFor(result, 'Caiçaras', 'medicinal').value).toBe(1);
  });

  test('variants declara quais rótulos crus foram fundidos', async () => {
    installLabelMap();
    await insertEvidence(
      evidence('E1', [community('C1', 'Caiçaras', ['alimentar', 'alimentação', 'medicinal'])])
    );

    const result = await getSankeyData({}, 10);

    expect(result.variants.alimentar.sort()).toEqual(['alimentar', 'alimentação']);
    // Um rótulo que não fundiu nada não polui o tooltip.
    expect(result.variants.medicinal).toBeUndefined();
  });

  test('o eixo de tipo de comunidade também é normalizado', async () => {
    installLabelMap();
    const db = database.getConnection();
    seedConcept(db, 'c-caicara', {
      status: 'candidate',
      prefLabels: [label('Caiçaras')],
      altLabels: [label('caiçara')]
    });
    db.exec(labelMapDdl);
    vocabulary.resetLabelMapCache();

    await insertEvidence(evidence('E1', [community('C1', 'Caiçaras', ['medicinal'])]));
    await insertEvidence(evidence('E2', [community('C2', 'caiçara', ['medicinal'])]));

    const result = await getSankeyData({}, 10);

    expect(result.links).toHaveLength(1);
    expect(linkFor(result, 'Caiçaras', 'medicinal').value).toBe(2);
  });
});

describeWithMap('expandLabels — filtros casam por Conceito', () => {
  test('devolve todos os Rótulos irmãos do Conceito', () => {
    installLabelMap();
    const labels = vocabulary.expandLabels(database.getConnection(), 'alimentar');

    expect(labels.sort()).toEqual(
      ['alimentacao', 'alimentar', 'alimentação', 'alimento', 'comida'].sort()
    );
  });

  test('a chave ignora caixa e espaço em volta, como na aquisição', () => {
    installLabelMap();
    const labels = vocabulary.expandLabels(database.getConnection(), '  ALIMENTAÇÃO ');

    expect(labels).toContain('alimentar');
  });

  test('acento faltando NÃO casa — a chave é a mesma da aquisição', () => {
    installLabelMap();
    const labels = vocabulary.expandLabels(database.getConnection(), 'alimenticio');

    expect(labels).toEqual(['alimenticio']);
  });

  test('valor sem Conceito volta como está', () => {
    installLabelMap();
    expect(vocabulary.expandLabels(database.getConnection(), 'tingimento')).toEqual(['tingimento']);
  });
});

describeWithMap('getCommunityCount — fatias por Conceito', () => {
  test('Conceito reservado conta no total mas não nomeia fatia', async () => {
    installLabelMap();
    const db = database.getConnection();
    seedConcept(db, 'c-tipo-reservado', {
      status: 'active',
      prefLabels: [label('tipo-sagrado', 'sacred')]
    });
    db.exec(labelMapDdl);
    vocabulary.resetLabelMapCache();

    await insertEvidence(evidence('E1', [community('C1', 'Caiçaras', ['medicinal'])]));
    await insertEvidence(evidence('E2', [community('C2', 'tipo-sagrado', ['medicinal'])]));

    const result = await getCommunityCount({});

    expect(result.total).toBe(2);
    expect(result.byType.map((t) => t.tipo)).toEqual(['Caiçaras']);
  });
});

describe('sem BioCultTermos — degrada em vez de derrubar', () => {
  test('o Sankey volta ao comportamento cru quando a view não existe', async () => {
    removeLabelMap();
    await insertEvidence(
      evidence('E1', [community('C1', 'Caiçaras', ['alimentar', 'alimentação'])])
    );

    const result = await getSankeyData({}, 10);

    expect(result.useTypeOrder.sort()).toEqual(['alimentar', 'alimentação']);
    expect(result.links).toHaveLength(2);
    expect(result.variants).toEqual({});
  });

  test('expandLabels devolve o valor original quando a view não existe', () => {
    removeLabelMap();
    expect(vocabulary.expandLabels(database.getConnection(), 'alimentação')).toEqual([
      'alimentação'
    ]);
  });

  test('getCommunityCount segue contando sem a view', async () => {
    removeLabelMap();
    await insertEvidence(evidence('E1', [community('C1', 'Caiçaras', ['medicinal'])]));

    const result = await getCommunityCount({});

    expect(result.total).toBe(1);
    expect(result.byType).toEqual([{ tipo: 'Caiçaras', count: 1 }]);
  });
});
