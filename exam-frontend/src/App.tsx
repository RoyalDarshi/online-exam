import React from 'react';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { Auth } from './components/common/Auth';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user.role === undefined) {
    return <Auth />;
  }
  if (user.role === 'admin') {
    return <AdminDashboard />;
  }
  if (user.role === 'teacher') {
    return <TeacherDashboard />;
  }

  return <StudentDashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;