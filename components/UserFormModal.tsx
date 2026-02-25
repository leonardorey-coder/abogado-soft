// ============================================================================
// UserFormModal — Modal para crear y editar usuarios del despacho
// Usado por TeamPage para el CRUD de equipo
// ============================================================================

import React, { useState, useEffect } from "react";

const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000/api";

export interface UserFormData {
    id?: string;
    email: string;
    name: string;
    role: "admin" | "asistente";
    officeName?: string;
    department?: string;
    position?: string;
    phone?: string;
    password?: string;
    isActive?: boolean;
}

interface UserFormModalProps {
    mode: "create" | "edit";
    initialData?: Partial<UserFormData>;
    onClose: () => void;
    onSuccess: (user: UserFormData) => void;
}

const ROLE_OPTIONS = [
    { value: "asistente", label: "Asistente" },
    { value: "admin", label: "Administrador" },
];

function generateTempPassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function UserFormModal({ mode, initialData, onClose, onSuccess }: UserFormModalProps) {
    const isEdit = mode === "edit";
    const [form, setForm] = useState<UserFormData>({
        email: initialData?.email ?? "",
        name: initialData?.name ?? "",
        role: initialData?.role ?? "asistente",
        officeName: initialData?.officeName ?? "",
        department: initialData?.department ?? "",
        position: initialData?.position ?? "",
        phone: initialData?.phone ?? "",
        password: isEdit ? undefined : generateTempPassword(),
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const token = () => (window as any).__supabaseSession?.access_token ?? "";

    const handleChange = (field: keyof UserFormData, value: string) => {
        setForm((p) => ({ ...p, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const url = isEdit
                ? `${API_URL}/users/${initialData?.id}`
                : `${API_URL}/users`;
            const method = isEdit ? "PATCH" : "POST";
            const body = isEdit
                ? { name: form.name, officeName: form.officeName, department: form.department, position: form.position, phone: form.phone }
                : { email: form.email, name: form.name, role: form.role, officeName: form.officeName, department: form.department, position: form.position, phone: form.phone, password: form.password };

            const res = await fetch(url, {
                method,
                headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Error al guardar usuario");
            onSuccess(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };



    const fieldRow = (label: string, field: keyof UserFormData, opts: { type?: string; disabled?: boolean; required?: boolean } = {}) => (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">
                {label}{opts.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                type={opts.type ?? "text"}
                value={(form[field] as string) ?? ""}
                onChange={(e) => handleChange(field, e.target.value)}
                disabled={opts.disabled || loading}
                required={opts.required}
                className="flex-1 min-w-0 rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 transition-colors"
            />
        </div>
    );

    return (
        <div
            className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white dark:bg-[#1a212f] w-full max-w-xl rounded-2xl shadow-xl border border-[#dbdfe6] dark:border-[#2d3748] overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-[#dbdfe6] dark:border-[#2d3748] flex items-start justify-between shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-[#111318] dark:text-white">
                            {isEdit ? "Editar Usuario" : "Agregar Colaborador"}
                        </h3>
                        <p className="text-sm text-[#616f89] dark:text-[#a0aec0] mt-1">
                            {isEdit ? "Actualizar información del colaborador." : "Nuevo miembro del equipo del despacho."}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[#616f89] dark:text-[#a0aec0] hover:text-[#111318] dark:hover:text-white transition-colors"
                        title="Cerrar"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                {/* Main scrollable body */}
                <div className="p-6 overflow-y-auto space-y-4">
                    {error && (
                        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}

                    <form id="user-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {fieldRow("Nombre completo", "name", { required: true })}

                        {!isEdit && fieldRow("Correo electrónico", "email", { type: "email", required: true })}

                        {!isEdit && (
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">
                                    Rol<span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={form.role}
                                        onChange={(e) => handleChange("role", e.target.value)}
                                        disabled={loading}
                                        className="w-full rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 text-sm text-[#111318] dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 appearance-none pr-10"
                                    >
                                        {ROLE_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">
                                        expand_more
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {fieldRow("Despacho / Oficina", "officeName")}
                            {fieldRow("Departamento", "department")}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {fieldRow("Cargo / Posición", "position")}
                            {fieldRow("Teléfono", "phone", { type: "tel" })}
                        </div>

                        {!isEdit && (
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">
                                    Contraseña temporal<span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={form.password ?? ""}
                                            onChange={(e) => handleChange("password", e.target.value)}
                                            disabled={loading}
                                            required
                                            className="w-full rounded-lg bg-[#f8fafb] dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] px-3 py-2 pr-10 text-sm text-[#111318] dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#616f89] dark:text-[#a0aec0] hover:text-primary transition-colors focus:outline-none"
                                            title={showPassword ? "Ocultar" : "Ver"}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">
                                                {showPassword ? "visibility_off" : "visibility"}
                                            </span>
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleChange("password", generateTempPassword())}
                                        className="shrink-0 flex items-center justify-center bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-3 hover:border-primary hover:text-primary dark:hover:text-primary text-slate-500 dark:text-slate-400 font-bold transition-all h-[38px]"
                                        title="Generar contraseña"
                                    >
                                        <span className="material-symbols-outlined text-lg">autorenew</span>
                                    </button>
                                </div>
                                <p className="text-xs text-[#616f89] dark:text-[#a0aec0]">
                                    El usuario deberá cambiarla al iniciar sesión por primera vez.
                                </p>
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[#dbdfe6] dark:border-[#2d3748] flex justify-end gap-3 shrink-0 bg-[#f8fafb] dark:bg-[#141921] rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="user-form"
                        disabled={loading}
                        className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? "Guardando..." : (isEdit ? "Guardar cambios" : "Agregar")}
                    </button>
                </div>
            </div>
        </div>
    );
}
