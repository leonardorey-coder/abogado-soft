import React from "react";
import { Document, DocumentPermissionLevel } from "../types";

const permissionLabel: Record<DocumentPermissionLevel, string> = {
  read: "Lectura",
  write: "Escritura",
  admin: "Administrador",
};

interface DocumentPermissionsModalProps {
  document: Document;
  onClose: () => void;
}

export const DocumentPermissionsModal: React.FC<DocumentPermissionsModalProps> = ({
  document,
  onClose,
}) => {
  const permissions = document.documentPermissions ?? [];
  const current = document.currentUserPermission;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-[#1a212f] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-2xl">shield</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#111318] dark:text-white">
                Permisos del documento
              </h2>
              <p className="text-[#616f89] dark:text-[#a0aec0] text-sm truncate max-w-[280px]" title={document.name}>
                {document.name}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {current !== undefined && (
            <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                Tu permiso
              </p>
              <p className="font-bold text-[#111318] dark:text-white">
                {permissionLabel[current]}
              </p>
            </div>
          )}
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
            Personas con acceso
          </p>
          {permissions.length === 0 ? (
            <p className="text-[#616f89] dark:text-[#a0aec0] text-sm py-2">
              No hay otros permisos asignados.
            </p>
          ) : (
            <ul className="space-y-2">
              {permissions.map((entry, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 dark:bg-[#101622] border border-slate-100 dark:border-[#2d3748]"
                >
                  <span className="font-medium text-[#111318] dark:text-white">
                    {entry.userName}
                  </span>
                  <span className="text-sm font-bold text-[#616f89] dark:text-[#a0aec0]">
                    {permissionLabel[entry.level]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-6 py-4 flex justify-end border-t border-[#dbdfe6] dark:border-[#2d3748]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
