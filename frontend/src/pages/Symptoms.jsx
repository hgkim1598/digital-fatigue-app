import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSymptom } from '../api/endpoints';
import { Eye, Brain, Battery, CheckCircle2, AlertCircle } from 'lucide-react';

const questions = [
  { key: 'eyeFatigue', label: '눈 피로', Icon: Eye, desc: '눈이 뻑뻑하거나 침침한 정도', category: 'green' },
  { key: 'headache', label: '두통', Icon: Brain, desc: '머리가 무겁거나 아픈 정도', category: 'green' },
  { key: 'generalFatigue', label: '전신 피로', Icon: Battery, desc: '몸 전체가 무겁거나 지친 정도', category: 'blue' },
];

const scoreLabels = ['매우 나쁨', '나쁨', '보통', '좋음', '매우 좋음'];

export default function Symptoms() {
  const navigate = useNavigate();
  const [scores, setScores] = useState({ eyeFatigue: 0, headache: 0, generalFatigue: 0 });
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const allSelected = Object.values(scores).every((v) => v > 0);

  const handleSelect = (key, value) => {
    setScores((prev) => ({ ...prev, [key]: value }));
    setStatus('idle');
  };

  const handleSubmit = async () => {
    if (!allSelected) return;
    setStatus('loading');
    try {
      await createSymptom(scores);
      setStatus('success');
      setTimeout(() => {
        navigate('/analysis');
      }, 800);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || '기록 저장에 실패했습니다');
      setStatus('error');
    }
  };

  const getColor = (category, selected) => {
    if (!selected) return 'bg-bg text-sub hover:bg-gray-200';
    return category === 'green'
      ? 'bg-main text-white'
      : 'bg-blue text-white';
  };

  const getIconBg = (category) =>
    category === 'green' ? 'bg-main/10' : 'bg-blue/10';

  const getIconColor = (category) =>
    category === 'green' ? 'text-main-dark' : 'text-blue-dark';

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="pt-2 pb-3">
        <h1 className="text-xl font-bold text-title text-center">증상 기록</h1>
        <p className="text-sm text-sub mt-1 text-center">오늘의 상태를 기록해주세요</p>
      </div>

      {questions.map(({ key, label, Icon, desc, category }) => (
        <div key={key} className="bg-card rounded-[20px] p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <span className={`w-8 h-8 rounded-full ${getIconBg(category)} flex items-center justify-center`}>
              <Icon size={16} className={getIconColor(category)} />
            </span>
            <span className="font-semibold text-title text-[15px]">{label}</span>
          </div>
          <p className="text-xs text-sub mb-4 ml-[42px]">{desc}</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleSelect(key, v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${getColor(category, scores[key] === v)}`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-1">
            <span className="text-[10px] text-sub/60">{scoreLabels[0]}</span>
            <span className="text-[10px] text-sub/60">{scoreLabels[4]}</span>
          </div>
        </div>
      ))}

      {status === 'success' && (
        <div className="flex items-center gap-2 bg-main/10 text-main-dark text-sm px-4 py-3 rounded-2xl" role="alert">
          <CheckCircle2 size={16} />
          증상이 기록되었습니다
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 bg-red-50 text-soft-red text-sm px-4 py-3 rounded-2xl" role="alert">
          <AlertCircle size={16} />
          {errorMsg}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!allSelected || status === 'loading'}
        className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all
          ${allSelected
            ? 'bg-main-dark hover:bg-main-dark/90 text-white'
            : 'bg-gray-200 text-sub cursor-not-allowed'
          } disabled:opacity-50`}
      >
        {status === 'loading' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            저장 중...
          </span>
        ) : '기록하기'}
      </button>
    </div>
  );
}
