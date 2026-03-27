'use strict';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

/**
 * 성공 응답 헬퍼
 * @param {number} statusCode - HTTP 상태 코드
 * @param {object} data - 응답 데이터
 * @returns {{ statusCode: number, headers: object, body: string }}
 */
const success = (statusCode, data) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(data),
});

/**
 * 에러 응답 헬퍼
 * @param {number} statusCode - HTTP 상태 코드
 * @param {string} message - 에러 메시지
 * @returns {{ statusCode: number, headers: object, body: string }}
 */
const error = (statusCode, message) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify({ message }),
});

module.exports = { success, error, CORS_HEADERS };
