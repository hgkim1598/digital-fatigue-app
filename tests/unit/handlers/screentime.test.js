'use strict';

var mockDdbSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDdbSend })) },
  PutCommand: jest.fn((params) => ({ ...params, _type: 'Put' })),
  QueryCommand: jest.fn((params) => ({ ...params, _type: 'Query' })),
}));

const { handler } = require('../../../src/handlers/screentime');

process.env.SCREEN_TIME_TABLE = 'ScreenTime';
process.env.REGION = 'us-east-1';

function makeEvent(method, body, email) {
  const event = {
    httpMethod: method,
    body: body ? JSON.stringify(body) : null,
    requestContext: {},
  };
  if (email) {
    event.requestContext.authorizer = { claims: { email } };
  }
  return event;
}

describe('ScreenTimeFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDdbSend.mockResolvedValue({});
  });

  describe('POST /api/screen-time', () => {
    test('유효한 스크린타임 세션을 저장한다', async () => {
      const res = await handler(makeEvent('POST', {
        startTime: '2024-01-15T09:00:00Z',
        endTime: '2024-01-15T10:30:00Z',
      }, 'user@example.com'));

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.message).toBe('스크린타임이 기록되었습니다');
      expect(body.sessionId).toMatch(/^SESSION#/);
    });

    test('durationMinutes를 올바르게 계산한다', async () => {
      let savedItem;
      mockDdbSend.mockImplementation((input) => {
        savedItem = input.Item;
        return Promise.resolve({});
      });

      await handler(makeEvent('POST', {
        startTime: '2024-01-15T09:00:00Z',
        endTime: '2024-01-15T10:30:00Z',
      }, 'user@example.com'));

      expect(savedItem.durationMinutes).toBe(90);
    });

    test('필수 필드 누락 시 400을 반환한다', async () => {
      const res = await handler(makeEvent('POST', { startTime: '2024-01-15T09:00:00Z' }, 'user@example.com'));
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('endTime');
    });

    test('startTime >= endTime이면 400을 반환한다', async () => {
      const res = await handler(makeEvent('POST', {
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T09:00:00Z',
      }, 'user@example.com'));
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('시작 시간');
    });

    test('startTime === endTime이면 400을 반환한다', async () => {
      const res = await handler(makeEvent('POST', {
        startTime: '2024-01-15T09:00:00Z',
        endTime: '2024-01-15T09:00:00Z',
      }, 'user@example.com'));
      expect(res.statusCode).toBe(400);
    });

    test('유효하지 않은 ISO 8601 형식이면 400을 반환한다', async () => {
      const res = await handler(makeEvent('POST', {
        startTime: 'not-a-date',
        endTime: '2024-01-15T10:00:00Z',
      }, 'user@example.com'));
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('startTime');
    });

    test('인증 정보 없으면 401을 반환한다', async () => {
      const res = await handler(makeEvent('POST', {
        startTime: '2024-01-15T09:00:00Z',
        endTime: '2024-01-15T10:00:00Z',
      }));
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/screen-time', () => {
    test('스크린타임 기록을 조회한다', async () => {
      mockDdbSend.mockResolvedValueOnce({
        Items: [
          { SK: 'SESSION#2024-01-15T10:00:00Z', startTime: '2024-01-15T09:00:00Z', endTime: '2024-01-15T10:00:00Z', durationMinutes: 60, createdAt: '2024-01-15T10:00:00Z' },
          { SK: 'SESSION#2024-01-14T10:00:00Z', startTime: '2024-01-14T09:00:00Z', endTime: '2024-01-14T10:00:00Z', durationMinutes: 60, createdAt: '2024-01-14T10:00:00Z' },
        ],
      });

      const res = await handler(makeEvent('GET', null, 'user@example.com'));
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.sessions).toHaveLength(2);
      expect(body.sessions[0].sessionId).toMatch(/^SESSION#/);
    });

    test('기록이 없으면 빈 배열을 반환한다', async () => {
      mockDdbSend.mockResolvedValueOnce({ Items: [] });

      const res = await handler(makeEvent('GET', null, 'user@example.com'));
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).sessions).toEqual([]);
    });

    test('인증 정보 없으면 401을 반환한다', async () => {
      const res = await handler(makeEvent('GET', null));
      expect(res.statusCode).toBe(401);
    });
  });

  describe('에러 핸들링', () => {
    test('지원하지 않는 HTTP 메서드는 404를 반환한다', async () => {
      const res = await handler(makeEvent('DELETE', null, 'user@example.com'));
      expect(res.statusCode).toBe(404);
    });

    test('예상치 못한 에러 시 500을 반환한다', async () => {
      mockDdbSend.mockRejectedValueOnce(new Error('DynamoDB error'));
      const res = await handler(makeEvent('POST', {
        startTime: '2024-01-15T09:00:00Z',
        endTime: '2024-01-15T10:00:00Z',
      }, 'user@example.com'));
      expect(res.statusCode).toBe(500);
    });
  });
});
