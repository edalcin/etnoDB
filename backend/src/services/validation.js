/**
 * Validation Service
 *
 * Server-side validation for reference data
 * All error messages in Portuguese per requirements
 */

const { Constraints, Status } = require('../models/Reference');
const logger = require('../shared/logger');

/**
 * Validate reference data
 * @param {Object} data - Reference data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
function validateReference(data) {
  const errors = [];

  // Title validation
  if (!data.titulo || typeof data.titulo !== 'string' || data.titulo.trim().length === 0) {
    errors.push('Título é obrigatório');
  } else if (data.titulo.length > Constraints.titulo.maxLength) {
    errors.push(`Título deve ter no máximo ${Constraints.titulo.maxLength} caracteres`);
  }

  // Authors validation
  if (!Array.isArray(data.autores) || data.autores.length === 0) {
    errors.push('Pelo menos um autor é obrigatório');
  } else {
    const emptyAuthors = data.autores.filter(a => !a || typeof a !== 'string' || a.trim().length === 0);
    if (emptyAuthors.length > 0) {
      errors.push('Todos os autores devem ter um nome válido');
    }
  }

  // Year validation
  if (!data.ano || !Number.isInteger(data.ano)) {
    errors.push('Ano é obrigatório e deve ser um número inteiro');
  } else if (data.ano < Constraints.ano.min || data.ano > Constraints.ano.max) {
    errors.push(`Ano deve estar entre ${Constraints.ano.min} e ${Constraints.ano.max}`);
  }

  // Optional field validation (if provided)
  if (data.resumo && data.resumo.length > Constraints.resumo.maxLength) {
    errors.push(`Resumo deve ter no máximo ${Constraints.resumo.maxLength} caracteres`);
  }

  if (data.DOI && data.DOI.length > Constraints.DOI.maxLength) {
    errors.push(`DOI deve ter no máximo ${Constraints.DOI.maxLength} caracteres`);
  }

  // Status validation
  if (data.status && !Object.values(Status).includes(data.status)) {
    errors.push('Status deve ser "pending", "approved" ou "rejected"');
  }

  // Communities validation
  if (!Array.isArray(data.comunidades) || data.comunidades.length === 0) {
    errors.push('Pelo menos uma comunidade é obrigatória');
  } else {
    data.comunidades.forEach((comunidade, idx) => {
      const communityErrors = validateCommunity(comunidade, idx + 1);
      errors.push(...communityErrors);
    });
  }

  const isValid = errors.length === 0;

  if (!isValid) {
    logger.validation('Validation failed:', errors);
  }

  return {
    isValid,
    errors
  };
}

/**
 * Validate community data
 * @param {Object} comunidade - Community data
 * @param {number} index - Community index (1-based for error messages)
 * @returns {string[]} Array of error messages
 */
function validateCommunity(comunidade, index) {
  const errors = [];
  const prefix = `Comunidade ${index}`;

  // Nome validation
  if (!comunidade.nome || typeof comunidade.nome !== 'string' || comunidade.nome.trim().length === 0) {
    errors.push(`${prefix}: Nome é obrigatório`);
  } else if (comunidade.nome.length > Constraints.comunidade.nome.maxLength) {
    errors.push(`${prefix}: Nome deve ter no máximo ${Constraints.comunidade.nome.maxLength} caracteres`);
  }

  // Município validation
  if (!comunidade.municipio || typeof comunidade.municipio !== 'string' || comunidade.municipio.trim().length === 0) {
    errors.push(`${prefix}: Município é obrigatório`);
  } else if (comunidade.municipio.length > Constraints.comunidade.municipio.maxLength) {
    errors.push(`${prefix}: Município deve ter no máximo ${Constraints.comunidade.municipio.maxLength} caracteres`);
  }

  // Estado validation
  if (!comunidade.estado || typeof comunidade.estado !== 'string' || comunidade.estado.trim().length === 0) {
    errors.push(`${prefix}: Estado é obrigatório`);
  } else if (comunidade.estado.length > Constraints.comunidade.estado.maxLength) {
    errors.push(`${prefix}: Estado deve ter no máximo ${Constraints.comunidade.estado.maxLength} caracteres`);
  }

  // Optional fields validation
  if (comunidade.local && comunidade.local.length > Constraints.comunidade.local.maxLength) {
    errors.push(`${prefix}: Local deve ter no máximo ${Constraints.comunidade.local.maxLength} caracteres`);
  }

  if (comunidade.observacoes && comunidade.observacoes.length > Constraints.comunidade.observacoes.maxLength) {
    errors.push(`${prefix}: Observações devem ter no máximo ${Constraints.comunidade.observacoes.maxLength} caracteres`);
  }

  // Economic activities validation
  if (comunidade.atividadesEconomicas && Array.isArray(comunidade.atividadesEconomicas)) {
    comunidade.atividadesEconomicas.forEach((atividade, aIdx) => {
      if (atividade && atividade.length > Constraints.comunidade.atividadeEconomica.maxLength) {
        errors.push(`${prefix}: Atividade econômica ${aIdx + 1} deve ter no máximo ${Constraints.comunidade.atividadeEconomica.maxLength} caracteres`);
      }
    });
  }

  // Plants validation
  if (!Array.isArray(comunidade.plantas) || comunidade.plantas.length === 0) {
    errors.push(`${prefix}: Pelo menos uma planta é obrigatória`);
  } else {
    comunidade.plantas.forEach((planta, pIdx) => {
      const plantErrors = validatePlant(planta, index, pIdx + 1);
      errors.push(...plantErrors);
    });
  }

  return errors;
}

/**
 * Validate plant data
 * @param {Object} planta - Plant data
 * @param {number} communityIndex - Community index (1-based)
 * @param {number} plantIndex - Plant index (1-based)
 * @returns {string[]} Array of error messages
 */
function validatePlant(planta, communityIndex, plantIndex) {
  const errors = [];
  const prefix = `Comunidade ${communityIndex}, Planta ${plantIndex}`;

  // Scientific name validation
  if (!Array.isArray(planta.nomeCientifico) || planta.nomeCientifico.length === 0) {
    errors.push(`${prefix}: Pelo menos um nome científico é obrigatório`);
  } else {
    const emptyNames = planta.nomeCientifico.filter(n => !n || typeof n !== 'string' || n.trim().length === 0);
    if (emptyNames.length > 0) {
      errors.push(`${prefix}: Todos os nomes científicos devem ser válidos`);
    }

    planta.nomeCientifico.forEach((nome, idx) => {
      if (nome && nome.length > Constraints.planta.nomeCientifico.maxLength) {
        errors.push(`${prefix}: Nome científico ${idx + 1} deve ter no máximo ${Constraints.planta.nomeCientifico.maxLength} caracteres`);
      }
    });
  }

  // Vernacular name validation
  if (!Array.isArray(planta.nomeVernacular) || planta.nomeVernacular.length === 0) {
    errors.push(`${prefix}: Pelo menos um nome vernacular é obrigatório`);
  } else {
    const emptyNames = planta.nomeVernacular.filter(n => !n || typeof n !== 'string' || n.trim().length === 0);
    if (emptyNames.length > 0) {
      errors.push(`${prefix}: Todos os nomes vernaculares devem ser válidos`);
    }

    planta.nomeVernacular.forEach((nome, idx) => {
      if (nome && nome.length > Constraints.planta.nomeVernacular.maxLength) {
        errors.push(`${prefix}: Nome vernacular ${idx + 1} deve ter no máximo ${Constraints.planta.nomeVernacular.maxLength} caracteres`);
      }
    });
  }

  // Type of use validation
  if (!Array.isArray(planta.tipoUso) || planta.tipoUso.length === 0) {
    errors.push(`${prefix}: Pelo menos um tipo de uso é obrigatório`);
  } else {
    const emptyUses = planta.tipoUso.filter(u => !u || typeof u !== 'string' || u.trim().length === 0);
    if (emptyUses.length > 0) {
      errors.push(`${prefix}: Todos os tipos de uso devem ser válidos`);
    }

    planta.tipoUso.forEach((uso, idx) => {
      if (uso && uso.length > Constraints.planta.tipoUso.maxLength) {
        errors.push(`${prefix}: Tipo de uso ${idx + 1} deve ter no máximo ${Constraints.planta.tipoUso.maxLength} caracteres`);
      }
    });
  }

  return errors;
}

/**
 * Sanitize string input (trim whitespace, limit length)
 * @param {string} str - Input string
 * @param {number} maxLength - Maximum length
 * @returns {string} Sanitized string
 */
function sanitizeString(str, maxLength) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
}

/**
 * Sanitize array of strings
 * @param {string[]} arr - Input array
 * @param {number} maxLength - Maximum length per string
 * @returns {string[]} Sanitized array
 */
function sanitizeArray(arr, maxLength) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(item => sanitizeString(item, maxLength))
    .filter(item => item.length > 0);
}

module.exports = {
  validateReference,
  validateCommunity,
  validatePlant,
  sanitizeString,
  sanitizeArray
};
