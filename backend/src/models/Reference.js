/**
 * Reference Data Model
 *
 * Schema definition for scientific reference documents
 * Based on data-model.md specification
 */

const { ObjectId } = require('mongodb');

/**
 * Reference Schema
 * Represents a scientific publication documenting ethnobotanical knowledge
 */
const ReferenceSchema = {
  _id: ObjectId,                    // MongoDB-generated unique identifier
  titulo: String,                   // Publication title (required)
  autores: [String],                // List of author names (required, min: 1)
  ano: Number,                      // Publication year (required, 4-digit integer)
  resumo: String,                   // Abstract/summary (optional)
  DOI: String,                      // Digital Object Identifier (optional)
  status: String,                   // Workflow status (required: pending|approved|rejected)
  comunidades: [                    // Nested array of communities (required, min: 1)
    {
      nome: String,                 // Community name (required)
      municipio: String,            // Municipality (required)
      estado: String,               // State/province (required)
      local: String,                // Detailed location (optional)
      atividadesEconomicas: [String], // Economic activities (optional)
      observacoes: String,          // Additional notes (optional)
      plantas: [                    // Nested array of plants (required, min: 1)
        {
          nomeCientifico: [String], // Scientific names (required, min: 1)
          nomeVernacular: [String], // Vernacular names (required, min: 1)
          tipoUso: [String]         // Types of use (required, min: 1)
        }
      ]
    }
  ],
  createdAt: Date,                  // Creation timestamp (auto-generated)
  updatedAt: Date                   // Last update timestamp (auto-generated)
};

/**
 * Status enum
 */
const Status = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

/**
 * Create new reference document with defaults
 * @param {Object} data - Reference data
 * @returns {Object} Reference document with timestamps and default status
 */
function createReference(data) {
  const now = new Date();

  return {
    ...data,
    status: data.status || Status.PENDING,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now
  };
}

/**
 * Update reference document with new timestamp
 * @param {Object} data - Updated reference data
 * @returns {Object} Reference document with updated timestamp
 */
function updateReference(data) {
  return {
    ...data,
    updatedAt: new Date()
  };
}

/**
 * Get field constraints for validation
 */
const Constraints = {
  titulo: { maxLength: 500 },
  resumo: { maxLength: 5000 },
  DOI: { maxLength: 100 },
  ano: { min: 1500, max: 2100 },
  comunidade: {
    nome: { maxLength: 200 },
    municipio: { maxLength: 100 },
    estado: { maxLength: 100 },
    local: { maxLength: 500 },
    observacoes: { maxLength: 2000 },
    atividadeEconomica: { maxLength: 100 }
  },
  planta: {
    nomeCientifico: { maxLength: 200 },
    nomeVernacular: { maxLength: 100 },
    tipoUso: { maxLength: 100 }
  }
};

module.exports = {
  ReferenceSchema,
  Status,
  Constraints,
  createReference,
  updateReference
};
