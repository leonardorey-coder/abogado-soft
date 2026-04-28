// ============================================================================
// TeamPage — Mi Equipo con CRUD completo de usuarios del despacho
// Permite crear, editar, cambiar rol, activar/desactivar y eliminar usuarios
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getRoleLabel } from "../lib/constants";
import { UserAvatar } from "./UserAvatar";
import { getViewerLabel } from "../lib/viewerIdentity";
import type { ApiActivityLog } from "../lib/api";
import { BitacoraEntryItem } from "./BitacoraEntryItem";

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

interface GroupInfo {
  id: string;
  name: string;
  description?: string | null;
  inviteCode?: string | null;
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

export const TeamPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, user: currentUser } = useAuth();
  const isAdmin = (currentUser as any)?.role === "admin";

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [activity, setActivity] = useState<ApiActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [assignments, setAssignments] = useState<any[]>([]);

  // CRUD state
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<TeamUser | null>(null);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false);
  const [officeConfigOpen, setOfficeConfigOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupInfo | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState("");
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);
  const [confirmDeleteGroupSecondsLeft, setConfirmDeleteGroupSecondsLeft] = useState(0);
  const deleteGroupTimerRef = useRef<number | null>(null);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      fetch(`${API_URL}/assignments?page=1&limit=10&sortOrder=desc`, { headers: authHeader }).then((r) => r.ok ? r.json() : { data: [] }),
      fetch(`${API_URL}/assignments/sent?page=1&limit=10&sortOrder=desc`, { headers: authHeader }).then((r) => r.ok ? r.json() : { data: [] }),
    ])
      .then(([usersRes, activityRes, receivedRes, sentRes]) => {
        setUsers(usersRes.data ?? []);
        setActivity(activityRes.data ?? []);
        // Combine received and sent, deduplicate by id
        const all = [...(receivedRes.data ?? []), ...(sentRes.data ?? [])];
        const seen = new Set<string>();
        const unique = all.filter((a: any) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });
        setAssignments(unique);
      })
      .catch(() => setError("No se pudo cargar el equipo."))
      .finally(() => setLoading(false));
  }, [token, searchQuery, roleFilter, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const openAddCollaborator = () => {
    setAddCollaboratorOpen(true);
    setGroups([]);
    setGroupsLoading(true);
    if (!token) return;
    fetch(`${API_URL}/groups?page=1&limit=10`, {
      headers: authHeader,
    })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => setGroups(res.data ?? []))
      .finally(() => setGroupsLoading(false));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const resetGroupDeleteConfirm = () => {
    if (deleteGroupTimerRef.current) {
      window.clearInterval(deleteGroupTimerRef.current);
      deleteGroupTimerRef.current = null;
    }
    setConfirmDeleteGroupId(null);
    setConfirmDeleteGroupSecondsLeft(0);
  };

  const openOfficeConfig = async () => {
    setOfficeConfigOpen(true);
    setGroupActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/groups?page=1&limit=10`, {
        headers: authHeader,
      });
      const payload = res.ok ? await res.json() : { data: [] };
      const firstGroup = (payload.data?.[0] ?? null) as GroupInfo | null;
      setSelectedGroup(firstGroup);
      setGroupNameDraft(firstGroup?.name ?? "");
      setGroupDescriptionDraft(firstGroup?.description ?? "");
      resetGroupDeleteConfirm();
    } catch {
      setSelectedGroup(null);
      setGroupNameDraft("");
      setGroupDescriptionDraft("");
      setError("No se pudo cargar la configuración del despacho.");
    } finally {
      setGroupActionLoading(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!selectedGroup) return;
    const trimmedName = groupNameDraft.trim();
    if (!trimmedName) {
      setError("El nombre del despacho es obligatorio.");
      return;
    }
    setGroupActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/groups/${selectedGroup.id}`, {
        method: "PATCH",
        headers: authHeader,
        body: JSON.stringify({
          name: trimmedName,
          description: groupDescriptionDraft.trim() || null,
        }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "No se pudo actualizar el despacho.");
      }
      const updated = await res.json();
      setSelectedGroup(updated);
      setGroupNameDraft(updated.name ?? "");
      setGroupDescriptionDraft(updated.description ?? "");
      showSuccess("Despacho actualizado correctamente.");
      setOfficeConfigOpen(false);
      loadData();
    } catch (e: any) {
      setError(e.message ?? "No se pudo actualizar el despacho.");
    } finally {
      setGroupActionLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    if (confirmDeleteGroupId === selectedGroup.id) {
      if (confirmDeleteGroupSecondsLeft > 0) return;
      setGroupActionLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/groups/${selectedGroup.id}`, {
          method: "DELETE",
          headers: authHeader,
        });
        if (!res.ok) {
          throw new Error((await res.json()).error ?? "No se pudo eliminar el despacho.");
        }
        resetGroupDeleteConfirm();
        setOfficeConfigOpen(false);
        showSuccess("Despacho eliminado. Configure uno nuevo para continuar.");
        navigate("/completar-perfil");
      } catch (e: any) {
        setError(e.message ?? "No se pudo eliminar el despacho.");
      } finally {
        setGroupActionLoading(false);
      }
      return;
    }

    setConfirmDeleteGroupId(selectedGroup.id);
    setConfirmDeleteGroupSecondsLeft(3);
    if (deleteGroupTimerRef.current) {
      window.clearInterval(deleteGroupTimerRef.current);
    }
    deleteGroupTimerRef.current = window.setInterval(() => {
      setConfirmDeleteGroupSecondsLeft((prev) => {
        if (prev <= 1) {
          if (deleteGroupTimerRef.current) {
            window.clearInterval(deleteGroupTimerRef.current);
            deleteGroupTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (deleteGroupTimerRef.current) {
        window.clearInterval(deleteGroupTimerRef.current);
      }
    };
  }, []);

  const handleEditUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    const formData = new FormData(e.currentTarget);
    const updates = {
      name: formData.get("name") as string,
      officeName: formData.get("officeName") as string,
      department: formData.get("department") as string,
      position: formData.get("position") as string,
      phone: formData.get("phone") as string,
    };
    setActionLoading(`edit-${editingUser.id}`);
    try {
      const res = await fetch(`${API_URL}/users/${editingUser.id}`, {
        method: "PATCH", headers: authHeader, body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      setUsers((prev) => prev.map((p) => p.id === editingUser.id ? { ...p, ...updates } : p));
      showSuccess(`Perfil de ${updates.name} actualizado`);
      setEditingUser(null);
    } catch (err: any) { setError(err.message); }
    finally { setActionLoading(null); }
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

  if (loading && users.length === 0) {
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
          <Link to="/" className="text-[#616f89] dark:text-gray-400 text-sm font-medium hover:text-primary">
            Inicio
          </Link>
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
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={openOfficeConfig}
                className="flex items-center gap-2 rounded-lg h-10 px-4 border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] text-[#111318] dark:text-white text-sm font-bold hover:bg-[#f8fafb] dark:hover:bg-[#141921] transition-colors"
              >
                <span className="material-symbols-outlined text-lg">settings</span>
                Configurar despacho
              </button>
            )}
            <button
              type="button"
              onClick={openAddCollaborator}
              className="flex items-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-md hover:bg-blue-700 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              Agregar Usuario
            </button>
          </div>
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
        <div className="bg-white dark:bg-[#1a212f] rounded-2xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm">
          {users.length === 0 ? (
            <div className="px-5 py-16 text-center text-[#616f89] dark:text-[#64748b] flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-5xl mb-3 opacity-50">group_off</span>
              <p className="text-lg font-medium">No se encontraron usuarios.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto no-scrollbar">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="border-b border-[#dbdfe6] dark:border-[#2d3748] bg-[#f8fafb] dark:bg-[#141921]">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Usuario</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider hidden md:table-cell">Cargo</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Rol</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider hidden lg:table-cell">Último acceso</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Estado</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className={`border-b border-[#dbdfe6] dark:border-[#2d3748] transition-colors hover:bg-[#f8fafb] dark:hover:bg-[#141921] ${!u.isActive ? "opacity-50" : ""}`}
                      >
                        {/* Avatar + name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-9 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center border border-primary/20 overflow-hidden">
                              <UserAvatar
                                name={u.name}
                                avatarUrl={u.avatarUrl}
                                className="size-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => navigate(`/equipo/usuario/${u.id}`)}
                                className="font-semibold text-[#111318] dark:text-white hover:text-primary dark:hover:text-primary transition-colors text-left truncate block"
                              >
                                {u.name}
                              </button>
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

                        {/* Acciones */}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {/* Editar */}
                            <button
                              title="Editar"
                              onClick={() => setEditingUser(u)}
                              disabled={actionLoading === `edit-${u.id}`}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card view */}
              <div className="md:hidden flex flex-col divide-y divide-[#dbdfe6] dark:divide-[#2d3748]">
                {users.map((u) => (
                  <div key={u.id} className={`p-4 flex flex-col gap-3 transition-colors hover:bg-[#f8fafb] dark:hover:bg-[#141921] ${!u.isActive ? "opacity-50" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center border border-primary/20 overflow-hidden">
                        <UserAvatar
                          name={u.name}
                          avatarUrl={u.avatarUrl}
                          className="size-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/equipo/usuario/${u.id}`)}
                          className="font-bold text-[#111318] dark:text-white text-base hover:text-primary dark:hover:text-primary transition-colors text-left truncate block w-full"
                        >
                          {u.name}
                        </button>
                        <p className="text-xs text-[#616f89] dark:text-[#64748b] truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 bg-[#f8fafb] dark:bg-[#101622] p-3 rounded-lg mt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Cargo</span>
                        <div className="text-right">
                          <span className="text-sm font-medium text-[#111318] dark:text-white block">{u.position || "—"}</span>
                          {u.department && <span className="text-[10px] text-[#616f89] dark:text-[#64748b] block">{u.department}</span>}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Rol</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${u.role === "admin" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                          {getRoleLabel(u.role)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Estado</span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${u.isActive ? "text-green-600 dark:text-green-400" : "text-[#616f89] dark:text-[#64748b]"}`}>
                          <span className={`size-1.5 rounded-full ${u.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                          {u.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold text-[#616f89] dark:text-[#64748b] uppercase tracking-wider">Último acceso</span>
                        <span className="text-xs text-[#111318] dark:text-white font-medium">{u.lastLogin ? formatTimeAgo(u.lastLogin) : "Nunca"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-1">
                      <button
                        title="Editar"
                        onClick={() => setEditingUser(u)}
                        disabled={actionLoading === `edit-${u.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold text-xs transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span> Editar
                      </button>

                      <button
                        title={`Cambiar a ${u.role === "admin" ? "Asistente" : "Administrador"}`}
                        disabled={actionLoading === `role-${u.id}`}
                        onClick={() => handleChangeRole(u)}
                        className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                      </button>

                      <button
                        title={u.isActive ? "Desactivar" : "Activar"}
                        disabled={actionLoading === `status-${u.id}`}
                        onClick={() => handleToggleStatus(u)}
                        className={`p-2 rounded-lg transition-colors ${u.isActive ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" : "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">{u.isActive ? "person_off" : "person_check"}</span>
                      </button>

                      <button
                        title="Eliminar"
                        disabled={actionLoading === `delete-${u.id}`}
                        onClick={() => setConfirmDeleteUser(u)}
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">person_remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total usuarios", value: users.length, icon: "group", iconColor: "text-primary", iconBg: "bg-blue-50 dark:bg-blue-900/30", action: () => { setRoleFilter(""); setStatusFilter(""); } },
            { label: "Activos", value: activeUsers.length, icon: "check_circle", iconColor: "text-green-600", iconBg: "bg-green-50 dark:bg-green-900/30", action: () => { setRoleFilter(""); setStatusFilter("true"); } },
            { label: "Administradores", value: users.filter((u) => u.role === "admin").length, icon: "shield_person", iconColor: "text-indigo-600", iconBg: "bg-indigo-50 dark:bg-indigo-900/30", action: () => { setRoleFilter("admin"); setStatusFilter(""); } },
            { label: "Inactivos", value: inactiveUsers.length, icon: "cancel", iconColor: "text-red-500", iconBg: "bg-red-50 dark:bg-red-900/30", action: () => { setRoleFilter(""); setStatusFilter("false"); } },
          ].map((s) => {
            const isActive =
              (s.label === "Total usuarios" && !roleFilter && !statusFilter) ||
              (s.label === "Activos" && statusFilter === "true" && !roleFilter) ||
              (s.label === "Administradores" && roleFilter === "admin" && !statusFilter) ||
              (s.label === "Inactivos" && statusFilter === "false" && !roleFilter);
            return (
              <button
                key={s.label}
                type="button"
                onClick={s.action}
                className={`bg-white dark:bg-[#1a212f] rounded-xl border p-4 flex items-center gap-3 text-left w-full transition-all hover:shadow-md ${
                  isActive
                    ? "border-primary ring-1 ring-primary/30 shadow-sm"
                    : "border-[#dbdfe6] dark:border-[#2d3748] hover:border-primary/40"
                }`}
              >
                <div className={`size-10 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined ${s.iconColor} text-xl`}>{s.icon}</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-[#111318] dark:text-white">{s.value}</p>
                  <p className="text-xs text-[#616f89] dark:text-[#64748b]">{s.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Asignados Summary Section */}
        <section className="mt-12 mb-8">
          <div className="flex flex-col gap-2 border-b border-[#dbdfe6] dark:border-[#2d3748] pb-4 mb-6">
            <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">assignment</span>
              Asignados recientes
            </h3>
            <button type="button" onClick={() => navigate('/asignados')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#616f89] dark:text-[#a0aec0] bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary dark:hover:text-primary transition-colors w-fit group">
              Ir al panel completo
              <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-0.5">arrow_forward</span>
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {[
              { label: 'Todos', count: assignments.length, icon: 'check_circle', colorClass: 'bg-white text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
              { label: 'Pendientes', count: assignments.filter(a => a.status === 'pendiente').length, icon: 'pending', colorClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/50' },
              { label: 'Aceptados', count: assignments.filter(a => ['visto', 'editado', 'revisado'].includes(a.status)).length, icon: 'visibility', colorClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50' },
              { label: 'Completados', count: assignments.filter(a => a.status === 'completado').length, icon: 'verified', colorClass: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50' },
              { label: 'Rechazados', count: assignments.filter(a => a.status === 'rechazado').length, icon: 'cancel', colorClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50' },
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

          {assignments.length === 0 ? (
            <div className="mt-6 bg-[#f8fafb] dark:bg-[#141921] rounded-2xl p-8 text-center border-2 border-dashed border-[#dbdfe6] dark:border-[#2d3748]">
              <div className="w-16 h-16 bg-white dark:bg-[#1a212f] rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100 dark:border-slate-800">
                <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600">inbox</span>
              </div>
              <p className="text-[#616f89] dark:text-[#64748b] text-base font-medium max-w-sm mx-auto">
                No hay documentos asignados o compartidos que requieran tu atención en este momento.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {assignments.map(assign => (
                <div
                  key={assign.id}
                  onClick={() => navigate(`/documento/${assign.documentId}`)}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] bg-white dark:bg-[#1a212f] hover:shadow-sm transition-all cursor-pointer hover:border-primary/50"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/documento/${assign.documentId}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400">
                      <span className="material-symbols-outlined text-xl">description</span>
                    </div>
                    <div>
                      <p className="font-bold text-[#111318] dark:text-white">
                        {assign.document?.name || 'Documento sin nombre'}
                      </p>
                      <p className="text-sm text-[#616f89] dark:text-[#a0aec0]">
                        Asignado por: {getViewerLabel({
                          subjectId: assign.assigner?.id,
                          subjectName: assign.assigner?.name,
                          currentUserId: currentUser?.id,
                          fallback: "Usuario",
                        })}{" "}
                        • {formatTimeAgo(assign.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${assign.status === 'pendiente' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                      ['visto', 'editado', 'revisado'].includes(assign.status) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        assign.status === 'completado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                      {assign.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        <section>
          <div className="flex flex-col gap-2 border-b border-[#dbdfe6] dark:border-[#2d3748] pb-4 mb-6 mt-8">
            <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              Actividad Reciente
            </h3>
            <button type="button" onClick={() => navigate('/actividad')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#616f89] dark:text-[#a0aec0] bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary dark:hover:text-primary transition-colors w-fit group">
              Ver todo el historial
              <span className="material-symbols-outlined text-base transition-transform group-hover:translate-x-0.5">arrow_forward</span>
            </button>
          </div>
          <div className="space-y-3">
            {activity.length === 0 ? (
              <p className="text-[#616f89] dark:text-[#a0aec0] py-4">No hay actividad reciente.</p>
            ) : (
              activity.map((item) => {
                return (
                  <div key={item.id}>
                    <BitacoraEntryItem
                      entry={item}
                      currentUserId={currentUser?.id}
                      onNavigate={navigate}
                    />
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

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

      {/* Invite Modal (Restored from old commit) */}
      {addCollaboratorOpen && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setAddCollaboratorOpen(false)}
        >
          <div className="bg-white dark:bg-[#1a212f] w-full max-w-md rounded-2xl shadow-xl border border-[#dbdfe6] dark:border-[#2d3748] overflow-hidden">
            <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748] flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-[#111318] dark:text-white">Agregar Colaborador</h3>
                <p className="text-sm text-[#616f89] dark:text-[#a0aec0] mt-1">
                  Comparta el código o el ID del grupo para que otros se unan.
                </p>
              </div>
              <button
                onClick={() => setAddCollaboratorOpen(false)}
                className="text-[#616f89] dark:text-[#a0aec0] hover:text-[#111318] dark:hover:text-white transition-colors"
                title="Cerrar"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {groupsLoading ? (
                <p className="text-[#616f89] dark:text-[#a0aec0] text-sm">Cargando…</p>
              ) : !groups[0] ? (
                <p className="text-[#616f89] dark:text-[#a0aec0] text-sm">No pertenece a un grupo. Cree uno desde completar perfil o contacte al administrador.</p>
              ) : (
                <>
                  {groups[0].name && (
                    <div>
                      <p className="text-base font-bold text-[#111318] dark:text-white">{groups[0].name}</p>
                      {groups[0].description && (
                        <p className="text-sm text-[#616f89] dark:text-[#a0aec0] mt-0.5">{groups[0].description}</p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">ID del grupo</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={groups[0].id}
                        className="flex-1 min-w-0 rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(groups[0].id, "id")}
                        className="shrink-0 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-colors w-[110px]"
                      >
                        <span className="material-symbols-outlined text-lg">{copiedId === "id" ? "check" : "content_copy"}</span>
                        {copiedId === "id" ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                  {groups[0].inviteCode && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">Código de invitación</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={groups[0].inviteCode}
                          className="flex-1 min-w-0 rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white font-mono uppercase tracking-wider"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(groups[0].inviteCode!, "code")}
                          className="shrink-0 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-colors w-[110px]"
                        >
                          <span className="material-symbols-outlined text-lg">{copiedId === "code" ? "check" : "content_copy"}</span>
                          {copiedId === "code" ? "Copiado" : "Copiar"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#dbdfe6] dark:border-[#2d3748] flex justify-end bg-[#f8fafb] dark:bg-[#141921] rounded-b-2xl">
              <button
                type="button"
                onClick={() => setAddCollaboratorOpen(false)}
                className="px-4 py-2 text-sm font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Configuración del despacho */}
      {officeConfigOpen && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setOfficeConfigOpen(false);
              resetGroupDeleteConfirm();
            }
          }}
        >
          <div className="bg-white dark:bg-[#1a212f] w-full max-w-lg rounded-2xl shadow-xl border border-[#dbdfe6] dark:border-[#2d3748] overflow-hidden">
            <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748] flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-[#111318] dark:text-white">Configuración del despacho</h3>
                <p className="text-sm text-[#616f89] dark:text-[#a0aec0] mt-1">
                  Renombre o elimine su despacho actual.
                </p>
              </div>
              <button
                onClick={() => {
                  setOfficeConfigOpen(false);
                  resetGroupDeleteConfirm();
                }}
                className="text-[#616f89] dark:text-[#a0aec0] hover:text-[#111318] dark:hover:text-white transition-colors"
                title="Cerrar"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {groupActionLoading && !selectedGroup ? (
                <p className="text-sm text-[#616f89] dark:text-[#a0aec0]">Cargando despacho...</p>
              ) : !selectedGroup ? (
                <div className="rounded-lg border border-dashed border-[#dbdfe6] dark:border-[#2d3748] p-4 text-sm text-[#616f89] dark:text-[#a0aec0]">
                  No hay un despacho disponible para configurar.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">Nombre del despacho</label>
                    <input
                      type="text"
                      value={groupNameDraft}
                      onChange={(e) => setGroupNameDraft(e.target.value)}
                      className="w-full rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white"
                      disabled={groupActionLoading}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">Descripción (opcional)</label>
                    <textarea
                      value={groupDescriptionDraft}
                      onChange={(e) => setGroupDescriptionDraft(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white resize-none"
                      disabled={groupActionLoading}
                    />
                  </div>
                  <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">Zona de riesgo</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      La eliminación desactiva el despacho y obliga a configurar uno nuevo.
                    </p>
                    <button
                      type="button"
                      onClick={handleDeleteGroup}
                      disabled={groupActionLoading}
                      className="mt-3 w-full rounded-lg bg-red-600 text-white text-sm font-bold py-2.5 hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {confirmDeleteGroupId === selectedGroup.id
                        ? confirmDeleteGroupSecondsLeft > 0
                          ? `Habilitar eliminar (${confirmDeleteGroupSecondsLeft}s)`
                          : "Clic para confirmar eliminación"
                        : "Eliminar despacho"}
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#dbdfe6] dark:border-[#2d3748] flex justify-end gap-3 bg-[#f8fafb] dark:bg-[#141921] rounded-b-2xl">
              <button
                type="button"
                onClick={() => {
                  setOfficeConfigOpen(false);
                  resetGroupDeleteConfirm();
                }}
                className="px-4 py-2 text-sm font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleSaveGroup}
                disabled={groupActionLoading || !selectedGroup}
                className="px-4 py-2 text-sm font-bold bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && setEditingUser(null)}>
          <div className="bg-white dark:bg-[#1a212f] w-full max-w-md rounded-2xl shadow-xl border border-[#dbdfe6] dark:border-[#2d3748] overflow-hidden">
            <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748] flex justify-between items-center">
              <h3 className="text-xl font-bold text-[#111318] dark:text-white">Editar Usuario</h3>
              <button onClick={() => setEditingUser(null)} className="text-[#616f89] dark:text-[#a0aec0] hover:text-[#111318] dark:hover:text-white transition-colors">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <form onSubmit={handleEditUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">Nombre completo</label>
                <input required type="text" name="name" defaultValue={editingUser.name} className="w-full rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">Cargo / Puesto</label>
                <input type="text" name="position" defaultValue={editingUser.position || ""} className="w-full rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">Departamento</label>
                <input type="text" name="department" defaultValue={editingUser.department || ""} className="w-full rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">Despacho</label>
                <input type="text" name="officeName" defaultValue={editingUser.officeName || ""} className="w-full rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">Teléfono</label>
                <input type="text" name="phone" defaultValue={editingUser.phone || ""} className="w-full rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white" />
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 border border-[#dbdfe6] dark:border-[#2d3748] rounded-lg text-sm font-medium text-[#616f89] dark:text-[#a0aec0] hover:bg-[#f8fafb] dark:hover:bg-slate-800">
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading === `edit-${editingUser.id}`} className="px-4 py-2 bg-primary rounded-lg text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
