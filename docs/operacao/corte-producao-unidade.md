# Corte in-place do container `BioCultDB` (Unraid) — Unidade dual-app

Procedimento manual do operador para migrar o container de produção `BioCultDB` (renomeado de
`etnoDB` no corte executado em 2026-07-13) da imagem single-app (`docker/Dockerfile`) para a
imagem dual-app (`docker/Dockerfile.unidade`,
BioCultDB + BioCultTermos sobre o mesmo arquivo SQLite), conforme
`docs/decisions/ADR-001-integracao-bioculttermos.md` e `integracao.md` §4.2.

Pré-requisito: imagem `ghcr.io/edalcin/biocultdb:latest` já publicada pelo CI como dual-app
(commit `a5dbe47`, workflow "Docker Build and Publish" run
[#29237786575](https://github.com/edalcin/BioCultDB/actions/runs/29237786575), verificada
localmente ponta a ponta antes da publicação).

Este documento **não é executado automaticamente** — é o roteiro que o operador segue
manualmente no Unraid.

## O que NÃO muda

- Nome do container: `BioCultDB` (renomeado de `etnoDB` no corte executado em 2026-07-13)
- Imagem: `ghcr.io/edalcin/biocultdb:latest` (agora dual-app — mesma tag, sem imagem paralela)
- Rede: `bridge`
- Volume bind mount: `<APPDATA>/biocultdb/data/` → `/data`
- Envs existentes: `TZ`, `HOST_OS`/`HOST_HOSTNAME`/`HOST_CONTAINERNAME`,
  `NODE_ENV=production`, `SQLITE_DB_PATH=/data/biocultdb.sqlite`
- Portas existentes: `3091:3001`, `3092:3002`, `3093:3003`
- Labels `net.unraid.docker.*`

## +2 portas novas (1:1, sem offset)

- `4000:4000/tcp` — BioCultTermos público
- `4001:4001/tcp` — BioCultTermos admin

## +2 variáveis de ambiente

- `ADMIN_USERNAME=<ADMIN_USERNAME>`
- `ADMIN_PASSWORD=<senha real — defina no Unraid, nunca commitar>`

## Procedimento de corte in-place

1. **Backup**: copiar `biocultdb.sqlite` (+ `-wal`/`-shm` se existirem) de
   `<APPDATA>/biocultdb/data/` para local de backup (a quente, WAL permite;
   ou com o container parado, mais seguro).
2. **Registrar o digest atual** (ponto de rollback — `:latest` é flutuante):
   ```bash
   docker inspect BioCultDB --format='{{.Image}}'
   ```
   Guarde esse valor.
3. **Parar e remover** `BioCultDB` (o bind mount preserva os dados, intocado).
4. **Recriar** com imagem/nome/rede/volume/envs atuais **+ 2 portas + 2 envs** (bloco completo
   abaixo).
5. **Subir** o container.
6. **Verificar saúde**:
   - `curl http://<HOST_UNRAID>:3093/` → 200 (BioCultDB, inalterado)
   - `curl http://<HOST_UNRAID>:4000/health` → `{"status":"ok","sqlite":"connected"}`
   - `curl -o /dev/null -w "%{http_code}" http://<HOST_UNRAID>:4001/` → `401` (sem credencial)
   - `curl -u <ADMIN_USERNAME>:<ADMIN_PASSWORD> -o /dev/null -w "%{http_code}" http://<HOST_UNRAID>:4001/` → `200`
   - `docker logs BioCultDB` → `[start-unit] Starting BioCultDB...` e `[start-unit] Starting
     BioCultTermos...`, sem stack trace
7. **Disparar a 1ª aquisição** (não esperar até 3h):
   ```bash
   curl -u <ADMIN_USERNAME>:<ADMIN_PASSWORD> -X POST http://<HOST_UNRAID>:4001/acquisition/run
   ```
   Confirmar candidatos criados a partir dos registros já existentes em `biocultdb_records`
   (`GET /acquisition/status` ou dashboard admin).
8. **Rollback** (a qualquer ponto após o passo 3): recriar `BioCultDB` com a imagem do digest
   registrado no passo 2, sem as 2 portas/2 envs novas — volume/dados intocados, só a
   imagem/portas/env mudam.

## Bloco `docker run` equivalente completo

```bash
docker run -d --name='BioCultDB' --net='bridge' --pids-limit 2048 \
  -e TZ="America/Sao_Paulo" \
  -e HOST_OS="Unraid" -e HOST_HOSTNAME="<HOST_HOSTNAME>" -e HOST_CONTAINERNAME="BioCultDB" \
  -e 'NODE_ENV'='production' \
  -e 'SQLITE_DB_PATH'='/data/biocultdb.sqlite' \
  -e 'ADMIN_USERNAME'='<ADMIN_USERNAME>' \
  -e 'ADMIN_PASSWORD'='<SENHA_ADMIN>' \
  -l net.unraid.docker.managed=dockerman \
  -l net.unraid.docker.webui='http://<HOST_UNRAID>:3093' \
  -l net.unraid.docker.icon='https://raw.githubusercontent.com/edalcin/etnoDB/main/docs/etnodbLogoTrans300.png' \
  -p '3091:3001/tcp' -p '3092:3002/tcp' -p '3093:3003/tcp' \
  -p '4000:4000/tcp' -p '4001:4001/tcp' \
  -v '<APPDATA>/biocultdb/data/':'/data':'rw' \
  'ghcr.io/edalcin/biocultdb:latest'
```

## Verificação local que precedeu este corte

A imagem dual-app foi validada localmente antes de publicar no CI (Etapa 2 do plano de
integração): build de `docker/Dockerfile.unidade`, container de teste com as 5 portas
respondendo, `401`→`200` na auth de `:4001`, seed de 1 registro em `biocultdb_records`,
`POST /acquisition/run` gerando 4 conceitos `candidate`, coexistência confirmada de
`biocultdb_records` e `etnotermos*` no mesmo arquivo SQLite, e restart do container sem erro
de schema (`duplicate column name`).

## Registro de execução (corte real, 2026-07-13)

O operador já havia recriado o container em produção com nome **`BioCultDB`** (não `etnoDB`) e
as envs/portas corretas, mas usando uma imagem `:latest` cacheada localmente no host — anterior
à publicação dual-app do CI (`Cmd=[npm start]`, single-app, sem BioCultTermos). Diagnóstico e
correção executados via SSH (`<HOST_UNRAID>`):

1. Diagnóstico: `docker logs BioCultDB` mostrava só `node backend/src/server.js` (sem
   `[start-unit]`/BioCultTermos) apesar do healthcheck estar `healthy`; `docker inspect` confirmou
   imagem local desatualizada (digest `sha256:90edc9a5...`, `Cmd=[npm start]`).
2. Backup a frio: `docker stop BioCultDB` (checkpoint limpo do WAL) + cópia de
   `biocultdb.sqlite` para `<APPDATA>/biocultdb/backups/` antes de qualquer
   remoção.
3. `docker rm BioCultDB` + `docker pull ghcr.io/edalcin/biocultdb:latest` → nova imagem
   dual-app, digest `sha256:5aad119cac49df80678c1df805076076325fd65144f89df4a968f90ce4b30fc8`.
4. Recriado com o mesmo `docker run` (nome `BioCultDB`, envs/portas do bloco acima).
5. Verificação: `:3093/` → 200, `:4000/health` → `{"status":"ok","sqlite":"connected"}`,
   `:4001/` sem auth → 401, com auth → 200. Logs mostraram `[start-unit] Starting BioCultDB...`
   e `[start-unit] Starting BioCultTermos...`, sem stack trace.
6. `POST /acquisition/run` → 202; confirmado no arquivo: 28 registros em `biocultdb_records`
   (dados de produção reais), 1404 conceitos `etnotermos` criados como `candidate`, 0 `active`
   (aguardando promoção manual pelo curador em `:4001/`).

**Lição operacional**: `docker pull`/recriação de container não garante imagem atualizada se
`:latest` já existir em cache local no host — sempre confirmar `docker pull` explícito antes de
recriar, ou verificar `docker inspect --format='{{.Image}}'` contra o digest publicado no GHCR.

## Atualizações posteriores a este corte

Este corte foi o primeiro de uma série de redeploys da mesma sessão de estabilização (mesmo
padrão: `docker pull` explícito + `docker rm`/`docker run` — repetido ~6 vezes sem incidente).
Cada um corrigiu um bug de produção real encontrado depois do corte inicial (autenticação,
cobertura de vocabulário, paginação do admin, bloqueio do processo de aquisição, botão de
ativação, busca de relações) — histórico completo e resultado agregado (28 registros → 2536
conceitos candidatos) em [`integracao.md`](../../integracao.md) §11 "Consolidação pós-corte".

### Redeploy de 2026-08-10 — purga dos nomes científicos (ADR-014)

Mesmo padrão do corte: `docker stop` (checkpoint limpo do WAL) → backup a frio →
`docker rm` → `docker pull` explícito → `docker run` do bloco acima. Imagem
`build.commit=9780915`. Backups: `backup-pre-purga-nomes-cientificos-2026-08-10T11-04-55Z.sqlite`
(antes da purga de dados) e `backup-pre-deploy-purga-2026-08-10T11-14-52Z.sqlite` (antes do
redeploy), ambos com `PRAGMA integrity_check` = ok.

Verificado depois: `:3093/` → 200; `:4001` sem auth → 401, com auth → 200; o filtro "Campo
semântico" oferece exatamente os quatro campos em escopo; aquisição com `created=0` nos quatro e
**nenhum** conceito de nome científico ressemeado; busca por nome científico na Apresentação
continua retornando. Detalhes em
[`../curadoria/decisao-nomes-cientificos-fora-de-escopo.md`](../curadoria/decisao-nomes-cientificos-fora-de-escopo.md).

> **Lição operacional (quase-incidente).** Ao recriar o container via SSH, a senha do admin foi
> passada como `"$ADMIN_PW"` dentro do script remoto, mas a variável só existia na máquina local —
> o container subiu `healthy` com `ADMIN_PASSWORD` **vazio**. `healthy` não prova autenticação:
> o healthcheck bate numa rota sem auth. Recriado com a senha embutida no script enviado por
> **stdin** (nunca em `argv`, que aparece em `ps`), e a verificação passou a exigir
> `401` sem credencial **e** `200` com credencial — não só o healthcheck.

## Referências

- `docs/decisions/ADR-001-integracao-bioculttermos.md` — decisão arquitetural completa
- `integracao.md` §2 (estado de produção antes/depois do corte) e §4.2 (procedimento de corte,
  fonte deste documento) e §11 (consolidação pós-corte, histórico completo dos redeploys
  subsequentes)
- `docker/Dockerfile.unidade` — Dockerfile de produção (dual-app)
- `docker/docker-compose.unidade.yml` — compose de dev/exemplo equivalente
