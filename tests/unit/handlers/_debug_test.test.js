// Jest 환경에서 handler 반환값 직접 확인
const mockDdbSend = jest.fn();
const mockBedrockAgentSend = jest.fn();
const mockBedrockRuntimeSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDdbSend })) },
  QueryCommand: jest.fn((p) => ({ ...p, _type: 'Query' })),
  PutCommand: jest.fn((p) => ({ ...p, _type: 'Put' })),
  GetCommand: jest.fn((p) => ({ ...p, _type: 'Get' })),
}));
jest.mock('@aws-sdk/client-bedrock-agent-runtime', () => ({
  BedrockAgentRuntimeClient: jest.fn(() => ({ send: mockBedrockAgentSend })),
  RetrieveCommand: jest.fn((p) => ({ ...p, _type: 'Retrieve' })),
}));
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: mockBedrockRuntimeSend })),
  InvokeModelCommand: jest.fn((p) => ({ ...p, _type: 'InvokeModel' })),
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

test('debug: 빈 문자열 POST', async () => {
  const res = await handler(makeEvent('u@e.com', 'POST', '/api/chat', { message: '' }));
  console.log('빈 문자열 결과:', res.statusCode, res.body);
});

test('debug: 공백 POST', async () => {
  const res = await handler(makeEvent('u@e.com', 'POST', '/api/chat', { message: ' ' }));
  console.log('공백 결과:', res.statusCode, res.body);
});

test('debug: null POST', async () => {
  const res = await handler(makeEvent('u@e.com', 'POST', '/api/chat', { message: null }));
  console.log('null 결과:', res.statusCode, res.body);
});

test('debug: undefined POST', async () => {
  const res = await handler(makeEvent('u@e.com', 'POST', '/api/chat', { message: undefined }));
  console.log('undefined 결과:', res.statusCode, res.body);
});

test('debug: GET history', async () => {
  mockDdbSend.mockResolvedValueOnce({
    Items: [{ PK: 'USER#u@e.com', SK: 'CHAT#ts', userMessage: ' ', botResponse: ' ', createdAt: '2026-03-01' }]
  });
  const res = await handler(makeEvent('u@e.com', 'GET', '/api/chat/history'));
  console.log('GET history 결과:', res.statusCode, res.body);
});
