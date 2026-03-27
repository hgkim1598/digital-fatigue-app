'use strict';

const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { success, error } = require('../utils/response');
const { maskEmail } = require('../utils/auth');
const {
  isValidEmail,
  isPositiveInteger,
  isValidGender,
  validateRequiredFields,
} = require('../utils/validation');

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION })
);

const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID;
const USERS_TABLE = process.env.USERS_TABLE;

const handler = async (event) => {
  try {
    const path = event.path || '';
    const method = (event.httpMethod || '').toUpperCase();

    if (method === 'POST' && path.endsWith('/signup')) {
      return await handleSignup(event);
    }
    if (method === 'POST' && path.endsWith('/login')) {
      return await handleLogin(event);
    }

    return error(404, 'Not found');
  } catch (err) {
    console.error('Auth handler error:', err.message);
    return error(500, '서버 오류가 발생했습니다');
  }
};

async function handleSignup(event) {
  const body = JSON.parse(event.body || '{}');

  const { valid, missing } = validateRequiredFields(body, ['email', 'password', 'age', 'gender']);
  if (!valid) {
    return error(400, `필수 항목이 누락되었습니다: ${missing.join(', ')}`);
  }

  const { email, password, age, gender } = body;

  if (!isValidEmail(email)) {
    return error(400, '유효하지 않은 이메일 형식입니다');
  }
  if (!isPositiveInteger(age)) {
    return error(400, '나이는 양의 정수여야 합니다');
  }
  if (!isValidGender(gender)) {
    return error(400, '성별은 male, female, other 중 하나여야 합니다');
  }

  try {
    await cognitoClient.send(
      new SignUpCommand({
        ClientId: USER_POOL_CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
      })
    );
  } catch (err) {
    if (err.name === 'UsernameExistsException') {
      console.warn(`Signup duplicate: ${maskEmail(email)}`);
      return error(409, '이미 등록된 이메일입니다');
    }
    console.error(`Cognito signup error for ${maskEmail(email)}:`, err.message);
    return error(500, '회원가입 처리 중 오류가 발생했습니다');
  }

  await ddbDocClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        PK: `USER#${email}`,
        email,
        age,
        gender,
        createdAt: new Date().toISOString(),
      },
    })
  );

  console.log(`Signup success: ${maskEmail(email)}`);
  return success(200, { message: '회원가입이 완료되었습니다' });
}

async function handleLogin(event) {
  const body = JSON.parse(event.body || '{}');

  const { valid, missing } = validateRequiredFields(body, ['email', 'password']);
  if (!valid) {
    return error(400, `필수 항목이 누락되었습니다: ${missing.join(', ')}`);
  }

  const { email, password } = body;

  try {
    const result = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: USER_POOL_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })
    );

    const tokens = result.AuthenticationResult;
    console.log(`Login success: ${maskEmail(email)}`);
    return success(200, {
      accessToken: tokens.AccessToken,
      idToken: tokens.IdToken,
      refreshToken: tokens.RefreshToken,
    });
  } catch (err) {
    if (
      err.name === 'NotAuthorizedException' ||
      err.name === 'UserNotFoundException'
    ) {
      console.warn(`Login failed: ${maskEmail(email)}`);
      return error(401, '이메일 또는 비밀번호가 올바르지 않습니다');
    }
    console.error(`Cognito login error for ${maskEmail(email)}:`, err.message);
    return error(500, '로그인 처리 중 오류가 발생했습니다');
  }
}

module.exports = { handler };
