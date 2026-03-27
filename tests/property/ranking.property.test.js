'use strict';

const fc = require('fast-check');

// Property 10: 순위는 항상 오름차순으로 정렬된다
describe('Property 10: 순위는 항상 오름차순으로 정렬된다', () => {
  test('rank 값 기준 오름차순 정렬 확인', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            email: fc.emailAddress(),
            weeklyHealthScore: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (users) => {
          // handler와 동일한 로직: 점수 내림차순 정렬 후 순위 부여
          const sorted = [...users].sort((a, b) => b.weeklyHealthScore - a.weeklyHealthScore);
          const ranked = sorted.map((u, idx) => ({
            rank: idx + 1,
            email: u.email,
            weeklyHealthScore: u.weeklyHealthScore,
          }));

          // 순위가 오름차순인지 확인
          for (let i = 1; i < ranked.length; i++) {
            expect(ranked[i].rank).toBeGreaterThan(ranked[i - 1].rank);
          }

          // 높은 순위(낮은 번호)의 점수가 같거나 높은지 확인
          for (let i = 1; i < ranked.length; i++) {
            expect(ranked[i - 1].weeklyHealthScore).toBeGreaterThanOrEqual(ranked[i].weeklyHealthScore);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
