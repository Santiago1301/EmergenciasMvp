import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./hooks/useSession";
import { CitizenReport } from "./pages/CitizenReport";
import { CitizenTracking } from "./pages/CitizenTracking";
import { OperatorDashboard } from "./pages/OperatorDashboard";
import { OperatorLogin } from "./pages/OperatorLogin";

function RequireOperator({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) return null;
  if (!session) return <Navigate to="/operador/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CitizenReport />} />
      <Route path="/seguimiento/:reportId" element={<CitizenTracking />} />
      <Route path="/operador/login" element={<OperatorLogin />} />
      <Route
        path="/operador"
        element={
          <RequireOperator>
            <OperatorDashboard />
          </RequireOperator>
        }
      />
    </Routes>
  );
}
