'use strict';

var mockDdbSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDdbSend })) },
  QueryCommand: jest.fn((params) => ({ ...params, _type: 'Query' })),
}));

process.env.RANKINGS_TABLE = 'Rankings';
process.env.USERS_TABLE = 'Users';
process.env.SYMPTOM_LOGS_TABLE = 'SymptomLogs';
process.env.SCREEN_TIME_TABLE = 'ScreenTime';
process.env.WEEKLY_ANALYSIS_TABLE = 'WeeklyAnalysis';
process.env.REGION = 'us-east-1';

const { handler } = require('../../../src/handlers/ranking');

const makeEvent = (email) => ({
  requestContext: {
    authorizer: { claims: { email } },
  },
});

describe('RankingFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('인증 정보 없으면 401을 반환한다', async () => {
    const res = await handler({ requestContext: {} });
    expect(res.statusCode).toBe(401);
  });

  test('순위 데이터를 오름차순으로 반환한다', async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [
        { rank: 1, email: 'top@test.com', weeklyHealthScore: 95 },
        { rank: 2, email: 'user@test.com', weeklyHealthScore: 80 },
        { rank: 3, email: 'low@test.com', weeklyHealthScore: 60 },
      ],
    });

    const res = await handler(makeEvent('user@test.com'));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.totalUsers).toBe(3);
    expect(body.rankings[0].rank).toBe(1);
    expect(body.rankings[2].rank).toBe(3);
    expect(body.myRank).toEqual({ rank: 2, weeklyHealthScore: 80 });
  });

  test('사용자가 순위에 없으면 myRank는 null이다', async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [
        { rank: 1, email: 'other@test.com', weeklyHealthScore: 90 },
      ],
    });

    const res = await handler(makeEvent('notranked@test.com'));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.myRank).toBeNull();
  });

  test('순위 데이터 없으면 빈 배열을 반환한다', async () => {
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    const res = await handler(makeEvent('user@test.com'));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.rankings).toEqual([]);
    expect(body.totalUsers).toBe(0);
  });

  test('DynamoDB 오류 시 500을 반환한다', async () => {
    mockDdbSend.mockRejectedValueOnce(new Error('DynamoDB error'));

    const res = await handler(makeEvent('user@test.com'));
    expect(res.statusCode).toBe(500);
  });
});
