# Presentation Context API Contract

**Context**: Public search and display interface for ethnobotanical data
**Port**: 3003
**Base URL**: `http://localhost:3003`

## Endpoints

### 1. Display Search Interface

**Endpoint**: `GET /`

**Description**: Renders public search page with filter options and initial results (or empty state)

**Query Parameters** (all optional):
- `comunidade`: Community name (partial match, case-insensitive)
- `planta`: Plant name - scientific or vernacular (partial match, case-insensitive)
- `estado`: State name (exact match)
- `municipio`: Municipality name (exact match)
- `page`: Page number for pagination (1-based, default: 1)
- `limit`: Results per page (default: 20, max: 100)

**Response**: HTML page with search form and results

**Page Structure**:
```html
<div class="presentation-page">
  <header>
    <h1>Etnobotânica - Base de Dados</h1>
    <p>Busca de conhecimentos tradicionais sobre plantas</p>
  </header>

  <section class="search-filters">
    <form method="GET" action="/">
      <input type="text" name="comunidade" placeholder="Nome da comunidade" value="<%= query.comunidade || '' %>">
      <input type="text" name="planta" placeholder="Nome da planta (científico ou vernacular)" value="<%= query.planta || '' %>">
      <input type="text" name="estado" placeholder="Estado" value="<%= query.estado || '' %>">
      <input type="text" name="municipio" placeholder="Município" value="<%= query.municipio || '' %>">
      <button type="submit">Buscar</button>
      <a href="/">Limpar Filtros</a>
    </form>
  </section>

  <section class="results">
    <p class="result-count"><%= totalResults %> resultado(s) encontrado(s)</p>

    <div class="cards-grid">
      <!-- Result cards rendered here -->
    </div>

    <div class="pagination">
      <!-- Pagination controls -->
    </div>
  </section>
</div>
```

**Status Code**: 200 OK

---

### 2. Search Results (via query parameters)

**Endpoint**: `GET /` (with query parameters)

**Example Requests**:
```
GET /?comunidade=Ponta+do+Almada
GET /?planta=erva-doce
GET /?estado=São+Paulo
GET /?municipio=Ubatuba
GET /?estado=São+Paulo&municipio=Ubatuba&planta=palmito
```

**Response**: Same HTML structure as endpoint #1, but with filtered results

**Empty Results**:
```html
<div class="results">
  <p class="result-count">0 resultado(s) encontrado(s)</p>
  <div class="empty-state">
    <p>Nenhuma referência encontrada com os filtros aplicados.</p>
    <p>Tente ajustar os critérios de busca.</p>
  </div>
</div>
```

---

### 3. Result Card Structure

**Description**: Each approved reference is displayed as a card showing key information

**Card HTML Template**:
```html
<div class="result-card">
  <div class="card-header">
    <h3 class="reference-title"><%= reference.titulo %></h3>
    <p class="reference-meta">
      <%= reference.autores.slice(0, 3).join('; ') %><%= reference.autores.length > 3 ? '; et al.' : '' %>
      (<%= reference.ano %>)
    </p>
  </div>

  <div class="card-body">
    <% reference.comunidades.forEach(comunidade => { %>
      <div class="community-section">
        <h4 class="community-name">
          📍 <%= comunidade.nome %> - <%= comunidade.municipio %>, <%= comunidade.estado %>
        </h4>

        <% if (comunidade.atividadesEconomicas && comunidade.atividadesEconomicas.length > 0) { %>
          <p class="economic-activities">
            <strong>Atividades:</strong> <%= comunidade.atividadesEconomicas.join(', ') %>
          </p>
        <% } %>

        <div class="plants-list">
          <strong>Plantas:</strong>
          <ul>
            <% comunidade.plantas.forEach(planta => { %>
              <li>
                <span class="scientific-name"><em><%= planta.nomeCientifico.join(', ') %></em></span>
                <span class="vernacular-name">(<%= planta.nomeVernacular.join(', ') %>)</span>
                <span class="use-types">- <%= planta.tipoUso.join(', ') %></span>
              </li>
            <% }); %>
          </ul>
        </div>
      </div>
    <% }); %>
  </div>

  <% if (reference.DOI && reference.DOI.trim() !== '') { %>
    <div class="card-footer">
      <a href="https://doi.org/<%= reference.DOI %>" target="_blank" rel="noopener">
        DOI: <%= reference.DOI %>
      </a>
    </div>
  <% } %>
</div>
```

**Card Content**:
- Title (reference.titulo)
- Authors (first 3, "et al." if more)
- Year
- For each community:
  - Community name + location (município, estado)
  - Economic activities (if present)
  - Plants list:
    - Scientific names (italicized)
    - Vernacular names (parentheses)
    - Use types
- DOI link (if present)

---

## MongoDB Queries

### Search with No Filters (All Approved)

```javascript
db.etnodb.find({ status: "approved" })
  .sort({ ano: -1, titulo: 1 })
  .skip((page - 1) * limit)
  .limit(limit);
```

### Search by Community Name

```javascript
db.etnodb.find({
  status: "approved",
  "comunidades.nome": { $regex: /searchTerm/i }
});
```

### Search by Plant Name (Scientific or Vernacular)

```javascript
db.etnodb.find({
  status: "approved",
  $or: [
    { "comunidades.plantas.nomeCientifico": { $regex: /searchTerm/i } },
    { "comunidades.plantas.nomeVernacular": { $regex: /searchTerm/i } }
  ]
});
```

### Search by State

```javascript
db.etnodb.find({
  status: "approved",
  "comunidades.estado": "São Paulo"  // Exact match
});
```

### Search by Municipality

```javascript
db.etnodb.find({
  status: "approved",
  "comunidades.municipio": "Ubatuba"  // Exact match
});
```

### Combined Filters (Multiple Criteria)

```javascript
// Example: State AND Municipality AND Plant
db.etnodb.find({
  status: "approved",
  "comunidades.estado": "São Paulo",
  "comunidades.municipio": "Ubatuba",
  $or: [
    { "comunidades.plantas.nomeCientifico": { $regex: /palmito/i } },
    { "comunidades.plantas.nomeVernacular": { $regex: /palmito/i } }
  ]
});
```

**Filter Logic**: All filters combined with AND (all conditions must match)

---

## Responsive Design

### Breakpoints (Tailwind CSS)

- **Mobile** (320px - 639px): Single column cards, full-width filters
- **Tablet** (640px - 1023px): 2-column card grid, stacked filters
- **Desktop** (1024px+): 3-column card grid, horizontal filter bar

### Card Layout Adaptation

**Mobile**:
```css
.cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
```

**Tablet**:
```css
@media (min-width: 640px) {
  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

**Desktop**:
```css
@media (min-width: 1024px) {
  .cards-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## Pagination

### Pagination Controls HTML

```html
<div class="pagination">
  <% if (currentPage > 1) { %>
    <a href="?<%= buildQueryString({...query, page: 1}) %>" class="page-link">
      « Primeira
    </a>
    <a href="?<%= buildQueryString({...query, page: currentPage - 1}) %>" class="page-link">
      ‹ Anterior
    </a>
  <% } %>

  <span class="page-info">
    Página <%= currentPage %> de <%= totalPages %>
  </span>

  <% if (currentPage < totalPages) { %>
    <a href="?<%= buildQueryString({...query, page: currentPage + 1}) %>" class="page-link">
      Próxima ›
    </a>
    <a href="?<%= buildQueryString({...query, page: totalPages}) %>" class="page-link">
      Última »
    </a>
  <% } %>
</div>
```

### Pagination Calculation

```javascript
const limit = parseInt(req.query.limit) || 20;
const page = parseInt(req.query.page) || 1;

const totalResults = await db.etnodb.countDocuments(query);
const totalPages = Math.ceil(totalResults / limit);

const results = await db.etnodb.find(query)
  .skip((page - 1) * limit)
  .limit(limit);
```

---

## Search Behavior

### Empty Search (No Filters)

- **Action**: Display all approved references
- **Sort**: By year (descending), then title (ascending)
- **Result**: Browse-all functionality

### Partial Match Behavior

**Community Name**: Case-insensitive substring match
- Query: "ponta" → Matches: "Ponta do Almada", "Ponta da Praia"

**Plant Name**: Case-insensitive substring match across both scientific and vernacular
- Query: "erva" → Matches: "erva-doce", "Erva de Santa Maria"
- Query: "foeniculum" → Matches: "Foeniculum vulgare"

### Exact Match Behavior

**State**: Exact match (case-sensitive recommended, but case-insensitive acceptable)
- Query: "São Paulo" → Matches only "São Paulo"

**Municipality**: Exact match (case-sensitive recommended, but case-insensitive acceptable)
- Query: "Ubatuba" → Matches only "Ubatuba"

### Multiple Filter Logic

- **All filters** combined with AND
- Example: `?estado=São Paulo&municipio=Ubatuba` → References with communities in Ubatuba, São Paulo only
- Example: `?planta=palmito&estado=São Paulo` → References with palmito plant AND communities in São Paulo

---

## Performance Considerations

### Query Optimization

**Indexes Required**:
```javascript
db.etnodb.createIndex({ status: 1 });
db.etnodb.createIndex({ ano: -1 });
db.etnodb.createIndex({ "comunidades.nome": "text" });
db.etnodb.createIndex({ "comunidades.estado": 1 });
db.etnodb.createIndex({ "comunidades.municipio": 1 });
db.etnodb.createIndex({
  "comunidades.plantas.nomeCientifico": "text",
  "comunidades.plantas.nomeVernacular": "text"
});
```

**Expected Performance** (with indexes):
- Search queries: 50-200ms
- Result rendering: 50-100ms
- Total page load: <300ms (well under 2s requirement)

### Result Limits

- Default: 20 results per page
- Maximum: 100 results per page
- Prevents excessive memory usage and slow rendering

### Caching (Future Enhancement)

- **Out of Scope**: No caching in initial version
- **Future**: Consider caching for frequent searches or static pages

---

## Error Handling

### Invalid Page Number

**Query**: `?page=abc` or `?page=-1`

**Handling**: Default to page 1 (no error shown)

### Excessive Limit

**Query**: `?limit=1000`

**Handling**: Cap at maximum (100), no error shown

### Database Query Failure

**Status**: 500 Internal Server Error

**Response**:
```html
<div class="error-page">
  <h2>Erro na Busca</h2>
  <p>Ocorreu um erro ao buscar as referências. Por favor, tente novamente.</p>
  <a href="/">Voltar à Busca</a>
</div>
```

---

## Security Considerations

### Public Access (No Authentication)

- All approved references publicly visible
- No sensitive data displayed (as per spec)
- Read-only interface (no data modification)

### Input Sanitization

- Escape all user input before MongoDB query (prevent NoSQL injection)
- Escape all output in HTML (prevent XSS)
- Limit query parameter lengths

**NoSQL Injection Prevention**:
```javascript
// BAD (vulnerable)
db.etnodb.find({ "comunidades.nome": req.query.comunidade });

// GOOD (sanitized)
const sanitizedInput = String(req.query.comunidade).substring(0, 200);
db.etnodb.find({ "comunidades.nome": { $regex: sanitizedInput, $options: 'i' } });
```

---

## Integration Points

### Data Source

- **Database**: MongoDB `etnodb.etnodb` collection
- **Filter**: Only `status: "approved"` references
- **Real-time**: Changes in curation context (approvals/rejections) immediately affect search results

### Shared Services

- Uses `models/Reference.js` for data structure
- Uses `services/database.js` for MongoDB queries
- No dependency on acquisition or curation contexts

---

## Example Search Scenarios

### Scenario 1: Find All Medicinal Plants

**Query**: `?planta=medicinal`

**Expected**: References where any plant has "medicinal" in tipoUso array

**Challenge**: Current query matches plant name, not use type

**Solution**: Modify query to search tipoUso field as well (future enhancement)

### Scenario 2: Browse All References from Ubatuba

**Query**: `?municipio=Ubatuba`

**Expected**: All references with communities in Ubatuba municipality

**Result**: Multiple references, each displayed as a card

### Scenario 3: Search for Specific Plant by Scientific Name

**Query**: `?planta=Foeniculum+vulgare`

**Expected**: References containing Foeniculum vulgare

**Result**: Matches in nomeCientifico arrays

### Scenario 4: Combined State and Plant Search

**Query**: `?estado=São+Paulo&planta=palmito`

**Expected**: References with communities in São Paulo state AND plants named "palmito"

**MongoDB Query**:
```javascript
{
  status: "approved",
  "comunidades.estado": "São Paulo",
  $or: [
    { "comunidades.plantas.nomeCientifico": /palmito/i },
    { "comunidades.plantas.nomeVernacular": /palmito/i }
  ]
}
```

---

## UI/UX Enhancements (Future)

### Out of Scope (Initial Version)

- Autocomplete for state/municipality (dropdown with known values)
- Advanced search (filter by use type, economic activities, year range)
- Export results (CSV, JSON download)
- Sorting options (alphabetical, by year, by number of plants)
- Map view (geolocation of communities)
- Detailed reference view (expandable card or separate page)
- Search result highlighting (matched terms highlighted in results)

### In Scope (Initial Version)

- Basic text input filters
- Card-based results display
- Pagination
- Responsive design (mobile to desktop)
- Empty state messaging
- Result count display

---

## Accessibility Considerations

### Semantic HTML

- Proper heading hierarchy (h1, h2, h3, h4)
- Form labels for all inputs
- Landmark regions (header, main, footer if present)

### Keyboard Navigation

- All filters and pagination accessible via keyboard
- Focus indicators visible
- Tab order logical

### Screen Readers

- Alt text for any icons
- ARIA labels where needed
- Form field descriptions

---

## Summary

The presentation API provides a read-only public interface for searching approved ethnobotanical references. It supports filtering by community, plant, state, and municipality with responsive card-based results display. Performance targets are well within requirements (<2s) with proper MongoDB indexing.
