# BioCultDB Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-06

## Integração com BioCultTermos

O **BioCultDB** está integrado com o sistema **BioCultTermos** de vocabulário controlado:

### Banco de Dados Compartilhado
- **Database**: SQLite `unidade.sqlite` (arquivo único, compartilhado entre BioCultDB e BioCultTermos via `SQLITE_DB_PATH`)
- **Tabelas**:
  - `biocultdb_records` - dados de referências etnobotânicas (BioCultDB)
  - `etnotermos` - vocabulário controlado (BioCultTermos)

### Vocabulário Controlado
Os campos abaixo do BioCultDB são gerenciados como vocabulário controlado pelo BioCultTermos:
- **comunidades.tipo**: 29 categorias de comunidades tradicionais (Decreto 8.750/2016)
- **comunidades.plantas.tipoUso**: Tipos de uso de plantas (medicinal, alimentício, etc.)

### Identidade Visual Compartilhada
O BioCultTermos usa exatamente a mesma identidade visual do BioCultDB:
- Tema "forest" do Tailwind CSS
- Mesmos componentes (botões, cards, formulários)
- Mesma estrutura de páginas
- Resultado: sistemas visualmente indistinguíveis

### Portas
- **BioCultDB**: 3001 (aquisição), 3002 (curadoria), 3003 (apresentação)
- **BioCultTermos**: 4000 (público), 4001 (admin)

## Active Technologies

- Node.js 20 LTS (Alpine Linux base) + Express.js (web framework), better-sqlite3 (SQLite + JSON1), EJS (templates), HTMX + Alpine.js (frontend), Tailwind CSS (001-web-interface)

## Project Structure

```text
backend/
├── src/
│   ├── contexts/
│   │   ├── acquisition/    # Port 3001
│   │   ├── curation/       # Port 3002
│   │   └── presentation/   # Port 3003
│   ├── models/
│   ├── services/
│   └── shared/
frontend/
└── src/
    ├── acquisition/styles/
    ├── curation/styles/
    ├── presentation/styles/
    └── shared/styles/      # Forest theme colors
tests/
```

## Commands

```bash
# Development
cd backend
npm run dev:acquisition   # Port 3001
npm run dev:curation      # Port 3002
npm run dev:presentation  # Port 3003

# Frontend CSS
cd frontend
npm run build:css
npm run watch:css

# Docker
docker-compose up -d
```

## Code Style

- **JavaScript**: ES2022+, Node.js 20 LTS
- **Templates**: EJS with semantic HTML
- **CSS**: Tailwind CSS utility classes (forest theme)
- **Testing**: Jest (SQLite `:memory:`)

## Recent Changes

- 2026-01-06: Integrated with BioCultTermos - shared database and visual identity
- 2026-01-06: Documented controlled vocabulary management (comunidades.tipo, plantas.tipoUso)
- 2025-12-25: Added Node.js 20 LTS (Alpine Linux base) + Express.js (web framework), better-sqlite3 (SQLite + JSON1), EJS (templates), HTMX + Alpine.js (frontend), Tailwind CSS

<!-- MANUAL ADDITIONS START -->
## BioCultTermos — onde manter o código

O `bioculttermos/` deste repositório é a **Cópia de Trabalho** do Módulo Compartilhado BioCultTermos
nesta Unidade Hospedeira — não é um sub-repositório nem um clone descartável. É aqui que se edita o
código do BioCultTermos quando a mudança é motivada pelo BioCultDB.

Regras vigentes — ADR-012 em `Arquitetura-BioCultural/docs/architecture-decisions/`, que **supersede
parcialmente ADR-007 F3 e ADR-010** no ponto em que declaravam o bump entre unidades opcional:

- **Nunca** clone o BioCultTermos fora de uma Unidade Hospedeira (G2). Um clone standalone não pode ser
  executado nem testado desde o ADR-007 F2, e só envelhece até divergir.
- Antes de editar: `git -C bioculttermos pull --ff-only`. Se falhar, há commit local esquecido — resolva
  antes de tocar em qualquer coisa.
- Todo commit precisa ser **seguro para as quatro unidades** (G4/G5): nada específico do BioCultDB entra
  no código do módulo.
- Commit + push ao remoto compartilhado e registro em `bioculttermos/CHANGELOG.md` — data, unidade de
  origem (BioCultDB), resumo, SHA — continuam obrigatórios (ADR-010 G2). Com
  `push.recurseSubmodules=on-demand`, o `git push` na raiz publica o módulo e o ponteiro juntos.
- A adoção de novas versões do módulo é **obrigatória e assíncrona** (G4), não mais opcional: esta
  unidade deve zerar seu Atraso de Módulo, no seu tempo.
- Veja o Atraso de Módulo das quatro unidades: `pwsh Arquitetura-BioCultural/bin/termos-status.ps1`.

**Build Docker**: use sempre `docker/build-unidade.sh` (nunca `docker compose build` direto) — ele falha
cedo se o submodule local não bater com o commit pinado, e carimba `/app/BUILD_INFO` com os SHAs do
BioCultDB e do bioculttermos, verificável em runtime via `docker exec <container> cat /app/BUILD_INFO`
(ADR-010 G3). Ver `docker/Dockerfile.unidade` e `verify-container-setup.sh`.

Estratégia completa: `Arquitetura-BioCultural/docs/gestaoBioCultTermos/` · Decisão:
`Arquitetura-BioCultural/docs/architecture-decisions/ADR-012-manutencao-codigo-bioculttermos.md`
<!-- MANUAL ADDITIONS END -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Arquitetura v3.1 — Persistência
Persistência = SQLite com JSON (JSON1), **um arquivo por unidade federada** compartilhado pelas ferramentas (tabelas distintas), WAL, `SQLITE_DB_PATH`. Um container por unidade. Sem MongoDB.
Ref.: Arquitetura-BioCultural/docs/architecture-decisions/ADR-005.

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout (`CONTEXT.md` na raiz + ADRs em `docs/decisions/`). See `docs/agents/domain.md`.
Índice de toda a documentação: `docs/README.md` — mantenha-o atualizado ao criar ou mover um documento.
