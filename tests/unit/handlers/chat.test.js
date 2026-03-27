'use strict';

const mockDdbSend = jest.fn();
const mockBedrockAgentSend = jest.fn();
const mockBedrockRuntimeSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDdbSend })) },
  QueryCommand: jest.fn((params) => ({ ...params, _type: 'Query' })),
  PutCommand: jest.fn((params) => ({ ...params, _type: 'Put' })),
  GetCommand: jest.fn((params) => ({ ...params, _type: 'Get' })),
}));

jest.mock('@aws-sdk/client-bedrock-agent-runtime', () => ({
  BedrockAgentRuntimeClient: jest.fn(() => ({ send: mockBedrockAgentSend })),
  RetrieveCommand: jest.fn((params) => ({ ...params, _type: 'Retrieve' })),
}));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: mockBedrockRuntimeSend })),
  InvokeModelCommand: jest.fn((params) => ({ ...params, _type: 'InvokeModel' })),
}));

process.env.CHAT_HISTORY_TABLE = 'ChatHistory';
process.env.USERS_TABLE = 'Users';
process.env.KB_ID = 'test-kb-id';
process.env.REGION = 'us-east-1';

const { handler } = require('../../../src/handlers/chat');

const makeEvent = (email, method, path, body) => ({
  requestContext: { authorizer: { claims: { email } } },
  httpMethod: method,
  path,
  body: body ? JSON.stringify(body) : null,
});

describe('ChatFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('인증 정보 없으면 401을 반환한다', async () => {
    const res = await handler({
      requestContext: {},
      httpMethod: 'POST',
      path: '/api/chat',
      body: JSON.stringify({ message: 'hello' }),
    });
    expect(res.statusCode).toBe(401);
  });

  test('빈 메시지 전송 시 400을 반환한다', async () => {
    const res = await handler(makeEvent('user@test.com', 'POST', '/api/chat', { message: '' }));
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('메시지를 입력해주세요');
  });

  test('공백만 있는 메시지 전송 시 400을 반환한다', async () => {
    const res = await handler(makeEvent('user@test.com', 'POST', '/api/chat', { message: '   ' }));
    expect(res.statusCode).toBe(400);
  });

  test('메시지 필드 누락 시 400을 반환한다', async () => {
    const res = await handler(makeEvent('user@test.com', 'POST', '/api/chat', {}));
    expect(res.statusCode).toBe(400);
  });

  test('성공 시 챗봇 응답을 반환한다', async () => {
    // getUserProfile
    mockDdbSend.mockResolvedValueOnce({
      Item: { PK: 'USER#user@test.com', age: 25, gender: 'male' },
    });
    // getRecentHistory
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    mockBedrockAgentSend.mockResolvedValueOnce({
      retrievalResults: [
        { content: { text: '20-20-20 규칙을 따르세요.' } },
      ],
    });

    const encodedBody = new TextEncoder().encode(JSON.stringify({
      content: [{ text: '눈 건강을 위해 20분마다 휴식하세요.' }],
    }));
    mockBedrockRuntimeSend.mockResolvedValueOnce({ body: encodedBody });

    // saveChatHistory
    mockDdbSend.mockResolvedValueOnce({});

    const res = await handler(makeEvent('user@test.com', 'POST', '/api/chat', { message: '눈이 피로해요' }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.response).toBe('눈 건강을 위해 20분마다 휴식하세요.');
  });

  test('대화 컨텍스트가 포함되어 처리된다', async () => {
    // getUserProfile
    mockDdbSend.mockResolvedValueOnce({
      Item: { PK: 'USER#user@test.com', age: 30, gender: 'female' },
    });
    // getRecentHistory - 이전 대화 있음
    mockDdbSend.mockResolvedValueOnce({
      Items: [
        { userMessage: '눈이 아파요', botResponse: '20-20-20 규칙을 추천합니다', createdAt: '2026-03-25T10:00:00.000Z' },
      ],
    });

    mockBedrockAgentSend.mockResolvedValueOnce({
      retrievalResults: [{ content: { text: '루테인 보충제 정보' } }],
    });

    const encodedBody = new TextEncoder().encode(JSON.stringify({
      content: [{ text: '루테인 영양제를 추천합니다.' }],
    }));
    mockBedrockRuntimeSend.mockResolvedValueOnce({ body: encodedBody });

    // saveChatHistory
    mockDdbSend.mockResolvedValueOnce({});

    const res = await handler(makeEvent('user@test.com', 'POST', '/api/chat', { message: '아까 말한 거 더 알려줘' }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.response).toBe('루테인 영양제를 추천합니다.');
  });

  test('Bedrock 실패 시 500을 반환한다', async () => {
    mockDdbSend.mockResolvedValueOnce({ Item: null });
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    mockBedrockAgentSend.mockRejectedValueOnce(new Error('Bedrock KB error'));

    const res = await handler(makeEvent('user@test.com', 'POST', '/api/chat', { message: '도움이 필요해요' }));
    expect(res.statusCode).toBe(500);
  });

  test('대화 이력 조회 시 빈 배열을 반환한다', async () => {
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    const res = await handler(makeEvent('user@test.com', 'GET', '/api/chat/history'));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.history).toEqual([]);
  });

  test('대화 이력 조회 시 시간순으로 반환한다', async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [
        { userMessage: '첫 번째', botResponse: '응답1', createdAt: '2026-03-25T10:00:00.000Z' },
        { userMessage: '두 번째', botResponse: '응답2', createdAt: '2026-03-25T11:00:00.000Z' },
      ],
    });

    const res = await handler(makeEvent('user@test.com', 'GET', '/api/chat/history'));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.history).toHaveLength(2);
    expect(body.history[0].userMessage).toBe('첫 번째');
    expect(body.history[1].userMessage).toBe('두 번째');
  });

  test('지원하지 않는 경로는 404를 반환한다', async () => {
    const res = await handler(makeEvent('user@test.com', 'DELETE', '/api/chat'));
    expect(res.statusCode).toBe(404);
  });

  test('응답 body는 항상 유효한 JSON이다', async () => {
    const res = await handler(makeEvent('user@test.com', 'POST', '/api/chat', { message: '' }));
    expect(() => JSON.parse(res.body)).not.toThrow();
  });
});
