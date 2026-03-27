'use strict';

var mockDdbSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDdbSend })) },
  ScanCommand: jest.fn((params) => ({ ...params, _type: 'Scan' })),
  QueryCommand: jest.fn((params) => ({ ...params, _type: 'Query' })),
  PutCommand: jest.fn((params) => ({ ...params, _type: 'Put' })),
  BatchWriteCommand: jest.fn((params) => ({ ...params, _type: 'BatchWrite' })),
}));

process.env.USERS_TABLE = 'Users';
process.env.SYMPTOM_LOGS_TABLE = 'SymptomLogs';
process.env.SCREEN_TIME_TABLE = 'ScreenTime';
process.env.WEEKLY_ANALYSIS_TABLE = 'WeeklyAnalysis';
process.env.RANKINGS_TABLE = 'Rankings';
process.env.REGION = 'us-east-1';

const { handler, calculateWeeklyHealthScore, getPreviousWeekRange, getISOWeekLabel } = require('../../../src/handlers/weeklySchedule');

describe('WeeklyScheduleFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDdbSend.mockResolvedValue({});
  });

  describe('calculateWeeklyHealthScore', () => {
    test('데이터 없으면 100점을 반환한다', () => {
      expect(calculateWeeklyHealthScore([], [])).toBe(100);
    });

    test('증상만 있을 때 올바르게 계산한다', () => {
      const logs = [
        { eyeFatigue: 3, headache: 3, generalFatigue: 3 },
      ];
      // symptomAvg = 3, symptomScore = ((3-1)/4) * 60 = 30
      // screenTimeScore = 40
      expect(calculateWeeklyHealthScore(logs, [])).toBe(70);
    });

    test('스크린타임만 있을 때 올바르게 계산한다', () => {
      const screenLogs = [{ durationMinutes: 420 }]; // 7시간
      // symptomScore = 60 (데이터 없으면 만점)
      // screenTimeScore = max(0, 40 - (420/7/60)*10) = max(0, 40 - 10) = 30
      expect(calculateWeeklyHealthScore([], screenLogs)).toBe(90);
    });

    test('증상과 스크린타임 모두 있을 때 올바르게 계산한다', () => {
      const symptomLogs = [
        { eyeFatigue: 2, headache: 2, generalFatigue: 2 },
        { eyeFatigue: 4, headache: 4, generalFatigue: 4 },
      ];
      const screenLogs = [
        { durationMinutes: 120 },
        { durationMinutes: 180 },
      ];
      // avgEye=3, avgHead=3, avgGeneral=3, symptomAvg=3
      // symptomScore = ((3-1)/4) * 60 = 30
      // totalMinutes=300, screenTimeScore = max(0, 40 - (300/7/60)*10) ≈ 32.86
      // total = round(30 + 32.86) = 63
      expect(calculateWeeklyHealthScore(symptomLogs, screenLogs)).toBe(63);
    });
  });

  describe('getPreviousWeekRange', () => {
    test('월요일 기준으로 전주 범위를 반환한다', () => {
      // 2024-01-15 (월요일)
      const now = new Date('2024-01-15T00:00:00Z');
      const { weekStart, weekEnd, weekLabel } = getPreviousWeekRange(now);
      expect(weekStart.toISOString()).toBe('2024-01-08T00:00:00.000Z');
      expect(weekEnd.getTime()).toBeLessThan(new Date('2024-01-15T00:00:00Z').getTime());
      expect(weekLabel).toMatch(/^\d{4}-W\d{2}$/);
    });
  });

  describe('getISOWeekLabel', () => {
    test('올바른 ISO 주차 라벨을 반환한다', () => {
      const label = getISOWeekLabel(new Date('2024-01-08T00:00:00Z'));
      expect(label).toBe('2024-W02');
    });
  });

  describe('handler', () => {
    test('사용자가 없으면 0명 처리 결과를 반환한다', async () => {
      // Scan → 빈 사용자 목록
      mockDdbSend.mockResolvedValueOnce({ Items: [] });

      const res = await handler({});
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.usersProcessed).toBe(0);
    });

    test('사용자 데이터를 집계하고 순위를 저장한다', async () => {
      // 1) Scan users
      mockDdbSend.mockResolvedValueOnce({
        Items: [{ PK: 'USER#a@test.com' }, { PK: 'USER#b@test.com' }],
      });
      // 2) user a: symptom query
      mockDdbSend.mockResolvedValueOnce({
        Items: [{ eyeFatigue: 2, headache: 2, generalFatigue: 2 }],
      });
      // 3) user a: screentime query
      mockDdbSend.mockResolvedValueOnce({
        Items: [{ durationMinutes: 120 }],
      });
      // 4) user a: put weekly analysis
      mockDdbSend.mockResolvedValueOnce({});
      // 5) user b: symptom query
      mockDdbSend.mockResolvedValueOnce({
        Items: [{ eyeFatigue: 4, headache: 4, generalFatigue: 4 }],
      });
      // 6) user b: screentime query
      mockDdbSend.mockResolvedValueOnce({
        Items: [{ durationMinutes: 600 }],
      });
      // 7) user b: put weekly analysis
      mockDdbSend.mockResolvedValueOnce({});
      // 8) batch write rankings
      mockDdbSend.mockResolvedValueOnce({});

      const res = await handler({});
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.usersProcessed).toBe(2);
      // 8 calls: scan + (query+query+put)*2 + batchWrite
      expect(mockDdbSend).toHaveBeenCalledTimes(8);
    });

    test('개별 사용자 처리 실패 시 다른 사용자는 계속 처리한다', async () => {
      mockDdbSend.mockResolvedValueOnce({
        Items: [{ PK: 'USER#fail@test.com' }, { PK: 'USER#ok@test.com' }],
      });
      // fail user: symptom query throws
      mockDdbSend.mockRejectedValueOnce(new Error('DynamoDB error'));
      // ok user: symptom query
      mockDdbSend.mockResolvedValueOnce({ Items: [] });
      // ok user: screentime query
      mockDdbSend.mockResolvedValueOnce({ Items: [] });
      // ok user: put weekly analysis
      mockDdbSend.mockResolvedValueOnce({});
      // batch write rankings (1 user)
      mockDdbSend.mockResolvedValueOnce({});

      const res = await handler({});
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).usersProcessed).toBe(1);
    });

    test('전체 실패 시 500을 반환한다', async () => {
      mockDdbSend.mockRejectedValueOnce(new Error('Scan failed'));

      const res = await handler({});
      expect(res.statusCode).toBe(500);
    });
  });
});
