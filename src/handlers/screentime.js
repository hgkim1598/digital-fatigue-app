'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { success, error } = require('../utils/response');
const { extractEmail, maskEmail } = require('../utils/auth');
const { validateRequiredFields } = require('../utils/validation');

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION })
);

const SCREEN_TIME_TABLE = process.env.SCREEN_TIME_TABLE;

const handler = async (event) => {
  try {
    const method = (event.httpMethod || '').toUpperCase();

    if (method === 'POST') {
      return await handleCreateScreenTime(event);
    }
    if (method === 'GET') {
      return await handleGetScreenTime(event);
    }

    return error(404, 'Not found');
  } catch (err) {
    console.error('ScreenTime handler error:', err.message);
    return error(500, '서버 오류가 발생했습니다');
  }
};

async function handleCreateScreenTime(event) {
  const email = extractEmail(event);
  if (!email) {
    return error(401, '인증 정보가 없습니다');
  }

  const body = JSON.parse(event.body || '{}');

  const { valid, missing } = validateRequiredFields(body, ['startTime', 'endTime']);
  if (!valid) {
    return error(400, `필수 필드가 누락되었습니다: ${missing.join(', ')}`);
  }

  const { startTime, endTime } = body;

  if (!isValidISO8601(startTime)) {
    return error(400, 'startTime은 유효한 ISO 8601 형식이어야 합니다');
  }
  if (!isValidISO8601(endTime)) {
    return error(400, 'endTime은 유효한 ISO 8601 형식이어야 합니다');
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    return error(400, '시작 시간이 종료 시간보다 같거나 늦습니다');
  }

  const durationMinutes = Math.round((end - start) / 60000);
  const now = new Date().toISOString();
  const item = {
    PK: `USER#${email}`,
    SK: `SESSION#${now}`,
    startTime,
    endTime,
    durationMinutes,
    createdAt: now,
  };

  await ddbDocClient.send(
    new PutCommand({ TableName: SCREEN_TIME_TABLE, Item: item })
  );

  console.log(`ScreenTime logged: ${maskEmail(email)}, duration: ${durationMinutes}min`);
  return success(200, { message: '스크린타임이 기록되었습니다', sessionId: item.SK });
}

async function handleGetScreenTime(event) {
  const email = extractEmail(event);
  if (!email) {
    return error(401, '인증 정보가 없습니다');
  }

  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: SCREEN_TIME_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':skPrefix': 'SESSION#',
      },
      ScanIndexForward: false,
    })
  );

  const sessions = (result.Items || []).map((item) => ({
    sessionId: item.SK,
    startTime: item.startTime,
    endTime: item.endTime,
    durationMinutes: item.durationMinutes,
    createdAt: item.createdAt,
  }));

  return success(200, { sessions });
}

function isValidISO8601(str) {
  if (!str || typeof str !== 'string') return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

module.exports = { handler };
