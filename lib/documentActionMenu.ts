import { Eye, Share2, UserPlus, Shield, Trash2, Download, Edit2, Lock } from "lucide-react";
import type { Document, DocumentPermissionLevel } from "../types";
import type { ActionMenuItem } from "../components/ui";

// Niveles de permiso jerárquicos
const PERMISSION_LEVELS: Record<DocumentPermissionLevel, number> = {
  none: 0,
  download: 1,
  read: 2,
  write: 3,
  admin: 4,
};

function hasPermission(
  userLevel: DocumentPermissionLevel | undefined,
  requiredLevel: DocumentPermissionLevel,
): boolean {
  const userNum = PERMISSION_LEVELS[userLevel ?? 'none'] ?? 0;
  const requiredNum = PERMISSION_LEVELS[requiredLevel] ?? 0;
  return userNum >= requiredNum;
}

export function buildDocumentActionMenuItems(
  doc: Document,
  ctx: {
    onOpen: () => void;
    onShare: () => void;
    onAssign: () => void;
    onPermissions: () => void;
    onDelete: () => void;
    confirmDeleteDocId: string | null;
    confirmDeleteSecondsLeft: number;
    /** Si se define, sustituye a doc.currentUserPermission al evaluar el menú */
    permissionLevel?: DocumentPermissionLevel;
  },
): ActionMenuItem[] {
  const {
    onOpen,
    onShare,
    onAssign,
    onPermissions,
    onDelete,
    confirmDeleteDocId,
    confirmDeleteSecondsLeft,
    permissionLevel,
  } = ctx;

  const userPermission = permissionLevel ?? doc.currentUserPermission ?? 'none';
  
  // Verificar permisos para cada acción
  const canDownload = hasPermission(userPermission, 'download');
  const canRead = hasPermission(userPermission, 'read');
  const canWrite = hasPermission(userPermission, 'write');
  const canAdmin = hasPermission(userPermission, 'admin');

  const items: ActionMenuItem[] = [];

  // Abrir siempre es visible si tiene al menos permiso de lectura
  if (canRead) {
    items.push({
      label: canWrite ? "Abrir y Editar" : "Abrir (Solo lectura)",
      icon: canWrite ? Edit2 : Eye,
      onClick: onOpen,
    });
  } else if (canDownload) {
    items.push({
      label: "Descargar",
      icon: Download,
      onClick: onOpen,
    });
  } else {
    items.push({
      label: "Sin acceso",
      icon: Lock,
      onClick: () => {},
      disabled: true,
    });
  }

  // Compartir requiere al menos lectura
  if (canRead) {
    items.push({
      label: "Compartir",
      icon: Share2,
      onClick: onShare,
    });
  }

  // Asignar requiere escritura o admin
  if (canWrite) {
    items.push({
      label: "Asignar",
      icon: UserPlus,
      onClick: onAssign,
    });
  }

  // Permisos solo para admin
  if (canAdmin) {
    items.push({
      label: "Permisos",
      icon: Shield,
      onClick: onPermissions,
    });
  }

  // Eliminar solo para admin
  if (canAdmin) {
    items.push({
      label:
        confirmDeleteDocId === doc.id
          ? confirmDeleteSecondsLeft > 0
            ? `Habilitar confirmar (${confirmDeleteSecondsLeft}s)`
            : "Click para confirmar"
          : "Eliminar",
      icon: Trash2,
      onClick: onDelete,
      danger: true,
      separator: true,
      closeOnClick: confirmDeleteDocId === doc.id && confirmDeleteSecondsLeft === 0,
    });
  }

  return items;
}
