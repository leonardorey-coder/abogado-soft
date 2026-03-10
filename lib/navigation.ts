import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Handshake,
  Users,
  Activity,
  Shield,
  Trash2,
} from "lucide-react";

export type NavGroup = "work" | "management" | "system";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Show in mobile bottom nav */
  mobileVisible: boolean;
  end?: boolean;
}

export const navigationConfig: NavItem[] = [
  // ── Trabajo ──
  { label: "Inicio",      path: "/",           icon: LayoutDashboard, group: "work",       mobileVisible: true,  end: true },
  { label: "Documentos",  path: "/documentos", icon: FileText,        group: "work",       mobileVisible: true  },
  { label: "Asignados",   path: "/asignados",  icon: ClipboardList,   group: "work",       mobileVisible: true  },
  { label: "Convenios",   path: "/convenios",  icon: Handshake,       group: "work",       mobileVisible: true  },
  // ── Gestión ──
  { label: "Equipo",      path: "/equipo",     icon: Users,           group: "management", mobileVisible: false },
  // ── Sistema ──
  { label: "Actividad",   path: "/actividad",  icon: Activity,        group: "system",     mobileVisible: false },
  { label: "Seguridad",   path: "/seguridad",  icon: Shield,          group: "system",     mobileVisible: false },
  { label: "Papelera",    path: "/papelera",   icon: Trash2,          group: "system",     mobileVisible: false },
];

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  work: "Trabajo",
  management: "Gestión",
  system: "Sistema",
};

export function getNavGroups() {
  const groups: { group: NavGroup; label: string; items: NavItem[] }[] = [];
  const seen = new Set<NavGroup>();
  for (const item of navigationConfig) {
    if (!seen.has(item.group)) {
      seen.add(item.group);
      groups.push({
        group: item.group,
        label: NAV_GROUP_LABELS[item.group],
        items: navigationConfig.filter((n) => n.group === item.group),
      });
    }
  }
  return groups;
}
