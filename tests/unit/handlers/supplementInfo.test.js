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
}));

jest.mock('@aws-sdk/client-bedrock-agent-runtime', () => ({
  BedrockAgentRuntimeClient: jest.fn(() => ({ send: mockBedrockAgentSend })),
  RetrieveCommand: jest.fn((params) => ({ ...params, _type: 'Retrieve' })),
}));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: mockBedrockRuntimeSend })),
  InvokeModelCommand: jest.fn((params) => ({ ...params, _type: 'InvokeModel' })),
}));

process.env.WEEKLY_ANALYSIS_TABLE = 'WeeklyAnalysis';
process.env.KB_ID = 'test-kb-id';
process.env.REGION = 'us-east-1';

const { handler } = require('../../../src/handlers/supplementInfo');

const makeEvent = (email) => ({
  requestContext: { authorizer: { claims: { email } } },
});

describe('SupplementInfoFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('인증 정보 없으면 401을 반환한다', async () => {
    const res = await handler({ requestContext: {} });
    expect(res.statusCode).toBe(401);
  });

  test('주간 건강 점수 없으면 404를 반환한다', async () => {
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    const res = await handler(makeEvent('user@test.com'));
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('주간 건강 점수가 없습니다');
  });

  test('성공 시 영양제 추천을 반환한다', async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [{
        PK: 'USER#user@test.com',
        SK: 'WEEK#2024-W02',
        weeklyHealthScore: 65,
        symptomLogCount: 5,
        screenTimeLogCount: 3,
      }],
    });

    mockBedrockAgentSend.mockResolvedValueOnce({
      retrievalResults: [
        { content: { text: '루테인은 눈 건강에 도움이 됩니다.' } },
        { content: { text: '오메가3는 염증을 줄여줍니다.' } },
      ],
    });

    const encodedBody = new TextEncoder().encode(JSON.stringify({
      content: [{ text: '맞춤 영양제 추천 결과입니다.' }],
    }));
    mockBedrockRuntimeSend.mockResolvedValueOnce({ body: encodedBody });

    const res = await handler(makeEvent('user@test.com'));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.weeklyHealthScore).toBe(65);
    expect(body.week).toBe('2024-W02');
    expect(body.recommendation).toBe('맞춤 영양제 추천 결과입니다.');
  });

  test('Bedrock KB 검색 실패 시 500을 반환한다', async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [{
        PK: 'USER#user@test.com',
        SK: 'WEEK#2024-W02',
        weeklyHealthScore: 70,
        symptomLogCount: 3,
        screenTimeLogCount: 2,
      }],
    });

    mockBedrockAgentSend.mockRejectedValueOnce(new Error('Bedrock KB error'));

    const res = await handler(makeEvent('user@test.com'));
    expect(res.statusCode).toBe(500);
  });

  test('Claude 호출 실패 시 500을 반환한다', async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [{
        PK: 'USER#user@test.com',
        SK: 'WEEK#2024-W02',
        weeklyHealthScore: 50,
        symptomLogCount: 4,
        screenTimeLogCount: 5,
      }],
    });

    mockBedrockAgentSend.mockResolvedValueOnce({
      retrievalResults: [{ content: { text: '비타민A 정보' } }],
    });

    mockBedrockRuntimeSend.mockRejectedValueOnce(new Error('Claude invocation failed'));

    const res = await handler(makeEvent('user@test.com'));
    expect(res.statusCode).toBe(500);
  });
});
