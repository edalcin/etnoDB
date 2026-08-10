# Integração BioCultTermos → BioCultDB (Unidade de Fontes Secundárias)

> Documento de referência para o agente de IA (Claude) que implementou esta integração.
> Produzido em sessão de `grill-with-docs` (grilling + domain modeling) em 2026-07-12.
> **Nenhum código havia sido alterado ao produzir este documento** — era plano, não implementação,
> no momento em que foi escrito. Desde então, todos os passos abaixo foram executados e
> verificados em produção (ver "Status" logo a seguir).
>
> Decisão arquitetural de origem: `Arquitetura-BioCultural/docs/architecture-decisions/ADR-004` e `ADR-005`.
> Decisão operacional desta integração: `BioCultDB/docs/decisions/ADR-001-integracao-bioculttermos.md`
> (leia primeiro — este documento é o checklist executável dela).

## Status: ✅ Implementado e verificado em produção (2026-07-13)

Todos os passos de §4 foram executados; a checklist de aceite de §5 está completa. Resumo do
resultado — detalhes em §11:

- **Corte em produção concluído**: container Unraid renomeado `etnoDB` → `BioCultDB`, imagem
  dual-app publicada (`ghcr.io/edalcin/biocultdb:latest`), 5 portas ativas (3091-3093 BioCultDB,
  4000-4001 BioCultTermos).
- **CI/CD publicando a imagem dual-app** desde o commit `a5dbe47` — todo push em `main` builda
  `docker/Dockerfile.unidade` com o submodule.
- **Aquisição de vocabulário rodando de fato**: 28 registros em `biocultdb_records` →
  **2536 conceitos candidatos** em `etnotermos` (844 nomes científicos, 981 nomes vernaculares,
  668 tipos de uso, 34 atividades econômicas, 9 tipos de comunidade), aguardando curadoria em
  `:4001`.
- **Cobertura de campos ampliada além do plano original**: `AcquisitionService` passou a monitorar
  também `comunidades.plantas.nomeCientifico` (ausente no scaffold original) e a semear um
  vocabulário estático de referência (`docs/referencia/tipoUso.txt`, ~450 termos), garantindo que o
  vocabulário candidato cubra o domínio completo, não só o que já foi digitado em registros
  existentes.

  > **Revertido em escopo (2026-08-10):** `comunidades.plantas.nomeCientifico` saiu do escopo de
  > curadoria do BioCultTermos — ver
  > [decisão](docs/curadoria/decisao-nomes-cientificos-fora-de-escopo.md).
- **6 bugs de produção encontrados e corrigidos durante a estabilização pós-corte** (fora do
  escopo original deste documento, mas parte do mesmo esforço de integração — detalhes em §11):
  autenticação HTTP Basic com re-prompt quebrado, links de edição de conceito quebrados (`_id` vs
  `id`, herança de MongoDB), paginação ausente na lista de termos admin, `AcquisitionService.run()`
  bloqueando o processo admin em execuções longas, botão "Ativar Conceito" com confirmação dupla e
  falha silenciosa (versão nunca enviada ao servidor), formulário de relacionamento semântico sem
  busca por nome.

Histórico completo: `9dcf4bf..369d4d8` em `BioCultDB` (12 commits), `2b4e377..a4805ee` em
`BioCultTermos` (6 commits).

## 1. O que já existia antes desta integração (não reinventar)

Uma sessão anterior já havia construído o scaffold técnico completo da unidade dual-app. Isto já
existia no repositório, testado localmente, mas nunca publicado/deployado em produção:

| Arquivo | Papel |
|---|---|
| `docker/Dockerfile.unidade` | Build multi-stage: compila BioCultDB + BioCultTermos (submodule), imagem final `node:20-alpine`, non-root `nodejs` (uid 1001), `dumb-init` como PID 1 |
| `docker/docker-compose.unidade.yml` | Compose de exemplo/dev com as 5 portas e envs de exemplo (**valores de exemplo não usáveis direto em produção, ver §3**) |
| `docker/start-unit.sh` | Entrypoint: sobe `biocultdb/backend/src/server.js` e `bioculttermos/backend/src/start.js` como processos irmãos, forwarda `SIGTERM`, fail-fast (se um crash, derruba o outro) |
| `bioculttermos/` (git submodule → `github.com/edalcin/BioCultTermos`) | Código real: SKOS-XL, servidor público (4000, sem auth) + admin (4001, HTTP Basic + bcrypt), `AcquisitionService` que lê `biocultdb_records` do mesmo arquivo SQLite |

O que faltava era **conectar esse scaffold à produção real** — é isso que este documento planejou,
e que §11 registra como foi de fato executado.

## 2. Estado de produção ANTES do corte (confirmado no início desta sessão)

Container Unraid `BioCultDB` (renomeado de `etnoDB`), rodando ao vivo em `<HOST_UNRAID>`:

```bash
docker run -d --name='BioCultDB' --net='bridge' --pids-limit 2048 \
  -e TZ="America/Sao_Paulo" \
  -e HOST_OS="Unraid" -e HOST_HOSTNAME="<HOST_HOSTNAME>" -e HOST_CONTAINERNAME="BioCultDB" \
  -e 'NODE_ENV'='production' \
  -e 'SQLITE_DB_PATH'='/data/biocultdb.sqlite' \
  -l net.unraid.docker.managed=dockerman \
  -l net.unraid.docker.webui='http://<HOST_UNRAID>:3093' \
  -l net.unraid.docker.icon='https://raw.githubusercontent.com/edalcin/etnoDB/main/docs/etnodbLogoTrans300.png' \
  -p '3091:3001/tcp' -p '3092:3002/tcp' -p '3093:3003/tcp' \
  -v '<APPDATA>/biocultdb/data/':'/data':'rw' \
  'ghcr.io/edalcin/biocultdb:latest'
```

- Imagem `ghcr.io/edalcin/biocultdb:latest`, **na época**, publicada por `.github/workflows/docker-publish.yml`
  a partir de `docker/Dockerfile` — single-app, sem submodule, sem BioCultTermos.
- `SQLITE_DB_PATH=/data/biocultdb.sqlite` — arquivo real, populado com referências, comunidades, plantas.
- Zero autenticação em qualquer porta (3091/3092/3093). Controle só por firewall/rede do Unraid.
- Volume bind mount `<APPDATA>/biocultdb/data/` → `/data`.

### Estado atual (pós-corte)

Mesmo container/nome (`BioCultDB`), imagem trocada para dual-app, +2 portas (4000/4001) +2 env vars
(`ADMIN_USERNAME`/`ADMIN_PASSWORD`). Bloco `docker run` completo, procedimento de corte executado e
registro da execução real (digests, backup, resultados) em
[`docs/operacao/corte-producao-unidade.md`](./docs/operacao/corte-producao-unidade.md).

## 3. Decisões tomadas (grilling 2026-07-12)

Resumo executável — a justificativa completa de cada uma está na ADR-001. Onde o scaffold existente
(`docker-compose.unidade.yml`) usa um valor de **exemplo** que diverge da decisão real, isso está marcado.

| Decisão | Valor | Nota |
|---|---|---|
| Caminho do SQLite | `SQLITE_DB_PATH=/data/biocultdb.sqlite` | **Diverge do exemplo no compose** (`/data/unidade.sqlite`). Não renomear o arquivo. |
| Autenticação BioCultTermos admin | `ADMIN_USERNAME` + `ADMIN_PASSWORD` | **Diverge do exemplo no compose** (`ADMIN_USERS` JSON bcrypt). Ver `bioculttermos/backend/src/config/index.js:22-28` — ambos os formatos são suportados pelo código, só a escolha operacional muda. |
| Dados iniciais BioCultTermos | Tabelas `etnotermos_*` vazias no boot | Sem migração — vocabulário candidato nasce do `AcquisitionService` lendo `biocultdb_records` já populado. |
| Mapeamento de portas existentes | `3091:3001`, `3092:3002`, `3093:3003` | Mantido, sem mudança. |
| Mapeamento de portas novas | `4000:4000`, `4001:4001` | Sem offset — igual interno e externo. |
| Publicação da imagem | `ghcr.io/edalcin/biocultdb:latest` passa a ser a imagem dual-app | Sem tag/imagem legada paralela. `docker/Dockerfile` (single-app) vira dev-only, não é mais usado para deploy. |
| Estratégia de corte | Substituição in-place do container `BioCultDB` | Backup do arquivo antes, indisponibilidade de segundos/minutos aceitável. |
| Primeira aquisição de termos | ~~Automática (cron 3h ou disparo manual pós-deploy)~~ → **Revertido em 2026-08-07** | Decisão original previa `ACQUISITION_CRON_SCHEDULE` (cron `0 3 * * *`); o agendador foi removido do código. Aquisição agora é exclusivamente sob demanda, pelo botão "Executar Aquisição" do dashboard admin (`POST /acquisition/run`). |
| Auth do BioCultDB (3001/3002) | **Fora de escopo**, não muda | Decisão futura separada, se necessária. |
| Repositório BioCultTermos standalone | Congelado como produto | Continua recebendo commits **via o submodule** (mecânica de git), mas não é mais desenvolvido/deployado isoladamente — ver §7. |

## 4. Mudanças necessárias (passo a passo)

### 4.1 CI/CD — `.github/workflows/docker-publish.yml`

Estado atual (`docker-publish.yml:22-23,50-51`): `actions/checkout@v4` sem `submodules`, build com
`file: ./docker/Dockerfile`.

Mudar para:

1. `actions/checkout@v4` com `submodules: recursive` (o submodule `bioculttermos` já está pushado em
   `github.com/edalcin/BioCultTermos`, checkout público funciona sem credencial extra).
2. `docker/build-push-action@v5` com `file: ./docker/Dockerfile.unidade` (em vez de `./docker/Dockerfile`).
3. Manter `context: .` (o Dockerfile.unidade já assume contexto = raiz do repo, incluindo `bioculttermos/`).
4. Manter a mesma tag `ghcr.io/edalcin/biocultdb:latest` — não criar imagem/tag paralela.
5. Verificar o passo "Image size check" (`docker-publish.yml:60-64`) continua fazendo sentido — a imagem
   dual-app é maior que a single-app (dois `node_modules`, dois CSS compilados); não é motivo para
   reverter a decisão, só para calibrar expectativa de tamanho.

### 4.2 Recriação do container em produção (Unraid)

Pré-requisito: a imagem `ghcr.io/edalcin/biocultdb:latest` já publicada pelo CI atualizado (§4.1).

1. **Backup**: copiar `biocultdb.sqlite` (e `biocultdb.sqlite-wal`/`-shm` se existirem, modo WAL) de
   `<APPDATA>/biocultdb/data/` para um local de backup, com o container ainda rodando
   (WAL permite cópia a quente) ou parado (mais seguro, escolha do operador).
2. **Registrar o digest da imagem atual** (ponto de rollback, já que `:latest` é uma tag flutuante):
   ```bash
   docker inspect BioCultDB --format='{{.Image}}'
   ```
   Guardar esse digest. Se o corte falhar, o rollback é recriar o container apontando para ESSE digest
   específico, não para `:latest` (que já vai apontar para a imagem nova, ruim).
3. **Parar e remover** o container `BioCultDB` atual (o volume bind mount preserva os dados, intocado).
4. **Recriar** o container (via interface Unraid ou `docker run` equivalente) com:
   - Mesma imagem: `ghcr.io/edalcin/biocultdb:latest` (agora dual-app)
   - Mesmo nome, rede, volume, `TZ`, `HOST_*` labels
   - Mesmas env vars existentes: `NODE_ENV=production`, `SQLITE_DB_PATH=/data/biocultdb.sqlite`
   - **+2 env vars novas**: `ADMIN_USERNAME=<ADMIN_USERNAME>`, `ADMIN_PASSWORD=<senha real, nunca commitar>`
   - **+2 portas novas**: `4000:4000/tcp`, `4001:4001/tcp`
   - Atualizar o label `net.unraid.docker.icon`/`webui` se desejado (opcional, cosmético)
5. **Subir** o container.
6. **Verificar saúde**:
   - `curl http://<HOST_UNRAID>:3093/health` → BioCultDB (Apresentação) — inalterado, já funcionava
   - `curl http://<HOST_UNRAID>:4000/health` → BioCultTermos público
   - `curl -u <ADMIN_USERNAME>:<ADMIN_PASSWORD> http://<HOST_UNRAID>:4001/health` → BioCultTermos admin (espera 200; sem
     credencial espera 401)
   - Checar logs do container por `[start-unit] Starting BioCultDB...` e `[start-unit] Starting
     BioCultTermos...` (ambos os processos subiram)
7. **Disparar a primeira aquisição** manualmente (não esperar até 3h):
   ```bash
   curl -u <ADMIN_USERNAME>:<ADMIN_PASSWORD> -X POST http://<HOST_UNRAID>:4001/acquisition/run
   ```
   Confirmar em `GET /acquisition/status` (ou na dashboard admin) que termos `candidate` foram criados a
   partir dos registros já existentes em `biocultdb_records`.
8. **Rollback** (se necessário, a qualquer ponto após o passo 3): recriar o container `BioCultDB` com a
   imagem do digest registrado no passo 2, envs/portas antigas (sem as 2 novas), volume intocado — os
   dados do BioCultDB nunca foram tocados, só a imagem/portas/env mudam.

### 4.3 O que NÃO muda

- `docker/Dockerfile` e `docker/docker-compose.yml` (single-app) continuam existindo, como conveniência
  de desenvolvimento local do BioCultDB isolado (sem precisar inicializar o submodule). Não são mais
  usados para build de produção.
- Nenhuma alteração em `backend/src/shared/database.js` do BioCultDB nem no schema `biocultdb_records` —
  o BioCultTermos só lê essa tabela, nunca escreve (`bioculttermos/backend/src/shared/database.js:9-12`).
- Nenhuma autenticação adicionada às portas 3001/3002 (3091/3092 externas) do BioCultDB — fora de escopo
  (ADR-001, item 8).

## 5. Verificação pós-corte (checklist de aceite)

- [x] `docker logs BioCultDB` mostra ambos os processos subindo sem erro (`[start-unit] Starting BioCultDB...` e `[start-unit] Starting BioCultTermos...`)
- [x] `GET :3093/` (Apresentação) continua respondendo normalmente — `200`, nenhuma regressão no BioCultDB
- [x] `GET :3091/` e `:3092/` (Aquisição/Curadoria) continuam respondendo normalmente — `200`/`200`
- [x] `GET :4000/health` responde `{"status":"ok","sqlite":"connected"}`
- [x] `GET :4001/health` sem credencial → `401`; com credencial correta → `200`
- [x] Após `POST :4001/acquisition/run`, existem linhas em `etnotermos` com `status='candidate'`
      — **2536 conceitos candidatos** gerados a partir dos 28 registros de `biocultdb_records`
- [x] `sqlite_master` mostra `biocultdb_records*` e `etnotermos*` coexistindo no mesmo arquivo
      (ver nota de bug conhecido em §8)
- [x] Reiniciar/recriar o container (~6 vezes ao longo desta sessão, cada redeploy) não gerou
      `duplicate column name` nem qualquer erro de schema (ver §8 — bug já corrigido, mas é o
      cenário que o expôs)

## 6. Backup e recuperação operacional

- Backup = copiar o arquivo `<APPDATA>/biocultdb/data/biocultdb.sqlite` (mais os
  arquivos `-wal`/`-shm` se o container estiver rodando em modo WAL no momento da cópia). Um único
  arquivo cobre BioCultDB **e** BioCultTermos agora — não há mais dois backups separados a coordenar.
- Recomendação: script de backup periódico (cron do host Unraid, fora do container) fazendo
  `sqlite3 biocultdb.sqlite ".backup backup-$(date +%F).sqlite"` (backup consistente mesmo com o banco
  em uso, via API nativa do SQLite) — não implementado nesta sessão, fica como próximo passo operacional
  sugerido, não bloqueante para o corte.

## 7. Fluxo de desenvolvimento do submodule (daqui para frente)

O repositório `BioCultTermos` (`github.com/edalcin/BioCultTermos`) fica **congelado como produto**:
ninguém mais roda `BioCultTermos/docker/docker-compose.yml` (single-service standalone) nem trata esse
repo como uma entrega independente com seu próprio roadmap/release.

Isso **não** significa que o repositório para de receber commits — por mecânica de git submodule, ele
continua sendo o remoto de onde o código de `BioCultDB/bioculttermos/` vem. O fluxo correto para qualquer
mudança futura no BioCultTermos:

```bash
cd BioCultDB/bioculttermos
# editar código normalmente
git add -A && git commit -m "..."
git push origin main            # vai para github.com/edalcin/BioCultTermos

cd ..                           # volta para a raiz do BioCultDB
git add bioculttermos           # registra o novo SHA do submodule
git commit -m "chore: bump bioculttermos submodule to <sha curto>"
git push origin main            # CI (docker-publish.yml) builda a imagem com o código novo
```

Nenhum desenvolvimento deve ser feito clonando `BioCultTermos` separadamente fora de `BioCultDB/bioculttermos/`
— isso divergiria do commit pinado pelo submodule sem ninguém perceber.

## 8. Bug conhecido já corrigido (contexto para o implementador)

`shared/database.js` de ambos os projetos (BioCultDB e BioCultTermos) tem uma função
`ensureGeneratedColumn` (`bioculttermos/backend/src/shared/database.js:91-104`) que existe por causa de
um bug real encontrado durante a migração v3.1: `PRAGMA table_info()` **não reflete** colunas
`GENERATED ALWAYS AS (...) VIRTUAL` adicionadas via `ALTER TABLE` (confirmado em SQLite 3.49.2 /
better-sqlite3 11.x — `sqlite_master.sql` tem a coluna, `table_info` não lista). Isso causava
`duplicate column name` em toda segunda conexão ao mesmo arquivo (restart do servidor, ou — relevante
aqui — os dois apps abrindo o mesmo arquivo em sequência). O fix já está em produção nos dois repos:
detectar a coluna via `try/catch` na própria `ALTER TABLE`, não via `table_info`. Não precisa reabrir
esse problema; só é relevante saber que ele existiu, porque o cenário desta integração (duas aplicações
abrindo o mesmo arquivo, cada uma criando seu próprio schema no boot) é exatamente o que o expôs
originalmente.

## 9. Fora de escopo (não implementar sem novo pedido explícito)

- Autenticação nas portas 3001/3002 (3091/3092 externas) do BioCultDB.
- Migração/importação de dados de uma instância standalone do BioCultTermos (não existe nenhuma em
  produção hoje).
- Integração com BioCultRelatos (padrão análogo, mas BioCultRelatos ainda está em fase inicial de
  desenvolvimento — ver `Arquitetura-BioCultural/README.md:251-272`). Quando o código do BioCultRelatos
  existir, este documento serve de modelo, mas a unidade "Comunidade Tradicional" é um container
  diferente, com seu próprio arquivo SQLite — não o mesmo `biocultdb.sqlite`.
- Script de backup automatizado (mencionado em §6 como sugestão, não como requisito desta integração).
- Multi-usuário admin no BioCultTermos (`ADMIN_USERS`) — hoje um único usuário (`ADMIN_USERNAME`/`ADMIN_PASSWORD`)
  é suficiente; migrar para `ADMIN_USERS` é reversível e trivial no futuro se necessário.

## 10. Glossário

| Termo | Significado |
|---|---|
| **Unidade Federada** | Unidade de implantação da Arquitetura BioCultural v3.1: um container, um arquivo SQLite compartilhado, uma ou mais ferramentas (ex.: BioCultDB + BioCultTermos = "Unidade de Fontes Secundárias"). Definido em ADR-004/ADR-005. |
| **`SQLITE_DB_PATH`** | Env var que aponta para o arquivo SQLite compartilhado dentro do container (`/data/biocultdb.sqlite` em produção). Lida por ambas as ferramentas. |
| **WAL (Write-Ahead Logging)** | Modo de journal do SQLite (`journal_mode=WAL`) que permite leitores não bloquearem escritores — necessário porque duas aplicações (BioCultDB e BioCultTermos) escrevem no mesmo arquivo. |
| **JSON1 / `json_extract`** | Extensão SQLite para armazenar/consultar documentos JSON em colunas `TEXT`; base do modelo de dados de ambas as ferramentas (ADR-005 DA2). |
| **Coluna gerada (`GENERATED ALWAYS AS ... VIRTUAL`)** | Coluna calculada a partir do JSON (`doc`) para permitir índice/filtro sem reprocessar o JSON inteiro a cada query. Ver bug conhecido em §8. |
| **FTS5** | Extensão de busca textual full-text do SQLite (`tokenize='unicode61 remove_diacritics 2'`, ranking `bm25()`), usada tanto por `biocultdb_records_fts` quanto por `etnotermos_fts`. |
| **`biocultdb_records`** | Tabela do BioCultDB (referências científicas, comunidades, plantas). Propriedade exclusiva do BioCultDB — o BioCultTermos só lê, nunca escreve. |
| **`etnotermos` / `etnotermos_fts` / `etnotermos_acquisition_log` / `etnotermos_audit_log`** | Tabelas do BioCultTermos no mesmo arquivo. Propriedade exclusiva do BioCultTermos. |
| **SKOS-XL** | *Simple Knowledge Organization System eXtension for Labels* (padrão W3C) — modelo de conceito/rótulo usado pelo BioCultTermos para vocabulário controlado multilíngue (`prefLabel`, `altLabel`, `broader`/`narrower`/`related`). |
| **`AcquisitionService`** | Serviço do BioCultTermos (`bioculttermos/backend/src/services/AcquisitionService.js`) que lê `biocultdb_records`, extrai valores de 4 campos monitorados (tipo de comunidade, nome vernacular, tipo de uso, atividade econômica) e cria conceitos `candidate` no `etnotermos`; também semeia o vocabulário estático de referência (`docs/referencia/tipoUso.txt`, via `bioculttermos/backend/src/data/referenceTerms.js`) mesmo sem ocorrência ainda em `biocultdb_records`. Nome científico saiu do escopo de curadoria em 2026-08-10 — ver [decisão](docs/curadoria/decisao-nomes-cientificos-fora-de-escopo.md). Disparado sob demanda pelo botão **"Executar Aquisição"** do dashboard admin (`POST /acquisition/run`). |
| **`candidate` / `active` / `deprecated`** | Ciclo de vida de um conceito SKOS-XL no BioCultTermos: criado como `candidate` pelo `AcquisitionService` a cada execução sob demanda, promovido a `active` por um curador/terminólogo (porta 4001), ou marcado `deprecated` (com `replacedBy` opcional). |
| **HTTP Basic Auth + bcrypt** | Mecanismo de autenticação da porta 4001 (admin). Middleware `requireAuth` (`bioculttermos/backend/src/lib/auth/basicAuth.js`) decodifica o header `Authorization: Basic ...` e compara com hash bcrypt. |
| **`ADMIN_USERNAME` / `ADMIN_PASSWORD`** | Par de env vars (Opção B de `config/index.js:22-28`) para um único usuário admin, senha em texto plano hasheada no boot. Opção escolhida nesta integração (vs. `ADMIN_USERS` JSON multi-usuário). |
| **`start-unit.sh`** | Script entrypoint do container dual-app: sobe os dois processos Node como filhos, propaga `SIGTERM`, e derruba ambos se qualquer um crashar sozinho ("fail-fast", nunca deixa a unidade "meio no ar"). |
| **`dumb-init`** | Processo `PID 1` minimalista usado no container para repassar sinais corretamente aos processos filhos (necessário porque Node não é um bom PID 1 por padrão). |
| **Submodule (git)** | Mecanismo do git para incluir um repositório dentro de outro, pinado a um commit específico. `BioCultDB/bioculttermos` é um submodule apontando para `github.com/edalcin/BioCultTermos`. |
| **Corte / cutover** | Momento em que o container de produção é substituído pela nova versão (dual-app). Ver checklist §4.2. |
| **Unidade de Fontes Secundárias** | Nome da unidade federada BioCultDB + BioCultTermos (dados extraídos de literatura científica — "fontes secundárias" — em oposição a "fontes primárias" registradas diretamente com comunidades, papel do futuro BioCultRelatos). |

## 11. Consolidação pós-corte (correções encontradas em produção)

O corte inicial (§4.2, commits `9dcf4bf..251e6df`) colocou a imagem dual-app no ar, mas expôs uma
série de problemas reais — alguns na própria infraestrutura de deploy, outros no código do
BioCultTermos (submodule) que só se manifestavam com dados de produção. Registrados aqui em ordem
cronológica, cada um com causa raiz, correção e commits.

### 11.1 Imagem `:latest` cacheada localmente no host (bloqueou o primeiro corte)

O operador recriou o container com o `docker run` correto (nome, envs, portas), mas o Docker do
host usou a imagem `:latest` **já em cache local** em vez de puxar a nova imagem dual-app do GHCR —
`docker run` não força pull se a tag já existe localmente. Resultado: container com envs/portas
dual-app corretas, mas rodando o binário single-app antigo (sem BioCultTermos).
**Correção**: `docker pull` explícito antes de recriar — desde então, todo redeploy desta sessão
seguiu esse padrão. Lição registrada em `docs/operacao/corte-producao-unidade.md`.

### 11.2 Autenticação HTTP Basic sem re-prompt (403 em vez de 401)

`bioculttermos/backend/src/lib/auth/basicAuth.js` retornava `403` (sem header `WWW-Authenticate`)
em credenciais inválidas. Navegadores só reabrem o prompt nativo de login em resposta `401` com
esse header — uma vez errada a senha, o usuário ficava preso vendo o JSON cru
`{"error":"Invalid credentials"}` para sempre, sem conseguir tentar de novo sem limpar o cache do
navegador. **Correção**: `401` + `WWW-Authenticate` em toda falha de autenticação, com página HTML
amigável (botão "Tentar novamente") para clientes de navegador; contrato JSON preservado para
clientes de API. `BioCultTermos@2b4e377` → `BioCultDB@f44ed30`.

### 11.3 Links de edição de conceito quebrados (`_id` vs `id`, herança de MongoDB)

Todas as views EJS (admin e público) referenciavam `._id` (convenção MongoDB pré-migração), mas o
modelo SQLite usa `.id`. O link "Editar" apontava para uma rota inexistente
(`/concepts/<id>/edit` — nunca existiu, só `GET /concepts/:id`) e, com `_id` undefined, virava
`/concepts//edit`, que o Express roteava como `id='edit'` → `404 Conceito não encontrado`. Também
afetava navegação entre conceitos relacionados e o banner de conceito depreciado no site público
(rótulos em branco por usar `.prefLabel` singular em vez de `.prefLabels[]`). **Correção**: 6
arquivos EJS corrigidos, sufixo `/edit` inexistente removido dos links. `BioCultTermos@23bb642` →
`BioCultDB@2b33a98`.

### 11.4 Cobertura de vocabulário incompleta (nome científico ausente, `tipoUso.txt` não usado)

`AcquisitionService.MONITORED_FIELDS` nunca incluiu `comunidades.plantas.nomeCientifico`, apesar de
ser um campo de primeira classe no BioCultDB (formulários, validação, estatísticas, FTS). Além
disso, `docs/referencia/tipoUso.txt` (lista de referência de ~450 termos de uso de plantas, compilada da
literatura etnobotânica) nunca era usado por nenhum código — só documentação de domínio.
**Correção**: campo `nomeCientifico` adicionado à extração; `docs/referencia/tipoUso.txt` copiado para
`bioculttermos/backend/src/data/referenceTerms.js` e semeado como conceitos `candidate` a cada
ciclo de aquisição (idempotente), independente do que já existe em `biocultdb_records` — curador
ainda revisa cada um antes de promover a `active`. `BioCultTermos@9c40c96` → `BioCultDB@36eed01`.

> **Revertido em escopo (2026-08-10):** `comunidades.plantas.nomeCientifico` saiu do escopo de
> curadoria do BioCultTermos — ver
> [decisão](docs/curadoria/decisao-nomes-cientificos-fora-de-escopo.md).

### 11.5 `AcquisitionService.run()` travando o processo admin em execuções longas

Com os ~454 termos de referência somados aos já minerados (~1400), um ciclo de aquisição passou a
tocar linhas suficientes para que o loop de upsert síncrono do better-sqlite3 travasse o processo
Node do admin (4001) pela duração inteira — a própria rota `POST /acquisition/run` (fire-and-forget
por design) não conseguia responder seu próprio `202` até o ciclo inteiro terminar, e nenhuma outra
requisição admin era atendida nesse meio tempo (confirmado com um `curl` que deu timeout logo após
disparar um ciclo). O processo público (4000) é separado e não era afetado. **Correção**: yield
periódico ao event loop (`setImmediate`) a cada 40 upserts nos dois loops de `run()`.
`BioCultTermos@7c8453d` → `BioCultDB@b4d8c53`.

### 11.6 Lista de termos admin sem paginação (2516 de 2536 termos inacessíveis)

`ConceptService.findMany()` sempre paginou em `limit=20`, mas `concepts/list.ejs` nunca renderizou
nenhuma navegação de página — a lista de termos do admin ficava presa nos primeiros 20 resultados,
sem nenhum jeito de alcançar os outros 2516. Ao investigar, mais dois bugs adjacentes no mesmo
arquivo: a resposta a requisições HTMX renderizava o **documento completo** (cabeçalho, nav, barra
de filtros) dentro do próprio alvo de troca — cada interação duplicaria a UI aninhada dentro de si
mesma; e os campos de filtro (Status/Campo semântico/Busca) nunca refletiam visualmente a seleção
ativa (checavam uma variável nunca passada pela rota). **Correção**: paginação Anterior/Próxima
adicionada, resposta HTMX corrigida para renderizar só o fragmento esperado, filtro "Campo
semântico" ganhou a opção `nomeCientifico`, estado visual dos filtros corrigido.
`BioCultTermos@ecb89d6` → `BioCultDB@d1c156b`.

> **Revertido em escopo (2026-08-10):** a opção `nomeCientifico` do filtro "Campo semântico" segue
> disponível para achar o legado, mas o campo saiu do escopo de curadoria — ver
> [decisão](docs/curadoria/decisao-nomes-cientificos-fora-de-escopo.md).

### 11.7 "Ativar Conceito": confirmação dupla e falha silenciosa

O botão misturava um handler Alpine.js morto
(`x-on:click="confirm(...) && $el.closest('form').submit()"` — o botão não está em `<form>`, então
`.closest('form')` é sempre `null`) com o `hx-confirm` nativo do htmx no mesmo elemento — dois
listeners de clique independentes, cada um com seu próprio diálogo nativo. Mais grave: por não
estar em `<form>` e sem `hx-vals`/`hx-include`, a ativação nunca enviava o campo `version` ao
servidor; `parseInt(undefined, 10)` é `NaN`, e o lock otimista (`concept.version !== version`)
nunca é verdadeiro para `NaN` — **toda tentativa de ativação falhava com 409, silenciosamente**, em
todo clique, sem nada na UI indicando o motivo. O formulário "Deprecar Conceito" tinha o bug
idêntico (nenhum campo de versão no formulário). Ao corrigir, descoberto um terceiro bug
independente na mesma área: adicionar/remover relações semânticas sempre devolvia o JSON cru do
conceito, que o htmx despejava como texto na lista de "pills" a cada sucesso. **Correção**: handler
Alpine quebrado removido, `hx-vals` com a versão atual adicionado a ambos os botões de status,
resposta das rotas de relação corrigida para renderizar HTML consistente. Aproveitado para também
trocar o campo de ID cru do formulário de relações por busca com sugestões por nome (pedido do
operador). `BioCultTermos@a4805ee` → `BioCultDB@369d4d8`.

### Resultado agregado

28 registros em `biocultdb_records` → **2536 conceitos candidatos** em `etnotermos` (844 nomes
científicos, 981 nomes vernaculares, 668 tipos de uso, 34 atividades econômicas, 9 tipos de
comunidade). Todos os 193 testes automatizados do BioCultTermos passam
(`bioculttermos/backend`, `npx jest`). Interface admin (`:4001/concepts`) navegável, editável e
funcional ponta a ponta — verificado interativamente via Chromium real em servidor local
descartável, além dos testes automatizados.
