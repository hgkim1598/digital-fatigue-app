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

const { handler } = require('../../src/handlers/symptom');

process.env.SYMPTOM_LOGS_TABLE = 'SymptomLogs';
process.env.REGION = 'us-east-1';

const makeEvent = (method, body, email) => ({
  httpMethod: method,
  path: '/api/symptoms',
  body: body ? JSON.stringify(body) : null,
  requestContext: {
    authorizer: { claims: { email: email || 'user@example.com' } },
  },
});

describe('Symptom Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDdbSend.mockResolvedValue({});
  });

  // Property 3: 유효한 증상 점수는 항상 저장된다
  it('Property 3: valid symptom scores always succeed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        async (eyeFatigue, headache, generalFatigue) => {
          mockDdbSend.mockResolvedValue({});

          const res = await handler(
            makeEvent('POST', { eyeFatigue, headache, generalFatigue })
          );
          expect(res.statusCode).toBe(200);
          expect(mockDdbSend).toHaveBeenCalled();
          expect(() => JSON.parse(res.body)).not.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property 4: 유효하지 않은 증상 입력은 항상 거부된다
  describe('Property 4: invalid symptom inputs are always rejected', () => {
    it('out-of-range scores are rejected', async () => {
      const outOfRangeArb = fc.oneof(
        fc.integer({ min: -100, max: 0 }),
        fc.integer({ min: 6, max: 100 })
      );

      await fc.assert(
        fc.asyncProperty(outOfRangeArb, async (badScore) => {
          mockDdbSend.mockClear();
          const res = await handler(
            makeEvent('POST', { eyeFatigue: badScore, headache: 3, generalFatigue: 3 })
          );
          expect(res.statusCode).toBe(400);
          // DynamoDB put should not be called
          expect(mockDdbSend).not.toHaveBeenCalled();
        }),
        { numRuns: 30 }
      );
    });

    it('non-integer scores are rejected', async () => {
      const nonIntArb = fc.oneof(
        fc.double({ min: 1.01, max: 4.99, noNaN: true }).filter((v) => !Number.isInteger(v)),
        fc.constant('three'),
        fc.constant(null)
      );

      await fc.assert(
        fc.asyncProperty(nonIntArb, async (badScore) => {
          mockDdbSend.mockClear();
          const res = await handler(
            makeEvent('POST', { eyeFatigue: 3, headache: badScore, generalFatigue: 3 })
          );
          expect(res.statusCode).toBe(400);
          expect(mockDdbSend).not.toHaveBeenCalled();
        }),
        { numRuns: 20 }
      );
    });

    it('missing fields are rejected', async () => {
      const partialArb = fc.constantFrom(
        { eyeFatigue: 3 },
        { headache: 2 },
        { generalFatigue: 4 },
        { eyeFatigue: 3, headache: 2 },
        {}
      );

      await fc.assert(
        fc.asyncProperty(partialArb, async (body) => {
          mockDdbSend.mockClear();
          const res = await handler(makeEvent('POST', body));
          expect(res.statusCode).toBe(400);
          expect(mockDdbSend).not.toHaveBeenCalled();
        }),
        { numRuns: 10 }
      );
    });
  });

  // Property 5: 증상 기록은 항상 시간 역순으로 조회된다
  it('Property 5: symptom logs are always returned in reverse chronological order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          { minLength: 2, maxLength: 20 }
        ),
        async (dates) => {
          // Simulate DynamoDB returning items sorted by SK descending
          const items = dates
            .map((d) => d.toISOString())
            .sort()
            .reverse()
            .map((ts) => ({
              SK: `LOG#${ts}`,
              eyeFatigue: 3,
              headache: 2,
              generalFatigue: 4,
              createdAt: ts,
            }));

          mockDdbSend.mockResolvedValueOnce({ Items: items });

          const res = await handler(makeEvent('GET'));
          expect(res.statusCode).toBe(200);
          const body = JSON.parse(res.body);
          const timestamps = body.logs.map((l) => l.createdAt);

          // Verify reverse chronological order
          for (let i = 1; i < timestamps.length; i++) {
            expect(timestamps[i - 1] >= timestamps[i]).toBe(true);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});
