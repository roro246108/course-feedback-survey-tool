
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
<<<<<<< Updated upstream
  ClipboardList,
  BookOpen,
=======
>>>>>>> Stashed changes
  GraduationCap,
  BarChart3,
  Users,
  LogOut,
  ChevronDown
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    path: '/admin/dashboard',
    icon: LayoutDashboard
  },
  {
    name: 'Surveys',
    path: '/admin/surveys',
    icon: ClipboardList,
    children: [
      { name: 'Create Survey', path: '/admin/surveys/create' },
      { name: 'Manage Surveys', path: '/admin/surveys' },
      { name: 'Manage Questions', path: '/admin/questions' }
    ]
  },
  {
    name: 'Reports',
    path: '/admin/reports',
    icon: BarChart3
  },
  {
    name: 'Users',
    path: '/admin/users',
    icon: Users
  }
]

function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col bg-[#2B5748] px-5 py-7 text-white">

      {/* Logo */}
      <div className="mb-12 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DED4AF] text-[#2B5748]">
          <GraduationCap size={27} />
        </div>

        <div>
          <h1 className="text-base font-bold">Course Feedback</h1>
          <p className="text-sm text-[#DED4AF]">Survey Tool</p>
        </div>
      </div>

<<<<<<< Updated upstream
      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {navigation.map((item) => {
=======
      <nav className="flex-1 space-y-2">
        {items.map((item) => {
>>>>>>> Stashed changes
          const Icon = item.icon

          return (
            <div key={item.name}>
              <NavLink
                to={item.path}
                end={!item.children}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-4 py-3 transition ${
                    isActive
                      ? 'bg-[#A6B398] text-[#243D34] font-semibold'
                      : 'text-[#F4F7F6] hover:bg-white/10'
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Icon size={20} />
                  {item.name}
                </span>

                {item.children && <ChevronDown size={17} />}
              </NavLink>

              {item.children && (
                <div className="ml-10 mt-2 space-y-1">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      end={child.path === '/admin/surveys'}
                      className={({ isActive }) =>
                        `block rounded-lg px-3 py-2 text-sm transition ${
                          isActive
                            ? 'bg-white/15 text-[#DED4AF]'
                            : 'text-white/75 hover:text-white hover:bg-white/10'
                        }`
                      }
                    >
                      {child.name}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        type="button"
        className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#DED4AF] transition hover:bg-white/10"
      >
        <LogOut size={20} />
        Logout
      </button>
    </aside>
  )
}

export default Sidebar
