// ============================================================================
// TeamPage — Mi Equipo con CRUD completo de usuarios del despacho
// Permite crear, editar, cambiar rol, activar/desactivar y eliminar usuarios
// ============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { ViewState } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { getRoleLabel } from "../lib/constants";
import UserFormModal, { UserFormData } from "./UserFormModal";

const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000/api";

interface TeamUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "asistente";
  avatarUrl?: string | null;
  officeName?: string | null;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
}

interface ActivityItem {
  id: string;
  activity: string;
  description: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string | null };
}

interface TeamPageProps {
  onNavigate: (view: ViewState) => void;
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Hace un momento";
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function activityIcon(activity: string): { icon: string; bg: string; color: string } {
  const lower = activity.toLowerCase();
  if (lower.includes("edit") || lower.includes("document")) return { icon: "edit_document", bg: "bg-green-100 dark:bg-green-900/30", color: "text-green-600 dark:text-green-400" };
  if (lower.includes("user")) return { icon: "person", bg: "bg-blue-100 dark:bg-blue-900/30", color: "text-blue-600 dark:text-blue-400" };
  if (lower.includes("login") || lower.includes("logout")) return { icon: "login", bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600 dark:text-purple-400" };
  return { icon: "history", bg: "bg-gray-100 dark:bg-gray-700", color: "text-gray-600 dark:text-gray-400" };
}

export const TeamPage: React.FC<TeamPageProps> = ({ onNavigate }) => {
  const { session, user: currentUser } = useAuth();
  const isAdmin = (currentUser as any)?.role === "admin";

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // CRUD state
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<TeamUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const token = session?.access_token ?? "";

  const authHeader = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const loadData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: "1", limit: "50" });
    if (searchQuery) params.set("search", searchQuery);
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("isActive", statusFilter);

    Promise.all([
      fetch(`${API_URL}/users?${params}`, { headers: authHeader }).then((r) => r.ok ? r.json() : { data: [] }),
      fetch(`${API_URL}/activity?page=1&limit=8&sortOrder=desc`, { headers: authHeader }).then((r) => r.ok ? r.json() : { data: [] }),
    ])
      .then(([usersRes, activityRes]) => {
        setUsers(usersRes.data ?? []);
        setActivity(activityRes.data ?? []);
      })
      .catch(() => setError("No se pudo cargar el equipo."))
      .finally(() => setLoading(false));
  }, [token, searchQuery, roleFilter, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleChangeRole = async (u: TeamUser) => {
    const newRole = u.role === "admin" ? "asistente" : "admin";
    setActionLoading(`role-${u.id}`);
    try {
      const res = await fetch(`${API_URL}/users/${u.id}/role`, {
        method: "PATCH", headers: authHeader, body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      setUsers((prev) => prev.map((p) => p.id === u.id ? { ...p, role: newRole } : p));
      showSuccess(`Rol de ${u.name} cambiado a ${getRoleLabel(newRole)}`);
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const handleToggleStatus = async (u: TeamUser) => {
    const newStatus = !u.isActive;
    setActionLoading(`status-${u.id}`);
    try {
      const res = await fetch(`${API_URL}/users/${u.id}/status`, {
        method: "PATCH", headers: authHeader, body: JSON.stringify({ isActive: newStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      setUsers((prev) => prev.map((p) => p.id === u.id ? { ...p, isActive: newStatus } : p));
      showSuccess(`${u.name} ${newStatus ? "reactivado" : "desactivado"}`);
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (u: TeamUser) => {
    setActionLoading(`delete-${u.id}`);
    setConfirmDeleteUser(null);
    try {
      const res = await fetch(`${API_URL}/users/${u.id}`, {
        method: "DELETE", headers: authHeader,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      setUsers((prev) => prev.map((p) => p.id === u.id ? { ...p, isActive: false } : p));
      showSuccess(`${u.name} eliminado del equipo.`);
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(null); }
  };

  const activeUsers = users.filter((u) => u.isActive);
  const inactiveUsers = users.filter((u) => !u.isActive);

  if (loading) {
    return (
      <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1">
        <div className="flex items-center justify-center py-20">
          <p className="text-[#616f89] dark:text-[#a0aec0]">Cargando equipo…</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
        {/* Breadcrumb */}
        <div className="flex flex-wrap gap-2 py-2">
          <button type="button" className="text-[#616f89] dark:text-gray-400 text-sm font-medium hover:text-primary cursor-pointer" onClick={() => onNavigate(ViewState.DASHBOARD)}>
            Inicio
          </button>
          <span className="text-[#616f89] dark:text-gray-600 text-sm font-medium">/</span>
          <span className="text-[#111318] dark:text-white text-sm font-medium">Mi Equipo</span>
        </div>

        {/* Title + Actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight dark:text-white">Mi Equipo</h2>
            <p className="text-[#616f89] dark:text-[#a0aec0] text-base mt-1">
              Gestione los usuarios y permisos de su despacho — {activeUsers.length} activos
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 rounded-lg h-10 px-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold shadow-sm hover:border-primary hover:text-primary transition-all"
              >
                <span className="material-symbols-outlined text-lg">content_copy</span>
                ID del Despacho
              </button>
              <button
                type="button"
                onClick={() => { setEditingUser(null); setModalMode("create"); }}
                className="flex items-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-md hover:bg-blue-700 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                Agregar Usuario
              </button>
            </div>
          )}
        </div>

        {/* Success / Error */}
        {successMsg && (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 text-sm">
            ✓ {successMsg}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 text-sm flex justify-between">
            {error}
            <button onClick={() => setError(null)} className="font-bold">✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 320 }}>
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-base">search</span>
            <input
              type="text"
              placeholder="Buscar usuario…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] text-sm text-[#111318] dark:text-white focus:outline-none focus:border-primary"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] text-sm text-[#111318] dark:text-white px-3 py-2 focus:outline-none"
          >
            <option value="">Todos los roles</option>
            <option value="admin">Administrador</option>
            <option value="asistente">Asistente</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] text-sm text-[#111318] dark:text-white px-3 py-2 focus:outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-[#1a212f] rounded-2xl border border-[#dbdfe6] dark:border-[#2d3748] overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#dbdfe6] dark:border-[#2d3748] bg-[#f8fafb] dark:bg-[#141921]">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Usuario</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider hidden md:table-cell">Cargo</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Rol</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider hidden lg:table-cell">Último acceso</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Estado</th>
                {isAdmin && <th className="px-5 py-3 text-right text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-[#616f89] dark:text-[#64748b]">No se encontraron usuarios.</td></tr>
              )}
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-[#dbdfe6] dark:border-[#2d3748] transition-colors hover:bg-[#f8fafb] dark:hover:bg-[#141921] ${!u.isActive ? "opacity-50" : ""}`}
                >
                  {/* Avatar + name */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center border border-primary/20 overflow-hidden">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt={u.name} className="size-full object-cover" />
                        ) : (
                          <span className="text-primary text-sm font-bold">{(u.name || "?").charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[#111318] dark:text-white truncate">{u.name}</p>
                        <p className="text-xs text-[#616f89] dark:text-[#64748b] truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Cargo */}
                  <td className="px-5 py-4 hidden md:table-cell">
                    <div className="min-w-0">
                      <p className="text-[#111318] dark:text-white truncate">{u.position || "—"}</p>
                      {u.department && <p className="text-xs text-[#616f89] dark:text-[#64748b] truncate">{u.department}</p>}
                    </div>
                  </td>

                  {/* Rol */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.role === "admin" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                      {getRoleLabel(u.role)}
                    </span>
                  </td>

                  {/* Último login */}
                  <td className="px-5 py-4 hidden lg:table-cell text-[#616f89] dark:text-[#64748b] text-xs">
                    {u.lastLogin ? formatTimeAgo(u.lastLogin) : "Nunca"}
                  </td>

                  {/* Estado */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.isActive ? "text-green-600 dark:text-green-400" : "text-[#616f89] dark:text-[#64748b]"}`}>
                      <span className={`size-1.5 rounded-full ${u.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                      {u.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>

                  {/* Acciones (solo admin) */}
                  {isAdmin && (
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* Editar */}
                        <button
                          title="Editar"
                          onClick={() => { setEditingUser(u); setModalMode("edit"); }}
                          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[#616f89] dark:text-[#64748b] hover:text-blue-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>

                        {/* Cambiar rol */}
                        <button
                          title={`Cambiar a ${u.role === "admin" ? "Asistente" : "Administrador"}`}
                          disabled={actionLoading === `role-${u.id}`}
                          onClick={() => handleChangeRole(u)}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-[#616f89] dark:text-[#64748b] hover:text-indigo-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">swap_horiz</span>
                        </button>

                        {/* Activar/Desactivar */}
                        <button
                          title={u.isActive ? "Desactivar" : "Activar"}
                          disabled={actionLoading === `status-${u.id}`}
                          onClick={() => handleToggleStatus(u)}
                          className={`p-1.5 rounded-lg transition-colors ${u.isActive ? "hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600" : "hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600"} text-[#616f89] dark:text-[#64748b]`}
                        >
                          <span className="material-symbols-outlined text-base">{u.isActive ? "person_off" : "person_check"}</span>
                        </button>

                        {/* Eliminar */}
                        <button
                          title="Eliminar"
                          disabled={actionLoading === `delete-${u.id}`}
                          onClick={() => setConfirmDeleteUser(u)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[#616f89] dark:text-[#64748b] hover:text-red-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">person_remove</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total usuarios", value: users.length, icon: "group" },
            { label: "Activos", value: activeUsers.length, icon: "check_circle" },
            { label: "Administradores", value: users.filter((u) => u.role === "admin").length, icon: "shield_person" },
            { label: "Inactivos", value: inactiveUsers.length, icon: "cancel" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">{s.icon}</span>
              <div>
                <p className="text-2xl font-black text-[#111318] dark:text-white">{s.value}</p>
                <p className="text-xs text-[#616f89] dark:text-[#64748b]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Asignados Summary Section */}
        <section className="mt-12 mb-8">
          <div className="flex flex-col gap-2 border-b border-[#dbdfe6] dark:border-[#2d3748] pb-4 mb-6">
            <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">assignment</span>
              Asignados recientes
            </h3>
            <button type="button" onClick={() => onNavigate(ViewState.ASIGNED)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#616f89] dark:text-[#a0aec0] bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary dark:hover:text-primary transition-colors w-fit group">
              Ir al panel completo
              <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-0.5">arrow_forward</span>
            </button>
          </div>

          <div className="flex gap-4 flex-wrap overflow-x-auto pb-2">
            {[
              { label: 'Todos', count: 0, icon: 'check_circle', colorClass: 'bg-white text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
              { label: 'Pendientes', count: 0, icon: 'pending', colorClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/50' },
              { label: 'Aceptados', count: 0, icon: 'visibility', colorClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50' },
              { label: 'Completados', count: 0, icon: 'verified', colorClass: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50' },
              { label: 'Rechazados', count: 0, icon: 'cancel', colorClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50' },
              { label: 'Compartidos', count: 0, icon: 'share', colorClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/50' }
            ].map((st) => (
              <div
                key={st.label}
                className={`flex items-center gap-2 rounded-full px-5 py-2 font-bold shadow-sm whitespace-nowrap border-2 ${st.colorClass}`}
              >
                <span className="material-symbols-outlined text-[20px]">{st.icon}</span>
                {st.label} ({st.count})
              </div>
            ))}
          </div>

          <div className="mt-6 bg-[#f8fafb] dark:bg-[#141921] rounded-2xl p-8 text-center border-2 border-dashed border-[#dbdfe6] dark:border-[#2d3748]">
            <div className="w-16 h-16 bg-white dark:bg-[#1a212f] rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100 dark:border-slate-800">
              <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600">inbox</span>
            </div>
            <p className="text-[#616f89] dark:text-[#64748b] text-base font-medium max-w-sm mx-auto">
              No hay documentos asignados o compartidos que requieran tu atención en este momento.
            </p>
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <div className="flex flex-col gap-2 border-b border-[#dbdfe6] dark:border-[#2d3748] pb-4 mb-6 mt-8">
            <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              Actividad Reciente
            </h3>
            <button type="button" onClick={() => onNavigate(ViewState.ACTIVITY_LOG)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#616f89] dark:text-[#a0aec0] bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary dark:hover:text-primary transition-colors w-fit group">
              Ver todo el historial
              <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-0.5">arrow_forward</span>
            </button>
          </div>
          <div className="space-y-3">
            {activity.length === 0 ? (
              <p className="text-[#616f89] dark:text-[#a0aec0] py-4">No hay actividad reciente.</p>
            ) : (
              activity.map((item) => {
                const { icon, bg, color } = activityIcon(item.activity);
                return (
                  <div key={item.id} className="flex items-center gap-4 bg-white dark:bg-[#1a212f] p-4 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
                    <div className={`size-9 ${bg} ${color} rounded-full flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined text-base">{icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#111318] dark:text-white text-sm truncate">
                        <strong>{item.user?.name ?? "Sistema"}</strong> {item.description}
                      </p>
                    </div>
                    <p className="text-xs text-[#616f89] dark:text-[#a0aec0] shrink-0">{formatTimeAgo(item.createdAt)}</p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* Create/Edit User Modal */}
      {modalMode && (
        <UserFormModal
          mode={modalMode}
          initialData={editingUser ? { id: editingUser.id, name: editingUser.name, email: editingUser.email, role: editingUser.role, officeName: editingUser.officeName ?? "", department: editingUser.department ?? "", position: editingUser.position ?? "", phone: editingUser.phone ?? "" } : undefined}
          onClose={() => { setModalMode(null); setEditingUser(null); }}
          onSuccess={() => {
            setModalMode(null);
            setEditingUser(null);
            showSuccess(modalMode === "create" ? "Usuario creado exitosamente." : "Usuario actualizado.");
            loadData();
          }}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setConfirmDeleteUser(null)}
        >
          <div className="bg-white dark:bg-[#1a212f] w-full max-w-sm rounded-2xl shadow-xl border border-[#dbdfe6] dark:border-[#2d3748] p-6">
            <div className="text-center mb-5">
              <div className="size-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-2xl">person_remove</span>
              </div>
              <h3 className="text-lg font-bold text-[#111318] dark:text-white">¿Eliminar usuario?</h3>
              <p className="text-sm text-[#616f89] dark:text-[#64748b] mt-2">
                <strong>{confirmDeleteUser.name}</strong> será desactivado y no podrá iniciar sesión. Sus documentos y registros históricos se conservan.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteUser(null)}
                className="flex-1 px-4 py-2 border border-[#dbdfe6] dark:border-[#2d3748] rounded-lg text-sm font-medium text-[#616f89] dark:text-[#a0aec0] hover:bg-[#f8fafb] dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteUser)}
                className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-sm font-bold text-white hover:bg-red-700"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && currentUser && (currentUser as any).groupMemberships?.[0] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowInviteModal(false)}
        >
          <div className="bg-white dark:bg-[#1a212f] w-full max-w-md rounded-2xl shadow-xl border border-[#dbdfe6] dark:border-[#2d3748] overflow-hidden">
            <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748] flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#111318] dark:text-white">
                  Invitar al Despacho
                </h3>
                <p className="text-sm text-[#616f89] dark:text-[#a0aec0] mt-1">
                  Comparta el ID único de grupo para nuevos miembros.
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-[#616f89] dark:text-[#a0aec0] hover:text-[#111318] dark:hover:text-white transition-colors"
                title="Cerrar"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">ID del grupo</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={(currentUser as any).groupMemberships[0].groupId}
                    className="flex-1 min-w-0 rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText((currentUser as any).groupMemberships[0].groupId);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg px-4 py-2 bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {copied ? "check" : "content_copy"}
                    </span>
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
              <p className="text-[#616f89] dark:text-[#a0aec0] text-xs">
                Ellos deberán ingresar este ID al momento de registrarse en la plataforma para poder ver los documentos de este entorno.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-[#dbdfe6] dark:border-[#2d3748] flex justify-end">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-sm font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
