'use strict';

const fc = require('fast-check');

var mockDdbSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDdbSend })) },
  PutCommand: jest.fn((params) => params),
  QueryCommand: jest.fn((params) => params),
}));

const { handler } = require('../../src/handlers/screentime');

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

// Property 6: 유효한 스크린타임 세션은 항상 저장된다
describe('Property 6: 유효한 스크린타임 세션은 항상 저장된다', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDdbSend.mockResolvedValue({});
  });

  test('startTime < endTime인 ISO 8601 시간 쌍은 항상 200을 반환한다', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        fc.integer({ min: 1, max: 1440 }),
        async (startDate, addMinutes) => {
          mockDdbSend.mockResolvedValue({});

          const endDate = new Date(startDate.getTime() + addMinutes * 60000);
          const res = await handler(makeEvent('POST', {
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
          }, 'user@example.com'));

          expect(res.statusCode).toBe(200);
          const body = JSON.parse(res.body);
          expect(body.sessionId).toMatch(/^SESSION#/);
          expect(mockDdbSend).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 7: 유효하지 않은 스크린타임 입력은 항상 거부된다
describe('Property 7: 유효하지 않은 스크린타임 입력은 항상 거부된다', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDdbSend.mockResolvedValue({});
  });

  test('startTime >= endTime이면 항상 400을 반환한다', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        fc.integer({ min: 0, max: 1440 }),
        async (endDate, subtractMinutes) => {
          mockDdbSend.mockClear();

          const startDate = new Date(endDate.getTime() + subtractMinutes * 60000);
          const res = await handler(makeEvent('POST', {
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString(),
          }, 'user@example.com'));

          expect(res.statusCode).toBe(400);
          expect(mockDdbSend).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('필수 필드 누락 시 항상 400을 반환한다', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          {},
          { startTime: '2024-01-15T09:00:00Z' },
          { endTime: '2024-01-15T10:00:00Z' }
        ),
        async (body) => {
          mockDdbSend.mockClear();

          const res = await handler(makeEvent('POST', body, 'user@example.com'));
          expect(res.statusCode).toBe(400);
          expect(mockDdbSend).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 8: 스크린타임 기록은 항상 시간 역순으로 조회된다
describe('Property 8: 스크린타임 기록은 항상 시간 역순으로 조회된다', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('조회 결과는 createdAt 기준 시간 역순으로 정렬된다', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
          { minLength: 2, maxLength: 20 }
        ),
        async (dates) => {
          // Simulate DynamoDB returning items sorted by SK descending
          const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());
          const items = sortedDates.map((d) => ({
            SK: `SESSION#${d.toISOString()}`,
            startTime: new Date(d.getTime() - 3600000).toISOString(),
            endTime: d.toISOString(),
            durationMinutes: 60,
            createdAt: d.toISOString(),
          }));

          mockDdbSend.mockResolvedValueOnce({ Items: items });

          const res = await handler(makeEvent('GET', null, 'user@example.com'));
          expect(res.statusCode).toBe(200);

          const body = JSON.parse(res.body);
          const sessions = body.sessions;

          for (let i = 1; i < sessions.length; i++) {
            expect(new Date(sessions[i - 1].createdAt).getTime())
              .toBeGreaterThanOrEqual(new Date(sessions[i].createdAt).getTime());
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
