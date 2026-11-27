
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';

import AdminLayout from './layouts/AdminLayout';

import Dashboard from './pages/admin/Dashboard';
import CreateSurvey from './pages/admin/CreateSurvey';
import ManageSurveys from './pages/admin/ManageSurveys';
import EditSurvey from './pages/admin/EditSurvey';
import ManageQuestions from './pages/admin/ManageQuestions';


function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Admin Dashboard */}
        <Route
          path="/admin/dashboard"
          element={
            <AdminLayout>
              <Dashboard />
            </AdminLayout>
          }
        />

        {/* Create Survey */}
        <Route
          path="/admin/surveys/create"
          element={
            <AdminLayout>
              <CreateSurvey />
            </AdminLayout>
          }
        />

        {/* Manage Surveys */}
        <Route
          path="/admin/surveys"
          element={
            <AdminLayout>
              <ManageSurveys />
            </AdminLayout>
          }
        />

        {/* Select a survey to manage its questions */}
        <Route
          path="/admin/questions"
          element={
            <AdminLayout>
              <ManageQuestions />
            </AdminLayout>
          }
        />

        {/* Manage questions for one survey */}
        <Route
          path="/admin/surveys/:id/questions"
          element={
            <AdminLayout>
              <ManageQuestions />
            </AdminLayout>
          }
        />

        {/* Edit Survey */}
        <Route
          path="/admin/surveys/:id/edit"
          element={
            <AdminLayout>
              <EditSurvey />
            </AdminLayout>
          }
        />

        {/* Default Route */}
        <Route
          path="*"
          element={<Navigate to="/admin/dashboard" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
