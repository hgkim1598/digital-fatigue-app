import { useState, useEffect, useRef } from 'react';
import { Eye } from 'lucide-react';
import { getScreenTime } from '../api/endpoints';

const NOTIFY_SECONDS = 20; // TODO: 테스트용 20초 → 배포 시 20 * 60으로 복원
const LS_KEY = 'eyeRestNotifyEnabled';

export default function Home() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(LS_KEY) === 'true');
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  // 타이머 시작/정지
  useEffect(() => {
    if (!enabled) {
      clearInterval(intervalRef.current);
      startRef.current = null;
      // SW 타이머도 중지
      navigator.serviceWorker?.ready.then((reg) => {
        reg.active?.postMessage({ type: 'DISABLE_202020' });
      });
      return;
    }

    startRef.current = Date.now();
    setElapsed(0);

    // SW에 타이머 시작 알림
    navigator.serviceWorker?.ready.then((reg) => {
      reg.active?.postMessage({ type: 'ENABLE_202020' });
    });

    const tick = () => {
      if (!startRef.current) return;
      const sec = Math.floor((Date.now() - startRef.current) / 1000);

      if (sec >= NOTIFY_SECONDS) {
        // SW가 알림을 처리하므로 여기서는 타이머 리셋만
        // SW 알림이 안 될 경우 fallback으로 registration.showNotification 사용
        navigator.serviceWorker?.ready.then((reg) => {
          reg.showNotification('👁️ 눈 휴식 시간', {
            body: '20분 이상 사용했어요. 20초간 먼 곳을 바라봐요.',
            icon: '/favicon.svg',
            tag: 'eye-rest-202020',
            renotify: true,
            data: { url: '/symptoms' },
          });
        }).catch(() => {
          // SW도 안 되면 alert fallback
          window.alert('👁️ 눈 휴식 시간!\n20분 이상 사용했어요. 20초간 먼 곳을 바라봐요.');
        });
        // 리셋
        startRef.current = Date.now();
        setElapsed(0);
      } else {
        setElapsed(sec);
      }
    };

    intervalRef.current = setInterval(tick, 1000);

    const onVisChange = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [enabled]);

  const toggle = async () => {
    const next = !enabled;
    if (next && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
    setEnabled(next);
    localStorage.setItem(LS_KEY, String(next));
  };

  const [todayMinutes, setTodayMinutes] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await getScreenTime();
        const sessions = res.data?.sessions || [];
        const today = new Date().toISOString().slice(0, 10);
        const total = sessions
          .filter((s) => s.startTime?.slice(0, 10) === today)
          .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
        setTodayMinutes(Math.round(total));
      } catch { /* silent */ }
    })();
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const progress = (elapsed / NOTIFY_SECONDS) * 100;
  const hours = Math.floor(todayMinutes / 60);
  const remainMins = todayMinutes % 60;

  return (
    <div className="px-6 py-5 space-y-6 overflow-hidden">
      <div className="text-center pt-2 pb-3">
        <p className="text-gray-400 text-sm">안녕하세요 👋</p>
        <h1 className="text-xl font-bold text-gray-800 mt-0.5">오늘도 눈 건강을 지켜요</h1>
      </div>

      {/* 20분 휴식 알림 */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl px-6 py-5 text-white shadow-lg shadow-blue-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-100 text-xs font-medium">20분 휴식 알림</p>
            <p className="text-3xl font-bold tracking-tight mt-1">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </p>
            <p className="text-blue-200 text-[11px] mt-0.5">경과 시간</p>
          </div>
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="white" strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
                className="transition-all duration-1000" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center">
              <Eye size={22} />
            </span>
          </div>
        </div>
        <button onClick={toggle}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold backdrop-blur-sm transition-all ${
            enabled ? 'bg-white/30 hover:bg-white/40' : 'bg-white/20 hover:bg-white/30'
          }`}>
          {enabled ? '알림 끄기' : '알림 켜기'}
        </button>
      </div>

      {/* 스크린타임 */}
      <div className="bg-white border border-gray-100 rounded-2xl px-6 py-5 shadow-sm">
        <p className="text-xs font-medium text-gray-400 mb-2">📱 오늘의 스크린타임</p>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-gray-800">
            {hours > 0 ? `${hours}시간 ` : ''}{remainMins}분
          </span>
        </div>
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              todayMinutes > 240 ? 'bg-red-400' : todayMinutes > 120 ? 'bg-yellow-400' : 'bg-green-400'
            }`}
            style={{ width: `${Math.min((todayMinutes / 360) * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-300 mt-1.5">권장: 하루 6시간 이하</p>
      </div>

      {/* 바로가기 */}
      <div className="grid grid-cols-2 gap-3">
        <a href="/symptoms"
          className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-4 text-center hover:shadow-sm transition-all">
          <span className="text-2xl block mb-1">📋</span>
          <p className="text-sm font-semibold text-orange-600">증상 기록</p>
          <p className="text-xs text-orange-300 mt-0.5">오늘의 상태 입력</p>
        </a>
        <a href="/analysis"
          className="bg-purple-50 border border-purple-100 rounded-2xl px-4 py-4 text-center hover:shadow-sm transition-all">
          <span className="text-2xl block mb-1">📊</span>
          <p className="text-sm font-semibold text-purple-600">주간 분석</p>
          <p className="text-xs text-purple-300 mt-0.5">건강 점수 확인</p>
        </a>
      </div>
    </div>
  );
}