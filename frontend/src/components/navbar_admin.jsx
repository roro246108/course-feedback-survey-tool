
import { Search, Bell, ChevronDown } from 'lucide-react'

function AdminNavbar() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-[#E5E8E3] bg-white px-8">

      {/* Welcome */}
      <div>
        <h2 className="text-lg font-semibold text-[#2B5748]">
          Welcome, Admin
        </h2>
        <p className="text-sm text-[#899187]">
          Course Feedback Survey Tool
        </p>
      </div>

      {/* Search */}
      <div className="flex w-[400px] items-center gap-3 rounded-full border border-[#E5E8E3] bg-[#F4F7F6] px-4 py-3">
        <Search size={19} className="text-[#4B5545]" />
        <input
          type="text"
          placeholder="Search for surveys, courses, or instructors..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
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
