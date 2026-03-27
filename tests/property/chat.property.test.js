'use strict';

const fc = require('fast-check');

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

const { handler } = require('../../src/handlers/chat');

const makeEvent = (email, method, path, body) => ({
  requestContext: { authorizer: { claims: { email } } },
  httpMethod: method,
  path,
  body: body ? JSON.stringify(body) : null,
});

describe('Property 13: 챗봇 대화 저장 및 조회 round-trip', () => {
  test('저장된 메시지와 응답이 조회 시 동일하게 반환되며 시간순 정렬된다', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userMessage: fc.string({ minLength: 1, maxLength: 200 }),
            botResponse: fc.string({ minLength: 1, maxLength: 500 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (conversations) => {
          jest.clearAllMocks();

          // 각 대화에 시간순 createdAt 부여
          const items = conversations.map((c, i) => ({
            PK: 'USER#user@example.com',
            SK: `CHAT#2026-03-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
            userMessage: c.userMessage,
            botResponse: c.botResponse,
            createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
          }));

          // GET /api/chat/history 모킹 - ScanIndexForward: true이므로 시간순
          mockDdbSend.mockResolvedValueOnce({ Items: items });

          const res = await handler(makeEvent('user@example.com', 'GET', '/api/chat/history'));
          expect(res.statusCode).toBe(200);

          const body = JSON.parse(res.body);
          expect(body.history).toHaveLength(conversations.length);

          // round-trip: 저장된 데이터와 동일한지 확인
          for (let i = 0; i < conversations.length; i++) {
            expect(body.history[i].userMessage).toBe(conversations[i].userMessage);
            expect(body.history[i].botResponse).toBe(conversations[i].botResponse);
          }

          // 시간순 정렬 확인
          for (let i = 1; i < body.history.length; i++) {
            expect(body.history[i].createdAt >= body.history[i - 1].createdAt).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});



describe('Property 14: 빈 챗봇 메시지는 항상 거부된다', () => {
  test('빈 문자열 또는 공백 문자열은 항상 400을 반환한다', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.stringOf(fc.constant(' '), { minLength: 1, maxLength: 50 }),
          fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 20 })
        ),
        async (emptyMessage) => {
          jest.clearAllMocks();

          const res = await handler(
            makeEvent('user@example.com', 'POST', '/api/chat', { message: emptyMessage })
          );
          expect(res.statusCode).toBe(400);

          // DynamoDB에 저장되지 않아야 함 (PutCommand 호출 없음)
          const putCalls = mockDdbSend.mock.calls.filter(
            (call) => call[0]?._type === 'Put'
          );
          expect(putCalls).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('메시지 필드 누락 시 항상 400을 반환한다', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant({}),
          fc.constant({ msg: 'wrong field' }),
          fc.constant({ message: null }),
          fc.constant({ message: undefined })
        ),
        async (body) => {
          jest.clearAllMocks();

          const res = await handler(
            makeEvent('user@example.com', 'POST', '/api/chat', body)
          );
          expect(res.statusCode).toBe(400);
        }
      ),
      { numRuns: 50 }
    );
  });
});
