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

const { handler } = require('../../../src/handlers/symptom');

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

describe('SymptomFunction handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDdbSend.mockResolvedValue({});
  });

  // ---- POST /api/symptoms ----
  describe('POST /api/symptoms', () => {
    const validBody = { eyeFatigue: 3, headache: 2, generalFatigue: 4 };

    it('returns 200 on successful symptom log', async () => {
      const res = await handler(makeEvent('POST', validBody));
      expect(res.statusCode).toBe(200);
      expect(mockDdbSend).toHaveBeenCalledTimes(1);
      const body = JSON.parse(res.body);
      expect(body.logId).toBeDefined();
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await handler(makeEvent('POST', { eyeFatigue: 3 }));
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('누락');
    });

    it('returns 400 for eyeFatigue out of range', async () => {
      const res = await handler(makeEvent('POST', { ...validBody, eyeFatigue: 6 }));
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for headache out of range', async () => {
      const res = await handler(makeEvent('POST', { ...validBody, headache: 0 }));
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for generalFatigue as non-integer', async () => {
      const res = await handler(makeEvent('POST', { ...validBody, generalFatigue: 2.5 }));
      expect(res.statusCode).toBe(400);
    });

    it('returns 401 when no auth info', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify(validBody),
        requestContext: {},
      };
      const res = await handler(event);
      expect(res.statusCode).toBe(401);
    });
  });

  // ---- GET /api/symptoms ----
  describe('GET /api/symptoms', () => {
    it('returns empty array when no logs', async () => {
      mockDdbSend.mockResolvedValueOnce({ Items: [] });
      const res = await handler(makeEvent('GET'));
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.logs).toEqual([]);
    });

    it('returns logs in response', async () => {
      mockDdbSend.mockResolvedValueOnce({
        Items: [
          { SK: 'LOG#2024-01-02T00:00:00Z', eyeFatigue: 3, headache: 2, generalFatigue: 4, createdAt: '2024-01-02T00:00:00Z' },
          { SK: 'LOG#2024-01-01T00:00:00Z', eyeFatigue: 1, headache: 1, generalFatigue: 1, createdAt: '2024-01-01T00:00:00Z' },
        ],
      });
      const res = await handler(makeEvent('GET'));
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.logs).toHaveLength(2);
    });

    it('returns 401 when no auth info', async () => {
      const event = { httpMethod: 'GET', requestContext: {} };
      const res = await handler(event);
      expect(res.statusCode).toBe(401);
    });
  });

  // ---- Edge cases ----
  describe('edge cases', () => {
    it('returns 404 for unsupported method', async () => {
      const event = { httpMethod: 'DELETE', requestContext: { authorizer: { claims: { email: 'a@b.com' } } } };
      const res = await handler(event);
      expect(res.statusCode).toBe(404);
    });

    it('response body is always valid JSON', async () => {
      const res = await handler(makeEvent('POST', { eyeFatigue: 99 }));
      expect(() => JSON.parse(res.body)).not.toThrow();
    });
  });
});
