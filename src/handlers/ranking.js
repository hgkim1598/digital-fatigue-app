'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { extractEmail, maskEmail } = require('../utils/auth');
const { success, error } = require('../utils/response');
const { getISOWeekLabel } = require('./weeklySchedule');

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION })
);

const RANKINGS_TABLE = process.env.RANKINGS_TABLE;

/**
 * 현재 주차의 전주 라벨 계산 (순위는 전주 기준)
 */
function getLatestWeekLabel() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  const prevMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  return getISOWeekLabel(prevMonday);
}

/**
 * GET /api/analysis/ranking
 * RankingsTable에서 전체 사용자 순위 목록을 순위 오름차순으로 조회
 * 인증된 사용자의 순위 정보를 myRank로 별도 표시
 */
const handler = async (event) => {
  try {
    const email = extractEmail(event);
    if (!email) {
      return error(401, '인증 정보가 없습니다');
    }

    const weekLabel = getLatestWeekLabel();

    const result = await ddbDocClient.send(
      new QueryCommand({
        TableName: RANKINGS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `WEEK#${weekLabel}`,
        },
        ScanIndexForward: true,
      })
    );

    const rawItems = (result.Items || []).map((item) => ({
      email: item.email,
      weeklyHealthScore: item.weeklyHealthScore,
    }));

    // 이메일 기준 중복 제거 (높은 점수 우선)
    const emailMap = new Map();
    for (const item of rawItems) {
      const existing = emailMap.get(item.email);
      if (!existing || item.weeklyHealthScore > existing.weeklyHealthScore) {
        emailMap.set(item.email, item);
      }
    }

    // 점수 내림차순 정렬 후 rank 재부여
    const rankings = [...emailMap.values()]
      .sort((a, b) => b.weeklyHealthScore - a.weeklyHealthScore)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    const myRank = rankings.find((r) => r.email === email) || null;

    console.log(`Rankings retrieved for week ${weekLabel}, total: ${rankings.length}, user: ${maskEmail(email)}`);

    return success(200, {
      week: weekLabel,
      totalUsers: rankings.length,
      myRank: myRank ? { rank: myRank.rank, weeklyHealthScore: myRank.weeklyHealthScore } : null,
      rankings,
    });
  } catch (err) {
    console.error('Ranking handler error:', err.message);
    return error(500, '순위 조회 중 오류가 발생했습니다');
  }
};

module.exports = { handler, getLatestWeekLabel };
