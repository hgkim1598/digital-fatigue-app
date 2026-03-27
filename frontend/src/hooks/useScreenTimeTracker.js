import { useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'app_screen_time';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getStoredMinutes() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const today = getTodayKey();
    return data[today] || 0;
  } catch {
    return 0;
  }
}

function addMinutes(mins) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const today = getTodayKey();
    data[today] = (data[today] || 0) + mins;
    // 오래된 데이터 정리 (7일 이전)
    const keys = Object.keys(data);
    if (keys.length > 7) {
      keys.sort();
      keys.slice(0, keys.length - 7).forEach((k) => delete data[k]);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* silent */ }
}

/**
 * 앱 내 사용 시간을 로컬에서 측정.
 * visibilitychange로 포그라운드 시간만 누적.
 */
export default function useScreenTimeTracker() {
  const sessionStart = useRef(null);

  const flushSession = useCallback(() => {
    if (!sessionStart.current) return;
    const elapsed = (Date.now() - sessionStart.current) / 60000; // 분 단위
    if (elapsed > 0.1) {
      addMinutes(elapsed);
    }
    sessionStart.current = null;
  }, []);

  useEffect(() => {
    sessionStart.current = Date.now();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        flushSession();
      } else {
        sessionStart.current = Date.now();
      }
    };

    const handleBeforeUnload = () => {
      flushSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 1분마다 중간 저장
    const interval = setInterval(() => {
      if (sessionStart.current && !document.hidden) {
        flushSession();
        sessionStart.current = Date.now();
      }
    }, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(interval);
      flushSession();
    };
  }, [flushSession]);
}

export { getStoredMinutes };
