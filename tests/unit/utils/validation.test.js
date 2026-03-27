'use strict';

const {
  isValidEmail,
  isIntegerInRange,
  isPositiveInteger,
  validateRequiredFields,
  isValidGender,
} = require('../../../src/utils/validation');

describe('validation utility', () => {
  describe('isValidEmail', () => {
    it('accepts valid emails', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('a.b@domain.co.kr')).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('noatsign')).toBe(false);
      expect(isValidEmail('@nodomain')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });
  });

  describe('isIntegerInRange', () => {
    it('accepts integers within range', () => {
      expect(isIntegerInRange(1, 1, 5)).toBe(true);
      expect(isIntegerInRange(3, 1, 5)).toBe(true);
      expect(isIntegerInRange(5, 1, 5)).toBe(true);
    });

    it('rejects values outside range', () => {
      expect(isIntegerInRange(0, 1, 5)).toBe(false);
      expect(isIntegerInRange(6, 1, 5)).toBe(false);
    });

    it('rejects non-integers', () => {
      expect(isIntegerInRange(2.5, 1, 5)).toBe(false);
      expect(isIntegerInRange('3', 1, 5)).toBe(false);
    });
  });

  describe('isPositiveInteger', () => {
    it('accepts positive integers', () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
    });

    it('rejects zero, negatives, and non-integers', () => {
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger(-1)).toBe(false);
      expect(isPositiveInteger(1.5)).toBe(false);
      expect(isPositiveInteger('1')).toBe(false);
    });
  });

  describe('validateRequiredFields', () => {
    it('returns valid when all fields present', () => {
      const result = validateRequiredFields({ a: 1, b: 'x' }, ['a', 'b']);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('returns missing fields', () => {
      const result = validateRequiredFields({ a: 1 }, ['a', 'b', 'c']);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['b', 'c']);
    });

    it('treats null, undefined, empty string as missing', () => {
      const result = validateRequiredFields({ a: null, b: undefined, c: '' }, ['a', 'b', 'c']);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['a', 'b', 'c']);
    });
  });

  describe('isValidGender', () => {
    it('accepts allowed values', () => {
      expect(isValidGender('male')).toBe(true);
      expect(isValidGender('female')).toBe(true);
      expect(isValidGender('other')).toBe(true);
    });

    it('rejects invalid values', () => {
      expect(isValidGender('Male')).toBe(false);
      expect(isValidGender('')).toBe(false);
      expect(isValidGender('unknown')).toBe(false);
    });
  });
});
