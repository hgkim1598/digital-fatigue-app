import { useState, useEffect } from 'react';
import { getWeeklyAnalysis, getRanking, getSymptoms } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { Activity, Trophy, Crown, AlertCircle, ClipboardList, Eye, Brain, Battery } from 'lucide-react';

function ScoreRing({ score }) {
  const r = 50;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - (score || 0) / 100);
  const color = score >= 70 ? '#A8D672' : score >= 40 ? '#EAB308' : '#E57373';

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#F0F0F0" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-title">{score ?? '--'}</span>
        <span className="text-[11px] text-sub">/ 100</span>
      </div>
    </div>
  );
}

function Section({ title, Icon, loading, error, children }) {
  if (loading) return (
    <div className="bg-card rounded-[20px] p-5 animate-pulse">
      <div className="h-4 bg-bg rounded w-24 mb-3" />
      <div className="h-20 bg-bg rounded-xl" />
    </div>
  );
  if (error) return (
    <div className="bg-card rounded-[20px] p-5">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={16} className="text-blue-dark" />}
        <p className="text-xs font-medium text-sub">{title}</p>
      </div>
      <div className="flex items-center gap-2 text-soft-red text-sm">
        <AlertCircle size={14} />
        {error}
      </div>
    </div>
  );
  return (
    <div className="bg-card rounded-[20px] px-5 py-5">
      <div className="flex items-center gap-2 mb-4">
        {Icon && (
          <span className="w-7 h-7 rounded-full bg-blue/10 flex items-center justify-center shrink-0">
            <Icon size={14} className="text-blue-dark" />
          </span>
        )}
        <div className="text-xs font-medium text-sub flex-1">{title}</div>
      </div>
      {children}
    </div>
  );
}

export default function Analysis() {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState({ data: null, loading: true, error: null });
  const [ranking, setRanking] = useState({ data: null, loading: true, error: null });
  const [todaySymptom, setTodaySymptom] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    getWeeklyAnalysis()
      .then((r) => setAnalysis({ data: r.data, loading: false, error: null }))
      .catch((e) => setAnalysis({ data: null, loading: false, error: e.response?.data?.message || '조회 실패' }));

    getRanking()
      .then((r) => setRanking({ data: r.data, loading: false, error: null }))
      .catch((e) => setRanking({ data: null, loading: false, error: e.response?.data?.message || '조회 실패' }));

    getSymptoms()
      .then((r) => {
        const logs = r.data?.logs || r.data?.symptoms || [];
        const today = new Date().toISOString().slice(0, 10);
        const todayLogs = logs.filter((l) => {
          const date = (l.SK || l.createdAt || l.timestamp || '').replace('LOG#', '');
          return date.slice(0, 10) === today;
        });
        setTodaySymptom({ data: todayLogs.length > 0 ? todayLogs : null, loading: false, error: null });
      })
      .catch((e) => setTodaySymptom({ data: null, loading: false, error: e.response?.data?.message || '조회 실패' }));
  }, []);

  const score = analysis.data?.weeklyScore ?? analysis.data?.weeklyHealthScore;
  const rankings = ranking.data?.rankings || [];
  // 백엔드 myRank가 없으면 rankings에서 현재 사용자 이메일로 직접 찾기
  const backendMyRank = ranking.data?.myRank;
  const myRank = backendMyRank || (() => {
    if (!user?.email || rankings.length === 0) return null;
    const found = rankings.find((r) => r.email === user.email);
    if (!found) return null;
    return { rank: found.rank ?? (rankings.indexOf(found) + 1), weeklyHealthScore: found.weeklyHealthScore };
  })();

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="pt-2 pb-3">
        <h1 className="text-xl font-bold text-title text-center">주간 분석</h1>
        <p className="text-sm text-sub mt-1 text-center">이번 주 건강 리포트</p>
      </div>

      <Section title="주간 건강 점수" Icon={Activity} loading={analysis.loading} error={analysis.error}>
        {analysis.data?.message ? (
          <p className="text-sm text-sub text-center py-4">{analysis.data.message}</p>
        ) : (
          <>
            <ScoreRing score={score} />
            {analysis.data?.period && (
              <p className="text-xs text-sub text-center mt-3">{analysis.data.period}</p>
            )}
          </>
        )}
      </Section>

      <Section
        title="전체 순위"
        Icon={Trophy}
        loading={ranking.loading}
        error={ranking.error}
      >
        <div className="bg-gradient-to-r from-main/20 to-blue/15 rounded-2xl px-4 py-3.5 mb-3 flex items-center justify-between border border-main/20">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-main-dark flex items-center justify-center text-white text-xs font-bold">
              {myRank?.rank ?? '-'}
            </span>
            <div>
              <p className="text-xs text-sub">내 순위</p>
              <p className="text-sm font-bold text-title">{myRank ? `${myRank.weeklyHealthScore}점` : '데이터 없음'}</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-main-dark">
            {myRank?.rank ?? '--'}<span className="text-sm font-medium ml-0.5">위</span>
          </span>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {rankings.slice(0, 10).map((r, i) => {
            const isMe = user?.email && r.email === user.email;
            const rank = r.rank || i + 1;
            return (
              <div key={r.SK || i}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm ${isMe ? 'bg-main/10 ring-1 ring-main/30' : 'bg-bg'}`}>
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-sub w-6 text-center">
                    {rank <= 3 ? <Crown size={16} className={rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-400' : 'text-amber-600'} /> : rank}
                  </span>
                  <span className={`truncate max-w-[140px] ${isMe ? 'font-bold text-main-dark' : 'text-title'}`}>
                    {isMe ? '나' : (r.email?.replace(/(.{2}).*(@.*)/, '$1***$2') || `사용자 ${rank}`)}
                  </span>
                </div>
                <span className={`font-bold ${isMe ? 'text-main-dark' : 'text-title'}`}>{r.weeklyHealthScore}<span className="text-xs font-normal text-sub ml-0.5">점</span></span>
              </div>
            );
          })}
          {rankings.length === 0 && (
            <p className="text-sm text-sub text-center py-3">순위 데이터가 없습니다</p>
          )}
        </div>
      </Section>

      <Section title="오늘의 증상 기록" Icon={ClipboardList} loading={todaySymptom.loading} error={todaySymptom.error}>
        {todaySymptom.data ? (
          <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
            {todaySymptom.data.map((log, idx) => {
              const raw = (log.SK || log.createdAt || log.timestamp || '').replace('LOG#', '');
              let time = '';
              if (raw.length >= 16) {
                const [h, m] = raw.slice(11, 16).split(':').map(Number);
                const kstH = (h + 9) % 24;
                time = `${String(kstH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
              }
              return (
                <div key={log.SK || idx}>
                  {time && (
                    <p className="text-sm text-sub/70 mb-1.5">{time}</p>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-main/10 rounded-2xl px-3 py-4 text-center">
                      <Eye size={18} className="text-main-dark mx-auto mb-1.5" />
                      <p className="text-xs text-sub mb-1">눈 피로</p>
                      <p className="text-2xl font-bold text-title">{log.eyeFatigue ?? '--'}</p>
                    </div>
                    <div className="bg-main/10 rounded-2xl px-3 py-4 text-center">
                      <Brain size={18} className="text-main-dark mx-auto mb-1.5" />
                      <p className="text-xs text-sub mb-1">두통</p>
                      <p className="text-2xl font-bold text-title">{log.headache ?? '--'}</p>
                    </div>
                    <div className="bg-blue/10 rounded-2xl px-3 py-4 text-center">
                      <Battery size={18} className="text-blue-dark mx-auto mb-1.5" />
                      <p className="text-xs text-sub mb-1">전신 피로</p>
                      <p className="text-2xl font-bold text-title">{log.generalFatigue ?? '--'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-sub text-center py-4">오늘 기록된 증상이 없습니다</p>
        )}
      </Section>
    </div>
  );
}
