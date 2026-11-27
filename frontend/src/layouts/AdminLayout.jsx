
import Sidebar from '../components/Sidebar'
import AdminNavbar from '../components/navbar_admin'

function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#F4F7F6]">

      <Sidebar />

      <div className="ml-[260px] min-h-screen">

        <AdminNavbar />

      <main className="w-full min-w-0 overflow-x-clip p-8">
          {children}
        </main>

      </div>
    </div>
  )
}

export default AdminLayout
