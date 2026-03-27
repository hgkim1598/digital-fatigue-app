'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { extractEmail, maskEmail } = require('../utils/auth');
const { success, error } = require('../utils/response');

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION })
);

const WEEKLY_ANALYSIS_TABLE = process.env.WEEKLY_ANALYSIS_TABLE;

/**
 * GET /api/analysis/weekly
 * JWT에서 이메일 추출 → WeeklyAnalysisTable에서 최근 주간 건강 점수 조회
 */
const handler = async (event) => {
  try {
    const email = extractEmail(event);
    if (!email) {
      return error(401, '인증 정보가 없습니다');
    }

    const result = await ddbDocClient.send(
      new QueryCommand({
        TableName: WEEKLY_ANALYSIS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${email}`,
        },
        ScanIndexForward: false,
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return success(200, {
        message: '아직 주간 분석 데이터가 없습니다. 증상과 스크린타임을 기록하면 다음 주에 분석 결과를 확인할 수 있습니다.',
        data: null,
      });
    }

    const latest = result.Items[0];
    console.log(`Weekly analysis retrieved for ${maskEmail(email)}: ${latest.SK}`);

    return success(200, {
      week: latest.SK.replace('WEEK#', ''),
      weeklyHealthScore: latest.weeklyHealthScore,
      symptomLogCount: latest.symptomLogCount,
      screenTimeLogCount: latest.screenTimeLogCount,
      createdAt: latest.createdAt,
    });
  } catch (err) {
    console.error('Analysis handler error:', err.message);
    return error(500, '주간 분석 조회 중 오류가 발생했습니다');
  }
};

module.exports = { handler };
