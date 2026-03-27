'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { extractEmail, maskEmail } = require('../utils/auth');
const { success, error } = require('../utils/response');

const REGION = process.env.REGION || 'us-east-1';
const KB_ID = process.env.KB_ID;
const CHAT_HISTORY_TABLE = process.env.CHAT_HISTORY_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION })
);
const bedrockAgentClient = new BedrockAgentRuntimeClient({ region: REGION });
const bedrockRuntimeClient = new BedrockRuntimeClient({ region: REGION });

/**
 * UsersTable에서 사용자 프로필 조회
 */
async function getUserProfile(email) {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { PK: `USER#${email}` },
    })
  );
  return result.Item || null;
}

/**
 * ChatHistoryTable에서 최근 대화 이력 조회 (SK 역순, limit개)
 */
async function getRecentHistory(email, limit = 5) {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: CHAT_HISTORY_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${email}` },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return (result.Items || []).reverse();
}

/**
 * Bedrock Knowledge Base에서 관련 문서 검색
 */
async function retrieveFromKB(query) {
  if (!KB_ID) {
    console.log('KB_ID not configured, skipping knowledge base retrieval');
    return [];
  }
  try {
    const result = await bedrockAgentClient.send(
      new RetrieveCommand({
        knowledgeBaseId: KB_ID,
        retrievalQuery: { text: query },
        retrievalConfiguration: {
          vectorSearchConfiguration: { numberOfResults: 5 },
        },
      })
    );
    return (result.retrievalResults || [])
      .map((r) => r.content?.text || '')
      .filter(Boolean);
  } catch (err) {
    console.error('KB retrieval failed, continuing without documents:', err.message);
    return [];
  }
}

/**
 * Claude Sonnet으로 챗봇 응답 생성
 */
async function generateResponse(message, profile, history, documents) {
  const profileInfo = profile
    ? `사용자 정보: 나이 ${profile.age}세, 성별 ${profile.gender}`
    : '사용자 정보: 없음';

  const historyText = history.length > 0
    ? history.map((h) => `사용자: ${h.userMessage}\n챗봇: ${h.botResponse}`).join('\n\n')
    : '이전 대화 없음';

  const docsText = documents.length > 0
    ? documents.join('\n\n')
    : '관련 문서 없음';

  const prompt = `당신은 디지털 피로 관리 전문 챗봇입니다. 사용자의 질문에 한국어로 답변해주세요.

${profileInfo}

이전 대화 이력:
${historyText}

관련 참고 문서:
${docsText}

사용자 메시지: ${message}

위 정보를 바탕으로 사용자에게 맞춤형 디지털 피로 해결책을 제공해주세요. 간결하고 실용적으로 답변해주세요.`;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const result = await bedrockRuntimeClient.send(
      new InvokeModelCommand({
        modelId: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body,
      })
    );

    const response = JSON.parse(new TextDecoder().decode(result.body));
    return response.content?.[0]?.text || '응답을 생성하지 못했습니다. 다시 시도해주세요.';
  } catch (err) {
    console.error('Bedrock model invocation failed:', err.name, err.message);
    throw err;
  }
}

/**
 * ChatHistoryTable에 대화 저장
 */
async function saveChatHistory(email, userMessage, botResponse) {
  const now = new Date().toISOString();
  await ddbDocClient.send(
    new PutCommand({
      TableName: CHAT_HISTORY_TABLE,
      Item: {
        PK: `USER#${email}`,
        SK: `CHAT#${now}`,
        userMessage,
        botResponse,
        createdAt: now,
      },
    })
  );
}

/**
 * POST /api/chat — 챗봇 메시지 전송
 */
async function handlePostChat(event, email) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return error(400, '잘못된 요청 형식입니다');
  }

  const { message } = body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return error(400, '메시지를 입력해주세요');
  }

  const trimmedMessage = message.trim();

  console.log(`Chat message from ${maskEmail(email)}`);

  const [profile, history] = await Promise.all([
    getUserProfile(email),
    getRecentHistory(email, 5),
  ]);

  const documents = await retrieveFromKB(trimmedMessage);
  const botResponse = await generateResponse(trimmedMessage, profile, history, documents);

  await saveChatHistory(email, trimmedMessage, botResponse);

  return success(200, { response: botResponse });
}

/**
 * GET /api/chat/history — 대화 이력 조회
 */
async function handleGetHistory(email) {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: CHAT_HISTORY_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${email}` },
      ScanIndexForward: true,
    })
  );

  return success(200, { history: result.Items || [] });
}

/**
 * Lambda handler
 */
const handler = async (event) => {
  try {
    const email = extractEmail(event);
    if (!email) {
      return error(401, '인증 정보가 없습니다');
    }

    const method = event.httpMethod;
    const path = event.path || '';

    if (method === 'POST' && path.endsWith('/api/chat')) {
      return await handlePostChat(event, email);
    }

    if (method === 'GET' && path.endsWith('/api/chat/history')) {
      return await handleGetHistory(email);
    }

    return error(404, 'Not found');
  } catch (err) {
    console.error('Chat handler error:', err.name, err.message);
    return error(500, `챗봇 처리 중 오류가 발생했습니다: ${err.name} - ${err.message}`);
  }
};

module.exports = { handler, getUserProfile, getRecentHistory, retrieveFromKB, generateResponse, saveChatHistory };
