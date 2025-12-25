# Acquisition Context API Contract

**Context**: Data entry interface for researchers to submit ethnobotanical references
**Port**: 3001
**Base URL**: `http://localhost:3001`

## Endpoints

### 1. Display Reference Entry Form

**Endpoint**: `GET /`

**Description**: Renders the main acquisition page with empty reference entry form

**Response**: HTML page with nested form structure

**Form Structure**:
- Reference metadata fields (titulo, autores, ano, resumo, DOI)
- Container for communities (initially 1 empty community form)
- "Adicionar Comunidade" button
- "Submeter Referência" button

---

### 2. Add Community Form Fragment

**Endpoint**: `POST /community/add`

**Description**: HTMX endpoint that returns HTML fragment for a new community form block

**Request Body**: None (or existing community count for numbering)

**Response**: HTML fragment
```html
<div class="community-form" id="community-{index}">
  <h3>Comunidade {index + 1}</h3>
  <input name="comunidades[{index}][nome]" placeholder="Nome da comunidade" required>
  <input name="comunidades[{index}][municipio]" placeholder="Município" required>
  <input name="comunidades[{index}][estado]" placeholder="Estado" required>
  <textarea name="comunidades[{index}][local]" placeholder="Localização detalhada"></textarea>
  <input name="comunidades[{index}][atividadesEconomicas]" placeholder="Atividades econômicas (separadas por vírgula)">
  <textarea name="comunidades[{index}][observacoes]" placeholder="Observações"></textarea>

  <div id="plantas-container-{index}">
    <!-- Initial empty plant form -->
  </div>

  <button hx-post="/plant/add/{index}" hx-target="#plantas-container-{index}" hx-swap="beforeend">
    Adicionar Planta
  </button>

  <button type="button" onclick="removeCommunity({index})">Remover Comunidade</button>
</div>
```

**Status Code**: 200 OK

---

### 3. Add Plant Form Fragment

**Endpoint**: `POST /plant/add/:communityIndex`

**Description**: HTMX endpoint that returns HTML fragment for a new plant form block within a specific community

**Path Parameters**:
- `communityIndex`: Index of the community (0-based)

**Response**: HTML fragment
```html
<div class="plant-form" id="plant-{communityIndex}-{plantIndex}">
  <h4>Planta {plantIndex + 1}</h4>
  <input name="comunidades[{communityIndex}][plantas][{plantIndex}][nomeCientifico]"
         placeholder="Nomes científicos (separados por vírgula)"
         required>
  <input name="comunidades[{communityIndex}][plantas][{plantIndex}][nomeVernacular]"
         placeholder="Nomes vernaculares (separados por vírgula)"
         required>
  <input name="comunidades[{communityIndex}][plantas][{plantIndex}][tipoUso]"
         placeholder="Tipos de uso (separados por vírgula)"
         required>
  <button type="button" onclick="removePlant({communityIndex}, {plantIndex})">Remover Planta</button>
</div>
```

**Status Code**: 200 OK

---

### 4. Submit Reference

**Endpoint**: `POST /reference/submit`

**Description**: Processes submitted reference form, validates data, inserts into MongoDB with status "pending"

**Request Body** (application/x-www-form-urlencoded):
```
titulo=Diversity+Of+Plant+Uses...
autores=HANAZAKI,+N.&autores=TAMASHIRO,+J.+Y.
ano=2000
resumo=Caiçaras+são+habitantes...
DOI=
comunidades[0][nome]=Ponta+do+Almada
comunidades[0][municipio]=Ubatuba
comunidades[0][estado]=São+Paulo
comunidades[0][local]=limite+sul...
comunidades[0][atividadesEconomicas]=pesca,agricultura,turismo
comunidades[0][observacoes]=É+a+menor...
comunidades[0][plantas][0][nomeCientifico]=Foeniculum+vulgare
comunidades[0][plantas][0][nomeVernacular]=erva-doce
comunidades[0][plantas][0][tipoUso]=medicinal
...
```

**Processing**:
1. Parse form data into nested structure
2. Convert comma-separated strings to arrays
3. Validate using validation rules from data-model.md
4. If valid:
   - Add `status: "pending"`
   - Add `createdAt` and `updatedAt` timestamps
   - Insert into MongoDB
   - Redirect to success page
5. If invalid:
   - Re-render form with error messages
   - Preserve submitted data

**Success Response**:
- **Status**: 302 Redirect
- **Location**: `/success`

**Validation Error Response**:
- **Status**: 400 Bad Request
- **Content-Type**: text/html
- **Body**: Form with error messages and preserved data

---

### 5. Success Page

**Endpoint**: `GET /success`

**Description**: Confirmation page after successful reference submission

**Response**: HTML page
```html
<div class="success-message">
  <h2>Referência Submetida com Sucesso</h2>
  <p>A referência foi enviada e está aguardando curadoria.</p>
  <p>Status: Pendente</p>
  <a href="/">Submeter Nova Referência</a>
</div>
```

**Status Code**: 200 OK

---

## Data Transformation

### Form Data → MongoDB Document

**Input** (form data):
```
autores=HANAZAKI, N.&autores=TAMASHIRO, J. Y.
comunidades[0][atividadesEconomicas]=pesca,agricultura,turismo
comunidades[0][plantas][0][nomeCientifico]=Foeniculum vulgare
```

**Output** (MongoDB document):
```json
{
  "autores": ["HANAZAKI, N.", "TAMASHIRO, J. Y."],
  "comunidades": [
    {
      "atividadesEconomicas": ["pesca", "agricultura", "turismo"],
      "plantas": [
        {
          "nomeCientifico": ["Foeniculum vulgare"]
        }
      ]
    }
  ]
}
```

**Transformation Logic**:
1. Multiple form fields with same name → Array
2. Comma-separated values in single field → Array (trim whitespace)
3. Empty strings → Empty string or omit field (based on optional/required)
4. Nested array indices `[0]`, `[1]` → Array order

---

## Error Responses

### Validation Errors

**Status**: 400 Bad Request

**Response Body**: HTML form with error messages

**Error Display Pattern**:
```html
<div class="error-summary">
  <h3>Erros de Validação:</h3>
  <ul>
    <li>Título é obrigatório</li>
    <li>Comunidade 1: Pelo menos uma planta é obrigatória</li>
  </ul>
</div>

<form>
  <!-- Form fields with error classes and preserved values -->
  <input name="titulo" value="" class="error">
  <span class="field-error">Título é obrigatório</span>
</form>
```

---

### Database Errors

**Status**: 500 Internal Server Error

**Response Body**: HTML error page

```html
<div class="error-page">
  <h2>Erro ao Submeter Referência</h2>
  <p>Ocorreu um erro ao salvar os dados. Por favor, tente novamente.</p>
  <a href="/">Voltar ao Formulário</a>
</div>
```

---

## Security Considerations

### Input Sanitization

- HTML encode all user input before display (prevent XSS)
- No authentication required (open access per spec)
- Rate limiting: Consider limiting submissions per IP (future enhancement)

### Data Validation

- Server-side validation mandatory (never trust client)
- Array length limits to prevent memory exhaustion
- String length limits enforced

---

## Performance Considerations

### Form Complexity

- Dynamic form additions use HTMX for efficient partial updates
- No full page reloads when adding communities/plants
- Client-side state minimal (server-side rendering)

### Large Submissions

- Typical reference: 1-5 communities, 1-10 plants per community
- Maximum reasonable: 20 communities, 50 plants each
- Form size: ~10-50KB typical, ~500KB maximum
- No special handling needed for stated scale

---

## Example Full Request

### Successful Submission

**Request**:
```http
POST /reference/submit HTTP/1.1
Host: localhost:3001
Content-Type: application/x-www-form-urlencoded

titulo=Diversity+Of+Plant+Uses+In+Two+Cai%C3%A7ara+Communities
&autores=HANAZAKI,+N.&autores=TAMASHIRO,+J.+Y.&autores=LEIT%C3%83O-FILHO,+H.+F.&autores=BEGOSSI,+A.
&ano=2000
&resumo=Cai%C3%A7aras+s%C3%A3o+habitantes+nativos...
&DOI=
&comunidades[0][nome]=Ponta+do+Almada
&comunidades[0][municipio]=Ubatuba
&comunidades[0][estado]=S%C3%A3o+Paulo
&comunidades[0][local]=limite+sul+do+N%C3%BAcleo+Picinguaba
&comunidades[0][atividadesEconomicas]=pesca,agricultura,turismo
&comunidades[0][observacoes]=%C3%89+a+menor+das+duas+comunidades
&comunidades[0][plantas][0][nomeCientifico]=Foeniculum+vulgare
&comunidades[0][plantas][0][nomeVernacular]=erva-doce
&comunidades[0][plantas][0][tipoUso]=medicinal
```

**Response**:
```http
HTTP/1.1 302 Found
Location: /success
```

---

## Integration Points

### MongoDB Connection

- Database: `etnodb`
- Collection: `etnodb`
- Connection string from environment variable: `MONGO_URI`

### Shared Services

- Uses `models/Reference.js` for data structure
- Uses `services/validation.js` for validation logic
- Uses `services/database.js` for MongoDB operations

---

## Future Enhancements (Out of Scope)

- Draft saving (auto-save form progress)
- File uploads (attach PDF of scientific article)
- Duplicate detection before submission
- Author autocomplete from existing database
- Plant name autocomplete with taxonomic validation
