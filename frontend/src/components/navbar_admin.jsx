
import { Bell, ChevronDown } from 'lucide-react'

function AdminNavbar() {
  return (
  <header className="relative z-20 flex h-20 items-center justify-between border-b border-[#E5E8E3] bg-white px-8">

      {/* Welcome */}
      <div>
        <h2 className="text-lg font-semibold text-[#2B5748]">
          Welcome, Admin
        </h2>
        <p className="text-sm text-[#899187]">
          Course Feedback Survey Tool
        </p>
      </div>

      {/* Profile */}
      <div className="flex items-center gap-6">
        <button className="relative text-[#4B5545]">
          <Bell size={22} />
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#A6B398]" />
        </button>

        <button className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2B5748] font-semibold text-white">
            A
          </div>

          <span className="text-sm font-medium text-[#2B5748]">
            Admin
          </span>

          <ChevronDown size={17} className="text-[#4B5545]" />
        </button>
      </div>
    </header>
  )
}

export default AdminNavbar
