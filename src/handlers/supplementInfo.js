'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { extractEmail, maskEmail } = require('../utils/auth');
const { success, error } = require('../utils/response');

const REGION = process.env.REGION || 'us-east-1';
const KB_ID = process.env.KB_ID;
const WEEKLY_ANALYSIS_TABLE = process.env.WEEKLY_ANALYSIS_TABLE;

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION })
);
const bedrockAgentClient = new BedrockAgentRuntimeClient({ region: REGION });
const bedrockRuntimeClient = new BedrockRuntimeClient({ region: REGION });

/**
 * WeeklyAnalysisTable에서 최근 Weekly_Health_Score 조회
 */
async function getLatestScore(email) {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: WEEKLY_ANALYSIS_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${email}` },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

/**
 * Bedrock Knowledge Base에서 관련 문서 검색
 */
async function retrieveFromKB(query) {
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
}

/**
 * Claude Sonnet으로 맞춤 영양제 추천 생성
 */
async function generateRecommendation(score, documents) {
  const prompt = `사용자의 주간 건강 점수는 ${score.weeklyHealthScore}점(100점 만점)입니다.
증상 기록 ${score.symptomLogCount || 0}건, 스크린타임 기록 ${score.screenTimeLogCount || 0}건을 기반으로 산출되었습니다.

아래는 관련 영양소 및 디지털 피로 해결책 문서입니다:
${documents.join('\n\n')}

위 정보를 바탕으로 사용자에게 맞춤형 영양제 추천과 디지털 피로 해결 조언을 한국어로 제공해주세요.
간결하고 실용적인 조언을 3~5개 항목으로 정리해주세요.`;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const result = await bedrockRuntimeClient.send(
    new InvokeModelCommand({
      modelId: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body,
    })
  );

  const response = JSON.parse(new TextDecoder().decode(result.body));
  return response.content?.[0]?.text || '';
}

/**
 * GET /api/supplement-info
 */
const handler = async (event) => {
  try {
    const email = extractEmail(event);
    if (!email) {
      return error(401, '인증 정보가 없습니다');
    }

    const score = await getLatestScore(email);
    if (!score) {
      return error(404, '주간 건강 점수가 없습니다. 증상과 스크린타임을 기록한 후 주간 분석이 완료되면 영양제 추천을 받을 수 있습니다.');
    }

    console.log(`Supplement info requested by ${maskEmail(email)}, score: ${score.weeklyHealthScore}`);

    const query = `디지털 피로 건강 점수 ${score.weeklyHealthScore}점 영양제 추천 눈피로 두통`;
    const documents = await retrieveFromKB(query);

    const recommendation = await generateRecommendation(score, documents);

    return success(200, {
      weeklyHealthScore: score.weeklyHealthScore,
      week: score.SK.replace('WEEK#', ''),
      recommendation,
    });
  } catch (err) {
    console.error('SupplementInfo handler error:', err.message);
    return error(500, '영양제 추천 조회 중 오류가 발생했습니다');
  }
};

module.exports = { handler, getLatestScore, retrieveFromKB, generateRecommendation };
