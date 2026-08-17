<div align="center">
  <img src="../assets/BioCultDBLogo300.png" alt="BioCultDB" width="160">
</div>

# Runbook — curar um Campo Semântico do BioCultTermos

### Procedimento reutilizável, para campo novo ou para atualizar campo já curado

> Este documento é o **método**, destilado de duas campanhas reais:
> ["Tipos de Usos de Plantas"](tipos-de-uso/procedimento.md) (2026-08-07, 713 termos) e
> ["Atividades Econômicas"](atividades-economicas/procedimento.md) (2026-08-17, 36 termos).
> Cada campanha guarda o seu registro próprio; aqui fica só o que se repete.
>
> As **regras de decisão** são do [Manual de Curadoria](https://edalcin.github.io/BioCultTermos/) —
> este runbook não as substitui, ele diz **como executá-las em produção sem quebrar nada**.

---

## Sumário

1. [Quando usar, e em qual modo](#1-quando-usar-e-em-qual-modo)
2. [O que você precisa antes de começar](#2-o-que-você-precisa-antes-de-começar)
3. [Fase 0 — backup](#fase-0--backup)
4. [Fase A — levantar o corpus](#fase-a--levantar-o-corpus)
5. [Fase B — desenhar e classificar](#fase-b--desenhar-e-classificar)
6. [O plano: esquema do JSON](#o-plano-esquema-do-json)
7. [Fase C — validar o plano antes de escrever](#fase-c--validar-o-plano-antes-de-escrever)
8. [Fase D — executar](#fase-d--executar)
9. [Fase E — conferir](#fase-e--conferir)
10. [Modo incremental: campo já curado](#10-modo-incremental-campo-já-curado)
11. [Se algo der errado](#11-se-algo-der-errado)
12. [Armadilhas conhecidas](#12-armadilhas-conhecidas)

---

## 1. Quando usar, e em qual modo

| Modo | Situação | O que muda |
|---|---|---|
| **Completo** | campo nunca curado (`nomeVernacular`, `tipo`) | todas as fases, taxonomia desenhada do zero |
| **Incremental** | campo já curado recebeu termos novos pela aquisição | [§10](#10-modo-incremental-campo-já-curado): só os candidatos novos, taxonomia já existe |

Os dois usam os mesmos artefatos e o mesmo plano. A diferença é o recorte da Fase A e o tamanho do
desenho na Fase B.

**Campos e seu estado** (atualize esta tabela a cada campanha):

| Campo Semântico | Conceitos | Estado |
|---|---:|---|
| `comunidades.plantas.nomeVernacular` | 983 | **cru** — o campo sensível (CARE deixa de ser teórico) |
| `comunidades.plantas.tipoUso` | 744 + 15 novos | curado 2026-08-07; **15 candidatos** aguardando passada incremental |
| `comunidades.atividadesEconomicas` | 42 | curado 2026-08-17 |
| `comunidades.tipo` | 9 | **cru** |
| ~~`comunidades.plantas.nomeCientifico`~~ | — | [fora de escopo desde 2026-08-10](decisao-nomes-cientificos-fora-de-escopo.md) |

## 2. O que você precisa antes de começar

- Acesso `ssh` ao Unraid e o container `BioCultDB` **no ar** (`docker start BioCultDB`; espere
  `healthy`). A API Admin é o único caminho de escrita que aplica os invariantes.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` no env do container. **Não os copie para lugar nenhum**: o
  executor os lê de `process.env` de dentro do container e nunca os imprime.
- O diretório de dados do host é montado em `/data` no container — é por ali que os scripts entram.
- Ler o Manual, em especial [§7 (guia de decisão)](https://edalcin.github.io/BioCultTermos/07-guia-de-decisao.html)
  e [§11 (erros comuns)](https://edalcin.github.io/BioCultTermos/11-erros-comuns.html).

**Curar com um ciclo de aquisição no ar é seguro** — verificado por teste: o `upsertConcept` não
mexe em `version`, e o driver é síncrono no mesmo processo. A interface recusa um segundo ciclo
simultâneo. Não há o que coordenar.

## Fase 0 — backup

Com WAL ativo, `VACUUM INTO` produz snapshot íntegro **sem parar o container**:

```bash
CAMPO=atividadeseconomicas          # sufixo curto do campo, para o nome do arquivo
D=/mnt/user/Storage/appsdata/biocultdb/data
B=$D/backup-pre-curadoria-$CAMPO-$(date -u +%Y-%m-%dT%H-%M-%SZ).sqlite
sqlite3 "file:$D/biocultdb.sqlite?mode=ro" "VACUUM INTO '$B';"
sqlite3 "$B" 'PRAGMA integrity_check;'   # deve responder: ok
md5sum "$B"
```

Anote arquivo, `integrity_check` e md5 no registro da campanha. **Não pule esta fase** — os backups
anteriores envelhecem a cada ciclo de aquisição.

## Fase A — levantar o corpus

O Campo Semântico **não é um campo próprio** do conceito: é o array `doc.sourceFields`, preenchido
pela aquisição. Todo recorte parte dele.

```sql
-- distribuição geral
SELECT x.value AS campo, count(*) FROM etnotermos e,
       json_each(json_extract(e.doc,'$.sourceFields')) x
GROUP BY 1 ORDER BY 2 DESC;

-- o campo inteiro, como documento
SELECT json_group_array(json(e.doc)) FROM etnotermos e
WHERE EXISTS (SELECT 1 FROM json_each(json_extract(e.doc,'$.sourceFields')) x
              WHERE x.value = '<CAMPO>');
```

Levante também, e não pule — foi o que mudou o desenho nas duas campanhas:

1. **Frequência de cada termo no corpus de origem** (`biocultdb_records`). É o critério de desempate
   do Manual §3.5 e revela qual termo merece ser faceta.
   ```sql
   SELECT a.value AS termo, count(*) AS n
   FROM biocultdb_records r, json_each(json_extract(r.doc,'$.comunidades')) c,
        json_each(coalesce(json_extract(c.value,'$.<campoNaComunidade>'),'[]')) a
   GROUP BY 1 ORDER BY 2 DESC;
   ```
2. **Conceitos compartilhados com outro campo** (`sourceFields` com mais de um valor) — eles já podem
   estar curados e ativos, e exigem a decisão de poli-hierarquia.
3. **O que já não é folha em branco**: definições, notas, rótulos e relações preexistentes.

Classifique o corpus por **natureza** antes de classificar termo a termo. É esse quadro que revela o
problema real do campo — e ele é diferente a cada campo:

| Campo | Problema dominante |
|---|---|
| `tipoUso` | sujeira: plurais, grafias, inglês, variantes de regência |
| `atividadesEconomicas` | granularidade desigual + termos de categoria errada (ocupação) |
| `nomeVernacular` (previsto) | CARE: povo de origem, `restricted`/`sacred`, preferencial entre co-iguais |

## Fase B — desenhar e classificar

**Primeiro a árvore, depois os termos.** Regras que as duas campanhas confirmaram:

- **As facetas saem do corpus**, não de uma classificação externa. Ancorar numa norma (CNAE, CID)
  parece rigor e entrega desencontro: elas são desenhadas para outro objeto.
- **Promova termo existente a faceta** em vez de criar um novo, quando ele já nomeia o ramo e é
  frequente (`agricultura`, 21 ocorrências, virou faceta). Crie conceito-pai só quando **nenhum**
  termo coletado nomeia o ramo.
- **Poli-hierarquia onde o significado exige**, não por gosto. Casos legítimos vistos: termo que
  carrega duas informações (`produção de hortaliças orgânicas` = espécie + sistema) e conceito
  compartilhado entre campos.
- **Definição só nos nós da taxonomia** (Manual §4.1). Folha sem definição é estado legítimo; folha
  com definição inventada, não.
- **Nota de escopo em toda fronteira sutil** — e a lição do §4.2: *decisão que só existe no documento
  se perde; escreva no conceito*.

Depois, termo a termo, pelo fluxo do Manual §7. As operações que o executor entende:

| Op | Significado | Efeito |
|---|---|---|
| `MANTER` | conceito próprio | ganha `broader`, e é ativado |
| `ALT` | variante do mesmo significado | rótulo `alt` no alvo + depreciação da origem |
| `HID` | forma que não deve ser exibida mas deve ser buscável | rótulo `hidden` no alvo + depreciação da origem |
| `HID2` | termo composto, nomeia **dois** conceitos | rótulo `hidden` nos **dois** + depreciação apontando o primeiro |
| `DEP` | não nomeia nada do campo | depreciação simples, em geral para `indeterminado` |

> **`indeterminado`** (`c3480024-e256-4657-b00a-d8120bc3ee97`) é conceito de serviço **compartilhado
> por todos os campos**. Use-o como destino terminal; não crie um por campo. A depreciação **exige**
> substituto, e deixar termo sem destino como `candidate` para sempre é erro (Manual §5).

**Produza a proposta antes de escrever**, com uma **lista curta dos casos duvidosos** no topo. Paga:
na campanha de 713 termos, das quatro divergências que o curador achou na revisão, três estavam na
lista curta e uma estava fora dela, entre as absorções tidas por óbvias.

## O plano: esquema do JSON

O plano é o contrato entre a decisão e a execução. Os dois scripts o consomem.

```jsonc
{
  "campoSemantico": "comunidades.atividadesEconomicas",
  "geradoEm": "2026-08-17",
  "backupPreCuradoria": "backup-pre-curadoria-...sqlite",

  // conceitos de serviço referenciáveis por "__nome__" em replacedBy
  "conceitosServico": { "indeterminado": "c3480024-..." },

  // Fase 1 — criados pela fábrica de domínio; `conceptId` é preenchido após a criação
  "paisNovos": [ { "label": "extrativismo vegetal", "language": "por" } ],

  // Fase 2 — rótulos + depreciação. `hidden_in` vazio ⇒ depreciação simples
  "absorcoes": [
    { "termo": "criação de gado e cabras", "op": "HID2",
      "hidden_in": ["criação de gado", "criação de cabras"],
      "replacedBy": "criação de gado",
      "rationale": "termo composto: nomeia dois conceitos (Manual §7.4)" },
    { "termo": "estudante", "op": "DEP", "hidden_in": [],
      "replacedBy": "__indeterminado__", "rationale": "não nomeia atividade alguma" }
  ],

  // Fase 3 — hierarquia e associação, por rótulo preferencial
  "broader": [ { "conceito": "apicultura", "pai": "pecuária" } ],
  "related": [ { "a": "manejo de sementes...", "b": "coleta do palmito juçara" } ],

  // Fase 4 — notas (campos omitidos não são tocados) e ativação
  "notas": {
    "pecuária": { "definition": "...", "scopeNote": "...", "historyNote": "..." }
  },
  "ativar": [ "apicultura", "pecuária" ]
}
```

**Tudo é referenciado por rótulo preferencial**, nunca por id — o executor resolve rótulo → id no
banco, inclusive os pais recém-criados. Isso mantém o plano legível e sobrevive a reexecução.

## Fase C — validar o plano antes de escrever

Sem tocar em produção. Estas checagens pegaram erro real nas duas campanhas:

| Checagem | Esperado |
|---|---|
| Todo termo do campo tem exatamente uma operação | sem termo órfão de decisão |
| Todo alvo de `hidden_in` / `replacedBy` / `pai` existe no universo (coletados + pais novos) | 0 irresolvidos |
| Nenhuma auto-referência, nenhuma cadeia de fusão (alvo que é ele mesmo absorvido) | 0 |
| Nenhum ciclo em `broader` | 0 |
| Todo sobrevivente tem pai **ou** é faceta raiz declarada | 0 órfãos inesperados |
| Nenhum rótulo novo de `paisNovos` já existe no vocabulário (pref, alt **ou** hidden) | 0 colisões |

Depois, o **dry-run**, que resolve todo o plano contra o banco real sem escrever nada:

```bash
docker exec BioCultDB node /data/fases2a4-executar.mjs /data/plano.json --dry-run
```

Foi o dry-run que pegou, na campanha de "Atividades Econômicas", uma chave trocada no plano
(`term` em vez de `termo`) antes que tocasse produção. **Não pule.**

## Fase D — executar

Copie os artefatos para o diretório de dados (que é `/data` no container) e rode:

```bash
scp fase1-criar-pais.mjs fases2a4-executar.mjs fase5-conferir.sql plano.json \
    root@<HOST>:/mnt/user/Storage/appsdata/biocultdb/data/

docker exec BioCultDB node /data/fase1-criar-pais.mjs /data/plano.json        # Fase 1
# anote os ids devolvidos no plano, em paisNovos[].conceptId
docker exec BioCultDB node /data/fases2a4-executar.mjs /data/plano.json       # Fases 2 a 4
```

Os artefatos são genéricos e vivem em
[`atividades-economicas/`](atividades-economicas/) — campo e conteúdo vêm do plano, não do código.

| Artefato | Papel |
|---|---|
| [`fase1-criar-pais.mjs`](atividades-economicas/fase1-criar-pais.mjs) | cria os conceitos-pai pela fábrica de domínio (`createConcept` + `insertConcept`), com auditoria |
| [`fases2a4-executar.mjs`](atividades-economicas/fases2a4-executar.mjs) | rótulos → depreciações → hierarquia → notas → ativação, tudo pela API Admin |
| [`fase5-conferir.sql`](atividades-economicas/fase5-conferir.sql) | as conferências, somente leitura |

> **Por que a criação não passa pela API.** A API Admin não tem rota de criação de conceito. A Fase 1
> usa a mesma fábrica que a aquisição usa. Um conceito recém-criado não tem relação alguma, então os
> invariantes que importam — ciclo, reciprocidade, `ancestors`, `version`, auditoria — só passam a
> valer nas operações seguintes, e essas vão **todas** pela API.

**Ordem importa** e o executor a garante: rótulo antes da depreciação (senão o termo some antes de
ser guardado), hierarquia antes da ativação, ativação por último.

**Os dois scripts são idempotentes.** Cada operação confere o estado antes de escrever e devolve
`skip` quando o efeito já está no banco. Reexecutar é seguro — e é como se retoma uma execução
interrompida. Se aparecer `409`, o executor falha alto: releia e rode de novo, que ele pula o que já
passou.

## Fase E — conferir

Rode [`fase5-conferir.sql`](atividades-economicas/fase5-conferir.sql), ajustando o campo:

```bash
docker exec BioCultDB sqlite3 "file:/data/biocultdb.sqlite?mode=ro" < /data/fase5-conferir.sql
```

| Verificação | Esperado |
|---|---|
| Contagens por status batem com o plano | sim |
| Todo ativo tem `broader` ou é faceta raiz | só as facetas sem pai |
| Nenhum conceito é ancestral de si mesmo | 0 |
| Toda `broader` tem a `narrower` recíproca | 0 faltando |
| Nenhum pai depreciado com filho ativo | 0 |
| Todo depreciado tem `replacedBy` | 0 faltando |
| Termo composto (`HID2`) presente nas **duas** metades | sim |
| Entradas de auditoria reconciliam com as escritas | soma exata |
| Reexecutar o executor não escreve nada | 100% `skip` |

E os dois testes finais, que são os que provam a curadoria:

**1. Sobrevive à aquisição.** É o único teste que prova que o trabalho é permanente.

```bash
curl -s -X POST -u "$U:$PW" -H "Accept: application/json" http://127.0.0.1:4001/acquisition/run
# aguarde running:false e confira o campo:
curl -s -u "$U:$PW" -H "Accept: application/json" http://127.0.0.1:4001/acquisition/status
```

Espere **`created: 0`** no campo curado e contagens idênticas. Se aparecer `created > 0` **no campo
curado**, algum termo recolhido foi recriado — investigue antes de declarar a campanha concluída.

> `created > 0` em **outros** campos não é falha: pode ser dado novo de origem. Confirme rodando um
> **segundo** ciclo — ele deve devolver `created: 0`. Foi o que aconteceu em 2026-08-17: 16 conceitos
> criados no 1º ciclo eram termos inéditos de `tipoUso` e `nomeVernacular`, e o 2º ciclo fechou em 0.

**2. A consulta pública responde.** Busque uma faceta na porta 4000 e confirme que os filhos
aparecem; confirme que um conceito depreciado devolve `410` com o `replacedBy` certo.

> ⚠️ **Rótulo oculto não é buscável hoje.** `etnotermos_fts` indexa `prefLabels`, `altLabels`,
> `definition` e `scopeNote` — **não** `hiddenLabels`. Buscas por termo oculto que "funcionam" o fazem
> por dobra de acentos contra o preferencial. Defeito conhecido, com correção proposta em
> [`atividades-economicas/procedimento.md` §8](atividades-economicas/procedimento.md#8-achado-rótulo-oculto-não-é-buscável).
> Enquanto não for corrigido, **não conte com a busca** para justificar uma decisão de `HID`.

Por fim, **escreva o registro da campanha** em `docs/curadoria/<campo>/`: `proposta.md` (termo a
termo, com a lista curta), `procedimento.md` (execução, conferências, decisões com a alternativa
recusada) e o `plano-<campo>.json`. E **atualize a tabela do [§1](#1-quando-usar-e-em-qual-modo)**.

## 10. Modo incremental: campo já curado

Quando a aquisição semeia termos novos num campo já curado, não se repete a campanha — cura-se só o
que chegou.

1. **Recorte os candidatos novos**, que é o que sobra em `candidate` num campo já curado:
   ```sql
   SELECT json_extract(doc,'$.id'), json_extract(doc,'$.prefLabels[0].literalForm'), created_at
   FROM etnotermos e WHERE status = 'candidate'
     AND EXISTS (SELECT 1 FROM json_each(json_extract(e.doc,'$.sourceFields')) x
                 WHERE x.value = '<CAMPO>')
   ORDER BY created_at DESC;
   ```
2. **Não redesenhe a árvore.** Carregue a taxonomia existente e encaixe os novos termos nela.
   Só crie faceta ou nó intermediário se o termo novo genuinamente não couber — e registre o porquê.
   ```sql
   SELECT p.pref || ' -> ' || c.pref FROM ...   -- veja a consulta 12 do fase5-conferir.sql
   ```
3. **O plano é o mesmo esquema**, só menor: `paisNovos` costuma vir vazio, e `notas` só toca nó novo.
4. **Fases 0, C, D e E são idênticas.** O backup continua obrigatório; o dry-run continua obrigatório.
5. Na Fase E, a conferência extra é: **as contagens dos termos já curados não mudaram** — a passada
   incremental não pode mexer no que já estava pronto.

Registre a passada como uma seção nova no `procedimento.md` do campo, com data e volume — não crie
um documento novo por passada.

## 11. Se algo der errado

Nenhuma operação deste procedimento é irreversível: conceito não é apagado, só depreciado, e toda
escrita deixa rastro em `etnotermos_audit_log`, consultável por conceito.

**Execução interrompida no meio:** rode o executor de novo. Ele pula o que já passou.

**Restauração completa**, em três comandos:

```bash
docker stop BioCultDB
cp $B /mnt/user/Storage/appsdata/biocultdb/data/biocultdb.sqlite
rm -f /mnt/user/Storage/appsdata/biocultdb/data/biocultdb.sqlite-{wal,shm}
docker start BioCultDB
```

**Não escreva no SQLite com o container parado** para "corrigir mais rápido". A API Admin é o único
caminho que aplica os invariantes; escrever no JSON à mão troca um risco pequeno e já mitigado —
corromper o arquivo — por um grande e silencioso: corromper o **vocabulário**.

## 12. Armadilhas conhecidas

| Armadilha | Por quê | O que fazer |
|---|---|---|
| Criar conceito novo com rótulo que já existe | a aquisição casa por `literalForm` em pref+alt+hidden; o segundo conceito fica inalcançável | verifique colisão na Fase C; se o conceito já existe, use **poli-hierarquia** |
| Pendurar filho puramente do campo novo num conceito compartilhado | ele herda a faceta do **outro** campo na cascata de `ancestors` | ligue o filho à **faceta**, não ao conceito compartilhado |
| Escrever `historyNote` num conceito que será depreciado | `deprecate` **sobrescreve** o `historyNote` com "Substituído por …" | não escreva nota histórica em termo que vai virar lápide |
| Depreciar conceito que tem filho ativo | a API devolve `orphans` em vez de executar | reencaixe os filhos antes, ou confirme com `confirmedOrphans` |
| Chamar `activate` em conceito já ativo | a API devolve `400` (só `candidate` ativa) | o executor já pula; se for chamada manual, confira o status antes |
| Contar `related` como o número de pares | a relação é simétrica e grava dos dois lados | 2 pares aparecem como 4 no banco |
| Gravar rótulo em outro idioma como `por` | a convenção é ISO 639-3 e existe para caber `tup`, `kgp`, `gub` | `eng`, `tup`, … |
| Confiar na busca por rótulo oculto | `hiddenLabels` não é indexado (ver Fase E) | trate como defeito conhecido até a correção |
| Deixar a decisão só no documento da campanha | o próximo curador lê o conceito, não o `.md` | grave definição, nota de escopo e nota histórica **no conceito** |

---

> **Referências:** [Manual de Curadoria](https://edalcin.github.io/BioCultTermos/) ·
> [campanha "Tipos de Usos de Plantas"](tipos-de-uso/procedimento.md) ·
> [campanha "Atividades Econômicas"](atividades-economicas/procedimento.md) ·
> [W3C SKOS-XL](https://www.w3.org/TR/skos-reference/skos-xl.html) ·
> [Princípios CARE](https://www.gida-global.org/care)
