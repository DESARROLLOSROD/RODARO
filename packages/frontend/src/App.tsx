import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rondas from './pages/Rondas';
import RondaDetalle from './pages/RondaDetalle';
import Vigilantes from './pages/Vigilantes';
import Rutas from './pages/Rutas';
import Turnos from './pages/Turnos';
import Reportes from './pages/Reportes';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="rondas" element={<Rondas />} />
        <Route path="rondas/:id" element={<RondaDetalle />} />
        <Route path="vigilantes" element={<Vigilantes />} />
        <Route path="rutas" element={<Rutas />} />
        <Route path="turnos" element={<Turnos />} />
        <Route path="reportes" element={<Reportes />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
