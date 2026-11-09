import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Spinner } from "./components/Feedback";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";
import AdminQueue from "./pages/AdminQueue";
import Home from "./pages/Home";
import IncidentDetail from "./pages/IncidentDetail";
import Incidents from "./pages/Incidents";
import Login from "./pages/Login";
import MyReports from "./pages/MyReports";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";
import Register from "./pages/Register";
import ReportIncident from "./pages/ReportIncident";

const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/incidents/:id" element={<IncidentDetail />} />
            <Route path="/report" element={<ProtectedRoute><ReportIncident /></ProtectedRoute>} />
            <Route path="/my-reports" element={<ProtectedRoute><MyReports /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute admin><AdminQueue /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute admin><Suspense fallback={<Spinner />}><AdminAnalytics /></Suspense></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
