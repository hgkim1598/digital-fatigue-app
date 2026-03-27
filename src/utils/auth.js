'use strict';

/**
 * JWT 토큰(Cognito Authorizer)에서 사용자 이메일을 추출한다.
 * API Gateway가 event.requestContext.authorizer.claims에 디코딩된 클레임을 전달한다.
 *
 * @param {object} event - API Gateway Lambda proxy 이벤트
 * @returns {string|null} 사용자 이메일 또는 null
 */
const extractEmail = (event) => {
  try {
    const email = event?.requestContext?.authorizer?.claims?.email ?? null;
    return email;
  } catch {
    return null;
  }
};

/**
 * 로그용 이메일 마스킹 처리
 * 예: user@example.com → u***@example.com
 *
 * @param {string} email - 원본 이메일
 * @returns {string} 마스킹된 이메일
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '***';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const masked = local.length > 1
    ? local[0] + '***'
    : '***';
  return `${masked}@${domain}`;
};

module.exports = { extractEmail, maskEmail };
