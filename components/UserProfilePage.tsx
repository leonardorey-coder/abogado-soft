// ============================================================================
// UserProfilePage — Perfil detallado de un usuario del despacho
// Muestra datos personales, rol, estado, despacho, permisos, asignaciones y bitácora
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getRoleLabel } from "../lib/constants";
import { UserAvatar } from "./UserAvatar";
import { getDocumentRoute } from "../lib/routes";

const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  phone?: string | null;
  officeName?: string | null;
  department?: string | null;
  position?: string | null;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
}

interface Assignment {
  id: string;
  status: string;
  createdAt: string;
  dueDate?: string | null;
  notes?: string | null;
  document?: { id: string; name: string; type: string } | null;
  assigner?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
}

interface ActivityLog {
  id: string;
  activity: string;
  description: string;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatTimeAgo(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Hace un momento";
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function getStatusStyle(status: string) {
  switch (status) {
    case "pendiente": return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700";
    case "visto": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700";
    case "editado": return "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700";
    case "completado": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700";
    case "rechazado": return "bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700";
    case "revisado": return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700";
    default: return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600";
  }
}

function statusLabel(s: string) {
  switch (s) {
    case "pendiente": return "Pendiente";
    case "visto": return "Visto";
    case "editado": return "Editado";
    case "completado": return "Completado";
    case "rechazado": return "Rechazado";
    case "revisado": return "Revisado";
    default: return s;
  }
}

function activityMeta(activity: string): { icon: string; bg: string; color: string } {
  const l = activity.toLowerCase();
  if (l.includes("login")) return { icon: "login", bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600 dark:text-purple-400" };
  if (l.includes("logout")) return { icon: "logout", bg: "bg-gray-100 dark:bg-gray-700", color: "text-gray-600 dark:text-gray-400" };
  if (l.includes("document") || l.includes("edit")) return { icon: "edit_document", bg: "bg-blue-100 dark:bg-blue-900/30", color: "text-blue-600 dark:text-blue-400" };
  if (l.includes("assign")) return { icon: "assignment", bg: "bg-indigo-100 dark:bg-indigo-900/30", color: "text-indigo-600 dark:text-indigo-400" };
  if (l.includes("user")) return { icon: "manage_accounts", bg: "bg-green-100 dark:bg-green-900/30", color: "text-green-600 dark:text-green-400" };
  if (l.includes("convenio")) return { icon: "handshake", bg: "bg-teal-100 dark:bg-teal-900/30", color: "text-teal-600 dark:text-teal-400" };
  return { icon: "history", bg: "bg-slate-100 dark:bg-slate-700", color: "text-slate-600 dark:text-slate-400" };
}

function translateActivity(activity: string): string {
  const map: Record<string, string> = {
    DOCUMENT_VIEWED: "Documento visto",
    DOCUMENT_CREATED: "Documento creado",
    DOCUMENT_UPDATED: "Documento actualizado",
    DOCUMENT_DELETED: "Documento eliminado",
    DOCUMENT_RESTORED: "Documento restaurado",
    DOCUMENT_ASSIGNED: "Documento asignado",
    DOCUMENT_SHARED: "Documento compartido",
    DOCUMENT_DOWNLOADED: "Documento descargado",
    DOCUMENT_EXPORTED: "Documento exportado",
    DOCUMENT_ARCHIVED: "Documento archivado",
    DOCUMENT_TRASHED: "Documento enviado a papelera",
    CONVENIO_CREATED: "Convenio creado",
    CONVENIO_UPDATED: "Convenio actualizado",
    CONVENIO_DELETED: "Convenio eliminado",
    CONVENIO_SIGNED: "Convenio firmado",
    COLLABORATION_STARTED: "Colaboración iniciada",
    COLLABORATION_ENDED: "Colaboración finalizada",
    USER_REGISTERED: "Usuario registrado",
    USER_UPDATED: "Usuario actualizado",
    USER_ACTIVATED: "Usuario activado",
    USER_DEACTIVATED: "Usuario desactivado",
    USER_ROLE_CHANGED: "Rol de usuario cambiado",
    USER_DELETED: "Usuario eliminado",
    GROUP_CREATED: "Grupo creado",
    GROUP_UPDATED: "Grupo actualizado",
    GROUP_DELETED: "Grupo eliminado",
    GROUP_MEMBER_ADDED: "Miembro añadido al grupo",
    GROUP_MEMBER_REMOVED: "Miembro eliminado del grupo",
    LOGIN: "Inicio de sesión",
    LOGOUT: "Cierre de sesión",
    PASSWORD_CHANGED: "Contraseña cambiada",
    ADMIN_ACCESS_GRANTED: "Acceso de administrador concedido",
    ADMIN_ACCESS_DENIED: "Acceso de administrador denegado",
    BACKUP_CREATED: "Copia de seguridad creada",
    BACKUP_RESTORED: "Copia de seguridad restaurada",
    SETTINGS_CHANGED: "Configuración cambiada",
    COMMENT_ADDED: "Comentario añadido",
    COMMENT_DELETED: "Comentario eliminado",
  };
  return map[activity] ?? activity.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

// ─── Component ───────────────────────────────────────────────────────────────

export const UserProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, user: currentUser } = useAuth();
  const isAdmin = (currentUser as any)?.role === "admin";
  const isSelf = currentUser?.id === id;

  const token = session?.access_token ?? "";
  const authHeader = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [user, setUser] = useState<UserProfile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"assignments" | "activity">("assignments");
  const [assignTab, setAssignTab] = useState<"recibidos" | "enviados">("recibidos");

  const fetchData = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      // Pasar userId para que el admin pueda ver datos de otro usuario
      const userIdParam = `userId=${id}`;
      const [userRes, receivedRes, sentRes, activityRes] = await Promise.all([
        fetch(`${API_URL}/users/${id}`, { headers: authHeader }),
        fetch(`${API_URL}/assignments?limit=100&sortOrder=desc&${userIdParam}`, { headers: authHeader }),
        fetch(`${API_URL}/assignments/sent?limit=100&sortOrder=desc&${userIdParam}`, { headers: authHeader }),
        fetch(`${API_URL}/activity?limit=50&sortOrder=desc&${userIdParam}`, { headers: authHeader }),
      ]);

      if (!userRes.ok) throw new Error("No se pudo cargar el perfil del usuario.");

      const userData: UserProfile = await userRes.json();
      const receivedData = receivedRes.ok ? await receivedRes.json() : { data: [] };
      const sentData = sentRes.ok ? await sentRes.json() : { data: [] };
      const activityData = activityRes.ok ? await activityRes.json() : { data: [] };

      setUser(userData);

      // El backend ya filtra por userId, solo tomamos todos
      const received = (receivedData.data ?? []) as Assignment[];
      const sent = (sentData.data ?? []) as Assignment[];

      // Merge con dirección
      const byId = new Map<string, Assignment & { _direction: "recibido" | "enviado" }>();
      received.forEach((a: Assignment) => byId.set(a.id, { ...a, _direction: "recibido" }));
      sent.forEach((a: Assignment) => {
        if (!byId.has(a.id)) byId.set(a.id, { ...a, _direction: "enviado" });
      });
      setAssignments(Array.from(byId.values()));

      // El backend ya filtra por userId
      setActivity(activityData.data ?? []);
    } catch (err: any) {
      setError(err.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="max-w-[960px] w-full mx-auto px-6 py-8 flex-1">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="flex gap-5 items-center">
            <div className="size-24 rounded-2xl bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-3 flex-1">
              <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
          </div>
          <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="max-w-[960px] w-full mx-auto px-6 py-8 flex-1 flex flex-col items-center justify-center gap-4 text-center">
        <span className="material-symbols-outlined text-5xl text-red-400">person_off</span>
        <h2 className="text-xl font-bold text-[#111318] dark:text-white">No se pudo cargar el perfil</h2>
        <p className="text-[#616f89] dark:text-[#a0aec0]">{error ?? "Usuario no encontrado."}</p>
        <button onClick={() => navigate("/equipo")} className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
          <span className="material-symbols-outlined text-base">arrow_back</span>Volver al equipo
        </button>
      </main>
    );
  }

  const receivedAssignments = assignments.filter((a: any) => a._direction === "recibido");
  const sentAssignments = assignments.filter((a: any) => a._direction === "enviado");
  const currentAssignments = assignTab === "recibidos" ? receivedAssignments : sentAssignments;

  const statsCards = [
    {
      label: "Asignaciones recibidas",
      value: receivedAssignments.length,
      icon: "inbox",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Asignaciones enviadas",
      value: sentAssignments.length,
      icon: "outbox",
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
      color: "text-indigo-600 dark:text-indigo-400",
    },
    {
      label: "Completadas",
      value: assignments.filter((a: any) => a.status === "completado").length,
      icon: "check_circle",
      bg: "bg-green-50 dark:bg-green-900/20",
      color: "text-green-600 dark:text-green-400",
    },
    {
      label: "Acciones registradas",
      value: activity.length,
      icon: "manage_history",
      bg: "bg-purple-50 dark:bg-purple-900/20",
      color: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <main className="max-w-[960px] w-full mx-auto px-6 py-8 flex-1 space-y-8">

      {/* Breadcrumb */}
      <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">
        <Link to="/" className="hover:text-primary transition-colors">Inicio</Link>
        <span>/</span>
        <Link to="/equipo" className="hover:text-primary transition-colors">Mi Equipo</Link>
        <span>/</span>
        <span className="text-[#111318] dark:text-white">{user.name}</span>
      </nav>

      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1a212f] rounded-2xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm overflow-hidden">

        {/* Gradient header strip */}
        <div className="h-24 bg-gradient-to-br from-primary/10 via-blue-100/40 to-indigo-100/30 dark:from-primary/20 dark:via-blue-900/20 dark:to-indigo-900/10" />

        <div className="px-6 pb-6">
          {/* Avatar & Header Info */}
          <div className="relative -mt-12 flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="size-[96px] rounded-3xl border-4 border-white dark:border-[#1a212f] bg-white dark:bg-[#1a212f] shadow-sm overflow-hidden flex-shrink-0">
                <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="size-full object-cover" />
              </div>
              
              {/* Name & Meta (Mobile Centered) */}
              <div className="text-center md:text-left">
                <h1 className="text-2xl font-black text-[#111318] dark:text-white leading-none">{user.name}</h1>
                <p className="text-[#616f89] dark:text-[#a0aec0] text-sm mt-1.5">{user.email}</p>
                {user.position && (
                  <p className="text-sm text-[#616f89] dark:text-[#a0aec0] mt-1.5 flex items-center justify-center md:justify-start gap-1.5 font-medium">
                    <span className="material-symbols-outlined text-[16px]">work</span>
                    {user.position}{user.department ? ` · ${user.department}` : ""}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-end md:justify-end gap-3 w-full md:w-auto mt-2 md:mt-0">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center justify-center w-full md:w-auto gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#616f89] dark:text-[#a0aec0] bg-slate-50 dark:bg-slate-800/60 border border-[#dbdfe6] dark:border-[#2d3748] hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary transition-colors flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Atrás
              </button>
              
              <span className={`inline-flex items-center justify-center w-full md:w-auto gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border ${
                user.isActive
                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                  : "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
              }`}>
                <span className={`size-1.5 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-500"}`} />
                {user.isActive ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>

          <div className="h-px w-full bg-[#dbdfe6] dark:bg-[#2d3748] my-7" />

          {/* Details grid (2 cols mobile, 3 tablet) */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
            {[
              { icon: "shield_person", label: "Rol", value: getRoleLabel(user.role), highlight: true },
              { icon: "domain", label: "Despacho / Oficina", value: user.officeName || "—" },
              { icon: "call", label: "Teléfono", value: user.phone || "—" },
              { icon: "login", label: "Último acceso", value: user.lastLogin ? formatTimeAgo(user.lastLogin) : "Nunca" },
              { icon: "calendar_today", label: "Miembro desde", value: formatDate(user.createdAt) },
              { icon: isSelf ? "person" : "badge", label: isSelf ? "Tú" : (isAdmin ? "Editable" : "Solo lectura"), value: isSelf ? "Tu perfil" : (isAdmin ? "Admin" : "Miembro") },
            ].map(({ icon, label, value, highlight }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className={`material-symbols-outlined text-[16px] ${highlight ? "text-primary" : "text-[#616f89] dark:text-[#64748b]"}`}>{icon}</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#616f89] dark:text-[#64748b]">{label}</p>
                </div>
                <p className={`text-sm font-semibold truncate ${highlight ? "text-primary" : "text-[#111318] dark:text-white"}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 p-5 rounded-2xl border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] shadow-sm">
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
              <p className="text-xs font-bold text-[#616f89] dark:text-[#a0aec0] uppercase tracking-wide truncate">{s.label}</p>
            </div>
            <p className="text-3xl font-black text-[#111318] dark:text-white mt-1.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tab switcher ──────────────────────────────────────────────────── */}
      <div className="flex p-1 bg-slate-100 dark:bg-[#101622] rounded-2xl w-full md:w-fit">
        {(["assignments", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === t
                ? "bg-white dark:bg-[#1a212f] text-primary shadow-sm"
                : "text-[#616f89] dark:text-[#a0aec0] hover:text-[#111318] hover:dark:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {t === "assignments" ? "assignment" : "manage_history"}
            </span>
            {t === "assignments" ? "Documentos Asignados" : "Bitácora"}
          </button>
        ))}
      </div>

      {/* ── Assignments Tab ────────────────────────────────────────────────── */}
      {activeTab === "assignments" && (
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-[#111318] dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">feed</span>
              Asignaciones
            </h2>
            {/* Sub-tabs recibidos / enviados */}
            <div className="flex p-1 bg-slate-100 dark:bg-[#101622] rounded-xl w-full md:w-fit">
              {(["recibidos", "enviados"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setAssignTab(t)}
                  className={`flex-1 md:flex-none whitespace-nowrap px-5 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                    assignTab === t
                      ? "bg-white dark:bg-[#1a212f] text-primary shadow-sm"
                      : "text-[#616f89] dark:text-[#a0aec0] hover:text-[#111318] hover:dark:text-white"
                  }`}
                >
                  {t} ({t === "recibidos" ? receivedAssignments.length : sentAssignments.length})
                </button>
              ))}
            </div>
          </div>

          {currentAssignments.length === 0 ? (
            <div className="bg-white dark:bg-[#1a212f] rounded-2xl border border-dashed border-[#dbdfe6] dark:border-[#2d3748] p-10 text-center">
              <span className="material-symbols-outlined text-4xl text-[#616f89] dark:text-[#a0aec0] block mb-2">folder_off</span>
              <p className="text-[#616f89] dark:text-[#a0aec0] font-medium">Sin asignaciones {assignTab}.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1a212f] rounded-2xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-[#dbdfe6] dark:border-[#2d3748] bg-[#f8fafb] dark:bg-[#141921]">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Documento</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider hidden md:table-cell">
                        {assignTab === "recibidos" ? "De" : "Para"}
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Estado</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider hidden lg:table-cell">Fecha</th>
                    </tr>
                </thead>
                <tbody>
                  {currentAssignments.map((a: any) => {
                    const docRoute = a.document?.id
                      ? getDocumentRoute(a.document.id, a.document.type)
                      : null;
                    const counterpart = assignTab === "recibidos" ? a.assigner : a.assignee;
                    return (
                      <tr
                        key={a.id}
                        onClick={() => docRoute && navigate(docRoute)}
                        className={`border-b border-[#dbdfe6] dark:border-[#2d3748] last:border-0 transition-colors ${
                          docRoute
                            ? "cursor-pointer hover:bg-[#f0f4ff] dark:hover:bg-[#1e2a3a]"
                            : ""
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center border border-blue-100 dark:border-blue-800 flex-shrink-0">
                              <span className="material-symbols-outlined text-base text-blue-600 dark:text-blue-400">description</span>
                            </div>
                            <p className="font-semibold text-[#111318] dark:text-white truncate max-w-[180px]">
                              {a.document?.name || "Documento"}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell text-[#616f89] dark:text-[#a0aec0] text-xs">
                          {counterpart?.name || "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusStyle(a.status)}`}>
                            {statusLabel(a.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-[#616f89] dark:text-[#a0aec0]">
                          {formatTimeAgo(a.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Activity / Bitácora Tab ────────────────────────────────────────── */}
      {activeTab === "activity" && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#111318] dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">manage_history</span>
            Historial de actividad
            <span className="ml-1 text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">
              ({activity.length} registros)
            </span>
          </h2>

          {activity.length === 0 ? (
            <div className="bg-white dark:bg-[#1a212f] rounded-2xl border border-dashed border-[#dbdfe6] dark:border-[#2d3748] p-10 text-center">
              <span className="material-symbols-outlined text-4xl text-[#616f89] dark:text-[#a0aec0] block mb-2">history_toggle_off</span>
              <p className="text-[#616f89] dark:text-[#a0aec0] font-medium">Sin registros de actividad.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((log) => {
                const { icon, bg, color } = activityMeta(log.activity);
                const entityLink =
                  log.entityId && log.entityType === "document" ? `/documento/${log.entityId}` :
                  log.entityId && log.entityType === "convenio" ? `/convenio/${log.entityId}` :
                  null;
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 bg-white dark:bg-[#1a212f] p-4 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm"
                  >
                    <div className={`size-9 ${bg} ${color} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <span className="material-symbols-outlined text-base">{icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#111318] dark:text-white text-sm">
                        {translateActivity(log.activity)}
                      </p>
                      {log.description && (
                        <p className="text-xs text-[#616f89] dark:text-[#a0aec0] mt-0.5">{log.description}</p>
                      )}
                      {log.entityName && (
                        <div className="mt-1">
                          {entityLink ? (
                            <button
                              onClick={() => navigate(entityLink)}
                              className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                              {log.entityName}
                            </button>
                          ) : (
                            <span className="text-xs italic text-[#616f89] dark:text-[#a0aec0]">{log.entityName}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-[#616f89] dark:text-[#a0aec0] flex-shrink-0 mt-0.5">
                      {formatTimeAgo(log.createdAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
};
