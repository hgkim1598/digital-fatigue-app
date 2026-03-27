import { useState, useEffect, useRef } from 'react';
import { sendChat, getChatHistory } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { MessageCircle, Send, RefreshCw } from 'lucide-react';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const bottomRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    getChatHistory()
      .then((res) => {
        const history = res.data?.history || [];
        const msgs = [];
        history.forEach((h) => {
          if (h.userMessage) msgs.push({ role: 'user', text: h.userMessage });
          if (h.botResponse) msgs.push({ role: 'bot', text: h.botResponse });
        });
        setMessages(msgs);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await sendChat({ question: text, userId: user?.email || 'testuser@digitalfatigue.com' });
      setMessages((prev) => [...prev, { role: 'bot', text: res.data?.answer || '응답을 받지 못했습니다' }]);
    } catch (err) {
      const errMsg = err.response?.data?.message || '오류가 발생했습니다';
      setMessages((prev) => [...prev, { role: 'error', text: errMsg, original: text }]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = (originalText) => {
    setMessages((prev) => prev.filter((m) => !(m.role === 'error' && m.original === originalText)));
    setInput(originalText);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-72px)] bg-bg">
      <div className="bg-card text-center pt-4 pb-4 px-6">
        <h1 className="text-lg font-bold text-title">건강 챗봇</h1>
        <p className="text-xs text-sub mt-0.5">증상을 말씀해주시면 맞춤 해결책을 알려드려요</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        {historyLoading ? (
          <div className="flex justify-center py-10">
            <span className="w-6 h-6 border-2 border-main border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <span className="w-14 h-14 rounded-full bg-blue/10 flex items-center justify-center mx-auto mb-3">
              <MessageCircle size={24} className="text-blue-dark" />
            </span>
            <p className="text-sm text-sub">안녕하세요. 불편한 증상을 알려주세요.</p>
            <p className="text-xs text-sub/60 mt-1">예: "요즘 눈이 자주 피로해요"</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-main text-white rounded-br-md'
                  : msg.role === 'error'
                    ? 'bg-red-50 text-soft-red rounded-bl-md'
                    : 'bg-blue-light text-[#3A3A3A] rounded-bl-md'
                }`}>
                <p className="whitespace-pre-line">{msg.text}</p>
                {msg.role === 'error' && (
                  <button
                    onClick={() => handleRetry(msg.original)}
                    className="mt-2 flex items-center gap-1 text-xs text-soft-red hover:text-red-600"
                  >
                    <RefreshCw size={12} /> 다시 보내기
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-blue-light px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-blue-dark/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-blue-dark/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-blue-dark/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-5 py-3 bg-card">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="증상이나 궁금한 점을 입력하세요"
            disabled={loading}
            className="flex-1 px-4 py-3 bg-bg border-none rounded-2xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue/40
                       placeholder:text-sub/50 disabled:opacity-50 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-11 h-11 flex items-center justify-center bg-main hover:bg-main-dark
                       text-white rounded-2xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="전송"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
