import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, signup } from '../api/endpoints';
import { AlertCircle } from 'lucide-react';
import mainLogo from '../assets/main-logo.png';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ email: '', password: '', age: '', gender: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { saveTokens } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const res = await login({ email: form.email, password: form.password });
        saveTokens(res.data);
        navigate('/', { replace: true });
      } else {
        const payload = {
          email: form.email,
          password: form.password,
          age: Number(form.age),
          gender: form.gender,
        };
        await signup(payload);
        const res = await login({ email: form.email, password: form.password });
        saveTokens(res.data);
        navigate('/', { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '오류가 발생했습니다';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full px-4 py-3 min-h-[44px] bg-bg border-none rounded-2xl text-sm
    focus:outline-none focus:ring-2 focus:ring-main/40 placeholder:text-sub/50 transition-all`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-bg">
      {/* 로고 */}
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-3 overflow-hidden">
          <img src={mainLogo} alt="디지털 피로 관리 로고" className="w-full h-full object-contain scale-150" />
        </div>
        <h1 className="text-2xl font-bold text-title">디지털 피로 관리</h1>
        <p className="text-sm text-sub mt-1">눈 건강을 지키는 스마트한 습관</p>
      </div>

      {/* 탭 */}
      <div className="w-full max-w-xs mb-6">
        <div className="flex bg-card rounded-2xl p-1">
          <button type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${
              isLogin ? 'bg-main text-white' : 'text-sub'
            }`}>
            로그인
          </button>
          <button type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${
              !isLogin ? 'bg-main text-white' : 'text-sub'
            }`}>
            회원가입
          </button>
        </div>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-sub mb-1.5 ml-1">이메일</label>
          <input id="email" name="email" type="email" required autoComplete="email"
            placeholder="example@email.com" value={form.email} onChange={handleChange}
            className={inputClass} />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-sub mb-1.5 ml-1">비밀번호</label>
          <input id="password" name="password" type="password" required
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder="비밀번호 입력" value={form.password} onChange={handleChange}
            className={inputClass} />
        </div>

        {!isLogin && (
          <>
            <div>
              <label htmlFor="age" className="block text-xs font-medium text-sub mb-1.5 ml-1">나이</label>
              <input id="age" name="age" type="number" required min="1"
                placeholder="나이 입력" value={form.age} onChange={handleChange}
                className={inputClass} />
            </div>
            <div>
              <label htmlFor="gender" className="block text-xs font-medium text-sub mb-1.5 ml-1">성별</label>
              <select id="gender" name="gender" required value={form.gender} onChange={handleChange}
                className={`${inputClass} appearance-none`}>
                <option value="" disabled>성별 선택</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
                <option value="other">기타</option>
              </select>
            </div>
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-500 text-xs px-4 py-3 rounded-2xl" role="alert">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3.5 min-h-[44px] bg-main-dark hover:bg-main-dark/90
                     text-white font-semibold text-sm rounded-2xl transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              처리 중...
            </span>
          ) : (isLogin ? '로그인' : '회원가입')}
        </button>
      </form>

      {/* 테스트 계정 바로 로그인 */}
      <button type="button"
        onClick={async () => {
          setLoading(true);
          setError('');
          try {
            const res = await login({ email: 'testuser@digitalfatigue.com', password: 'Test1234!' });
            saveTokens(res.data);
            navigate('/', { replace: true });
          } catch (err) {
            setError(err.response?.data?.message || '데모 로그인 실패');
          } finally {
            setLoading(false);
          }
        }}
        className="mt-6 text-xs text-sub/50 hover:text-sub underline transition-colors">
        테스트 계정으로 로그인
      </button>
    </div>
  );
}
