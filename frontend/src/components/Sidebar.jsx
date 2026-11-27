
import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  BarChart3,
  Users,
  LogOut,
  ChevronDown,
  ClipboardList
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
    name: 'Courses',
    path: '/admin/courses',
    icon: BookOpen
  },
  {
    name: 'Instructors',
    path: '/admin/instructors',
    icon: GraduationCap
  },
  {
    name: 'Reports',
    path: '/admin/reports',
<<<<<<< Updated upstream
    icon: BarChart3
  },

=======
    icon: BarChart3,
    children: [
      { name: 'Analytics Overview', path: '/admin/reports' },
      {
        name: 'Semester Comparison',
        path: '/admin/reports/semesters'
      },
      {
        name: 'Export Reports',
        path: '/admin/reports/export'
      }
    ]
  },
>>>>>>> Stashed changes
  {
    name: 'Users',
    path: '/admin/users',
    icon: Users
  }
]

function Sidebar({
  items = navigation,
  showLogout = true,
  collapsibleItems = false
}) {
  const { logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [expandedItems, setExpandedItems] = useState(() => new Set(
    items
      .filter((item) => item.children?.some((child) => child.path === location.pathname))
      .map((item) => item.name)
  ))

  useEffect(() => {
    if (!collapsibleItems) return

    const activeItems = items
      .filter((item) => item.children?.some((child) => child.path === location.pathname))
      .map((item) => item.name)

    if (activeItems.length) {
      setExpandedItems((current) => new Set([...current, ...activeItems]))
    }
  }, [collapsibleItems, items, location.pathname])

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)

    try {
      await logout()
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      navigate('/login', { replace: true })
    }
  }

  function toggleItem(itemName) {
    setExpandedItems((current) => {
      const next = new Set(current)
      if (next.has(itemName)) {
        next.delete(itemName)
      } else {
        next.add(itemName)
      }
      return next
    })
  }

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

      {/* Navigation */}
      <nav className="flex-1 space-y-2 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon
          const isExpanded = expandedItems.has(item.name)
          const hasActiveChild = item.children?.some(
            (child) => child.path === location.pathname
          )
          const childrenId = `sidebar-${item.name.toLowerCase().replace(/\s+/g, '-')}-links`

          return (
            <div key={item.name}>
              {collapsibleItems && item.children ? (
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={childrenId}
                  onClick={() => toggleItem(item.name)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                    hasActiveChild
                      ? 'bg-[#A6B398] text-[#243D34] font-semibold'
                      : 'text-[#F4F7F6] hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={20} />
                    {item.name}
                  </span>
                  <ChevronDown
                    size={17}
                    className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              ) : (
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
              )}

              {item.children && (!collapsibleItems || isExpanded) && (
                <div className="ml-10 mt-2 space-y-1">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      end
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
      {showLogout && (
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#DED4AF] transition hover:bg-white/10 disabled:opacity-60"
        >
          <LogOut size={20} />
          {loggingOut ? 'Logging out…' : 'Logout'}
        </button>
      )}
    </aside>
  )
}

export default Sidebar
