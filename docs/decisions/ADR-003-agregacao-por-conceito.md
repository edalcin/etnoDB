# ADR-003: Agregação por Conceito — o BioCultTermos publica, o BioCultDB consome

## Status

**Aceito** — decidido em sessão de `grill-with-docs` em 2026-08-10, implementado na mesma sessão.

Complementa o ADR-001 (integração BioCultTermos como aplicação irmã, SQLite compartilhado) e o
ADR-005 da Arquitetura BioCultural (cada ferramenta é dona das suas tabelas no arquivo da unidade).

## Contexto

O painel mostrava `alimentar` e `alimentação` como dois destinos distintos no Sankey "Tipos de
Comunidade x Tipos de Uso". No BioCultTermos as duas são **Rótulos do mesmo Conceito**, sendo
`alimentar` o Termo Preferencial. O `CONTEXT.md` já afirmava que Tipo de Uso "é vocabulário
controlado, curado no BioCultTermos" — a linguagem prometia o que o código não cumpria: nenhuma
agregação, filtro ou consulta do BioCultDB consultava o `etnotermos`.

O defeito tinha duas metades. A visível: rótulos sinônimos contados separadamente. A invisível: o
corte Top-N acontecia **antes** de qualquer agregação (`statistics.js`, `getSankeyData`), então
rótulos do mesmo Conceito disputavam vagas separadas e podiam, juntos, expulsar do gráfico um uso
genuinamente distinto.

## Decisões

### D1 — Tradução em tempo de consulta, por SQL, no arquivo compartilhado

As duas ferramentas abrem o mesmo SQLite (ADR-001). A resolução Rótulo → Termo Preferencial é um
`JOIN`, sem rede e sempre refletindo a curadoria mais recente.

Rejeitados:

- **HTTP na API pública do BioCultTermos** (porta 4000): acopla por rede dois processos do mesmo
  container, e exigiria criar um endpoint de resolução que não existe.
- **Normalização na escrita** (a Curadoria grava o Termo Preferencial na Evidência): destrutivo. A
  Evidência é fonte secundária; a fidelidade ao que o artigo escreveu é o ativo do acervo.
- **Tabela-mapa materializada**: cache sem problema de desempenho que o justifique (1.768 conceitos).

### D2 — O BioCultTermos publica a view; o BioCultDB nunca abre um documento de conceito

`bioculttermos/backend/src/shared/database.js` cria, junto das suas tabelas, a view

```
etnotermos_label_map (label_key, concept_id, pref_label)
```

O BioCultDB faz `LEFT JOIN` nela e só. **Esta é a parte que um leitor futuro acharia errada sem este
registro**: verá o `statistics.js` consultando um objeto que o BioCultDB não cria e cujo DDL está em
outro repositório, e o palpite natural será "isso deveria ler a tabela direto".

A direção é deliberada e simétrica à que já existe: o BioCultTermos lê `biocultdb_records` porque o
BioCultDB o publica. A recíproca tem de ser uma superfície publicada, não uma leitura por dentro.
Com a view, as regras SKOS-XL (D3, D4, D5) ficam do lado de quem entende SKOS-XL, e uma mudança no
modelo de conceito é corrigida no mesmo commit que a causa.

Custo aceito: alterações exigem commit nos dois repositórios (fluxo já documentado no `CLAUDE.md`).

### D3 — Todo status, todos os três tipos de Rótulo, `replacedBy` um salto

`prefLabels`, `altLabels` e `hiddenLabels` resolvem para o Termo Preferencial, em conceitos
`candidate`, `active` ou `deprecated`; um conceito `deprecated` resolve para o alvo de `replacedBy`,
uma vez, sem recursão.

O status governa o ciclo editorial do Conceito, não a identidade dele: `alimentação` já é o mesmo
Conceito que `alimentar` no instante em que o curador as juntou, antes de qualquer ativação.
Restringir a `active` deixaria quase tudo sem efeito — a aquisição semeia tudo como `candidate`.

### D4 — CARE vence a agregação: rotula-se com o melhor Rótulo público

`pref_label` é o `prefLabel` público (preferindo `por`), senão um `altLabel` público, senão `NULL`.
Linha com Conceito e `pref_label` nulo é **descartada** da agregação: agregar sob um rótulo
`restricted`/`sacred` publicaria, num eixo público, exatamente o que a curadoria reservou — o
BioCultDB furaria a proteção que o BioCultTermos mantém em `stripNonPublicLabels`.

**Consequência conhecida e aceita, que envelhece mal:** o Conceito some do gráfico, e quem comparar o
total do gráfico com o total do acervo percebe o buraco. É um vazamento residual. Foi escolhido
contra as duas alternativas piores: um balde "Reservado" anuncia a existência de forma ainda mais
explícita, e ignorar `accessLevel` publica o rótulo. Se a política mudar, é aqui que se mexe.

### D5 — A chave de casamento é `trim().toLowerCase()`, idêntica à da aquisição

Sem remoção de diacríticos: `alimenticio` **não** casa com `alimentício`. Duas razões. Coerência: a
`AcquisitionService` usa essa chave para decidir se um valor bruto já é um Conceito; uma chave mais
frouxa no painel faria as duas telas discordarem sobre o que é o mesmo termo. Custo: a função
`unicode_sort_key` está registrada só na conexão do BioCultTermos, e duplicá-la criaria duas
implementações de "mesma string" em dois repositórios.

O acento perdido vira `hiddenLabel` — que é o mecanismo que o SKOS-XL oferece para isso. Se o volume
incomodar, a correção é frouxar a chave **na aquisição**; o painel herda.

### D6 — Só sinonímia; sem rollup hierárquico

`broader`/`narrower` existem e não são usados. `alimentar`/`alimentação` são o mesmo Conceito —
juntá-las corrige um defeito. `gripe`/`medicinal` são Conceitos distintos — somar um no outro é
escolha editorial nova, que exige responder "subir até que nível?". Misturar as duas operações faria
o gráfico afirmar que "Conceito igual" e "Conceito aparentado" são a mesma coisa, que é a confusão
que o SKOS existe para evitar.

### D7 — Agregações e filtros normalizam; o card de resultado, não

O gráfico existe para contar Conceitos; o card existe para dizer o que aquele artigo afirmou. Trocar
`alimentação` por `alimentar` no card apagaria o registro etnográfico e faria o acervo mentir sobre
sua fonte.

Os filtros expandem por Conceito (`expandLabels`): escolher `alimentar` encontra as Evidências que
gravaram `alimentação`. Sem isso, clicar num fluxo do Sankey cairia numa lista menor que o número do
fluxo. Vale para as três superfícies, que constroem SQL de forma independente: estatísticas do
painel, busca e etnoChat.

### D8 — Valor sem Conceito aparece cru

Sem balde "Não classificado". O órfão visível no eixo é o sinal que puxa o curador para o
BioCultTermos; o balde esconde trabalho pendente e inventa uma categoria que não existe no domínio.

### D9 — Os quatro campos monitorados

`comunidades.tipo`, `comunidades.atividadesEconomicas`, `comunidades.plantas.nomeVernacular`,
`comunidades.plantas.tipoUso` — os mesmos de `MONITORED_FIELDS`. Explicitamente **não**
`comunidades.plantas.nomeCientifico`, fora de escopo desde 2026-08-10 (regido pelo ICN).

Incluir `comunidades.tipo` carrega um risco: as 29 categorias do Decreto 8.750/2016 são lista legal
fechada, e um `prefLabel` mal escolhido renomearia uma categoria oficial no gráfico. É risco de
curadoria, corrigível na curadoria — não justifica uma segunda regra no código do painel.

### D10 — Sem `etnotermos_label_map`, degrada em silêncio

O BioCultDB roda sozinho na imagem single-app, na suíte de testes e em desenvolvimento sem o
submódulo. A ausência da view é detectada uma vez e desliga a agregação; nada lança. Tornar a
normalização requisito de boot transformaria um recurso de apresentação em dependência de
inicialização e quebraria os testes por motivo cosmético. A unidade é a soma das ferramentas, mas a
ferramenta não morre sem a irmã.

### D11 — O gráfico declara o que agregou

Tooltip com os rótulos crus fundidos (campo `variants` no payload de `/painel/api/stats/sankey`) e
uma linha no cabeçalho do cartão. Sem isso, três barras somem da tela e a mudança parece perda de
dado.

## Consequências

- `getSankeyData` passa a devolver `variants`; o campo pode vir vazio e o frontend tolera sua
  ausência.
- O corte Top-N mudou de significado: são os N **Conceitos** mais frequentes, não os N rótulos. O
  gráfico pode passar a exibir usos que antes não cabiam.
- A view é recriada a cada boot do BioCultTermos, então uma mudança na sua definição viaja junto com
  o código, sem migração.
- `backend/tests/unit/vocabulary-aggregation.test.js` lê o DDL da view do arquivo do submódulo em vez
  de copiá-lo: uma mudança lá quebra o teste aqui, em vez de passar despercebida.
