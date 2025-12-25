# Data Model

**Feature**: Ethnobotanical Database Web Interface
**Date**: 2025-12-25
**Status**: Complete

## Overview

This document defines the data model for the ethnobotanical database interface, based on the existing MongoDB schema and functional requirements from spec.md.

## Entity Definitions

### Reference

**Purpose**: Represents a scientific publication documenting ethnobotanical knowledge from traditional communities.

**Schema**:
```javascript
{
  _id: ObjectId,                    // MongoDB-generated unique identifier
  titulo: String,                   // Publication title (required)
  autores: [String],                // List of author names (required, min: 1)
  ano: Number,                      // Publication year (required, 4-digit integer)
  resumo: String,                   // Abstract/summary (optional)
  DOI: String,                      // Digital Object Identifier (optional, empty string if none)
  status: String,                   // Workflow status (required, enum: "pending" | "approved" | "rejected")
  comunidades: [Community],         // Nested array of communities (required, min: 1)
  createdAt: Date,                  // Creation timestamp (auto-generated)
  updatedAt: Date                   // Last update timestamp (auto-generated)
}
```

**Validation Rules**:
- `titulo`: Non-empty string, max 500 characters
- `autores`: Array with at least 1 non-empty string
- `ano`: Integer between 1500-2100 (historical to near-future publications)
- `resumo`: Optional string, max 5000 characters
- `DOI`: Optional string, max 100 characters, empty string if not available
- `status`: Must be one of: "pending", "approved", "rejected"
- `comunidades`: Array with at least 1 community object

**State Transitions**:
```
[New Submission] → status: "pending"
       ↓
[Curator Review]
       ↓
  ┌────┴────┐
  ↓         ↓
approved  rejected
  ↓         ↓
[Public]  [Hidden]
```

**Indexes**:
```javascript
// Text search on title
db.etnodb.createIndex({ titulo: "text" });

// Status filter for curation context
db.etnodb.createIndex({ status: 1 });

// Recent references for curation list
db.etnodb.createIndex({ createdAt: -1 });
```

---

### Community

**Purpose**: Represents a traditional community studied in a scientific reference.

**Schema**:
```javascript
{
  nome: String,                     // Community name (required)
  municipio: String,                // Municipality (required)
  estado: String,                   // State/province (required)
  local: String,                    // Detailed location description (optional)
  atividadesEconomicas: [String],   // Economic activities (optional)
  observacoes: String,              // Additional notes/observations (optional)
  plantas: [Plant]                  // Nested array of plants (required, min: 1)
}
```

**Validation Rules**:
- `nome`: Non-empty string, max 200 characters
- `municipio`: Non-empty string, max 100 characters
- `estado`: Non-empty string, max 100 characters (should match Brazilian state names)
- `local`: Optional string, max 500 characters
- `atividadesEconomicas`: Optional array of strings, each max 100 characters
- `observacoes`: Optional string, max 2000 characters
- `plantas`: Array with at least 1 plant object

**Nested Within**: Reference (comunidades array)

**Indexes** (on Reference collection):
```javascript
// State/municipality filters for presentation search
db.etnodb.createIndex({ "comunidades.estado": 1 });
db.etnodb.createIndex({ "comunidades.municipio": 1 });

// Community name search
db.etnodb.createIndex({ "comunidades.nome": "text" });
```

---

### Plant

**Purpose**: Represents a plant species used by a community, with botanical and local knowledge.

**Schema**:
```javascript
{
  nomeCientifico: [String],         // Scientific names (required, min: 1)
  nomeVernacular: [String],         // Vernacular/common names (required, min: 1)
  tipoUso: [String]                 // Types of use (required, min: 1)
}
```

**Validation Rules**:
- `nomeCientifico`: Array with at least 1 non-empty string, each max 200 characters
  - Format: Genus species (e.g., "Foeniculum vulgare")
  - May include botanical authority (e.g., "Bidens pilosa L.")
- `nomeVernacular`: Array with at least 1 non-empty string, each max 100 characters
  - Local names in Portuguese or indigenous languages
- `tipoUso`: Array with at least 1 non-empty string, each max 100 characters
  - Examples: "medicinal", "alimentício", "artesanato", "construção"

**Nested Within**: Community (plantas array)

**Indexes** (on Reference collection):
```javascript
// Plant name searches (scientific and vernacular)
db.etnodb.createIndex({
  "comunidades.plantas.nomeCientifico": "text",
  "comunidades.plantas.nomeVernacular": "text"
});
```

---

## Data Relationships

```
Reference (1)
  ├── titulo
  ├── autores[]
  ├── ano
  ├── resumo
  ├── DOI
  ├── status
  └── comunidades[] (1..n)
        ├── nome
        ├── municipio
        ├── estado
        ├── local
        ├── atividadesEconomicas[]
        ├── observacoes
        └── plantas[] (1..n)
              ├── nomeCientifico[]
              ├── nomeVernacular[]
              └── tipoUso[]
```

**Cardinality**:
- 1 Reference contains 1-n Communities
- 1 Community contains 1-n Plants
- All relationships are containment (no external references)

---

## Query Patterns

### Acquisition Context

**Insert New Reference**:
```javascript
db.etnodb.insertOne({
  titulo: "...",
  autores: ["...", "..."],
  ano: 2024,
  resumo: "...",
  DOI: "",
  status: "pending",  // Always "pending" on creation
  comunidades: [
    {
      nome: "...",
      municipio: "...",
      estado: "...",
      local: "...",
      atividadesEconomicas: ["...", "..."],
      observacoes: "...",
      plantas: [
        {
          nomeCientifico: ["...", "..."],
          nomeVernacular: ["...", "..."],
          tipoUso: ["...", "..."]
        }
      ]
    }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
});
```

---

### Curation Context

**List All References with Status**:
```javascript
db.etnodb.find(
  {},
  {
    projection: {
      titulo: 1,
      autores: 1,
      ano: 1,
      status: 1,
      createdAt: 1
    }
  }
).sort({ createdAt: -1 });
```

**Get Single Reference for Editing**:
```javascript
db.etnodb.findOne({ _id: ObjectId("...") });
```

**Update Reference Content**:
```javascript
db.etnodb.updateOne(
  { _id: ObjectId("...") },
  {
    $set: {
      titulo: "...",
      autores: ["...", "..."],
      // ... other fields
      comunidades: [...], // Complete replacement of nested arrays
      updatedAt: new Date()
    }
  }
);
```

**Change Reference Status**:
```javascript
db.etnodb.updateOne(
  { _id: ObjectId("...") },
  {
    $set: {
      status: "approved", // or "rejected"
      updatedAt: new Date()
    }
  }
);
```

---

### Presentation Context

**Search by Community Name**:
```javascript
db.etnodb.find(
  {
    status: "approved",
    "comunidades.nome": { $regex: /searchTerm/i }
  },
  {
    projection: {
      titulo: 1,
      autores: 1,
      ano: 1,
      comunidades: 1
    }
  }
);
```

**Search by Plant Name (Scientific or Vernacular)**:
```javascript
db.etnodb.find(
  {
    status: "approved",
    $or: [
      { "comunidades.plantas.nomeCientifico": { $regex: /searchTerm/i } },
      { "comunidades.plantas.nomeVernacular": { $regex: /searchTerm/i } }
    ]
  }
);
```

**Filter by State**:
```javascript
db.etnodb.find(
  {
    status: "approved",
    "comunidades.estado": "São Paulo"
  }
);
```

**Filter by Municipality**:
```javascript
db.etnodb.find(
  {
    status: "approved",
    "comunidades.municipio": "Ubatuba"
  }
);
```

**Combined Filters (AND logic)**:
```javascript
db.etnodb.find(
  {
    status: "approved",
    "comunidades.estado": "São Paulo",
    "comunidades.municipio": "Ubatuba",
    "comunidades.plantas.nomeVernacular": { $regex: /erva/i }
  }
);
```

---

## Validation Implementation

### Server-Side Validation (Node.js)

**Reference Validation Function**:
```javascript
function validateReference(data) {
  const errors = [];

  // Title validation
  if (!data.titulo || data.titulo.trim().length === 0) {
    errors.push("Título é obrigatório");
  } else if (data.titulo.length > 500) {
    errors.push("Título deve ter no máximo 500 caracteres");
  }

  // Authors validation
  if (!Array.isArray(data.autores) || data.autores.length === 0) {
    errors.push("Pelo menos um autor é obrigatório");
  }

  // Year validation
  if (!data.ano || !Number.isInteger(data.ano)) {
    errors.push("Ano é obrigatório e deve ser um número inteiro");
  } else if (data.ano < 1500 || data.ano > 2100) {
    errors.push("Ano deve estar entre 1500 e 2100");
  }

  // Communities validation
  if (!Array.isArray(data.comunidades) || data.comunidades.length === 0) {
    errors.push("Pelo menos uma comunidade é obrigatória");
  } else {
    data.comunidades.forEach((comunidade, idx) => {
      if (!comunidade.nome || comunidade.nome.trim().length === 0) {
        errors.push(`Comunidade ${idx + 1}: Nome é obrigatório`);
      }
      if (!comunidade.municipio || comunidade.municipio.trim().length === 0) {
        errors.push(`Comunidade ${idx + 1}: Município é obrigatório`);
      }
      if (!comunidade.estado || comunidade.estado.trim().length === 0) {
        errors.push(`Comunidade ${idx + 1}: Estado é obrigatório`);
      }

      // Plants validation
      if (!Array.isArray(comunidade.plantas) || comunidade.plantas.length === 0) {
        errors.push(`Comunidade ${idx + 1}: Pelo menos uma planta é obrigatória`);
      } else {
        comunidade.plantas.forEach((planta, pIdx) => {
          if (!Array.isArray(planta.nomeCientifico) || planta.nomeCientifico.length === 0) {
            errors.push(`Comunidade ${idx + 1}, Planta ${pIdx + 1}: Nome científico é obrigatório`);
          }
          if (!Array.isArray(planta.nomeVernacular) || planta.nomeVernacular.length === 0) {
            errors.push(`Comunidade ${idx + 1}, Planta ${pIdx + 1}: Nome vernacular é obrigatório`);
          }
          if (!Array.isArray(planta.tipoUso) || planta.tipoUso.length === 0) {
            errors.push(`Comunidade ${idx + 1}, Planta ${pIdx + 1}: Tipo de uso é obrigatório`);
          }
        });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
```

---

## Edge Cases & Handling

### Empty/Optional Fields

| Field | Empty Value | Handling |
|-------|-------------|----------|
| DOI | No DOI available | Store as empty string `""` (not null) |
| resumo | No abstract | Store as empty string `""` or omit field |
| local | No specific location | Store as empty string `""` or omit field |
| atividadesEconomicas | No economic data | Store as empty array `[]` or omit field |
| observacoes | No observations | Store as empty string `""` or omit field |

### Duplicate Detection

**Plant Duplicates**: Multiple plants with same scientific name within one community
- **Handling**: Allow at data entry (acquisition), flag for curator review (curation)
- **Validation**: Warning message but not blocking

**Reference Duplicates**: Same publication entered twice
- **Handling**: Check title + authors + year before insert
- **Query**: `db.etnodb.findOne({ titulo: "...", autores: [...], ano: 2024 })`

### Special Characters

**Botanical Authorities**: Scientific names may include special characters
- Examples: "Foeniculum vulgare L.", "Astrocaryum aculeatissimum (Schott) Burret"
- **Handling**: No character restrictions, store as UTF-8

**Portuguese Characters**: Accents and special letters in vernacular names
- Examples: "erva-doce", "jiçara", "brejaúva"
- **Handling**: Full UTF-8 support, case-insensitive search with collation

### Inconsistent Geographic Names

**State/Municipality Spelling Variations**:
- Example: "São Paulo" vs "Sao Paulo" vs "SP"
- **Handling**:
  - Acquisition: Accept any input (free text)
  - Curation: Curator standardizes during review
  - Future: Consider autocomplete/dropdown for standardization

---

## Data Migration

**Status**: No migration needed - database already exists with structure matching /docs/dataStructure.json

**Index Creation**: Execute index creation commands on existing collection:
```javascript
// Run once during deployment
db.etnodb.createIndex({ titulo: "text" });
db.etnodb.createIndex({ status: 1 });
db.etnodb.createIndex({ createdAt: -1 });
db.etnodb.createIndex({ "comunidades.estado": 1 });
db.etnodb.createIndex({ "comunidades.municipio": 1 });
db.etnodb.createIndex({ "comunidades.nome": "text" });
db.etnodb.createIndex({
  "comunidades.plantas.nomeCientifico": "text",
  "comunidades.plantas.nomeVernacular": "text"
});
```

---

## Performance Considerations

### Index Strategy

**Text Indexes**: Full-text search on titulo, comunidades.nome, plantas.nomeCientifico, plantas.nomeVernacular
- **Tradeoff**: Slower writes, faster reads (acceptable for read-heavy presentation context)

**Compound Indexes**: Not needed initially - simple field indexes sufficient for current scale

### Query Optimization

**Projection**: Limit returned fields in presentation context
```javascript
// Only return necessary fields for card display
{ projection: { titulo: 1, autores: 1, ano: 1, "comunidades.nome": 1, "comunidades.plantas": 1 } }
```

**Pagination**: Limit results to prevent large result sets
```javascript
db.etnodb.find(...).limit(50).skip(page * 50);
```

### Denormalization Considerations

**Current**: Fully nested structure (reference → communities → plants)
- **Pros**: Matches domain model, atomic operations, consistency
- **Cons**: Deep nesting in queries, potential duplication of plant data across communities

**Future**: If performance degrades, consider:
- Separate collections for normalized data
- Caching layer for frequent searches
- **Decision**: Defer until proven necessary (YAGNI principle)

---

## Summary

The data model directly reflects the existing MongoDB schema defined in /docs/dataStructure.json with added:
- Status field for curation workflow
- Timestamps for tracking
- Validation rules for data integrity
- Indexes for search performance
- Query patterns for three contexts

All entities and relationships align with functional requirements from spec.md.
