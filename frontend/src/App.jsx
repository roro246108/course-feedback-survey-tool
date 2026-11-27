
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import AnalyticsOverview from './pages/admin/AnalyticsOverview'
import SemesterComparison from './pages/admin/SemesterComparison'
import ExportReports from './pages/admin/ExportReports'
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/admin/dashboard"
          element={
            <AdminLayout>
              <Dashboard />
            </AdminLayout>
          }
        />
        <Route
  path="/admin/reports/semesters"
  element={
    <AdminLayout>
      <SemesterComparison />
    </AdminLayout>
  }
/>

        <Route
          path="/admin/reports"
          element={
            <AdminLayout>
              <AnalyticsOverview />
            </AdminLayout>
          }
        />

        <Route
          path="/admin/reports/export"
          element={
            <AdminLayout>
              <ExportReports />
            </AdminLayout>
          }
        />

        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
