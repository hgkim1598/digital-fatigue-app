'use strict';

const { extractEmail, maskEmail } = require('../../../src/utils/auth');

describe('auth utility', () => {
  describe('extractEmail', () => {
    it('extracts email from valid Cognito authorizer claims', () => {
      const event = {
        requestContext: {
          authorizer: {
            claims: { email: 'user@example.com' },
          },
        },
      };
      expect(extractEmail(event)).toBe('user@example.com');
    });

    it('returns null when claims are missing', () => {
      expect(extractEmail({ requestContext: {} })).toBeNull();
    });

    it('returns null when event is empty', () => {
      expect(extractEmail({})).toBeNull();
    });

    it('returns null when event is null or undefined', () => {
      expect(extractEmail(null)).toBeNull();
      expect(extractEmail(undefined)).toBeNull();
    });
  });

  describe('maskEmail', () => {
    it('masks email with more than 1 char local part', () => {
      expect(maskEmail('user@example.com')).toBe('u***@example.com');
    });

    it('masks single char local part', () => {
      expect(maskEmail('a@example.com')).toBe('***@example.com');
    });

    it('returns *** for null/undefined/empty', () => {
      expect(maskEmail(null)).toBe('***');
      expect(maskEmail(undefined)).toBe('***');
      expect(maskEmail('')).toBe('***');
    });

    it('returns *** for non-string input', () => {
      expect(maskEmail(123)).toBe('***');
    });

    it('returns *** for string without @', () => {
      expect(maskEmail('noemail')).toBe('***');
    });
  });
});
