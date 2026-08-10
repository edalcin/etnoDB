<div align="center">
  <img src="assets/BioCultDBLogo.png" alt="BioCultDB" width="160">
</div>

# Documentação do BioCultDB

Índice de tudo que vive em `docs/`. Cada pasta tem um propósito único — se um documento novo não
couber claramente em uma delas, o lugar provavelmente está errado (ou falta uma pasta).

| Pasta | Propósito | Quem lê |
|---|---|---|
| [`decisions/`](#decisions--decisões-e-especificação) | Por que o sistema é assim: ADRs, especificação, modelo de dados, contratos de API | Quem vai mexer no código |
| [`curadoria/`](#curadoria--vocabulário-controlado-bioculttermos) | Como o vocabulário controlado do BioCultTermos é curado, e o registro de cada campanha | Curador / terminólogo |
| [`operacao/`](#operacao--instalação-implantação-e-produção) | Instalar, implantar e operar a unidade em produção | Operador / administrador |
| [`referencia/`](#referencia--fontes-primárias-de-domínio) | Fontes primárias de domínio (etnobotânica, legislação, exemplo canônico de dado) | Todos |
| [`assets/`](#assets--imagens) | Imagens usadas pelos documentos | — |
| [`agents/`](#agents--instruções-para-agentes-de-ia) | Convenções que agentes de IA seguem neste repositório | Agentes / mantenedor |

```
docs/
├── README.md                    ← este índice
├── decisions/                   decisões de arquitetura e especificação
│   └── contracts/               contratos HTTP dos três contextos
├── curadoria/                   vocabulário controlado (BioCultTermos)
│   └── tipos-de-uso/            campanha do campo "Tipos de Usos de Plantas"
├── operacao/                    instalação, corte em produção, histórico de manutenção
├── referencia/                  fontes primárias de domínio
├── assets/                      imagens
└── agents/                      convenções para agentes de IA
```

---

## `decisions/` — decisões e especificação

Registro das decisões que governam o código. ADRs locais complementam — nunca contradizem — as ADRs
do ecossistema em
[`Arquitetura-BioCultural/docs/architecture-decisions/`](https://github.com/edalcin/Arquitetura-BioCultural/tree/main/docs/architecture-decisions).

| Arquivo | O que é |
|---|---|
| [`ADR-001-integracao-bioculttermos.md`](decisions/ADR-001-integracao-bioculttermos.md) | Integração operacional do BioCultTermos na Unidade de Fontes Secundárias: um container, um SQLite, duas aplicações. **Aceito e implementado** (corte em produção em 2026-07-13). |
| [`ADR-002-extracao-por-ia.md`](decisions/ADR-002-extracao-por-ia.md) | Absorção do BioCultPapers pelo BioCultDB: a extração de evidências por IA passa a acontecer dentro da unidade, eliminando a entrega por arquivo JSON. **Aceito** em 2026-08-02. |
| [`spec.md`](decisions/spec.md) | Especificação funcional original da interface web (dez/2025): histórias de usuário, requisitos FR-001…, critérios de aceite. Documento histórico — cita MongoDB, substituído por SQLite. |
| [`data-model.md`](decisions/data-model.md) | Modelo de dados sobre o document store SQLite JSON1 (`biocultdb_records`): entidades, validação, índices e colunas geradas. |
| [`technology-decision.md`](decisions/technology-decision.md) | Decisão de stack tecnológica (dez/2025), com nota de atualização: a implementação real usa **Express** e **SQLite + JSON1**, não Fastify e MongoDB. |
| [`etnochat-plan.md`](decisions/etnochat-plan.md) | Plano do **etnoChat**: consulta em linguagem natural com múltiplos provedores de IA, chave no browser. Status: planejado. |
| [`contracts/acquisition-api.md`](decisions/contracts/acquisition-api.md) | Contrato HTTP do contexto de **Aquisição** (porta 3001) — entrada de evidências. |
| [`contracts/curation-api.md`](decisions/contracts/curation-api.md) | Contrato HTTP do contexto de **Curadoria** (porta 3002) — edição e aprovação. |
| [`contracts/presentation-api.md`](decisions/contracts/presentation-api.md) | Contrato HTTP do contexto de **Apresentação** (porta 3003) — busca e consulta pública. |

## `curadoria/` — vocabulário controlado (BioCultTermos)

Como transformar termos crus coletados pela aquisição em conceitos SKOS-XL curados, e o registro
de cada campanha de curadoria já executada.

| Arquivo | O que é |
|---|---|
| [`Manual.md`](curadoria/Manual.md) | **Manual de Curadoria** — publicado como site em [edalcin.github.io/BioCultTermos](https://edalcin.github.io/BioCultTermos/), capítulo por capítulo: termo × conceito, rótulos `pref`/`alt`/`hidden`, notas de escopo, hierarquia, idiomas (ISO 639-3), CARE. É o critério normativo de qualquer curadoria; o arquivo local é só um ponteiro. |
| [`avaliacao-campos-semanticos.md`](curadoria/avaliacao-campos-semanticos.md) | Três análises sobre o modelo do vocabulário: unificar nomes científicos e vernaculares num só conceito (**não**), o `pref` quando não há preferência cultural, e `alt` × RT entre nomes vernaculares. O raciocínio segue válido; o alvo do mapeamento foi atualizado pela decisão abaixo. |
| [`decisao-nomes-cientificos-fora-de-escopo.md`](curadoria/decisao-nomes-cientificos-fora-de-escopo.md) | **Decisão (2026-08-10)**: o Campo Semântico "Nomes Científicos de Plantas" sai do escopo de curadoria do BioCultTermos — nome científico é regido pelo ICN e verificável em autoridade externa. Contém o plano de implementação em quatro fases. Nenhum dado é apagado. |

### `curadoria/tipos-de-uso/` — campanha do campo `comunidades.plantas.tipoUso`

Curadoria assistida dos 713 termos do Campo Semântico "Tipos de Usos de Plantas", **executada em
produção em 2026-08-07** (713 → 332 conceitos).

| Arquivo | O que é |
|---|---|
| [`procedimento.md`](curadoria/tipos-de-uso/procedimento.md) | O procedimento em cinco fases, as decisões D1–D13, os riscos aceitos e o §14 com o registro da execução real. Documento condutor da campanha. |
| [`proposta.md`](curadoria/tipos-de-uso/proposta.md) | A proposta termo a termo: 713 decisões, a lista curta dos 30 casos duvidosos e as quatro divergências levantadas pelo curador na revisão. |
| [`plano-tipouso.json`](curadoria/tipos-de-uso/plano-tipouso.json) | O plano executável derivado da proposta: operações, conceitos novos, promoções, backup usado e resultado da execução. |
| [`fase1-criar-pais.mjs`](curadoria/tipos-de-uso/fase1-criar-pais.mjs) | Script da Fase 1 — cria os conceitos-pai novos usando a mesma fábrica de domínio da aquisição, de dentro do container (a API Admin não expõe criação de conceito). Idempotente. |

## `operacao/` — instalação, implantação e produção

| Arquivo | O que é |
|---|---|
| [`UNRAID_INSTALLATION.md`](operacao/UNRAID_INSTALLATION.md) | Guia completo de instalação e atualização no Unraid pela interface web: variáveis, portas, volume do SQLite, backup e diagnóstico. |
| [`corte-producao-unidade.md`](operacao/corte-producao-unidade.md) | Runbook do corte in-place do container de produção da imagem single-app para a imagem dual-app (BioCultDB + BioCultTermos sobre o mesmo SQLite), com o registro do que foi executado. |
| [`LIMPEZA_2026-07-11.md`](operacao/LIMPEZA_2026-07-11.md) | Registro histórico da limpeza profunda do repositório em 2026-07-11, incluindo a remediação de uma credencial vazada. Os caminhos citados são os daquela data. |

## `referencia/` — fontes primárias de domínio

Material de origem, não artefato de processo: é daqui que sai o vocabulário e o formato do dado.

| Arquivo | O que é |
|---|---|
| [`tipoUso.txt`](referencia/tipoUso.txt) | 453 tipos de uso de plantas compilados da literatura etnobotânica. Semeado como conceitos `candidate` a cada aquisição (via `bioculttermos/backend/src/data/referenceTerms.js`) e usado como corpus de exemplos no Manual de Curadoria. |
| [`termosPreferidosCESP.txt`](referencia/termosPreferidosCESP.txt) | Treze categorias de uso de alto nível (Medicinal, Alimentício, Tecnologia Social, …) — candidatas naturais a conceitos-pai da hierarquia de tipos de uso. |
| [`povosComunidadesTradicionaisDecreto8750.txt`](referencia/povosComunidadesTradicionaisDecreto8750.txt) | Os 29 povos e comunidades tradicionais reconhecidos pelo Decreto 8.750/2016 — vocabulário de referência para o campo "tipo de comunidade". |
| [`dataStructure.json`](referencia/dataStructure.json) | Exemplo canônico da estrutura hierárquica do documento (referência → comunidades → plantas), preenchido com Hanazaki et al. 2000. É o formato citado pela `spec.md` e pelo `data-model.md`. |
| [`Hanazakietal2000.pdf`](referencia/Hanazakietal2000.pdf) | O artigo que originou o exemplo acima. Também é o PDF real usado para validar a leitura de PDF no navegador da Extração por IA. |

## `assets/` — imagens

| Arquivo | O que é |
|---|---|
| `BioCultDBLogo.png` | Logo do projeto, usado no `README.md` e nos documentos. |
| `modeloBasico.png` | Diagrama do modelo conceitual básico: Comunidade Tradicional —(evidência / referência bibliográfica)— Plantas. |

## `agents/` — instruções para agentes de IA

| Arquivo | O que é |
|---|---|
| [`domain.md`](agents/domain.md) | Que documentação de domínio um agente deve ler antes de explorar o código (`CONTEXT.md`, `docs/decisions/`, ADRs do ecossistema) e a convenção de nome `ADR-NNN-slug.md`. |
| [`issue-tracker.md`](agents/issue-tracker.md) | Issues e specs vivem como markdown em `.scratch/<feature-slug>/`; convenções de arquivo, numeração e triagem. |

---

## Documentação fora de `docs/`

| Arquivo | O que é |
|---|---|
| [`../README.md`](../README.md) | Visão geral do projeto, arquitetura, fluxo de trabalho e ecossistema federado. |
| [`../INSTALLATION.md`](../INSTALLATION.md) | Instalação para desenvolvimento local e resumo do deploy via Docker. |
| [`../integracao.md`](../integracao.md) | Checklist executado da integração com o BioCultTermos, glossário e os bugs de estabilização pós-corte. |
| [`../CONTEXT.md`](../CONTEXT.md) | Linguagem ubíqua do domínio — os termos que o código e estes documentos usam. |
| [`../CLAUDE.md`](../CLAUDE.md) | Convenções do repositório para agentes de IA. |