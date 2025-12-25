# Curation Context API Contract

**Context**: Data editing and approval interface for curators
**Port**: 3002
**Base URL**: `http://localhost:3002`

## Endpoints

### 1. Display Reference List

**Endpoint**: `GET /`

**Description**: Renders list of all references with their status, sorted by most recent first

**Query Parameters**:
- `status` (optional): Filter by status ("pending", "approved", "rejected", or "all")
  - Default: "all"
- `page` (optional): Page number for pagination (1-based)
  - Default: 1
- `limit` (optional): Results per page
  - Default: 50

**Response**: HTML page with reference table

**Table Columns**:
- Título (title)
- Autores (authors, first 3 shown)
- Ano (year)
- Status (badge with color: pending=yellow, approved=green, rejected=red)
- Data de Submissão (submission date)
- Ações (actions: "Editar" link)

**Example Response Structure**:
```html
<div class="curation-list">
  <h2>Curadoria de Referências</h2>

  <div class="filters">
    <a href="/?status=all">Todas</a>
    <a href="/?status=pending">Pendentes</a>
    <a href="/?status=approved">Aprovadas</a>
    <a href="/?status=rejected">Rejeitadas</a>
  </div>

  <table class="reference-table">
    <thead>
      <tr>
        <th>Título</th>
        <th>Autores</th>
        <th>Ano</th>
        <th>Status</th>
        <th>Data</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Diversity Of Plant Uses...</td>
        <td>HANAZAKI, N.; TAMASHIRO, J. Y.; ...</td>
        <td>2000</td>
        <td><span class="badge pending">Pendente</span></td>
        <td>2025-12-24</td>
        <td><a href="/reference/edit/{id}">Editar</a></td>
      </tr>
    </tbody>
  </table>

  <div class="pagination">
    <!-- Pagination controls -->
  </div>
</div>
```

**Status Code**: 200 OK

---

### 2. Display Reference Edit Form

**Endpoint**: `GET /reference/edit/:id`

**Description**: Renders edit form for a specific reference, pre-populated with existing data

**Path Parameters**:
- `id`: MongoDB ObjectId of the reference

**Response**: HTML page with editable form (same structure as acquisition form, but pre-filled)

**Additional Elements**:
- Status change section (radio buttons: pending, approved, rejected)
- "Salvar Alterações" button
- "Cancelar" link back to reference list

**404 Response**: If reference ID not found
```html
<div class="error-page">
  <h2>Referência Não Encontrada</h2>
  <p>A referência solicitada não existe.</p>
  <a href="/">Voltar à Lista</a>
</div>
```

**Status Code**: 200 OK (or 404 Not Found)

---

### 3. Update Reference Content

**Endpoint**: `PUT /reference/update/:id`

**Description**: Updates reference data (metadata, communities, plants) without changing status

**Path Parameters**:
- `id`: MongoDB ObjectId of the reference

**Request Body** (application/x-www-form-urlencoded):
Same format as acquisition submit, with all fields editable

**Processing**:
1. Parse form data into nested structure
2. Validate using same rules as acquisition
3. If valid:
   - Update all fields except status
   - Set `updatedAt` timestamp
   - Update document in MongoDB
   - Redirect to edit form with success message
4. If invalid:
   - Re-render form with errors and preserve data

**Success Response**:
- **Status**: 302 Redirect
- **Location**: `/reference/edit/:id?success=true`

**Validation Error Response**:
- **Status**: 400 Bad Request
- **Content-Type**: text/html
- **Body**: Form with error messages

---

### 4. Change Reference Status

**Endpoint**: `POST /reference/status/:id`

**Description**: Changes only the status field of a reference (approve or reject)

**Path Parameters**:
- `id`: MongoDB ObjectId of the reference

**Request Body** (application/x-www-form-urlencoded):
```
status=approved
```

**Valid Status Values**:
- `pending`
- `approved`
- `rejected`

**Processing**:
1. Validate status value
2. Update only `status` field and `updatedAt` timestamp
3. Redirect to reference list

**Success Response**:
- **Status**: 302 Redirect
- **Location**: `/?success=status-updated&id={id}&status={new_status}`

**Validation Error Response**:
- **Status**: 400 Bad Request
- **Body**: Error message (invalid status value)

---

### 5. Add Community (Edit Mode)

**Endpoint**: `POST /reference/:id/community/add`

**Description**: HTMX endpoint that returns HTML fragment for adding a community to existing reference during editing

**Path Parameters**:
- `id`: MongoDB ObjectId of the reference being edited

**Request Body**: Current community count (for indexing)

**Response**: Same community form fragment as acquisition context

**Status Code**: 200 OK

---

### 6. Add Plant (Edit Mode)

**Endpoint**: `POST /reference/:id/plant/add/:communityIndex`

**Description**: HTMX endpoint that returns HTML fragment for adding a plant to a community during editing

**Path Parameters**:
- `id`: MongoDB ObjectId of the reference being edited
- `communityIndex`: Index of the community (0-based)

**Response**: Same plant form fragment as acquisition context

**Status Code**: 200 OK

---

## MongoDB Queries

### List References with Filters

**Query** (all references):
```javascript
db.etnodb.find()
  .project({
    titulo: 1,
    autores: 1,
    ano: 1,
    status: 1,
    createdAt: 1
  })
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit);
```

**Query** (filtered by status):
```javascript
db.etnodb.find({ status: "pending" })
  .project({ titulo: 1, autores: 1, ano: 1, status: 1, createdAt: 1 })
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit);
```

### Get Single Reference for Editing

```javascript
db.etnodb.findOne({ _id: ObjectId(id) });
```

### Update Reference Content

```javascript
db.etnodb.updateOne(
  { _id: ObjectId(id) },
  {
    $set: {
      titulo: "...",
      autores: ["...", "..."],
      ano: 2000,
      resumo: "...",
      DOI: "",
      comunidades: [...], // Complete nested array
      updatedAt: new Date()
    }
  }
);
```

### Update Reference Status Only

```javascript
db.etnodb.updateOne(
  { _id: ObjectId(id) },
  {
    $set: {
      status: "approved",
      updatedAt: new Date()
    }
  }
);
```

---

## UI Patterns

### Status Badges

```html
<span class="badge pending">Pendente</span>
<span class="badge approved">Aprovada</span>
<span class="badge rejected">Rejeitada</span>
```

**CSS Classes**:
- `.badge.pending`: Yellow/orange background
- `.badge.approved`: Green background
- `.badge.rejected`: Red background

### Status Change Section

```html
<div class="status-section">
  <h3>Alterar Status</h3>
  <form action="/reference/status/{id}" method="POST">
    <label>
      <input type="radio" name="status" value="pending" <%= status === 'pending' ? 'checked' : '' %>>
      Pendente
    </label>
    <label>
      <input type="radio" name="status" value="approved" <%= status === 'approved' ? 'checked' : '' %>>
      Aprovada
    </label>
    <label>
      <input type="radio" name="status" value="rejected" <%= status === 'rejected' ? 'checked' : '' %>>
      Rejeitada
    </label>
    <button type="submit">Atualizar Status</button>
  </form>
</div>
```

### Success Messages

**Query Parameter Handling**:
- `?success=true`: "Alterações salvas com sucesso"
- `?success=status-updated&status=approved`: "Referência aprovada com sucesso"
- `?success=status-updated&status=rejected`: "Referência rejeitada"

---

## Security Considerations

### No Authentication (Per Spec)

- Curation interface accessible without login
- Access control handled at network level (port exposure, firewall)
- Unraid deployment assumes trusted network

### Input Validation

- Same validation rules as acquisition context
- MongoDB ObjectId validation for :id parameters
- Status enum validation

### Audit Trail (Out of Scope)

- No change history tracking in initial version
- `updatedAt` timestamp provides basic tracking
- Future enhancement: Full audit log with user attribution

---

## Error Responses

### Invalid Reference ID

**Status**: 404 Not Found

**Body**: HTML error page
```html
<div class="error-page">
  <h2>Referência Não Encontrada</h2>
  <p>A referência com ID {id} não existe.</p>
  <a href="/">Voltar à Lista</a>
</div>
```

### Invalid Status Value

**Status**: 400 Bad Request

**Body**: HTML error page
```html
<div class="error-page">
  <h2>Status Inválido</h2>
  <p>O status deve ser "pending", "approved" ou "rejected".</p>
  <a href="/">Voltar à Lista</a>
</div>
```

### Database Update Failure

**Status**: 500 Internal Server Error

**Body**: HTML error page
```html
<div class="error-page">
  <h2>Erro ao Atualizar Referência</h2>
  <p>Ocorreu um erro ao salvar as alterações. Por favor, tente novamente.</p>
  <a href="/reference/edit/{id}">Voltar ao Formulário</a>
</div>
```

---

## Performance Considerations

### Pagination

- Default 50 references per page
- Indexes on `status` and `createdAt` for efficient queries
- Skip/limit for pagination (acceptable for <10,000 total records)

### Edit Form Pre-population

- Single MongoDB query fetches complete reference document
- No lazy loading needed for nested communities/plants
- Typical reference size: 5-50KB

---

## Integration Points

### Shared with Acquisition Context

- Same validation logic (`services/validation.js`)
- Same data models (`models/Reference.js`)
- Same database service (`services/database.js`)
- Same HTMX form fragments for adding communities/plants

### Impact on Presentation Context

- When status changes to "approved", reference becomes visible in public search
- When status changes to "rejected" or "pending", reference hidden from public

---

## Example Workflows

### Workflow 1: Approve Pending Reference

1. Curator accesses `/` (reference list)
2. Filters by status "pending": `/?status=pending`
3. Clicks "Editar" on a reference: `GET /reference/edit/{id}`
4. Reviews content, makes any corrections: `PUT /reference/update/{id}`
5. Changes status to "approved": `POST /reference/status/{id}` with `status=approved`
6. Redirected to list with success message
7. Reference now visible in presentation context (port 3003)

### Workflow 2: Edit and Reject Reference

1. Curator accesses reference list
2. Opens reference for editing: `GET /reference/edit/{id}`
3. Reviews content and identifies issues
4. Changes status to "rejected": `POST /reference/status/{id}` with `status=rejected`
5. Reference remains hidden from public presentation

### Workflow 3: Edit Reference Content

1. Curator opens approved reference for editing
2. Corrects typo in plant name or adds missing community
3. Submits update: `PUT /reference/update/{id}`
4. Status remains "approved", content updated
5. Updated content immediately reflects in presentation context

---

## Future Enhancements (Out of Scope)

- Bulk status changes (approve/reject multiple references)
- Comments/notes on references for curator communication
- Revision history with rollback capability
- Duplicate reference detection and merging
- Taxonomic validation integration with external APIs
- Email notifications when status changes
