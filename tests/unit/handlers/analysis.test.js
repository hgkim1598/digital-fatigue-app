'use strict';

var mockDdbSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDdbSend })) },
  QueryCommand: jest.fn((params) => ({ ...params, _type: 'Query' })),
}));

process.env.WEEKLY_ANALYSIS_TABLE = 'WeeklyAnalysis';
process.env.REGION = 'us-east-1';

const { handler } = require('../../../src/handlers/analysis');

const makeEvent = (email) => ({
  requestContext: {
    authorizer: { claims: { email } },
  },
});

describe('AnalysisFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('인증 정보 없으면 401을 반환한다', async () => {
    const res = await handler({ requestContext: {} });
    expect(res.statusCode).toBe(401);
  });

  test('데이터 없으면 안내 메시지와 200을 반환한다', async () => {
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    const res = await handler(makeEvent('user@test.com'));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeNull();
    expect(body.message).toBeTruthy();
  });

  test('최근 주간 분석 데이터를 반환한다', async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [{
        PK: 'USER#user@test.com',
        SK: 'WEEK#2024-W02',
        weeklyHealthScore: 75,
        symptomLogCount: 5,
        screenTimeLogCount: 3,
        createdAt: '2024-01-15T00:00:00.000Z',
      }],
    });

    const res = await handler(makeEvent('user@test.com'));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.week).toBe('2024-W02');
    expect(body.weeklyHealthScore).toBe(75);
    expect(body.symptomLogCount).toBe(5);
    expect(body.screenTimeLogCount).toBe(3);
  });

  test('DynamoDB 오류 시 500을 반환한다', async () => {
    mockDdbSend.mockRejectedValueOnce(new Error('DynamoDB error'));

    const res = await handler(makeEvent('user@test.com'));
    expect(res.statusCode).toBe(500);
  });
});
