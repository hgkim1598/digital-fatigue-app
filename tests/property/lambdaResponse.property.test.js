'use strict';

const fc = require('fast-check');

// --- Shared mocks ---
const mockDdbSend = jest.fn();
const mockBedrockAgentSend = jest.fn();
const mockBedrockRuntimeSend = jest.fn();
const mockCognitoSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDdbSend })) },
  QueryCommand: jest.fn((p) => ({ ...p, _type: 'Query' })),
  PutCommand: jest.fn((p) => ({ ...p, _type: 'Put' })),
  GetCommand: jest.fn((p) => ({ ...p, _type: 'Get' })),
  ScanCommand: jest.fn((p) => ({ ...p, _type: 'Scan' })),
}));

jest.mock('@aws-sdk/client-bedrock-agent-runtime', () => ({
  BedrockAgentRuntimeClient: jest.fn(() => ({ send: mockBedrockAgentSend })),
  RetrieveCommand: jest.fn((p) => p),
}));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: mockBedrockRuntimeSend })),
  InvokeModelCommand: jest.fn((p) => p),
}));

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({ send: mockCognitoSend })),
  SignUpCommand: jest.fn((p) => p),
  InitiateAuthCommand: jest.fn((p) => p),
}));

process.env.REGION = 'us-east-1';
process.env.USERS_TABLE = 'Users';
process.env.SYMPTOM_LOGS_TABLE = 'SymptomLogs';
process.env.SCREEN_TIME_TABLE = 'ScreenTime';
process.env.WEEKLY_ANALYSIS_TABLE = 'WeeklyAnalysis';
process.env.RANKINGS_TABLE = 'Rankings';
process.env.CHAT_HISTORY_TABLE = 'ChatHistory';
process.env.KB_ID = 'test-kb';
process.env.USER_POOL_ID = 'pool-id';
process.env.USER_POOL_CLIENT_ID = 'client-id';

const { handler: authHandler } = require('../../src/handlers/auth');
const { handler: symptomHandler } = require('../../src/handlers/symptom');
const { handler: screentimeHandler } = require('../../src/handlers/screentime');
const { handler: analysisHandler } = require('../../src/handlers/analysis');
const { handler: rankingHandler } = require('../../src/handlers/ranking');
const { handler: supplementHandler } = require('../../src/handlers/supplementInfo');
const { handler: chatHandler } = require('../../src/handlers/chat');

/**
 * 응답이 표준 형식 { statusCode, body } 이며 body가 유효한 JSON인지 검증
 */
function assertValidResponse(res) {
  expect(res).toHaveProperty('statusCode');
  expect(typeof res.statusCode).toBe('number');
  expect(res.statusCode).toBeGreaterThanOrEqual(100);
  expect(res.statusCode).toBeLessThan(600);
  expect(res).toHaveProperty('body');
  expect(typeof res.body).toBe('string');
  expect(() => JSON.parse(res.body)).not.toThrow();
}

// 랜덤 이벤트 생성 arbitrary
const randomEvent = fc.record({
  httpMethod: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
  path: fc.constantFrom(
    '/api/auth/signup', '/api/auth/login',
    '/api/symptoms', '/api/screen-time',
    '/api/analysis/weekly', '/api/analysis/ranking',
    '/api/supplement-info', '/api/chat', '/api/chat/history',
    '/unknown'
  ),
  body: fc.oneof(
    fc.constant(null),
    fc.constant('{}'),
    fc.constant('{"message":"test"}'),
    fc.constant('invalid json'),
    fc.json()
  ),
  requestContext: fc.oneof(
    fc.constant({}),
    fc.constant({ authorizer: { claims: { email: 'u@test.com' } } })
  ),
});

describe('Property 12: 모든 Lambda 응답은 표준 형식을 따르며 예외 시 500을 반환한다', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 기본적으로 DynamoDB 호출은 빈 결과 반환
    mockDdbSend.mockResolvedValue({ Items: [], Item: null });
    mockCognitoSend.mockRejectedValue(new Error('mock'));
    mockBedrockAgentSend.mockRejectedValue(new Error('mock'));
    mockBedrockRuntimeSend.mockRejectedValue(new Error('mock'));
  });

  const handlers = [
    { name: 'auth', handler: authHandler },
    { name: 'symptom', handler: symptomHandler },
    { name: 'screentime', handler: screentimeHandler },
    { name: 'analysis', handler: analysisHandler },
    { name: 'ranking', handler: rankingHandler },
    { name: 'supplementInfo', handler: supplementHandler },
    { name: 'chat', handler: chatHandler },
  ];

  handlers.forEach(({ name, handler }) => {
    test(`${name} 핸들러는 랜덤 이벤트에 항상 표준 응답 형식을 반환한다`, async () => {
      await fc.assert(
        fc.asyncProperty(randomEvent, async (event) => {
          jest.clearAllMocks();
          mockDdbSend.mockResolvedValue({ Items: [], Item: null });
          mockCognitoSend.mockRejectedValue(new Error('mock'));
          mockBedrockAgentSend.mockRejectedValue(new Error('mock'));
          mockBedrockRuntimeSend.mockRejectedValue(new Error('mock'));

          const res = await handler(event);
          assertValidResponse(res);
        }),
        { numRuns: 30 }
      );
    });
  });

  test('예외 발생 시 모든 핸들러가 500을 반환한다', async () => {
    // DynamoDB가 항상 에러를 던지도록 설정
    mockDdbSend.mockRejectedValue(new Error('DynamoDB explosion'));

    const authEvent = {
      requestContext: { authorizer: { claims: { email: 'u@test.com' } } },
      httpMethod: 'POST',
      path: '/api/auth/signup',
      body: JSON.stringify({ email: 'u@test.com', password: 'Pass1234!', age: 25, gender: 'male' }),
    };

    const authedEvent = (method, path) => ({
      requestContext: { authorizer: { claims: { email: 'u@test.com' } } },
      httpMethod: method,
      path,
      body: null,
    });

    const results = await Promise.all([
      symptomHandler(authedEvent('GET', '/api/symptoms')),
      screentimeHandler(authedEvent('GET', '/api/screen-time')),
      analysisHandler(authedEvent('GET', '/api/analysis/weekly')),
      rankingHandler(authedEvent('GET', '/api/analysis/ranking')),
      supplementHandler(authedEvent('GET', '/api/supplement-info')),
      chatHandler(authedEvent('GET', '/api/chat/history')),
    ]);

    results.forEach((res) => {
      assertValidResponse(res);
      expect(res.statusCode).toBe(500);
    });
  });
});
