'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { success, error } = require('../utils/response');
const { extractEmail, maskEmail } = require('../utils/auth');
const { isIntegerInRange, validateRequiredFields } = require('../utils/validation');

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION })
);

const SYMPTOM_LOGS_TABLE = process.env.SYMPTOM_LOGS_TABLE;

const handler = async (event) => {
  try {
    const method = (event.httpMethod || '').toUpperCase();

    if (method === 'POST') {
      return await handleCreateSymptom(event);
    }
    if (method === 'GET') {
      return await handleGetSymptoms(event);
    }

    return error(404, 'Not found');
  } catch (err) {
    console.error('Symptom handler error:', err.message);
    return error(500, '서버 오류가 발생했습니다');
  }
};

async function handleCreateSymptom(event) {
  const email = extractEmail(event);
  if (!email) {
    return error(401, '인증 정보가 없습니다');
  }

  const body = JSON.parse(event.body || '{}');

  const { valid, missing } = validateRequiredFields(body, ['eyeFatigue', 'headache', 'generalFatigue']);
  if (!valid) {
    return error(400, `필수 항목이 누락되었습니다: ${missing.join(', ')}`);
  }

  const { eyeFatigue, headache, generalFatigue } = body;

  if (!isIntegerInRange(eyeFatigue, 1, 5)) {
    return error(400, 'eyeFatigue는 1~5 사이의 정수여야 합니다');
  }
  if (!isIntegerInRange(headache, 1, 5)) {
    return error(400, 'headache는 1~5 사이의 정수여야 합니다');
  }
  if (!isIntegerInRange(generalFatigue, 1, 5)) {
    return error(400, 'generalFatigue는 1~5 사이의 정수여야 합니다');
  }

  const now = new Date().toISOString();
  const item = {
    PK: `USER#${email}`,
    SK: `LOG#${now}`,
    eyeFatigue,
    headache,
    generalFatigue,
    createdAt: now,
  };

  await ddbDocClient.send(
    new PutCommand({ TableName: SYMPTOM_LOGS_TABLE, Item: item })
  );

  console.log(`Symptom logged: ${maskEmail(email)}`);
  return success(200, { message: '증상이 기록되었습니다', logId: item.SK });
}

async function handleGetSymptoms(event) {
  const email = extractEmail(event);
  if (!email) {
    return error(401, '인증 정보가 없습니다');
  }

  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: SYMPTOM_LOGS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':skPrefix': 'LOG#',
      },
      ScanIndexForward: false,
    })
  );

  const logs = (result.Items || []).map((item) => ({
    logId: item.SK,
    eyeFatigue: item.eyeFatigue,
    headache: item.headache,
    generalFatigue: item.generalFatigue,
    createdAt: item.createdAt,
  }));

  return success(200, { logs });
}

module.exports = { handler };
