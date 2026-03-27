'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { maskEmail } = require('../utils/auth');

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION })
);

const USERS_TABLE = process.env.USERS_TABLE;
const SYMPTOM_LOGS_TABLE = process.env.SYMPTOM_LOGS_TABLE;
const SCREEN_TIME_TABLE = process.env.SCREEN_TIME_TABLE;
const WEEKLY_ANALYSIS_TABLE = process.env.WEEKLY_ANALYSIS_TABLE;
const RANKINGS_TABLE = process.env.RANKINGS_TABLE;

/**
 * 주간 건강 점수 계산
 * 증상 점수: 1=나쁨, 5=좋음 (높을수록 건강)
 * symptomScore = ((symptomAvg - 1) / 4) * 60
 * screenTimeScore = max(0, 40 - (totalScreenTimeMinutes / 7 / 60) * 10)
 * weeklyHealthScore = round(symptomScore + screenTimeScore)
 */
function calculateWeeklyHealthScore(symptomLogs, screenTimeLogs) {
  let symptomScore = 60; // 증상 데이터 없으면 만점
  if (symptomLogs.length > 0) {
    const totalEye = symptomLogs.reduce((s, l) => s + l.eyeFatigue, 0);
    const totalHead = symptomLogs.reduce((s, l) => s + l.headache, 0);
    const totalGeneral = symptomLogs.reduce((s, l) => s + l.generalFatigue, 0);
    const count = symptomLogs.length;
    const avgEye = totalEye / count;
    const avgHead = totalHead / count;
    const avgGeneral = totalGeneral / count;
    const symptomAvg = (avgEye + avgHead + avgGeneral) / 3;
    symptomScore = ((symptomAvg - 1) / 4) * 60;
  }

  let screenTimeScore = 40; // 스크린타임 데이터 없으면 만점
  if (screenTimeLogs.length > 0) {
    const totalMinutes = screenTimeLogs.reduce((s, l) => s + l.durationMinutes, 0);
    screenTimeScore = Math.max(0, 40 - (totalMinutes / 7 / 60) * 10);
  }

  return Math.round(symptomScore + screenTimeScore);
}

/**
 * 전주 월~일 기간 계산 (UTC 기준)
 * @param {Date} now - 현재 시각
 * @returns {{ weekStart: Date, weekEnd: Date, weekLabel: string }}
 */
function getPreviousWeekRange(now) {
  const d = new Date(now);
  // 현재 요일 (0=일, 1=월, ..., 6=토)
  const dayOfWeek = d.getUTCDay();
  // 이번 주 월요일 구하기
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday));
  // 전주 월요일 ~ 일요일
  const weekStart = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(thisMonday.getTime() - 1); // 일요일 23:59:59.999

  // ISO week label: YYYY-Www
  const weekLabel = getISOWeekLabel(weekStart);
  return { weekStart, weekEnd, weekLabel };
}

/**
 * ISO 8601 주차 라벨 생성
 * @param {Date} date
 * @returns {string} YYYY-Www 형식
 */
function getISOWeekLabel(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * 모든 사용자 이메일 목록 조회
 */
async function getAllUserEmails() {
  const result = await ddbDocClient.send(
    new ScanCommand({
      TableName: USERS_TABLE,
      ProjectionExpression: 'PK',
    })
  );
  return (result.Items || [])
    .map((item) => item.PK.replace('USER#', ''))
    .filter((email) => email.length > 0);
}

/**
 * 특정 사용자의 전주 증상 기록 조회
 */
async function getUserSymptomLogs(email, weekStart, weekEnd) {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: SYMPTOM_LOGS_TABLE,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :skStart AND :skEnd',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':skStart': `LOG#${weekStart.toISOString()}`,
        ':skEnd': `LOG#${weekEnd.toISOString()}`,
      },
    })
  );
  return result.Items || [];
}

/**
 * 특정 사용자의 전주 스크린타임 기록 조회
 */
async function getUserScreenTimeLogs(email, weekStart, weekEnd) {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName: SCREEN_TIME_TABLE,
      KeyConditionExpression: 'PK = :pk AND SK BETWEEN :skStart AND :skEnd',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':skStart': `SESSION#${weekStart.toISOString()}`,
        ':skEnd': `SESSION#${weekEnd.toISOString()}`,
      },
    })
  );
  return result.Items || [];
}

/**
 * WeeklyScheduleFunction handler
 * EventBridge cron 트리거로 매주 월요일 UTC 0시에 실행
 */
const handler = async (_event) => {
  try {
    const now = new Date();
    const { weekStart, weekEnd, weekLabel } = getPreviousWeekRange(now);

    console.log(`Weekly analysis started: ${weekLabel}, range: ${weekStart.toISOString()} ~ ${weekEnd.toISOString()}`);

    const emails = await getAllUserEmails();
    console.log(`Processing ${emails.length} users`);

    const userScores = [];

    for (const email of emails) {
      try {
        const [symptomLogs, screenTimeLogs] = await Promise.all([
          getUserSymptomLogs(email, weekStart, weekEnd),
          getUserScreenTimeLogs(email, weekStart, weekEnd),
        ]);

        const score = calculateWeeklyHealthScore(symptomLogs, screenTimeLogs);

        // WeeklyAnalysisTable에 저장
        await ddbDocClient.send(
          new PutCommand({
            TableName: WEEKLY_ANALYSIS_TABLE,
            Item: {
              PK: `USER#${email}`,
              SK: `WEEK#${weekLabel}`,
              weeklyHealthScore: score,
              symptomLogCount: symptomLogs.length,
              screenTimeLogCount: screenTimeLogs.length,
              createdAt: now.toISOString(),
            },
          })
        );

        userScores.push({ email, score });
        console.log(`Processed: ${maskEmail(email)}, score: ${score}`);
      } catch (err) {
        console.error(`Error processing ${maskEmail(email)}:`, err.message);
      }
    }

    // 순위 산출 (높은 점수 = 낮은 순위 번호)
    userScores.sort((a, b) => b.score - a.score);

    // RankingsTable: 기존 데이터 삭제 후 새로 삽입 (중복 방지)
    const existingResult = await ddbDocClient.send(
      new QueryCommand({
        TableName: RANKINGS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `WEEK#${weekLabel}` },
        ProjectionExpression: 'PK, SK',
      })
    );
    const existingItems = existingResult.Items || [];
    for (let i = 0; i < existingItems.length; i += 25) {
      const batch = existingItems.slice(i, i + 25);
      await ddbDocClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [RANKINGS_TABLE]: batch.map((item) => ({
              DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
            })),
          },
        })
      );
    }

    const rankItems = userScores.map((u) => ({
      PK: `WEEK#${weekLabel}`,
      SK: `USER#${u.email}`,
      email: u.email,
      weeklyHealthScore: u.score,
      createdAt: now.toISOString(),
    }));

    // BatchWrite는 25개씩 처리
    for (let i = 0; i < rankItems.length; i += 25) {
      const batch = rankItems.slice(i, i + 25);
      await ddbDocClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [RANKINGS_TABLE]: batch.map((item) => ({
              PutRequest: { Item: item },
            })),
          },
        })
      );
    }

    console.log(`Weekly analysis completed: ${weekLabel}, ${userScores.length} users ranked`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: '주간 분석 완료',
        week: weekLabel,
        usersProcessed: userScores.length,
      }),
    };
  } catch (err) {
    console.error('WeeklySchedule handler error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: '주간 분석 처리 중 오류가 발생했습니다' }),
    };
  }
};

module.exports = { handler, calculateWeeklyHealthScore, getPreviousWeekRange, getISOWeekLabel };
