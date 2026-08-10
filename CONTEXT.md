# BioCultDB — Unidade de Fontes Secundárias

O BioCultDB registra o conhecimento tradicional associado à biodiversidade tal como documentado em
**literatura científica**. É a unidade federada de *fontes secundárias* da Arquitetura BioCultural:
o dado não nasce de um encontro direto com a comunidade (papel do BioCultRelatos), mas da leitura
de artigos que descreveram esse encontro.

## Language

### Núcleo

**Evidência**:
O conteúdo etnobotânico que um artigo científico documentou — seus metadados bibliográficos mais as
relações entre comunidades tradicionais e plantas que ele descreve. Um artigo, uma Evidência; uma
Evidência documenta muitas relações.
_Avoid_: Referência, Registro, Record, ArticleRecord, Artigo, Paper

**Comunidade Tradicional**:
Grupo humano culturalmente diferenciado que se reconhece como tal e mantém relação própria com o
território e a biodiversidade. Seu tipo vem da lista de 29 categorias do Decreto 8.750/2016.
_Avoid_: População, Grupo, Etnia

**Planta**:
Espécie vegetal citada por uma Comunidade Tradicional dentro de uma Evidência, com seus nomes
científicos, seus nomes vernaculares e os usos que aquela comunidade lhe dá.
_Avoid_: Espécie, Táxon, Vegetal

**Tipo de Uso**:
A finalidade que uma Comunidade Tradicional atribui a uma Planta — medicinal, alimentício, ritual,
construção, entre outros. É vocabulário controlado, curado no BioCultTermos.
_Avoid_: Finalidade, Aplicação, Categoria de uso

**Atividade Econômica**:
Prática produtiva de uma Comunidade Tradicional registrada numa Evidência. Também é vocabulário
controlado.
_Avoid_: Ocupação, Meio de vida

### Ciclo de vida da Evidência

**Aquisição**:
A etapa em que uma Evidência entra no acervo — digitada à mão ou produzida pela Extração por IA.
Nenhuma Evidência nasce publicada.
_Avoid_: Entrada, Cadastro, Ingestão

**Curadoria**:
A etapa em que um humano julga uma Evidência pendente: corrige, aprova ou rejeita com justificativa.
É o único caminho pelo qual uma Evidência se torna pública.
_Avoid_: Revisão, Validação, Moderação

**Apresentação**:
A etapa em que Evidências aprovadas são consultadas — por busca, pelo painel analítico ou pelo
etnoChat. Somente leitura, aberta ao público.
_Avoid_: Publicação, Consulta, Portal

**Pendente / Aprovada / Rejeitada**:
Os três estados de uma Evidência. *Pendente* é o estado de nascimento; *Aprovada* é a única que
aparece na Apresentação; *Rejeitada* é preservada com a justificativa de quem a recusou.

### Inteligência artificial

**Extração por IA**:
A leitura automatizada de um artigo científico por um modelo de linguagem, produzindo uma Evidência
pendente. Substitui a digitação manual, não a Curadoria.
_Avoid_: BioCultPapers, EtnoPapers, Extração (sozinho — colide com extrativismo), Importação, OCR

**Prompt de Extração**:
O texto que instrui o modelo sobre o que extrair de um artigo e em que forma devolver. É um artefato
editorial da unidade: editá-lo muda a qualidade de tudo que for extraído depois.
_Avoid_: Instrução, Template, System prompt

**Provedor de IA**:
O serviço externo que executa o modelo de linguagem. Escolhido pelo usuário entre Claude, OpenAI,
Gemini e OpenRouter, e autenticado com uma chave que pertence a ele, não à instância.
_Avoid_: LLM, Modelo (o modelo é a escolha dentro do provedor), Motor, Backend de IA

**etnoChat**:
A consulta em linguagem natural sobre Evidências aprovadas, na Apresentação. Consome os mesmos
Provedores de IA que a Extração por IA, com chave própria.
_Avoid_: Assistente, Bot, Copiloto

### Federação

**Unidade Federada**:
Uma instalação soberana da Arquitetura BioCultural — um container, um arquivo SQLite, as ferramentas
que aquela unidade opera. O BioCultDB com o BioCultTermos formam a Unidade de Fontes Secundárias.
_Avoid_: Instância, Nó, Deployment

**Fonte Secundária / Fonte Primária**:
*Secundária* é o conhecimento tradicional documentado por terceiros em literatura — o domínio do
BioCultDB. *Primária* é o registrado diretamente com a comunidade — domínio do BioCultRelatos.

**Vocabulário Controlado**:
O conjunto de termos aceitos para os campos que o BioCultTermos governa (tipo de comunidade, tipo de
uso, nomes vernaculares, atividades econômicas), modelado em SKOS-XL. Nome científico é dado da
Planta, regido pelo ICN — fora do vocabulário.
_Avoid_: Taxonomia, Dicionário, Lista de valores
