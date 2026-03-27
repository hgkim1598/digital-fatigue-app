'use strict';

/**
 * Cognito Pre Sign-up Lambda Trigger
 * 회원가입 시 이메일 인증 없이 자동 확인 처리
 */
const handler = async (event) => {
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  return event;
};

module.exports = { handler };
