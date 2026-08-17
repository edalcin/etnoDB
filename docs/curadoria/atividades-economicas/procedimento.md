<div align="center">
  <img src="../../assets/BioCultDBLogo300.png" alt="BioCultDB" width="160">
</div>

# Curadoria do Campo Semântico "Atividades Econômicas" — execução e relatório

### `comunidades.atividadesEconomicas` · 36 termos → 38 conceitos vivos · 2026-08-17

> **Estado: EXECUTADA em produção.** As cinco fases foram aplicadas pela API Admin na porta 4001,
> com o container no ar, sobre o backup
> `backup-pre-curadoria-atividadeseconomicas-2026-08-17T17-19-02Z.sqlite`.
> Resultado: **36 → 42 conceitos no campo** (38 `active`, 0 `candidate`, 4 `deprecated`), 110 entradas
> de auditoria, **zero erro e zero `409`**, e a curadoria **verificada sobrevivente** a dois ciclos
> completos de aquisição (`criados=0` no campo).
> A proposta termo a termo está em [`proposta.md`](proposta.md); o plano legível por máquina, em
> [`plano-atividades-economicas.json`](plano-atividades-economicas.json).
> O método genérico, aplicável ao próximo campo, foi extraído para
> [`../runbook-campo-semantico.md`](../runbook-campo-semantico.md).

---

## Sumário

1. [O que mudou em relação à campanha anterior](#1-o-que-mudou-em-relação-à-campanha-anterior)
2. [Levantamento do estado de produção](#2-levantamento-do-estado-de-produção)
3. [Backup e recuperação](#3-backup-e-recuperação)
4. [Desenho da taxonomia](#4-desenho-da-taxonomia)
5. [Regras de decisão aplicadas](#5-regras-de-decisão-aplicadas)
6. [Execução](#6-execução)
7. [Conferências da Fase 5](#7-conferências-da-fase-5)
8. [Achado: rótulo oculto não é buscável](#8-achado-rótulo-oculto-não-é-buscável)
9. [Registro de decisões](#9-registro-de-decisões)
10. [O que ficou para depois](#10-o-que-ficou-para-depois)

---

## 1. O que mudou em relação à campanha anterior

A curadoria de "Tipos de Usos de Plantas" (2026-08-07, 713 termos) resolveu **sujeira de corpus**:
plurais, grafias incorretas, termos em inglês, variantes de regência. Este campo não tem nada disso.
Aqui o trabalho foi outro, e vale nomeá-lo porque é o que se repetirá nos próximos campos:

| Problema | "Tipos de Usos de Plantas" | "Atividades Econômicas" |
|---|---|---|
| Variantes da mesma ideia | 362 termos → rótulo `alt` | **zero** |
| Grafia incorreta | 9 → rótulo oculto | **zero** |
| Termo em inglês | 45 → `alt`/`eng` | **zero** |
| Termo composto | 12 | **1** |
| **Granularidade desigual sem hierarquia** | presente | **é o problema central** |
| **Categoria errada (ocupação em vez de atividade)** | ausente | **3 termos** |
| **Conceito compartilhado com outro campo** | 3, intocados (§7.6) | **2, curados em poli-hierarquia** |

As duas últimas linhas são a novidade metodológica desta campanha, e estão no
[§9](#9-registro-de-decisões) como D2 e D3.

## 2. Levantamento do estado de produção

Apurado por acesso direto ao servidor, somente leitura, em 2026-08-17.

### 2.1 Infraestrutura

| Item | Valor |
|---|---|
| Host | `<HOST_UNRAID>` (`<HOST_HOSTNAME>`, Unraid 6.18.38) |
| Acesso | `ssh -i <chave> root@<HOST_UNRAID>` |
| Container | `BioCultDB`, imagem `ghcr.io/edalcin/biocultdb:latest`, `TZ=America/Sao_Paulo` |
| Banco | `<APPDATA>/biocultdb/data/biocultdb.sqlite` (host) → `/data/biocultdb.sqlite` (container) |
| Journal | **WAL ativo** — backup consistente sem parar o container ([§3](#3-backup-e-recuperação)) |
| Portas | 3091→3001, 3092→3002, 3093→3003 · 4000 (público) · 4001 (admin) |
| Auth admin | Basic Auth, `ADMIN_USERNAME=<ADMIN_USERNAME>`, senha no env do container |

> **Convenção deste documento:** identificadores da instalação aparecem como placeholders —
> `<HOST_UNRAID>`, `<HOST_HOSTNAME>`, `<APPDATA>`, `<ADMIN_USERNAME>`, `<ADMIN_PASSWORD>`. Os valores
> reais vivem no env do container e **não** em documento versionado. Nenhum script desta campanha
> recebe a senha por argumento: o executor a lê de `process.env.ADMIN_PASSWORD` dentro do container e
> nunca a imprime.

**O container estava parado** (`Exited (0)`) no início da sessão e foi iniciado para a execução — a
API Admin é o único caminho de escrita que aplica os invariantes, e ela exige o serviço no ar.

### 2.2 Estado do campo antes

34 dos 36 conceitos estavam `candidate`; `pesca` e `artesanato` já estavam `active`, herdados da
curadoria de "Tipos de Usos de Plantas", com o pai `material e tecnológico`. Fora esses dois, o campo
era **folha em branco**: zero definição, zero nota, zero rótulo alternativo ou oculto, zero relação.
Todos os 36 rótulos em `por` e `public`.

Distribuição do vocabulário no momento do levantamento (1768 conceitos):

| `sourceFields` | Conceitos |
|---|---:|
| `comunidades.plantas.nomeVernacular` | 982 |
| `comunidades.plantas.tipoUso` | 744 (curado) |
| **`comunidades.atividadesEconomicas`** | **36** |
| `comunidades.tipo` | 9 |

### 2.3 O corpus de origem

Os 36 termos vêm de 29 registros e descrevem o meio de vida das comunidades. Frequências que
importaram para o desenho: `agricultura` 21 · `agricultura de subsistência` 12 ·
`coleta do palmito juçara`, `exploração do palmito para venda`,
`manejo de sementes de juçara para venda` e `pesca` 7 cada · `turismo` 6 · os demais 1 ou 2.

O complexo da juçara aparece em 7 comunidades quilombolas do Vale do Ribeira, sempre com os três
termos juntos — foi o que motivou as duas únicas relações RT da campanha.

## 3. Backup e recuperação

Com WAL ativo, `VACUUM INTO` produz um snapshot íntegro **com o container no ar**:

```bash
D=<APPDATA>/biocultdb/data
B=$D/backup-pre-curadoria-atividadeseconomicas-$(date -u +%Y-%m-%dT%H-%M-%SZ).sqlite
sqlite3 "file:$D/biocultdb.sqlite?mode=ro" "VACUUM INTO '$B';"
sqlite3 "$B" 'PRAGMA integrity_check;'   # deve responder: ok
md5sum "$B"
```

Executado antes de qualquer escrita:

| Item | Valor |
|---|---|
| Arquivo | `backup-pre-curadoria-atividadeseconomicas-2026-08-17T17-19-02Z.sqlite` |
| `integrity_check` | `ok` |
| md5 | `138f1d319f2e9640ac0128d540118e24` |
| Tamanho | 4,52 MB |
| Downtime | nenhum |

Restauração:

```bash
docker stop BioCultDB
cp $B $D/biocultdb.sqlite
rm -f $D/biocultdb.sqlite-wal $D/biocultdb.sqlite-shm
docker start BioCultDB
```

Nenhuma operação desta campanha é irreversível: conceito não é apagado, só depreciado, e toda escrita
deixa rastro em `etnotermos_audit_log`.

## 4. Desenho da taxonomia

Sete facetas de 1º nível, profundidade máxima 3, poli-hierarquia em três pontos. Verificada sem
ciclos antes da execução e conferida sem ciclos depois. O desenho e o diagrama estão em
[`proposta.md` §3](proposta.md); o que segue são as três decisões estruturais.

**As facetas saem do corpus, não de uma classificação externa.** Cogitou-se ancorar a árvore na CNAE
(IBGE). Recusado: a CNAE é desenhada para estabelecimento formal e trata mal subsistência,
extrativismo e trabalho não remunerado — que são justamente o assunto deste corpus. As sete facetas
são setores econômicos reconhecíveis, mas recortados pelo que as comunidades declaram.

**`extrativismo vegetal` é faceta separada de `agricultura`.** Coletar juçara da mata e plantar
mandioca não são a mesma atividade, e a distinção cultivo × extrativismo é central na literatura de
meios de vida tradicionais. Sete das 29 comunidades vivem do extrativismo da juçara.

**`agricultura` foi dividida em dois ramos.** `sistema agrícola` (como/para quê se cultiva) e
`cultivo por espécie` (o que se cultiva) separam duas perguntas diferentes que o corpus mistura —
mesma lógica do par `indicação terapêutica` × `ação farmacológica` da campanha anterior.
`produção de hortaliças orgânicas` carrega as duas informações e recebeu **os dois pais**.

## 5. Regras de decisão aplicadas

Aplicação direta do fluxo do Manual §7:

| Situação no corpus | Teste | Decisão | Exemplo |
|---|---|---|---|
| Caso específico de outro | é um tipo de | **hierarquia** (`broader`) | `bovinocultura de leite` → `criação de gado` |
| Distintos mas associados | nem tipo, nem sinônimo | **relacionado (RT)** | `manejo de sementes de juçara` ↔ `coleta do palmito` |
| Termo composto | nomeia dois conceitos | **oculto nos dois** + depreciar apontando o primeiro (§7.4) | `criação de gado e cabras` |
| Ocupação que nomeia a atividade pelo agente | nomeia a atividade, não é outro nome dela | **oculto no conceito da atividade** + depreciar (D2) | `lavrador` → `agricultura` |
| Não nomeia atividade alguma | sem substituto legítimo | **depreciar** → `indeterminado` | `estudante` |
| Conceito já existente em outro campo | mesma unidade de significado, dois campos | **2º pai** (poli-hierarquia, D3) | `pesca`, `artesanato` |

Nenhum caso justificou rótulo **alternativo**, relação de **sinônimo** ou reclassificação de
**`accessLevel`** — ver [`proposta.md` §6](proposta.md).

## 6. Execução

Cinco fases, cada uma verificável antes da seguinte. Os artefatos são versionados junto a este
documento e foram executados de dentro do container:

| Artefato | Papel |
|---|---|
| [`fase1-criar-pais.mjs`](fase1-criar-pais.mjs) | cria os conceitos-pai pela fábrica de domínio (a API Admin não tem rota de criação) |
| [`fases2a4-executar.mjs`](fases2a4-executar.mjs) | executa rótulos, depreciações, hierarquia, notas e ativação pela API Admin |
| [`fase5-conferir.sql`](fase5-conferir.sql) | as 15 conferências pós-execução, somente leitura |
| [`plano-atividades-economicas.json`](plano-atividades-economicas.json) | o plano que o executor consome |

> **Por que a criação de conceito não passa pela API.** A API Admin cobre `GET`, `PUT`, `activate`,
> `deprecate`, rótulos e relações — e nada mais. A Fase 1 usa a **mesma fábrica de domínio que a
> aquisição** (`createConcept` + `insertConcept`), com uma entrada de auditoria por conceito criado.
> Um conceito recém-criado não tem relação alguma: os invariantes que importam — ciclo,
> reciprocidade, cascata de `ancestors`, `version`, auditoria — só passam a valer nas operações
> seguintes, e essas vão **todas** pela API.

**Os dois executores são idempotentes.** Cada operação confere o estado antes de escrever. Provado:
a segunda execução do `fases2a4-executar.mjs` devolveu **92 `skip` e 0 escrita**. Há ainda
`--dry-run`, que resolve todo o plano sem escrever — e foi ele que pegou um erro de chave no plano
antes que tocasse produção.

### O que cada fase escreveu

| Fase | Operação | Volume | Tempo |
|---|---|---:|---:|
| 1 | conceitos-pai criados | 6 | <1 s |
| 2 | `POST /labels` — rótulos ocultos | 4 | — |
| 2 | `POST /deprecate` — 1 `HID2` + 2 `HID` + 1 `DEP` | 4 | — |
| 3 | `POST /broader` | 32 | — |
| 3 | `POST /related` | 2 | — |
| 4 | `PUT /concepts/:id` — 12 definições, 13 notas de escopo, 1 nota histórica | 14 chamadas | — |
| 4 | `POST /activate` | 36 | — |
| | **total** | **92 escritas** | **9,3 s** |

Zero erro, zero `409`, nenhuma retentativa.

### Resultado

| | Antes | Depois |
|---|---:|---:|
| Conceitos no campo | 36 | **42** |
| `active` | 2 | **38** |
| `candidate` | 34 | **0** |
| `deprecated` | 0 | **4** |
| Relações `broader` | 2 | **34** |
| Relações `related` | 0 | **4** (2 pares, simétricas) |
| Rótulos ocultos | 0 | **4** |
| Definições | 0 | **11** |
| Notas de escopo | 0 | **12** |

Fora do campo, um conceito de serviço foi tocado: **`indeterminado`** teve a definição generalizada
(era presa a "uso de planta") e ganhou nota de escopo e nota histórica, para servir a qualquer Campo
Semântico — daí 12 definições e 13 notas de escopo escritas contra 11 e 12 contadas dentro do campo.

## 7. Conferências da Fase 5

| Verificação | Resultado |
|---|---|
| Contagens batem com o plano | ✅ `38 active / 0 candidate / 4 deprecated`, total 42 = 36 + 6 |
| Nenhum órfão | ✅ os únicos ativos sem `broader` são as 7 facetas raiz |
| Sem ciclo | ✅ 0 conceitos com o próprio id em `ancestors` |
| Reciprocidade BT/NT | ✅ 0 relações `broader` sem o `narrower` recíproco |
| Nenhum pai depreciado com filho ativo | ✅ 0 |
| Todo depreciado tem substituto | ✅ 4/4 |
| Termo composto preservado nas duas metades | ✅ `criação de gado e cabras` é oculto em `criação de gado` **e** em `criação de cabras`, ambos `active` |
| Trilha completa | ✅ 110 entradas em 2026-08-17: 40 `status` + 32 `broader` + 13 `scopeNote` + 12 `definition` + 6 `concept` + 4 `hiddenLabels` + 2 `related` + 1 `historyNote` — reconcilia exatamente com as 92 chamadas |
| Idempotência | ✅ 2ª execução: 92 `skip`, 0 escrita |
| **Sobrevive à aquisição** | ✅ ver abaixo |
| Consulta pública responde | ⚠️ parcialmente — ver [§8](#8-achado-rótulo-oculto-não-é-buscável) |

### O teste que importa

Dois ciclos completos de aquisição disparados à mão, após a curadoria:

| Ciclo | `atividadesEconomicas` | Total geral |
|---|---|---|
| 1º (`17:33`) | **criados=0**, existentes=36 | criados=16 |
| 2º (`17:35`) | **criados=0**, existentes=36 | **criados=0** |

Nenhum termo recolhido reapareceu como conceito novo; as contagens do campo (`38/0/4`, total 42)
ficaram **idênticas** antes e depois. A curadoria é permanente.

> **Os 16 conceitos criados no 1º ciclo não são ressurreição** — são dados novos de origem, todos em
> outros campos: 15 em `tipoUso` (`soltar o catarro`, `recuperar de fraturas e luxações`,
> `mata a larva da dengue`, …) e 1 em `nomeVernacular` (`pin`). São frases que nunca haviam sido
> coletadas; a última aquisição anterior fora em 2026-08-10. O 2º ciclo, com `criados=0`, confirma
> que foram semeadas e reconhecidas. As contas fecham exatamente: 1768 + 6 (pais) + 16 (aquisição)
> = 1790 conceitos; `active` 308 + 36 = 344; `deprecated` 411 + 4 = 415.
>
> **Consequência para o curador:** `tipoUso` voltou a ter 15 candidatos crus. É trabalho de
> atualização de campo já curado — o caso que o [runbook](../runbook-campo-semantico.md) chama de
> passada incremental.

### Busca pública verificada

| Busca na porta 4000 | Devolve | Regra |
|---|---|---|
| `agricultura` | 7 conceitos, entre eles as três modalidades sob `sistema agrícola` | hierarquia montada |
| `cabras` | `criação de cabras`, `criação de cabras leiteiras`, `criação de gado` | as duas metades do composto são alcançáveis |
| `GET /concepts/{id de lavrador}` | `410`, `replacedBy` = `agricultura` | lápide aponta o substituto |
| `GET /concepts/{id de estudante}` | `410`, `replacedBy` = `indeterminado` | destino terminal |
| `GET /concepts/{id de dona de casa}` | `410`, `replacedBy` = `atividades domésticas` | — |
| `GET /concepts/{id de criação de gado e cabras}` | `410`, `replacedBy` = `criação de gado` | §7.4 |

## 8. Achado: rótulo oculto não é buscável

**Este é um defeito de produto, anterior a esta campanha, e ele contradiz o Manual.**

O Manual promete que o rótulo oculto *"não deve aparecer ao público, mas **ajuda a busca** a encontrar
o conceito"* (§3.1) e que a grafia errada guardada como oculto faz com que *"a busca ainda encontre"*
(§11). **Não é o que acontece.**

A prova, em três medições:

1. **O índice não tem a coluna.** `etnotermos_fts` é
   `fts5(id UNINDEXED, prefLabels, altLabels, definition, scopeNote, tokenize='unicode61 remove_diacritics 2')`
   — não há `hiddenLabels`. E `syncConceptFts` (`models/Concept.js`) grava só esses quatro campos.
2. **A linha do índice confirma.** Para `criação de gado`, que detém o oculto
   `criação de gado e cabras`, a linha indexada é `pref=[criação de gado] alt=[]`.
3. **A busca falha onde não há outro caminho.** `gazes` (oculto de `gases`) e `inflamation` (oculto de
   `anti-inflamatório`) devolvem **0 resultados** na porta 4000.

Por que isso passou despercebido na campanha anterior: os exemplos usados para declarar sucesso —
`diarréia` → `diarreia`, `hemorróidas` → `hemorroidas`, `ictéricia` → `icterícia` — funcionam por
**dobra de acentos** do tokenizador (`remove_diacritics 2`) contra o rótulo **preferencial**, não pelo
rótulo oculto. O exemplo canônico do Manual, `gazes` → `gases`, é justamente o que **não** funciona,
porque `z` e `s` não se dobram.

Nesta campanha, `lavrador` e `dona de casa` *são* encontrados — mas por acidente: eu os citei
nominalmente nas **notas de escopo** de `agricultura` e `atividades domésticas`, e nota de escopo é
indexada. Retirada a nota, a busca falharia.

**O dado está correto** — os 4 rótulos ocultos estão gravados nos conceitos certos, e as 37 ocultações
do vocabulário inteiro seguem íntegras. O que não funciona é a indexação. A correção não foi feita
porque não estava no escopo pedido e exige alterar código, reconstruir a imagem e reimplantar:

> **Correção proposta (uma linha + backfill).** Em `syncConceptFts`, concatenar os `hiddenLabels` na
> coluna `altLabels` do índice — a coluna FTS é apenas um saco de texto para casamento, e o que se
> exibe vem sempre de `etnotermos.doc`. Isso evita alterar o schema da tabela FTS5 (que exigiria
> recriá-la) e torna os 37 rótulos ocultos buscáveis. Depois, reindexar o vocabulário.

## 9. Registro de decisões

### D1 — A classificação é feita pelo agente, não por chamada a um provedor de IA

**Contexto.** Igual à campanha anterior: não há chave de IA registrada no servidor, e o
[ADR-002](../../decisions/ADR-002-extracao-por-ia.md) D5 decidiu que a chave vive no `localStorage` do
browser e nunca é persistida.

**Decidido.** A classificação dos 36 termos foi produzida diretamente, com o Manual, o schema, o
corpus e as frequências no mesmo contexto. Zero credencial criada.

### D2 — Ocupação vira rótulo oculto da atividade, não rótulo alternativo

**Contexto.** `lavrador`, `dona de casa` e `estudante` são ocupações num campo de atividades. O Manual
não tem regra para esse caso — é a categoria que a campanha anterior não encontrou.

**Recusado.** (a) Rótulo **alternativo**: afirmaria que `lavrador` é outro nome de `agricultura`, e
não é — um é o agente, o outro é a atividade. (b) Depreciação **simples**: perderia a busca por um
termo que a fonte de fato registrou. (c) Manter como conceito próprio sob uma faceta "ocupações":
inventaria um ramo inteiro para 3 termos de 1 ocorrência cada, e o campo não é de ocupações.

**Decidido.** Quando a ocupação **nomeia** uma atividade que existe no vocabulário, ela vira rótulo
**oculto** dessa atividade e o conceito de origem é depreciado apontando-a: `lavrador` → `agricultura`,
`dona de casa` → `atividades domésticas`. Quando **não nomeia atividade alguma**, é depreciação simples
para `indeterminado`, **sem** rótulo — pôr `estudante` como rótulo de `indeterminado` afirmaria uma
equivalência falsa.

**Consequência.** A distinção entre (b) e (c) é o teste "o termo nomeia a atividade?", e ele é
reaproveitável. Ver a ressalva do [§8](#8-achado-rótulo-oculto-não-é-buscável): o ganho de busca
prometido por esta decisão só se realiza quando o índice for corrigido.

### D3 — Conceito compartilhado entre campos ganha um 2º pai, não um conceito novo

**Contexto.** `pesca` e `artesanato` já existiam, `active`, sob `material e tecnológico`, onde
significam *planta empregada na pesca / em artesanato*. Aqui significam *meio de vida*. O Manual §7.6
manda **não tocar** um termo que pertence a outro campo — mas estes pertencem legitimamente **aos
dois**.

**Recusado.** (a) Não tocar: deixaria a faceta econômica sem o seu termo mais frequente (`pesca`, 7
ocorrências) e `pesca artesanal` sem pai coerente. (b) Criar conceitos novos homônimos: dois conceitos
com o mesmo `literalForm` quebram a deduplicação da aquisição, que casa por `literalForm` em
pref + alt + hidden — o segundo conceito ficaria inalcançável para a aquisição.

**Decidido.** Poli-hierarquia: os conceitos compartilhados recebem um **segundo `broader`** na faceta
econômica, e uma **nota de escopo** que registra as duas leituras. Os filhos puramente econômicos
(`pesca artesanal`, `fabricação artesanal de…`) pendem da **faceta**, não do conceito compartilhado,
para não herdar `material e tecnológico` na cascata de `ancestors`.

### D4 — `atividades domésticas` é preservado, com a ressalva escrita no conceito

**Contexto.** Trabalho doméstico não remunerado é "atividade econômica"? A economia clássica diz que
não; a economia feminista diz que sim. Duas comunidades caiçaras o declararam.

**Decidido.** Preservar como faceta ativa e **escrever a controvérsia na nota de escopo**. O
vocabulário registra o que a fonte afirmou; descartar seria o curador sobrepor sua teoria econômica à
declaração da comunidade.

### D5 — `indeterminado` é generalizado, não duplicado

**Contexto.** `estudante` precisava de destino terminal. O `indeterminado` existente tinha definição
presa a "uso de planta".

**Recusado.** Criar um `indeterminado` por campo — duplicaria um conceito de serviço sem ganho.

**Decidido.** Generalizar a definição para servir a qualquer Campo Semântico, com nota de escopo
declarando-o compartilhado e nota histórica registrando a mudança e o motivo. O `sourceFields` dele
**não** foi alterado (a API Admin não expõe esse campo, e ele é da aquisição, não da curadoria) — por
isso `indeterminado` não conta entre os 42 conceitos do campo.

## 10. O que ficou para depois

1. **Corrigir a indexação dos rótulos ocultos** ([§8](#8-achado-rótulo-oculto-não-é-buscável)) —
   é o único item que afeta trabalho já entregue, aqui e na campanha anterior.
2. **Definição dos 27 conceitos-folha.** Só os 11 nós da taxonomia foram definidos, conforme o Manual
   §4.1. As folhas (`cultivo de mandioca`, `turismo`, …) seguem sem definição, que é estado legítimo.
3. **Os 15 novos candidatos em `tipoUso`** semeados pela aquisição desta sessão — passada incremental
   sobre campo já curado.
4. **`nomeVernacular` (983) e `tipo` (9)** seguem crus. O primeiro é o campo sensível: é onde o CARE
   deixa de ser teórico.

---

> **Referências:** [Manual de Curadoria](https://edalcin.github.io/BioCultTermos/) ·
> [runbook genérico](../runbook-campo-semantico.md) ·
> [campanha anterior](../tipos-de-uso/procedimento.md) ·
> [W3C SKOS-XL](https://www.w3.org/TR/skos-reference/skos-xl.html) ·
> [Princípios CARE](https://www.gida-global.org/care)
