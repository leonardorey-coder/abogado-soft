import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { GuestRoute } from "./components/GuestRoute";
import { AppLayout } from "./components/AppLayout";

// Pages (lazy-loaded for code splitting)
const LoginPage = lazy(() => import("./components/LoginPage").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./components/RegisterPage").then(m => ({ default: m.RegisterPage })));
const CompleteProfilePage = lazy(() => import("./components/CompleteProfilePage").then(m => ({ default: m.CompleteProfilePage })));
const Dashboard = lazy(() => import("./components/Dashboard").then(m => ({ default: m.Dashboard })));
const DocumentsList = lazy(() => import("./components/DocumentsList").then(m => ({ default: m.DocumentsList })));
const AssignedList = lazy(() => import("./components/AssignedList").then(m => ({ default: m.AssignedList })));
const AgreementsList = lazy(() => import("./components/AgreementsList").then(m => ({ default: m.AgreementsList })));
const TeamPage = lazy(() => import("./components/TeamPage").then(m => ({ default: m.TeamPage })));
const DocumentEditor = lazy(() => import("./components/DocumentEditor").then(m => ({ default: m.DocumentEditor })));
const ExcelEditor = lazy(() => import("./components/ExcelEditor").then(m => ({ default: m.ExcelEditor })));
const ActivityLog = lazy(() => import("./components/ActivityLog").then(m => ({ default: m.ActivityLog })));
const SecurityPage = lazy(() => import("./components/SecurityPage").then(m => ({ default: m.SecurityPage })));
const TrashPage = lazy(() => import("./components/TrashPage").then(m => ({ default: m.TrashPage })));
const TermsPage = lazy(() => import("./components/TermsPage").then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import("./components/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const SecurityInfoPage = lazy(() => import("./components/SecurityInfoPage").then(m => ({ default: m.SecurityInfoPage })));
const HealthCheck = lazy(() => import("./components/HealthCheck").then(m => ({ default: m.HealthCheck })));

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Rutas públicas (solo para usuarios no autenticados) */}
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/registro" element={<RegisterPage />} />
            </Route>

            {/* Completar perfil (protegida, sin layout principal) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/completar-perfil" element={<CompleteProfilePage />} />
            </Route>

            {/* Rutas protegidas con layout completo (header + footer) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="/documentos" element={<DocumentsList />} />
                <Route path="/asignados" element={<AssignedList />} />
                <Route path="/convenios" element={<AgreementsList />} />
                <Route path="/equipo" element={<TeamPage />} />
                <Route path="/documento/:id" element={<DocumentEditor />} />
                <Route path="/documento/:id/excel" element={<ExcelEditor />} />
                <Route path="/actividad" element={<ActivityLog />} />
                <Route path="/seguridad" element={<SecurityPage />} />
                <Route path="/papelera" element={<TrashPage />} />
                <Route path="/terminos" element={<TermsPage />} />
                <Route path="/privacidad" element={<PrivacyPage />} />
                <Route path="/informacion-seguridad" element={<SecurityInfoPage />} />
                <Route path="/health" element={<HealthCheck />} />
              </Route>
            </Route>

            {/* Catch-all: redirige al inicio (el guard maneja si hay sesión o no) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
