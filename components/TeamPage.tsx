import React, { useState, useEffect } from "react";
import { ViewState } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { getRoleLabel } from "../lib/constants";

const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000/api";

interface TeamUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "asistente";
  avatarUrl?: string | null;
  officeName?: string | null;
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

interface GroupInfo {
  id: string;
  name: string;
  description?: string | null;
  inviteCode?: string | null;
}

interface TeamPageProps {
  onNavigate: (view: ViewState) => void;
}

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins !== 1 ? "s" : ""}`;
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? "s" : ""}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? "s" : ""}`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function activityIcon(activity: string): { icon: string; bg: string; color: string } {
  const lower = activity.toLowerCase();
  if (lower.includes("edit") || lower.includes("document")) return { icon: "edit_document", bg: "bg-green-100 dark:bg-green-900/30", color: "text-green-600 dark:text-green-400" };
  if (lower.includes("user") || lower.includes("client")) return { icon: "person_add", bg: "bg-blue-100 dark:bg-blue-900/30", color: "text-blue-600 dark:text-blue-400" };
  if (lower.includes("calendar") || lower.includes("audiencia")) return { icon: "calendar_today", bg: "bg-amber-100 dark:bg-amber-900/30", color: "text-amber-600 dark:text-amber-400" };
  return { icon: "history", bg: "bg-gray-100 dark:bg-gray-700", color: "text-gray-600 dark:text-gray-400" };
}

export const TeamPage: React.FC<TeamPageProps> = ({ onNavigate }) => {
  const { session } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addCollaboratorOpen, setAddCollaboratorOpen] = useState(false);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    const token = session.access_token;
    Promise.all([
      fetch(`${API_URL}/users?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch(`${API_URL}/activity?page=1&limit=5&sortOrder=desc`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([usersRes, activityRes]) => {
        setUsers(usersRes.data ?? []);
        setActivity(activityRes.data ?? []);
      })
      .catch(() => setError("No se pudo cargar el equipo."))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const openAddCollaborator = () => {
    setAddCollaboratorOpen(true);
    setGroups([]);
    setGroupsLoading(true);
    if (!session?.access_token) return;
    fetch(`${API_URL}/groups?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
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

  if (loading) {
    return (
      <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1">
        <div className="flex items-center justify-center py-20">
          <p className="text-[#616f89] dark:text-[#a0aec0]">Cargando equipo…</p>
        </div>
      </main>
    );
  }

  const firstGroup = groups[0];

  return (
    <>
      <main className="max-w-[1200px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
        <div className="flex flex-wrap gap-2 py-2">
          <button
            type="button"
            className="text-[#616f89] dark:text-gray-400 text-sm font-medium hover:text-primary cursor-pointer"
            onClick={() => onNavigate(ViewState.DASHBOARD)}
          >
            Inicio
          </button>
          <span className="text-[#616f89] dark:text-gray-600 text-sm font-medium">/</span>
          <span className="text-[#111318] dark:text-white text-sm font-medium">Mi Equipo</span>
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black tracking-tight dark:text-white">Su Equipo de Trabajo</h2>
          <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">
            Gestione a los miembros de su firma y supervise su actividad reciente.
          </p>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={openAddCollaborator}
            className="flex items-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-md hover:bg-blue-700 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Agregar Colaborador
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {users.map((u) => (
            <div
              key={u.id}
              className="min-w-0 bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-primary transition-all shadow-sm flex items-start gap-6"
            >
              <div className="size-20 rounded-full bg-primary/10 flex-shrink-0 overflow-hidden border-2 border-primary/20">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt={u.name} className="size-full object-cover" />
                ) : (
                  <div className="size-full flex items-center justify-center text-primary text-2xl font-bold">
                    {(u.name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                    {getRoleLabel(u.role)}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#111318] dark:text-white mb-1 truncate">{u.name}</h3>
                <p className="text-[#616f89] dark:text-[#a0aec0] mb-4 flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-base">mail</span>
                  {u.email}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate(ViewState.ACTIVITY_LOG)}
                  className="flex items-center gap-2 text-primary font-bold border-2 border-primary/20 px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors text-sm"
                >
                  <span className="material-symbols-outlined text-lg">history</span>
                  Ver Actividad
                </button>
              </div>
            </div>
          ))}
        </div>

        <section>
          <div className="flex items-center justify-between border-b border-[#dbdfe6] dark:border-[#2d3748] pb-4 mb-6">
            <h3 className="text-2xl font-bold dark:text-white">Resumen de la Firma</h3>
            <button
              type="button"
              onClick={() => onNavigate(ViewState.ACTIVITY_LOG)}
              className="text-primary font-semibold flex items-center gap-1 hover:underline text-sm"
            >
              Ver todo el historial
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
          <div className="space-y-4">
            {activity.length === 0 ? (
              <p className="text-[#616f89] dark:text-[#a0aec0] py-4">No hay actividad reciente.</p>
            ) : (
              activity.map((item) => {
                const { icon, bg, color } = activityIcon(item.activity);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 bg-white dark:bg-[#1a212f] p-4 rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] shadow-sm"
                  >
                    <div className={`size-10 ${bg} ${color} rounded-full flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined">{icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[#111318] dark:text-white">
                        <strong>{item.user.name}</strong> {item.description}
                      </p>
                      <p className="text-xs text-[#616f89] dark:text-[#a0aec0]">{formatTimeAgo(item.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {addCollaboratorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setAddCollaboratorOpen(false)}
        >
          <div className="bg-white dark:bg-[#1a212f] w-full max-w-md rounded-2xl shadow-xl border border-[#dbdfe6] dark:border-[#2d3748] overflow-hidden">
            <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748]">
              <h3 className="text-xl font-bold text-[#111318] dark:text-white">Agregar Colaborador</h3>
              <p className="text-sm text-[#616f89] dark:text-[#a0aec0] mt-1">
                Comparta el código o el ID del grupo para que otros se unan.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {groupsLoading ? (
                <p className="text-[#616f89] dark:text-[#a0aec0] text-sm">Cargando…</p>
              ) : !firstGroup ? (
                <p className="text-[#616f89] dark:text-[#a0aec0] text-sm">No pertenece a un grupo. Cree uno desde completar perfil o contacte al administrador.</p>
              ) : (
                <>
                  {firstGroup.name && (
                    <div>
                      <p className="text-base font-bold text-[#111318] dark:text-white">{firstGroup.name}</p>
                      {firstGroup.description && (
                        <p className="text-sm text-[#616f89] dark:text-[#a0aec0] mt-0.5">{firstGroup.description}</p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">ID del grupo</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={firstGroup.id}
                        className="flex-1 min-w-0 rounded-lg bg-background-light dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(firstGroup.id, "id")}
                        className="shrink-0 flex items-center gap-1.5 rounded-lg px-4 py-2 bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">{copiedId === "id" ? "check" : "content_copy"}</span>
                        {copiedId === "id" ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                  {firstGroup.inviteCode && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">Código de invitación</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={firstGroup.inviteCode}
                          className="flex-1 min-w-0 rounded-lg bg-background-light dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white font-mono uppercase"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(firstGroup.inviteCode!, "code")}
                          className="shrink-0 flex items-center gap-1.5 rounded-lg px-4 py-2 bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-colors"
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
            <div className="px-6 py-4 border-t border-[#dbdfe6] dark:border-[#2d3748] flex justify-end">
              <button
                type="button"
                onClick={() => setAddCollaboratorOpen(false)}
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
