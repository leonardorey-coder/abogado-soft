import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { conveniosApi, ApiConvenio } from "../lib/api";

const inputClass =
    "w-full bg-background-light dark:bg-[#101622] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl px-4 py-3 text-[#111318] dark:text-white font-medium focus:border-primary focus:ring-0 transition-all";

export const ConvenioForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditing = Boolean(id);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEditing);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        numero: "",
        institucion: "",
        departamento: "",
        descripcion: "",
        fechaInicio: "",
        fechaFin: "",
        estado: "pendiente",
        notas: "",
        monto: "",
    });

    useEffect(() => {
        if (isEditing && id) {
            conveniosApi
                .get(id)
                .then((data) => {
                    setFormData({
                        numero: data.numero,
                        institucion: data.institucion,
                        departamento: data.departamento || "",
                        descripcion: data.descripcion || "",
                        fechaInicio: data.fechaInicio.split("T")[0],
                        fechaFin: data.fechaFin.split("T")[0],
                        estado: data.estado,
                        notas: data.notas || "",
                        monto: data.monto ? data.monto.toString() : "",
                    });
                })
                .catch((err) => setError(err.message || "Error al cargar convenio"))
                .finally(() => setFetching(false));
        }
    }, [id, isEditing]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const payload: any = { ...formData };
            if (!payload.departamento) delete payload.departamento;
            if (!payload.descripcion) delete payload.descripcion;
            if (!payload.notas) delete payload.notas;
            if (!payload.monto) delete payload.monto;
            else payload.monto = Number(payload.monto);

            if (isEditing && id) {
                delete payload.numero; // No se actualiza si no es soportado, pero partial lo permite. Dejemoslo si se ocupa. En schema de Prisma si, pero req.body partial.
                const res = await conveniosApi.update(id, payload);
                navigate(`/convenio/${res.id}`);
            } else {
                const res = await conveniosApi.create(payload);
                navigate(`/convenio/${res.id}`);
            }
        } catch (err: any) {
            setError(err.message || "Error al guardar el convenio");
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <main className="max-w-[800px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
            <div className="flex flex-col gap-2">
                <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0] mb-1">
                    <Link to="/" className="hover:text-primary">Inicio</Link>
                    <span>/</span>
                    <Link to="/convenios" className="hover:text-primary">Convenios</Link>
                    <span>/</span>
                    <span className="text-[#111318] dark:text-white">
                        {isEditing ? `Editar Convenio ${formData.numero}` : "Nuevo Convenio"}
                    </span>
                </nav>
                <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight">
                    {isEditing ? "Editar Convenio" : "Registrar Nuevo Convenio"}
                </h1>
                <p className="text-[#616f89] dark:text-[#a0aec0] text-lg">
                    Complete la información del acuerdo para registrarlo en el sistema.
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="bg-white dark:bg-[#1a212f] rounded-xl border border-[#dbdfe6] dark:border-[#2d3748] p-6 shadow-sm space-y-6"
            >
                {error && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
                            Número de Convenio <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            name="numero"
                            value={formData.numero}
                            onChange={handleChange}
                            disabled={isEditing || loading}
                            className={inputClass}
                            placeholder="Ej. CV-2024-001"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
                            Institución Colaboradora <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            name="institucion"
                            value={formData.institucion}
                            onChange={handleChange}
                            disabled={loading}
                            className={inputClass}
                            placeholder="Ej. Universidad XYZ"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
                            Departamento <span className="text-[#616f89] font-normal">(Opcional)</span>
                        </label>
                        <input
                            name="departamento"
                            value={formData.departamento}
                            onChange={handleChange}
                            disabled={loading}
                            className={inputClass}
                            placeholder="Ej. Facultad de Derecho"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
                            Monto Estimado <span className="text-[#616f89] font-normal">(Opcional)</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            name="monto"
                            value={formData.monto}
                            onChange={handleChange}
                            disabled={loading}
                            className={inputClass}
                            placeholder="Ej. 150000.00"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
                            Fecha de Inicio <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            type="date"
                            name="fechaInicio"
                            value={formData.fechaInicio}
                            onChange={handleChange}
                            disabled={loading}
                            className={inputClass}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
                            Fecha de Fin <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            type="date"
                            name="fechaFin"
                            value={formData.fechaFin}
                            onChange={handleChange}
                            disabled={loading}
                            className={inputClass}
                        />
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
                            Estado Actual <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            name="estado"
                            value={formData.estado}
                            onChange={handleChange}
                            disabled={loading}
                            className={inputClass}
                        >
                            <option value="pendiente">Pendiente</option>
                            <option value="activo">Activo</option>
                            <option value="vencido">Vencido</option>
                            <option value="expirado">Expirado</option>
                            <option value="cancelado">Cancelado</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
                            Descripción Corta <span className="text-[#616f89] font-normal">(Opcional)</span>
                        </label>
                        <textarea
                            name="descripcion"
                            value={formData.descripcion}
                            onChange={handleChange}
                            disabled={loading}
                            rows={3}
                            className={`${inputClass} resize-none`}
                            placeholder="Resumen del alcance del convenio..."
                        />
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="text-[#111318] dark:text-white font-bold text-sm px-1">
                            Notas Adicionales <span className="text-[#616f89] font-normal">(Opcional)</span>
                        </label>
                        <textarea
                            name="notas"
                            value={formData.notas}
                            onChange={handleChange}
                            disabled={loading}
                            rows={4}
                            className={`${inputClass} resize-none`}
                            placeholder="Cláusulas clave, contactos, referencias..."
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#dbdfe6] dark:border-[#2d3748]">
                    <button
                        type="button"
                        onClick={() => navigate("/convenios")}
                        disabled={loading}
                        className="px-6 py-3 bg-white dark:bg-[#1a212f] border border-[#dbdfe6] dark:border-[#2d3748] rounded-xl font-bold text-[#111318] dark:text-white hover:bg-gray-50 dark:hover:bg-[#101622] transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? (
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined">save</span>
                        )}
                        {isEditing ? "Guardar Cambios" : "Crear Convenio"}
                    </button>
                </div>
            </form>
        </main>
    );
};
