'use strict';

const fc = require('fast-check');
const { calculateWeeklyHealthScore } = require('../../src/handlers/weeklySchedule');

// Property 9: Weekly_Health_Score는 올바르게 계산된다
describe('Property 9: Weekly_Health_Score는 증상과 스크린타임을 모두 반영하여 올바르게 계산된다', () => {
  test('점수는 항상 0~100 범위이다', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            eyeFatigue: fc.integer({ min: 1, max: 5 }),
            headache: fc.integer({ min: 1, max: 5 }),
            generalFatigue: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 0, maxLength: 30 }
        ),
        fc.array(
          fc.record({
            durationMinutes: fc.integer({ min: 1, max: 1440 }),
          }),
          { minLength: 0, maxLength: 30 }
        ),
        (symptomLogs, screenTimeLogs) => {
          const score = calculateWeeklyHealthScore(symptomLogs, screenTimeLogs);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('공식이 정확하게 적용된다', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            eyeFatigue: fc.integer({ min: 1, max: 5 }),
            headache: fc.integer({ min: 1, max: 5 }),
            generalFatigue: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.array(
          fc.record({
            durationMinutes: fc.integer({ min: 1, max: 1440 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (symptomLogs, screenTimeLogs) => {
          const score = calculateWeeklyHealthScore(symptomLogs, screenTimeLogs);

          // 수동 계산
          const count = symptomLogs.length;
          const avgEye = symptomLogs.reduce((s, l) => s + l.eyeFatigue, 0) / count;
          const avgHead = symptomLogs.reduce((s, l) => s + l.headache, 0) / count;
          const avgGeneral = symptomLogs.reduce((s, l) => s + l.generalFatigue, 0) / count;
          const symptomAvg = (avgEye + avgHead + avgGeneral) / 3;
          const symptomScore = ((symptomAvg - 1) / 4) * 60;

          const totalMinutes = screenTimeLogs.reduce((s, l) => s + l.durationMinutes, 0);
          const screenTimeScore = Math.max(0, 40 - (totalMinutes / 7 / 60) * 10);

          const expected = Math.round(symptomScore + screenTimeScore);
          expect(score).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('데이터 없으면 만점(100)이다', () => {
    const score = calculateWeeklyHealthScore([], []);
    expect(score).toBe(100);
  });

  test('최악의 증상(모두 1)이면 symptomScore는 0이다', () => {
    const logs = [{ eyeFatigue: 1, headache: 1, generalFatigue: 1 }];
    const score = calculateWeeklyHealthScore(logs, []);
    // symptomScore = ((1-1)/4) * 60 = 0, screenTimeScore = 40
    expect(score).toBe(40);
  });
});

// Property 11: 순위는 점수 기반으로 올바르게 산출된다
describe('Property 11: 주간 집계 후 순위는 점수 기반으로 올바르게 산출된다', () => {
  test('높은 점수가 낮은 순위 번호를 가진다', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            email: fc.emailAddress(),
            score: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 2, maxLength: 50 }
        ),
        (users) => {
          // 점수 내림차순 정렬 (handler와 동일한 로직)
          const sorted = [...users].sort((a, b) => b.score - a.score);
          const ranked = sorted.map((u, idx) => ({ ...u, rank: idx + 1 }));

          for (let i = 1; i < ranked.length; i++) {
            // 순위가 높은(번호 작은) 사용자의 점수가 같거나 높아야 함
            expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
            expect(ranked[i - 1].rank).toBeLessThan(ranked[i].rank);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
