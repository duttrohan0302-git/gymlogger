import { Home, PlusCircle, TrendingUp, Clock } from 'lucide-react'

const tabs = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'log', label: 'Log', Icon: PlusCircle },
  { id: 'progress', label: 'Progress', Icon: TrendingUp },
  { id: 'history', label: 'History', Icon: Clock },
]

export default function BottomNav({ screen, onNavigate }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 safe-bottom z-50">
      <div className="flex">
        {tabs.map(({ id, label, Icon }) => {
          const active = screen === id || (screen === 'settings' && id === 'home')
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
                active ? 'text-brand' : 'text-gray-500'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
