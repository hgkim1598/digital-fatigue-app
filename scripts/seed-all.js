'use strict';

/**
 * 전체 시드 스크립트 — 기존 데이터 전부 삭제 후 테스트 계정 + 데모 데이터 일괄 삽입
 *
 * 사용법: node scripts/seed-all.js
 * 환경변수: USER_POOL_ID, USER_POOL_CLIENT_ID, REGION (기본 us-east-1)
 *
 * 대상 테이블: Users, SymptomLogs, ScreenTime, WeeklyAnalysis, Rankings, ChatHistory
 * 테스트 계정: testuser@digitalfatigue.com / Test1234!
 */

const { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.REGION || 'us-east-1';
const USER_POOL_ID = process.env.USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID;

const TABLES = {
  USERS: process.env.USERS_TABLE || 'Users',
  SYMPTOM_LOGS: process.env.SYMPTOM_LOGS_TABLE || 'SymptomLogs',
  SCREEN_TIME: process.env.SCREEN_TIME_TABLE || 'ScreenTime',
  WEEKLY_ANALYSIS: process.env.WEEKLY_ANALYSIS_TABLE || 'WeeklyAnalysis',
  RANKINGS: process.env.RANKINGS_TABLE || 'Rankings',
  CHAT_HISTORY: process.env.CHAT_HISTORY_TABLE || 'ChatHistory',
};

const TEST_EMAIL = 'testuser@digitalfatigue.com';
const TEST_PASSWORD = 'Test1234!';

if (!USER_POOL_ID || !USER_POOL_CLIENT_ID) {
  console.error('❌ USER_POOL_ID, USER_POOL_CLIENT_ID 환경변수가 필요합니다.');
  console.error('   sam deploy 출력 또는:');
  console.error('   aws cloudformation describe-stacks --stack-name <스택명> --query "Stacks[0].Outputs"');
  process.exit(1);
}

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

// ============================================
// 유틸리티 함수
// ============================================

function getISOWeekLabel(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getLatestWeekLabel() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  const prevMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  return getISOWeekLabel(prevMonday);
}

/** 전주 월~일 날짜 배열 반환 */
function getPreviousWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  const prevMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(prevMonday.getTime() + i * 24 * 60 * 60 * 1000);
    dates.push(d);
  }
  return dates;
}

// ============================================
// 1. 테이블 전체 삭제
// ============================================

async function clearTable(tableName, keyNames) {
  console.log(`  🗑️  ${tableName} 삭제 중...`);
  let totalDeleted = 0;
  let lastEvaluatedKey;

  do {
    const params = { TableName: tableName, Limit: 100 };
    if (lastEvaluatedKey) params.ExclusiveStartKey = lastEvaluatedKey;

    const result = await ddbDocClient.send(new ScanCommand(params));
    const items = result.Items || [];
    lastEvaluatedKey = result.LastEvaluatedKey;

    if (items.length === 0) break;

    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      await ddbDocClient.send(new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((item) => ({
            DeleteRequest: {
              Key: keyNames.reduce((k, name) => { k[name] = item[name]; return k; }, {}),
            },
          })),
        },
      }));
      totalDeleted += batch.length;
    }
  } while (lastEvaluatedKey);

  console.log(`     ✅ ${totalDeleted}건 삭제 완료`);
}

async function clearAllTables() {
  console.log('\n=== 1단계: 모든 테이블 데이터 삭제 ===');
  await clearTable(TABLES.USERS, ['PK']);
  await clearTable(TABLES.SYMPTOM_LOGS, ['PK', 'SK']);
  await clearTable(TABLES.SCREEN_TIME, ['PK', 'SK']);
  await clearTable(TABLES.WEEKLY_ANALYSIS, ['PK', 'SK']);
  await clearTable(TABLES.RANKINGS, ['PK', 'SK']);
  await clearTable(TABLES.CHAT_HISTORY, ['PK', 'SK']);
}

// ============================================
// 2. Cognito 테스트 계정 생성
// ============================================

async function createTestAccount() {
  console.log('\n=== 2단계: Cognito 테스트 계정 생성 ===');

  try {
    await cognitoClient.send(new SignUpCommand({
      ClientId: USER_POOL_CLIENT_ID,
      Username: TEST_EMAIL,
      Password: TEST_PASSWORD,
      UserAttributes: [{ Name: 'email', Value: TEST_EMAIL }],
    }));
    console.log('  ✅ Cognito 회원가입 완료');
  } catch (err) {
    if (err.name === 'UsernameExistsException') {
      console.log('  ⚠️  이미 등록된 계정 (스킵)');
    } else {
      throw err;
    }
  }

  try {
    await cognitoClient.send(new AdminConfirmSignUpCommand({
      UserPoolId: USER_POOL_ID,
      Username: TEST_EMAIL,
    }));
    console.log('  ✅ 계정 확인 완료');
  } catch (err) {
    if (err.name === 'NotAuthorizedException' || err.message?.includes('already confirmed')) {
      console.log('  ⚠️  이미 확인된 계정 (스킵)');
    } else {
      throw err;
    }
  }
}

// ============================================
// 3. Users 테이블 시드
// ============================================

async function seedUsersTable() {
  console.log('\n=== 3단계: Users 테이블 시드 ===');
  await ddbDocClient.send(new PutCommand({
    TableName: TABLES.USERS,
    Item: {
      PK: `USER#${TEST_EMAIL}`,
      email: TEST_EMAIL,
      age: 25,
      gender: 'male',
      createdAt: new Date().toISOString(),
    },
  }));
  console.log('  ✅ 테스트 계정 프로필 저장 완료');
}

// ============================================
// 4. SymptomLogs 시드 (전주 7일치)
// ============================================

async function seedSymptomLogs() {
  console.log('\n=== 4단계: SymptomLogs 시드 (전주 7일) ===');
  const dates = getPreviousWeekDates();
  const items = [];

  // 현실적인 증상 패턴: 주 초반 높고 후반 낮아지는 패턴
  const patterns = [
    { eyeFatigue: 4, headache: 3, generalFatigue: 4 }, // 월
    { eyeFatigue: 4, headache: 4, generalFatigue: 3 }, // 화
    { eyeFatigue: 3, headache: 3, generalFatigue: 3 }, // 수
    { eyeFatigue: 3, headache: 2, generalFatigue: 3 }, // 목
    { eyeFatigue: 2, headache: 2, generalFatigue: 2 }, // 금
    { eyeFatigue: 2, headache: 1, generalFatigue: 2 }, // 토
    { eyeFatigue: 1, headache: 1, generalFatigue: 1 }, // 일
  ];

  for (let i = 0; i < 7; i++) {
    const d = dates[i];
    // 오전 9시 기록
    const ts = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 9, 0, 0));
    items.push({
      PK: `USER#${TEST_EMAIL}`,
      SK: `LOG#${ts.toISOString()}`,
      eyeFatigue: patterns[i].eyeFatigue,
      headache: patterns[i].headache,
      generalFatigue: patterns[i].generalFatigue,
      createdAt: ts.toISOString(),
    });
  }

  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    await ddbDocClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.SYMPTOM_LOGS]: batch.map((item) => ({ PutRequest: { Item: item } })),
      },
    }));
  }
  console.log(`  ✅ 증상 기록 ${items.length}건 삽입 완료`);
}

// ============================================
// 5. ScreenTime 시드 (전주 7일치)
// ============================================

async function seedScreenTime() {
  console.log('\n=== 5단계: ScreenTime 시드 (전주 7일) ===');
  const dates = getPreviousWeekDates();
  const items = [];

  // 하루 2세션씩 (오전 업무 + 오후 업무)
  const dailyPatterns = [
    { sessions: [{ start: 9, dur: 240 }, { start: 14, dur: 180 }] }, // 월: 7시간
    { sessions: [{ start: 9, dur: 210 }, { start: 14, dur: 150 }] }, // 화: 6시간
    { sessions: [{ start: 9, dur: 180 }, { start: 14, dur: 120 }] }, // 수: 5시간
    { sessions: [{ start: 9, dur: 180 }, { start: 14, dur: 120 }] }, // 목: 5시간
    { sessions: [{ start: 9, dur: 150 }, { start: 14, dur: 90 }] },  // 금: 4시간
    { sessions: [{ start: 10, dur: 120 }] },                          // 토: 2시간
    { sessions: [{ start: 11, dur: 60 }] },                           // 일: 1시간
  ];

  for (let i = 0; i < 7; i++) {
    const d = dates[i];
    for (const sess of dailyPatterns[i].sessions) {
      const startTime = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), sess.start, 0, 0));
      const endTime = new Date(startTime.getTime() + sess.dur * 60 * 1000);
      const createdAt = endTime.toISOString();

      items.push({
        PK: `USER#${TEST_EMAIL}`,
        SK: `SESSION#${createdAt}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes: sess.dur,
        createdAt,
      });
    }
  }

  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    await ddbDocClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.SCREEN_TIME]: batch.map((item) => ({ PutRequest: { Item: item } })),
      },
    }));
  }
  console.log(`  ✅ 스크린타임 ${items.length}건 삽입 완료`);
}

// ============================================
// 6. WeeklyAnalysis + Rankings 시드
// ============================================

async function seedWeeklyAnalysisAndRankings() {
  console.log('\n=== 6단계: WeeklyAnalysis + Rankings 시드 ===');
  const weekLabel = getLatestWeekLabel();
  const now = new Date().toISOString();

  // 테스트 계정 점수 (증상 + 스크린타임 기반 현실적 점수)
  const TEST_SCORE = 78;

  // WeeklyAnalysis
  await ddbDocClient.send(new PutCommand({
    TableName: TABLES.WEEKLY_ANALYSIS,
    Item: {
      PK: `USER#${TEST_EMAIL}`,
      SK: `WEEK#${weekLabel}`,
      weeklyHealthScore: TEST_SCORE,
      symptomLogCount: 7,
      screenTimeLogCount: 12,
      createdAt: now,
    },
  }));
  console.log(`  ✅ WeeklyAnalysis 삽입 완료 (${weekLabel}, 점수: ${TEST_SCORE})`);

  // 더미 유저 30명 + 테스트 계정 순위
  const dummyUsers = [];
  for (let i = 1; i <= 30; i++) {
    dummyUsers.push({
      email: `dummy_user_${String(i).padStart(3, '0')}@example.com`,
      weeklyHealthScore: Math.floor(Math.random() * 81) + 10, // 10~90
    });
  }

  const allUsers = [
    ...dummyUsers,
    { email: TEST_EMAIL, weeklyHealthScore: TEST_SCORE },
  ];
  allUsers.sort((a, b) => b.weeklyHealthScore - a.weeklyHealthScore);

  const rankItems = allUsers.map((u) => ({
    PK: `WEEK#${weekLabel}`,
    SK: `USER#${u.email}`,
    email: u.email,
    weeklyHealthScore: u.weeklyHealthScore,
    isDummy: u.email !== TEST_EMAIL,
    createdAt: now,
  }));

  for (let i = 0; i < rankItems.length; i += 25) {
    const batch = rankItems.slice(i, i + 25);
    await ddbDocClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.RANKINGS]: batch.map((item) => ({ PutRequest: { Item: item } })),
      },
    }));
  }

  const myIdx = allUsers.findIndex((u) => u.email === TEST_EMAIL);
  console.log(`  ✅ Rankings 삽입 완료 (${rankItems.length}명, 테스트 계정: ${myIdx + 1}위)`);
}

// ============================================
// 7. ChatHistory 시드 (샘플 대화 3개)
// ============================================

async function seedChatHistory() {
  console.log('\n=== 7단계: ChatHistory 시드 ===');
  const now = new Date();

  const conversations = [
    {
      offset: -3600000 * 3, // 3시간 전
      userMessage: '요즘 눈이 너무 피로한데 어떻게 해야 할까요?',
      botResponse: '눈 피로를 줄이려면 20-20-20 규칙을 추천드려요. 20분마다 20피트(약 6m) 떨어진 곳을 20초간 바라보세요. 또한 화면 밝기를 주변 조명과 맞추고, 블루라이트 필터를 사용해보세요.',
    },
    {
      offset: -3600000 * 2, // 2시간 전
      userMessage: '스크린타임을 줄이는 팁이 있을까요?',
      botResponse: '스크린타임 관리를 위해 몇 가지 방법을 추천드려요: 1) 업무 시간에 50분 집중 후 10분 휴식하는 포모도로 기법 활용, 2) 취침 1시간 전 디지털 기기 사용 중단, 3) 알림을 최소화하여 불필요한 화면 확인 줄이기.',
    },
    {
      offset: -3600000, // 1시간 전
      userMessage: '눈에 좋은 영양제가 있나요?',
      botResponse: '눈 건강에 도움이 되는 대표적인 영양소로는 루테인, 오메가-3, 비타민A가 있어요. 루테인은 블루라이트로부터 망막을 보호하고, 오메가-3는 안구건조증 완화에 효과적입니다. 균형 잡힌 식단과 함께 섭취하시면 좋아요.',
    },
  ];

  const items = conversations.map((c) => {
    const ts = new Date(now.getTime() + c.offset).toISOString();
    return {
      PK: `USER#${TEST_EMAIL}`,
      SK: `CHAT#${ts}`,
      userMessage: c.userMessage,
      botResponse: c.botResponse,
      createdAt: ts,
    };
  });

  for (const item of items) {
    await ddbDocClient.send(new PutCommand({
      TableName: TABLES.CHAT_HISTORY,
      Item: item,
    }));
  }
  console.log(`  ✅ 채팅 이력 ${items.length}건 삽입 완료`);
}

// ============================================
// 메인 실행
// ============================================

async function main() {
  try {
    console.log('🚀 전체 시드 스크립트 시작');
    console.log(`   테스트 계정: ${TEST_EMAIL}`);
    console.log(`   리전: ${REGION}`);
    console.log(`   주차: ${getLatestWeekLabel()}`);

    await clearAllTables();
    await createTestAccount();
    await seedUsersTable();
    await seedSymptomLogs();
    await seedScreenTime();
    await seedWeeklyAnalysisAndRankings();
    await seedChatHistory();

    console.log('\n🎉 전체 시드 완료!');
    console.log('');
    console.log('로그인 정보:');
    console.log(`  이메일: ${TEST_EMAIL}`);
    console.log(`  비밀번호: ${TEST_PASSWORD}`);
  } catch (err) {
    console.error('\n❌ 시드 실패:', err.message);
    console.error(err);
    process.exit(1);
  }
}

main();
