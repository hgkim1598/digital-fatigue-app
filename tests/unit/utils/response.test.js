'use strict';

const { success, error, CORS_HEADERS } = require('../../../src/utils/response');

describe('response utility', () => {
  describe('success', () => {
    it('returns correct statusCode and JSON-stringified body', () => {
      const result = success(200, { message: 'ok', id: '123' });
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ message: 'ok', id: '123' });
    });

    it('includes CORS headers', () => {
      const result = success(201, {});
      expect(result.headers).toEqual(CORS_HEADERS);
    });

    it('handles empty object body', () => {
      const result = success(200, {});
      expect(JSON.parse(result.body)).toEqual({});
    });
  });

  describe('error', () => {
    it('returns correct statusCode and message in body', () => {
      const result = error(400, '입력이 유효하지 않습니다');
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({ message: '입력이 유효하지 않습니다' });
    });

    it('includes CORS headers', () => {
      const result = error(500, '서버 오류');
      expect(result.headers).toEqual(CORS_HEADERS);
    });
  });

  describe('response format compliance', () => {
    it('body is always a valid JSON string', () => {
      const s = success(200, { data: [1, 2, 3] });
      const e = error(404, 'not found');
      expect(() => JSON.parse(s.body)).not.toThrow();
      expect(() => JSON.parse(e.body)).not.toThrow();
    });
  });
});
