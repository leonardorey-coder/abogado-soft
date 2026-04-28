import React from "react";
import { ApiActivityLog } from "../lib/api";
import { getViewerLabel } from "../lib/viewerIdentity";
import { formatTimeAgo } from "../lib/formatters";

const ACTIVITY_LABELS: Record<string, string> = {
  LOGIN: "Inició sesión",
  LOGOUT: "Cerró sesión",
  DOCUMENT_CREATED: "Creó documento",
  DOCUMENT_UPDATED: "Modificó los datos del documento",
  DOCUMENT_FILE_STATUS_CHANGED: "",
  DOCUMENT_WORKFLOW_STATUS_CHANGED: "",
  DOCUMENT_DELETED: "Eliminó documento",
  DOCUMENT_RESTORED: "Restauró documento",
  DOCUMENT_SHARED: "Compartió documento",
  DOCUMENT_ASSIGNED: "Asignó documento",
  DOCUMENT_DOWNLOADED: "Descargó documento",
  DOCUMENT_EXTRACTED: "Convirtió a PDF",
  DOCUMENT_PERMISSION_CHANGED: "Cambió permisos",
  DOCUMENT_VERSION_CREATED: "Creó versión",
  DOCUMENT_COMMENT_ADDED: "Comentó documento",
  DOCUMENT_COMMENT_DELETED: "Eliminó comentario",
  CONVENIO_CREATED: "Creó convenio",
  CONVENIO_UPDATED: "Editó convenio",
  CONVENIO_DELETED: "Eliminó convenio",
  CONVENIO_VERSION_CREATED: "Creó versión de convenio",
  CONVENIO_COMMENT_ADDED: "Comentó convenio",
  CONVENIO_COMMENT_DELETED: "Eliminó comentario de convenio",
  GROUP_CREATED: "Creó grupo",
  GROUP_UPDATED: "Editó grupo",
  GROUP_DELETED: "Eliminó grupo",
  GROUP_MEMBER_ADDED: "Agregó miembro",
  GROUP_MEMBER_REMOVED: "Removió miembro",
  ADMIN_ACCESS_GRANTED: "Concedió acceso admin",
  ADMIN_ACCESS_DENIED: "Denegó acceso admin",
  BACKUP_CREATED: "Creó respaldo",
  BACKUP_RESTORED: "Restauró respaldo",
  USER_REGISTERED: "Se registró",
  USER_UPDATED: "Actualizó perfil",
  PASSWORD_CHANGED: "Cambió contraseña",
  SETTINGS_CHANGED: "Cambió configuración",
  COLLABORATION_STARTED: "Actualizó asignación",
  COLLABORATION_ENDED: "Finalizó asignación",
  DOCUMENT_LOCKED: "Bloqueó documento",
  DOCUMENT_UNLOCKED: "Desbloqueó documento",
  CASE_CREATED: "Creó expediente",
  CASE_UPDATED: "Editó expediente",
  CASE_DOCUMENT_LINKED: "Vinculó documento a expediente",
  CASE_DOCUMENT_UNLINKED: "Desvinculó documento de expediente",
  DOCUMENT_VIEWED: "Vio documento",
};

type CategoryInfo = {
  label: string;
  icon: string;
  colorClass: string;
  badgeBg: string;
};

const CATEGORY_BY_PAGE: Record<string, CategoryInfo> = {
  documents: {
    label: "Documentos",
    icon: "description",
    colorClass: "text-blue-700 dark:text-blue-400",
    badgeBg: "bg-blue-50 dark:bg-blue-900/30",
  },
  convenios: {
    label: "Convenios",
    icon: "handshake",
    colorClass: "text-amber-700 dark:text-amber-400",
    badgeBg: "bg-amber-50 dark:bg-amber-900/30",
  },
  team: {
    label: "Equipo",
    icon: "groups",
    colorClass: "text-indigo-700 dark:text-indigo-400",
    badgeBg: "bg-indigo-50 dark:bg-indigo-900/30",
  },
  security: {
    label: "Seguridad",
    icon: "shield",
    colorClass: "text-red-700 dark:text-red-400",
    badgeBg: "bg-red-50 dark:bg-red-900/30",
  },
  assignments: {
    label: "Asignados",
    icon: "assignment",
    colorClass: "text-purple-700 dark:text-purple-400",
    badgeBg: "bg-purple-50 dark:bg-purple-900/30",
  },
  general: {
    label: "General",
    icon: "history",
    colorClass: "text-slate-700 dark:text-slate-300",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
  },
};

function resolveCategory(activity: string): CategoryInfo {
  if (activity.startsWith("DOCUMENT_ASSIGNED") || activity.startsWith("DOCUMENT_SHARED") || activity.startsWith("COLLABORATION_")) {
    return CATEGORY_BY_PAGE.assignments;
  }
  if (activity === "DOCUMENT_WORKFLOW_STATUS_CHANGED") {
    return CATEGORY_BY_PAGE.assignments;
  }
  if (activity === "DOCUMENT_FILE_STATUS_CHANGED") {
    return CATEGORY_BY_PAGE.documents;
  }
  if (activity.startsWith("DOCUMENT_")) return CATEGORY_BY_PAGE.documents;
  if (activity.startsWith("CONVENIO_")) return CATEGORY_BY_PAGE.convenios;
  if (activity.startsWith("GROUP_") || activity === "USER_REGISTERED" || activity === "USER_UPDATED") {
    return CATEGORY_BY_PAGE.team;
  }
  if (["LOGIN", "LOGOUT", "PASSWORD_CHANGED", "ADMIN_ACCESS_GRANTED", "ADMIN_ACCESS_DENIED", "BACKUP_CREATED", "BACKUP_RESTORED", "SETTINGS_CHANGED"].includes(activity)) {
    return CATEGORY_BY_PAGE.security;
  }
  return CATEGORY_BY_PAGE.general;
}

function getActivityLabel(activity: string): string {
  return ACTIVITY_LABELS[activity] ?? activity.replace(/_/g, " ").toLowerCase();
}

function getActivityIcon(activity: string): { icon: string; iconBg: string; iconColor: string } {
  if (activity === "DOCUMENT_FILE_STATUS_CHANGED") {
    return { icon: "toggle_on", iconBg: "bg-amber-50 dark:bg-amber-900/30", iconColor: "text-amber-600 dark:text-amber-400" };
  }
  if (activity === "DOCUMENT_WORKFLOW_STATUS_CHANGED") {
    return { icon: "account_tree", iconBg: "bg-violet-50 dark:bg-violet-900/30", iconColor: "text-violet-600 dark:text-violet-400" };
  }
  const value = activity.toLowerCase();
  if (value.includes("download") || value.includes("descarg")) return { icon: "download", iconBg: "bg-blue-50 dark:bg-blue-900/30", iconColor: "text-primary" };
  if (value.includes("upload") || value.includes("creat")) return { icon: "upload_file", iconBg: "bg-purple-50 dark:bg-purple-900/30", iconColor: "text-purple-600" };
  if (value === "document_updated" || (value.includes("update") && !value.includes("status"))) {
    return { icon: "edit_note", iconBg: "bg-green-50 dark:bg-green-900/30", iconColor: "text-green-600" };
  }
  if (value.includes("update") || value.includes("edit") || value.includes("modif") || value.includes("cambio")) {
    return { icon: "rule", iconBg: "bg-green-50 dark:bg-green-900/30", iconColor: "text-green-600" };
  }
  if (value.includes("delete") || value.includes("elimin")) return { icon: "delete", iconBg: "bg-red-50 dark:bg-red-900/30", iconColor: "text-red-600" };
  if (value.includes("login") || value.includes("logout") || value.includes("auth") || value.includes("sesion")) return { icon: "login", iconBg: "bg-teal-50 dark:bg-teal-900/30", iconColor: "text-teal-600" };
  if (value.includes("share") || value.includes("compart") || value.includes("assign") || value.includes("asign")) return { icon: "share", iconBg: "bg-indigo-50 dark:bg-indigo-900/30", iconColor: "text-indigo-600" };
  if (value.includes("backup") || value.includes("respald")) return { icon: "backup", iconBg: "bg-emerald-50 dark:bg-emerald-900/30", iconColor: "text-emerald-600" };
  if (value.includes("password") || value.includes("contrase")) return { icon: "lock", iconBg: "bg-orange-50 dark:bg-orange-900/30", iconColor: "text-orange-600" };
  if (value.includes("group") || value.includes("member")) return { icon: "group_add", iconBg: "bg-indigo-50 dark:bg-indigo-900/30", iconColor: "text-indigo-600" };
  if (value.includes("permission") || value.includes("permiso")) return { icon: "admin_panel_settings", iconBg: "bg-amber-50 dark:bg-amber-900/30", iconColor: "text-amber-600" };
  if (value.includes("version")) return { icon: "history", iconBg: "bg-cyan-50 dark:bg-cyan-900/30", iconColor: "text-cyan-600" };
  if (value.includes("comment") || value.includes("coment")) return { icon: "comment", iconBg: "bg-pink-50 dark:bg-pink-900/30", iconColor: "text-pink-600" };
  if (value.includes("restore")) return { icon: "restore", iconBg: "bg-lime-50 dark:bg-lime-900/30", iconColor: "text-lime-600" };
  return { icon: "event", iconBg: "bg-orange-50 dark:bg-orange-900/30", iconColor: "text-orange-600" };
}

function getEntityLink(entry: ApiActivityLog): string | null {
  if (!entry.entityId) return null;
  const entityType = (entry.entityType || "").toLowerCase();
  if (entityType === "document") return `/documento/${entry.entityId}`;
  if (entityType === "convenio") return `/convenio/${entry.entityId}`;
  return null;
}

function formatActionDate(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileStatusTextClass(s: string): string {
  switch (s) {
    case "ACTIVO":
      return "text-emerald-600 dark:text-emerald-400";
    case "PENDIENTE":
      return "text-amber-600 dark:text-amber-400";
    case "INACTIVO":
      return "text-slate-500 dark:text-slate-400";
    default:
      return "text-slate-600 dark:text-slate-300";
  }
}

function labelFileStatus(s: string): string {
  return (
    { ACTIVO: "activo", PENDIENTE: "pendiente", INACTIVO: "inactivo" } as Record<string, string>
  )[s] ?? s.toLowerCase();
}

const COLLAB_LABEL: Record<string, string> = {
  VISTO: "visto",
  EDITADO: "editado",
  COMENTADO: "comentado",
  REVISADO: "revisado",
  APROBADO: "aprobado",
  PENDIENTE_REVISION: "pendiente de revisión",
  RECHAZADO: "rechazado",
};

const SHARING_LABEL: Record<string, string> = {
  ENVIADO: "enviado",
  ASIGNADO: "asignado",
};

function workflowTextClass(key: "collab" | "share", code: string | null): string {
  if (!code) return "text-slate-400 dark:text-slate-500";
  if (key === "share") {
    if (code === "ENVIADO") return "text-cyan-600 dark:text-cyan-400";
    if (code === "ASIGNADO") return "text-purple-600 dark:text-purple-400";
    return "text-slate-600 dark:text-slate-300";
  }
  if (code === "RECHAZADO") return "text-red-600 dark:text-red-400";
  if (code === "APROBADO" || code === "REVISADO") return "text-emerald-600 dark:text-emerald-400";
  if (code === "EDITADO" || code === "VISTO") return "text-blue-600 dark:text-blue-400";
  if (code === "PENDIENTE_REVISION") return "text-amber-600 dark:text-amber-400";
  if (code === "COMENTADO") return "text-pink-600 dark:text-pink-400";
  return "text-slate-600 dark:text-slate-300";
}

function labelWorkflow(field: string | undefined, code: string | null): string {
  if (!code) return "—";
  if (field === "sharingStatus") {
    return SHARING_LABEL[code] ?? code.toLowerCase();
  }
  return COLLAB_LABEL[code] ?? code.toLowerCase();
}

interface BitacoraEntryItemProps {
  entry: ApiActivityLog;
  currentUserId?: string;
  compact?: boolean;
  onNavigate?: (path: string) => void;
}

export const BitacoraEntryItem: React.FC<BitacoraEntryItemProps> = ({
  entry,
  currentUserId,
  compact = false,
  onNavigate,
}) => {
  const { icon, iconBg, iconColor } = getActivityIcon(entry.activity);
  const category = resolveCategory(entry.activity);
  const action = getActivityLabel(entry.activity);
  const entityLink = getEntityLink(entry);
  const actor = getViewerLabel({
    subjectId: entry.userId,
    subjectName: entry.user?.name,
    currentUserId,
    fallback: "Sistema",
  });
  const isSelf = actor === "Tú";
  const meta = (entry.metadata ?? {}) as {
    kind?: string;
    fromStatus?: string;
    toStatus?: string;
    field?: string;
    from?: string | null;
    to?: string | null;
  };

  const nameClass =
    "block w-full min-w-0 max-w-full text-left break-words [overflow-wrap:anywhere] line-clamp-2 sm:line-clamp-3";
  const textSize = compact ? "text-xs" : "text-sm";

  const renderMainLine = () => {
    if (entry.activity === "DOCUMENT_FILE_STATUS_CHANGED" && meta.fromStatus && meta.toStatus) {
      const v = isSelf ? "Cambiaste el estado" : "Cambió el estado";
      return <>{v}</>;
    }
    if (entry.activity === "DOCUMENT_WORKFLOW_STATUS_CHANGED" && meta.field) {
      if (meta.field === "collaborationStatus") {
        return <>{isSelf ? "Cambiaste el flujo de colaboración" : "Cambió el flujo de colaboración"}</>;
      }
      if (meta.field === "sharingStatus") {
        return <>{isSelf ? "Cambiaste el flujo de compartir" : "Cambió el flujo de compartir"}</>;
      }
    }
    if (action) {
      return <>{action}</>;
    }
    return <>{getActivityLabel(entry.activity)}</>;
  };

  const renderTransition = () => {
    if (entry.activity === "DOCUMENT_FILE_STATUS_CHANGED" && meta.fromStatus && meta.toStatus) {
      return (
        <p className={`mt-1.5 text-xs font-medium tabular-nums`}>
          <span className={fileStatusTextClass(meta.fromStatus)}>{labelFileStatus(meta.fromStatus)}</span>
          <span className="text-slate-400 dark:text-slate-500 mx-1">→</span>
          <span className={fileStatusTextClass(meta.toStatus)}>{labelFileStatus(meta.toStatus)}</span>
        </p>
      );
    }
    if (entry.activity === "DOCUMENT_WORKFLOW_STATUS_CHANGED" && meta.field) {
      const wKey = meta.field === "sharingStatus" ? "share" : "collab";
      const fromC = labelWorkflow(meta.field, (meta.from as string) ?? null);
      const toC = labelWorkflow(meta.field, (meta.to as string) ?? null);
      return (
        <p className={`mt-1.5 text-xs font-medium tabular-nums`}>
          <span className={workflowTextClass(wKey, meta.from as string | null)}>{fromC}</span>
          <span className="text-slate-400 dark:text-slate-500 mx-1">→</span>
          <span className={workflowTextClass(wKey, meta.to as string | null)}>{toC}</span>
        </p>
      );
    }
    return null;
  };

  return (
    <div className={`flex items-start gap-3 ${compact ? "px-4 py-2.5" : "p-4"} rounded-xl border border-[#dbdfe6] dark:border-gray-800 bg-white dark:bg-[#1a212f]`}>
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        {entry.entityName ? (
          <>
            <p className={`${textSize} text-[#111318] dark:text-white leading-snug`}>
              <span className="font-bold">{actor}</span> {renderMainLine()}
            </p>
            <p className={`mt-1 min-w-0 ${textSize}`}>
              {entityLink ? (
                <button
                  type="button"
                  onClick={() => onNavigate?.(entityLink)}
                  className={`${nameClass} text-primary hover:underline bg-transparent border-none p-0 font-medium italic cursor-pointer`}
                  title={entry.entityName}
                >
                  {entry.entityName}
                </button>
              ) : (
                <span
                  className={`${nameClass} block italic text-[#616f89] dark:text-[#a0aec0]`}
                  title={entry.entityName}
                >
                  {entry.entityName}
                </span>
              )}
            </p>
            {renderTransition()}
          </>
        ) : (
          <p className={`${textSize} text-[#111318] dark:text-white leading-snug`}>
            <span className="font-bold">{actor}</span> {renderMainLine()}
            {renderTransition()}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${category.badgeBg} ${category.colorClass}`}>
            <span className="material-symbols-outlined text-[12px]">{category.icon}</span>
            {category.label}
          </span>
          <span
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"
            title={formatActionDate(entry.createdAt)}
          >
            <span className="material-symbols-outlined text-[15px] leading-none text-slate-400 dark:text-slate-500">calendar_today</span>
            {formatTimeAgo(entry.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
};
