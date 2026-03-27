import { NavLink } from 'react-router-dom';
import { Home, ClipboardList, BarChart3, MessageCircle } from 'lucide-react';

const tabs = [
  { to: '/', label: '홈', Icon: Home },
  { to: '/symptoms', label: '증상기록', Icon: ClipboardList },
  { to: '/analysis', label: '분석', Icon: BarChart3 },
  { to: '/chat', label: '챗봇', Icon: MessageCircle },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white z-50">
      <ul className="flex justify-around items-center h-16" role="tablist">
        {tabs.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1" role="presentation">
            <NavLink
              to={to}
              end={to === '/'}
              role="tab"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors ${
                  isActive ? 'text-main font-semibold' : 'text-sub'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                      isActive ? 'bg-main/15' : ''
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
