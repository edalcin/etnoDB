# etnoDB - Base de Dados Etnobotânica

<div align="center">
  <img src="./docs/etnodbLogoTrans.png" alt="etnoDB Logo" width="200">
</div>

Sistema web para gerenciamento de **dados secundários** etnobotânicos sobre a relação entre comunidades tradicionais e plantas, extraídos de artigos científicos publicados.

## O que é Etnobotânica?

A etnobotânica é uma disciplina que investiga as interações e relações complexas entre as plantas e as pessoas ao longo do tempo e do espaço. Ela abrange o conhecimento tradicional e ocidental, incluindo os diversos usos (alimentares, medicinais, entre outros), a cosmovisão, os sistemas de gestão e classificação, e as línguas que as diferentes culturas mantêm em relação às plantas e aos seus ecossistemas terrestres e aquáticos associados. Em essência, busca compreender como as sociedades percebem, utilizam, manejam e atribuem significado cultural as plantas, atuando como uma ponte fundamental entre a biologia e as ciências humanas.

> Prance, G.T. Ethnobotany, the science of survival: a declaration from Kaua'i. *Econ Bot* **61**, 1–2 (2007). https://doi.org/10.1007/BF02862367

## Sobre o Projeto

O **etnoDB** é uma interface baseada na web para um banco de dados MongoDB que centraliza **dados secundários** sobre conhecimento tradicional de comunidades brasileiras em relação ao uso de plantas.

### O que são Dados Secundários?

**Dados secundários** são informações que já foram coletadas, publicadas e estão disponíveis em fontes existentes, como artigos científicos, livros, relatórios e outras publicações. Diferentemente dos dados primários (coletados diretamente pelo pesquisador através de entrevistas, observações ou experimentos), os dados secundários representam a compilação e sistematização de conhecimentos já documentados na literatura científica.

No contexto do etnoDB:
- **Fonte**: Artigos científicos publicados em periódicos revisados por pares
- **Conteúdo**: Relações documentadas entre comunidades tradicionais e plantas (usos, nomes vernaculares, conhecimentos associados)
- **Evidência**: Cada registro no banco de dados está vinculado à sua publicação científica original (referência bibliográfica completa com autores, ano, título, DOI)

Essa abordagem permite:
- Reunir conhecimento disperso em múltiplas publicações
- Facilitar buscas e análises integradas de dados etnobotânicos
- Preservar a rastreabilidade das informações até suas fontes originais
- Respeitar os direitos autorais e a ética na pesquisa com comunidades tradicionais

## Arquitetura

O projeto segue a arquitetura proposta em [etnoArquitetura](https://github.com/edalcin/etnoArquitetura), organizada em três contextos principais:

### 1. **Aquisição** (Entrada de Dados Secundários)
Interface dedicada à entrada de **dados secundários extraídos de artigos científicos publicados**.

**Porta**: 3001
**Funcionalidade**: Formulário hierárquico para entrada de:
- Referência bibliográfica completa (título, autores, ano, resumo, DOI)
- Comunidades tradicionais documentadas no artigo
- Plantas e seus usos reportados para cada comunidade

**Importante**: Cada registro está sempre vinculado à sua publicação científica original, garantindo rastreabilidade e respeito aos direitos autorais.

### 2. **Curadoria** (Edição e Validação)
Interface especializada para controle de qualidade com acesso restrito a pesquisadores e representantes das comunidades.

**Porta**: 3002
**Funcionalidade**:
- Listagem de referências com status (pendente/aprovada/rejeitada)
- Edição de conteúdo (metadados, comunidades, plantas)
- Workflow de aprovação implementando princípios C.A.R.E. (Collective Benefit, Authority to Control, Responsibility, Ethics)
- Validação taxonômica (planejada para implementação futura)

### 3. **Apresentação** (Busca e Visualização) - Home Page
Interface pública e padrão para disseminação dos dados curados, com apresentação aprimorada.

**Porta**: 3003 (Interface padrão)
**Funcionalidade**:
- Logo do projeto centralizado na home page
- Busca avançada por comunidade, planta (nome científico ou vernacular), estado e município
- Visualização de resultados em formato de cards responsivos
- Acesso aberto aos dados aprovados
- Exportação de dados em formatos abertos (planejado)

## Estrutura de Dados

O banco de dados utiliza uma estrutura hierárquica em MongoDB, conforme definido em [`/docs/dataStructure.json`](./docs/dataStructure.json):

```
Referência (Publicação Científica)
├── titulo
├── autores[]
├── ano
├── resumo
├── DOI
├── status (pending/approved/rejected)
└── comunidades[] (uma ou mais)
    ├── nome
    ├── municipio
    ├── estado
    ├── local
    ├── atividadesEconomicas[]
    ├── observacoes
    └── plantas[] (uma ou mais)
        ├── nomeCientifico[]
        ├── nomeVernacular[]
        └── tipoUso[]
```

### Exemplo de Registro

Uma referência científica pode documentar múltiplas comunidades, e cada comunidade pode ter múltiplas plantas associadas:

```json
{
  "titulo": "Diversity Of Plant Uses In Two Caiçara Communities",
  "autores": ["HANAZAKI, N.", "TAMASHIRO, J. Y.", ...],
  "ano": 2000,
  "status": "approved",
  "comunidades": [
    {
      "nome": "Ponta do Almada",
      "municipio": "Ubatuba",
      "estado": "São Paulo",
      "plantas": [
        {
          "nomeCientifico": ["Foeniculum vulgare"],
          "nomeVernacular": ["erva-doce"],
          "tipoUso": ["medicinal"]
        }
      ]
    }
  ]
}
```

## Stack Tecnológica

- **Backend**: Node.js 20 LTS + Express.js
- **Frontend**: HTMX + Alpine.js + Tailwind CSS
- **Banco de Dados**: MongoDB 7.0+
- **Containerização**: Docker (Alpine Linux)
- **Template Engine**: EJS
- **Testes**: Jest + mongodb-memory-server

## Arquitetura Técnica

- **Tipo de Projeto**: Aplicação web com backend e frontend
- **Organização**: Três aplicações Express rodando em portas separadas dentro de um único container Docker
- **Renderização**: Server-side rendering com HTMX para interatividade
- **Responsividade**: Design responsivo de 320px (mobile) a 1920px+ (desktop)

## Requisitos

- Node.js 20 LTS ou superior
- MongoDB 7.0 ou superior
- Docker 24.0+ (para deploy em container)
- npm 10.0+

## Instalação e Desenvolvimento

### Configuração Local

```bash
# Clone o repositório
git clone <repository-url>
cd etnoDB

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações

# Inicie o ambiente de desenvolvimento
npm run dev
```

### Usando Docker Compose

```bash
# Inicia aplicação + MongoDB
docker-compose up
```

### Acessando as Interfaces

Após iniciar a aplicação:

- **Aquisição** (entrada de dados): http://localhost:3001
- **Curadoria** (edição e aprovação): http://localhost:3002
- **Apresentação** (busca pública): http://localhost:3003

## Deploy

### Build do Container Docker

```bash
docker build -f docker/Dockerfile -t ghcr.io/edalcin/etnodb:latest .
```

### Publicação

```bash
docker push ghcr.io/edalcin/etnodb:latest
```

O container é publicado automaticamente no GitHub Container Registry (ghcr.io/edalcin/) a cada modificação no código.

### Deploy no Unraid

1. Instale a imagem `ghcr.io/edalcin/etnodb:latest`
2. Configure as variáveis de ambiente:
   - `MONGO_URI`: String de conexão do MongoDB
   - `NODE_ENV=production`
3. Mapeie as portas 3001, 3002 e 3003
4. Conecte à rede do container MongoDB

## Princípios C.A.R.E.

O projeto implementa os princípios C.A.R.E. para dados de povos indígenas e comunidades tradicionais:

- **C**ollective Benefit: Benefício coletivo para as comunidades
- **A**uthority to Control: Autoridade das comunidades sobre seus dados
- **R**esponsibility: Responsabilidade no uso dos dados
- **E**thics: Ética na coleta, armazenamento e disseminação

## Padrões de Dados

O projeto considera a adoção de padrões abertos de dados:
- Darwin Core (biodiversidade)
- Plinian Core (espécies)
- SocioBio (dados socioambientais)

## Documentação Técnica

A documentação técnica completa está disponível em:

- **Especificação de Requisitos**: [`specs/spec.md`](./specs/spec.md)
- **Plano de Implementação**: [`specs/plan.md`](./specs/plan.md)
- **Modelo de Dados**: [`specs/data-model.md`](./specs/data-model.md)
- **Contratos de API**: [`specs/contracts/`](./specs/contracts/)
- **Quickstart para Desenvolvedores**: [`specs/quickstart.md`](./specs/quickstart.md)

## Workflow Completo

1. **Pesquisador** acessa interface de **Aquisição** (porta 3001)
2. Insere dados da referência científica com comunidades e plantas
3. Dados salvos com status `pending`
4. **Curador** acessa interface de **Curadoria** (porta 3002)
5. Revisa e edita dados se necessário
6. Aprova referência (status → `approved`)
7. **Público** acessa interface de **Apresentação** (porta 3003)
8. Busca e visualiza dados aprovados

## Segurança

- Sem autenticação por padrão (controle de acesso gerenciado em nível de rede/infraestrutura)
- Validação server-side de todos os dados
- Sanitização de inputs para prevenir XSS e NoSQL injection
- Todas as interfaces em português

## Próximas Funcionalidades

- Validação taxonômica automática (APIs de Flora e Funga do Brasil, GBIF)
- Autenticação para curadoria e entrada de dados
- Histórico de alterações (audit trail)
- Exportação de dados (CSV, JSON)
- API REST para integrações externas
- Integração com APIs de periódicos científicos

## Contribuições

Contribuições são bem-vindas! Caso tenha sugestões, encontre bugs ou tenha comentários sobre o projeto, abra uma [Issue](../../issues).

## Suporte

Para questões, problemas ou sugestões sobre o etnoDB, utilize a seção [Issues](../../issues) do repositório.

## Contato

Para mais informações sobre o projeto:
- **Desenvolvedor**: Eduardo Dalcin - edalcin@jbrj.gov.br
- **Referência Arquitetônica**: [etnoArquitetura](https://github.com/edalcin/etnoArquitetura)

---

**Nota**: Este projeto documenta conhecimentos de comunidades tradicionais. O uso dos dados deve respeitar os direitos das comunidades e seguir os princípios C.A.R.E.
