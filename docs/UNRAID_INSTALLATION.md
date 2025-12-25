# Guia de Instalação do etnoDB no Unraid

**Documentação de Deployment do etnoDB via Interface Web do Unraid**

---

## Pré-requisitos

Antes de começar, certifique-se de que:

- ✅ Unraid server está instalado e executando
- ✅ Docker está habilitado no Unraid (padrão)
- ✅ MongoDB está rodando em um container Docker no Unraid
  - Se não tiver MongoDB, siga a [Seção 1: Instalar MongoDB](#seção-1-instalar-mongodb)
- ✅ Conectividade de rede entre containers está configurada
- ✅ Você tem acesso à interface web do Unraid (porta 80/443)

---

## Seção 1: Instalar MongoDB (se necessário)

Se você já tem MongoDB rodando, **pule para a Seção 2**.

### Passo 1.1: Acessar a Interface Docker do Unraid

1. Abra o navegador e acesse: `http://<ip-do-unraid>/`
2. No menu superior, clique em **"Docker"**
3. Clique em **"Docker Containers"** na seção esquerda

### Passo 1.2: Adicionar Container MongoDB

1. Clique no botão **"Add Container"** (ou o ícone `+`)
2. No campo **"Template"**, selecione `mongodb`
   - Se não aparecer, pesquise por "mongo" ou "mongodb"
3. Preencha os campos:
   - **Name**: `mongodb`
   - **Repository**: `library/mongo:latest` (ou versão específica como `mongo:7.0`)
   - **Network Type**: `bridge`

4. Na seção **"Show docker allocations..."**, clique para expandir:
   - Mapeie a porta MongoDB:
     - **Container Port**: `27017`
     - **Host Port**: `27017`

5. Clique em **"Apply"** para criar o container
6. Aguarde até ver o status **"running"** (em verde)

### Passo 1.3: Verificar Conexão MongoDB

```bash
# Do Unraid console ou via SSH:
docker exec mongodb mongosh --eval "db.version()"

# Você deve ver algo como:
# 7.0.0
```

---

## Seção 2: Adicionar Container etnoDB

### Passo 2.1: Acessar Interface Docker do Unraid

1. Abra seu navegador: `http://<ip-do-unraid>/`
2. No menu, clique em **"Docker"** → **"Docker Containers"**
3. Clique em **"Add Container"**

### Passo 2.2: Configuração Básica

Você verá a tela "Add Container" com os seguintes campos:

#### Campo 1: Template
- **Descrição**: Modelo pré-configurado para o container
- **Ação**: Deixe em branco (selecionaremos configuração manual)
- **Valor**: `(deixe vazio ou selecione "Custom")`

#### Campo 2: Name
- **Descrição**: Nome do container no Unraid
- **Ação**: Digite o nome
- **Valor**: `etnodb`

#### Campo 3: Repository
- **Descrição**: Imagem Docker a ser usada
- **Ação**: Digite a URL completa do repositório
- **Valor**: `ghcr.io/edalcin/etnodb:latest`

**Exemplo de preenchimento:**
```
Repository: ghcr.io/edalcin/etnodb:latest
```

### Passo 2.3: Configuração de Rede

#### Network Type
- **Descrição**: Como o container se conecta à rede
- **Ação**: Selecione do dropdown
- **Valor**: `bridge`

Clique em **"Show more settings..."** para expandir opções adicionais.

---

### Passo 2.4: Mapeamento de Portas

Você precisa mapear 3 portas (uma para cada contexto da aplicação).

Clique em **"Add another Path, Port, Variable, Label or Device"** (botão azul com `+`) e repita este processo **3 vezes**:

#### Porta 1: Aquisição (Data Entry)
```
Container Port: 3001
Host Port: 3001
Protocol: tcp
Description: Aquisição - Entrada de dados
```

#### Porta 2: Curadoria (Data Curation)
```
Container Port: 3002
Host Port: 3002
Protocol: tcp
Description: Curadoria - Edição de dados
```

#### Porta 3: Apresentação (Public Search - HOME)
```
Container Port: 3003
Host Port: 3003
Protocol: tcp
Description: Apresentação - Busca pública (Home)
```

**Como adicionar cada porta:**
1. Clique no botão azul **"+"**
2. Preencha os valores acima
3. Clique em **"Add another..."** para a próxima porta

---

### Passo 2.5: Variáveis de Ambiente

Clique novamente em **"Add another Path, Port, Variable, Label or Device"** para adicionar **variáveis de ambiente**.

**Como adicionar cada variável:**
1. Clique no botão azul **"+"**
2. Selecione o tipo: **"Variable"** (não "Path" ou "Port")
3. Preencha `Key` e `Value`
4. Clique em **"Add another..."** para a próxima variável

#### Variável 1: MongoDB URI (OBRIGATÓRIA)
```
Key: MONGO_URI
Value: mongodb://mongodb:27017/etnodb
```

**Explicação**:
- Define como a aplicação se conecta ao MongoDB
- Valor padrão assume MongoDB rodando localmente em container Docker
- `mongodb` = nome do container MongoDB (descoberta de DNS automática)
- `27017` = porta padrão MongoDB
- `etnodb` = nome do banco de dados

**Variações**:
- Se MongoDB em outro host: `mongodb://[OUTRO_HOST]:27017/etnodb`
- Se usando MongoDB Atlas (cloud): `mongodb+srv://user:pass@cluster.mongodb.net/etnodb`
- Se com autenticação: `mongodb://user:password@mongodb:27017/etnodb`

#### Variável 2: Node Environment (OBRIGATÓRIA)
```
Key: NODE_ENV
Value: production
```

**Explicação**:
- Define a aplicação em modo produção
- Otimiza performance e segurança
- Valores aceitos: `production` (padrão) ou `development`

#### Variável 3: Porta Aquisição (OPCIONAL)
```
Key: PORT_ACQUISITION
Value: 3001
```

**Explicação**:
- Porta interna para interface de entrada de dados
- Padrão: `3001`
- Só alterar se conflitar com outra aplicação

#### Variável 4: Porta Curadoria (OPCIONAL)
```
Key: PORT_CURATION
Value: 3002
```

**Explicação**:
- Porta interna para interface de edição de dados
- Padrão: `3002`
- Só alterar se conflitar com outra aplicação

#### Variável 5: Porta Apresentação (OPCIONAL)
```
Key: PORT_PRESENTATION
Value: 3003
```

**Explicação**:
- Porta interna para interface pública (home page)
- Padrão: `3003`
- Só alterar se conflitar com outra aplicação

---

### Passo 2.6: Configurações Adicionais Opcionais

#### CPU/Memory Limits (Opcional)
Se quiser limitar recursos:

```
CPU Cores: 2
Memory: 512
```

#### Privileged Mode (Não recomendado)
- Deixe como **OFF** (modo padrão é suficiente)

#### Console Shell (Padrão)
- Deixe como **Shell**

---

### Passo 2.7: Revisar Configuração

Antes de clicar em "Apply", sua configuração deve parecer com isto:

```
Name: etnodb
Repository: ghcr.io/edalcin/etnodb:latest
Network Type: bridge

Port Mappings:
├── 3001 → 3001 (Aquisição)
├── 3002 → 3002 (Curadoria)
└── 3003 → 3003 (Apresentação)

Environment Variables (Obrigatórias):
├── MONGO_URI: mongodb://mongodb:27017/etnodb
└── NODE_ENV: production

Environment Variables (Opcionais - apenas se usar portas diferentes):
├── PORT_ACQUISITION: 3001
├── PORT_CURATION: 3002
└── PORT_PRESENTATION: 3003
```

**Resumo de Variáveis de Ambiente:**

| Variável | Obrigatória? | Padrão | Descrição |
|----------|--------------|--------|-----------|
| `MONGO_URI` | ✅ Sim | `mongodb://mongodb:27017/etnodb` | Conexão ao MongoDB |
| `NODE_ENV` | ✅ Sim | `production` | Modo de execução |
| `PORT_ACQUISITION` | ❌ Não | `3001` | Porta de entrada de dados |
| `PORT_CURATION` | ❌ Não | `3002` | Porta de edição/aprovação |
| `PORT_PRESENTATION` | ❌ Não | `3003` | Porta pública (home) |

---

### Passo 2.8: Criar o Container

1. Clique no botão **"Apply"** (canto inferior direito)
2. Aguarde o container ser criado e iniciado
3. Você verá uma notificação: `"Container etnodb created successfully"`

---

## Seção 3: Acessar a Aplicação

### Verificar Status

Na página **"Docker Containers"**, procure por `etnodb`:

```
Container: etnodb
Status: ✅ running (verde)
Repository: ghcr.io/edalcin/etnodb:latest
Uptime: seconds ago
```

### Acessar os Contextos

Após o container estar **running**, acesse a aplicação:

#### 🏠 Apresentação (Home Page - Interface Pública)
```
http://<ip-do-unraid>:3003/
```

**Funcionalidade**:
- Busca de plantas e comunidades
- Logo do projeto centralizado
- Interface principal e pública
- **Recomendado para acesso público**

#### 📥 Aquisição (Entrada de Dados)
```
http://<ip-do-unraid>:3001/
```

**Funcionalidade**:
- Formulário para inserir dados secundários de artigos científicos
- Referências, comunidades e plantas
- **Restringir a pesquisadores**

#### ✏️ Curadoria (Edição e Aprovação)
```
http://<ip-do-unraid>:3002/
```

**Funcionalidade**:
- Revisar dados submetidos
- Editar e validar informações
- Aprovar/rejeitar referências
- **Restringir a curadores**

---

## Seção 4: Segurança e Acesso

### Controle de Acesso Recomendado

Como a aplicação **não tem autenticação integrada**, configure acesso em nível de infraestrutura:

#### Opção A: Firewall do Unraid

1. No Unraid, vá para **"Settings"** → **"Firewall"**
2. Configure regras:
   - ✅ Porta 3003 (Apresentação): Permitir todos
   - 🔒 Portas 3001, 3002: Restringir a IPs confiáveis

#### Opção B: Reverse Proxy (Recomendado)

Se você usa um reverse proxy como **nginx** ou **Traefik** no Unraid:

```nginx
# Apresentação (público)
server {
  listen 443 ssl;
  server_name etnodb.example.com;
  location / {
    proxy_pass http://localhost:3003;
  }
}

# Aquisição (privado)
server {
  listen 443 ssl;
  server_name etnodb-acquisition.example.com;
  auth_basic "Restricted";
  location / {
    proxy_pass http://localhost:3001;
  }
}

# Curadoria (privado)
server {
  listen 443 ssl;
  server_name etnodb-curation.example.com;
  auth_basic "Restricted";
  location / {
    proxy_pass http://localhost:3002;
  }
}
```

#### Opção C: VPN/Rede Local Apenas

Configure seu firewall para:
- Expor apenas porta 3003 (Apresentação) para internet
- Manter portas 3001 e 3002 restritas à rede local

---

## Seção 5: Verificação de Saúde

### Logs do Container

Para verificar se tudo está funcionando:

1. Na página **Docker Containers**, clique em **`etnodb`**
2. Clique em **"View Logs"** (ícone de documento/logs)
3. Procure por mensagens como:
   ```
   Connected to MongoDB
   Acquisition server listening on port 3001
   Curation server listening on port 3002
   Presentation server listening on port 3003
   ```

### Teste de Conectividade

Se os logs mostrarem erros de MongoDB:

1. Verifique se container `mongodb` está **running**
2. Teste a conexão:
   ```bash
   docker exec etnodb ping mongodb
   # Deve responder com sucesso
   ```

3. Teste a porta MongoDB:
   ```bash
   docker exec etnodb nc -zv mongodb 27017
   # Deve mostrar: Connection successful
   ```

---

## Seção 6: Backup e Manutenção

### Backup de Dados MongoDB

Antes de fazer atualizações, faça backup do banco de dados:

```bash
# Backup completo
docker exec mongodb mongodump --out /backup/etnodb-$(date +%Y%m%d)

# Ou via Unraid:
# Settings → Scheduled Tasks → Add new script:
/usr/bin/docker exec mongodb mongodump --out /mnt/user/backups/etnodb-$(date +%Y%m%d)
```

### Atualizar etnoDB

Para atualizar para nova versão:

1. Remova o container `etnodb`:
   - Em **Docker Containers**, clique em `etnodb` → **"Delete"**

2. Puxe a nova imagem:
   - Clique em **"Docker Hub"**
   - Pesquise `ghcr.io/edalcin/etnodb`
   - Clique em **"Pull"**

3. Re-crie o container (repita Seção 2)

---

## Seção 7: Troubleshooting

### Problema: Container para/não inicia

**Verificar logs:**
```bash
docker logs etnodb
```

**Causas comuns:**
- ❌ MongoDB não está rodando
- ❌ Porta já está em uso (altere Host Port)
- ❌ Variáveis de ambiente incorretas

### Problema: Aplicação lenta

**Verificar recursos:**
1. Em **Docker Containers**, clique em `etnodb`
2. Vá para **"Stats"** para ver CPU e memória
3. Se necessário, aumente limits (Seção 2.6)

### Problema: Não consegue conectar ao MongoDB

**Verificar variável MONGO_URI:**

1. Clique em `etnodb` → **"Edit"**
2. Procure por variável `MONGO_URI`
3. Confirme que está como: `mongodb://mongodb:27017/etnodb`
4. Clique **"Apply"** e reinicie o container

### Problema: Conexão recusada

**Possíveis causas:**
1. Firewall bloqueando portas
   - Verifique **Settings → Firewall** no Unraid

2. Container ainda iniciando
   - Aguarde 30 segundos e tente novamente

3. Container não está rodando
   - Verifique status em **Docker Containers**
   - Clique no container para ver logs

---

## Seção 8: Configurações Avançadas

### Customizar Portas e Variáveis de Ambiente

**Cenário**: Você quer usar portas diferentes das padrões ou conectar a MongoDB em outro host.

#### Editar Variáveis Existentes

1. Em **Docker Containers**, clique no container **`etnodb`**
2. Clique em **"Edit"**
3. Procure por **"Environment Variables"** (seção com seus KEY=VALUE)
4. Clique na variável que quer alterar (ex: `MONGO_URI`)
5. Atualize o valor conforme necessário
6. Clique em **"Apply"** para salvar

#### Exemplo: Alterar Porta de Apresentação

Se a porta 3003 está sendo usada por outra aplicação:

1. Clique em **Edit** no container `etnodb`
2. Na seção **Port Mappings**, altere:
   - De: `Container Port 3003 → Host Port 3003`
   - Para: `Container Port 3003 → Host Port 4003`
3. Na seção **Environment Variables**, altere:
   - Adicione/altere: `PORT_PRESENTATION = 4003`
4. Clique em **Apply**
5. Acesse: `http://<ip-unraid>:4003/` (nova porta)

#### Exemplo: Usar MongoDB Atlas (Cloud)

Se preferir usar MongoDB em nuvem em vez de container local:

1. Crie conta em [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crie um cluster (Free tier disponível)
3. Copie a connection string: `mongodb+srv://user:pass@cluster.mongodb.net/etnodb`
4. Na edição do container `etnodb`:
   - Clique em **Edit**
   - Procure por variável `MONGO_URI`
   - Atualize o valor para: `mongodb+srv://user:pass@cluster.mongodb.net/etnodb`
   - Clique em **Apply**

**Nota**: Se MongoDB Atlas requer autenticação, inclua na URL: `mongodb+srv://username:password@cluster.mongodb.net/etnodb`

#### Exemplo: Customizar Porta MongoDB

Se MongoDB não está na porta padrão 27017:

1. Na edição do container `etnodb`:
   - Procure por variável `MONGO_URI`
   - Atualize de: `mongodb://mongodb:27017/etnodb`
   - Para: `mongodb://mongodb:27777/etnodb` (ou sua porta customizada)
   - Clique em **Apply**

### Armazenamento Persistente

Para persistir dados fora do container:

1. Clique em etnodb → **"Edit"**
2. Clique em **"Add another Path, Port, Variable..."**
3. Selecione tipo **"Path"**:
   ```
   Container Path: /data
   Host Path: /mnt/user/appdata/etnodb/data
   Read Only: No
   ```

### Adicionar Novas Variáveis de Ambiente

Se precisar adicionar outras variáveis no futuro:

1. Clique em etnodb → **"Edit"**
2. Clique em **"Add another Path, Port, Variable, Label or Device"**
3. Selecione tipo **"Variable"**
4. Preencha:
   ```
   Key: NOME_DA_VARIAVEL
   Value: valor_desejado
   ```
5. Clique em **Apply**

---

## Seção 9: Resumo de Portas

| Contexto | Porta | URL | Acesso | Descrição |
|----------|-------|-----|--------|-----------|
| **Apresentação** | 3003 | `http://unraid:3003/` | 🌐 Público | Home page, busca pública |
| **Aquisição** | 3001 | `http://unraid:3001/` | 🔒 Restrito | Entrada de dados |
| **Curadoria** | 3002 | `http://unraid:3002/` | 🔒 Restrito | Edição e aprovação |

---

## Seção 10: Próximos Passos

Depois da instalação:

1. **Acessar apresentação**: `http://<ip-unraid>:3003/`
2. **Inserir primeiro artigo**: Use `http://<ip-unraid>:3001/`
3. **Revisar dados**: Use `http://<ip-unraid>:3002/`
4. **Configurar segurança**: Restrinja acesso às portas 3001 e 3002
5. **Configurar backup**: Crie tarefas agendadas para backup de dados

---

## Contato e Suporte

Para questões sobre instalação ou uso:

- **Issues**: [GitHub Repository Issues](../../issues)
- **Desenvolvedor**: Eduardo Dalcin <edalcin@jbrj.gov.br>
- **Documentação**: Veja [README.md](../README.md)

---

**Última atualização**: 2025-12-25
**Versão**: etnoDB 1.0
