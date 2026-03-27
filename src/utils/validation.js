'use strict';

/**
 * 이메일 형식 검증 (RFC 5322 간소화)
 * @param {string} email
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * 정수 범위 검증
 * @param {*} value - 검증할 값
 * @param {number} min - 최솟값 (포함)
 * @param {number} max - 최댓값 (포함)
 * @returns {boolean}
 */
const isIntegerInRange = (value, min, max) => {
  return Number.isInteger(value) && value >= min && value <= max;
};

/**
 * 양의 정수 검증
 * @param {*} value
 * @returns {boolean}
 */
const isPositiveInteger = (value) => {
  return Number.isInteger(value) && value > 0;
};

/**
 * 필수 필드 검증
 * @param {object} obj - 검증할 객체
 * @param {string[]} fields - 필수 필드 이름 배열
 * @returns {{ valid: boolean, missing: string[] }}
 */
const validateRequiredFields = (obj, fields) => {
  const missing = fields.filter(
    (f) => obj[f] === undefined || obj[f] === null || obj[f] === '',
  );
  return { valid: missing.length === 0, missing };
};

/**
 * 성별 검증
 * @param {string} gender
 * @returns {boolean}
 */
const isValidGender = (gender) => {
  return ['male', 'female', 'other'].includes(gender);
};

module.exports = {
  isValidEmail,
  isIntegerInRange,
  isPositiveInteger,
  validateRequiredFields,
  isValidGender,
};
