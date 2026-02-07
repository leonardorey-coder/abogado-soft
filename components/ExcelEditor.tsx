import React from "react";
import { ViewState } from "../types";

interface ExcelEditorProps {
  onNavigate: (view: ViewState) => void;
}

export const ExcelEditor: React.FC<ExcelEditorProps> = ({ onNavigate }) => {
  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-[#111318] dark:text-white flex-1">
      <main className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Breadcrumbs & Heading */}
        <div className="flex flex-col gap-2">
          <nav className="flex flex-wrap gap-2 items-center">
            <a
              className="text-[#616f89] text-sm font-medium hover:text-primary transition-colors cursor-pointer"
              onClick={() => onNavigate(ViewState.DASHBOARD)}
            >
              Archivos
            </a>
            <span className="text-[#616f89] text-sm font-medium">/</span>
            <span className="text-primary text-sm font-medium">Convenios</span>
            <span className="text-[#616f89] text-sm font-medium">/</span>
            <span className="text-[#111318] dark:text-white text-sm font-medium">
              Convenio Universidad - Edición
            </span>
          </nav>
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-[#111318] dark:text-white text-3xl font-black leading-tight tracking-tight">
                Convenio Universidad_2024.xlsx
              </h1>
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <span className="material-symbols-outlined text-sm">
                  cloud_done
                </span>
                <p className="text-sm font-medium">
                  Los cambios se guardan automáticamente
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <select className="appearance-none min-w-[220px] bg-white dark:bg-gray-800 border border-[#f0f2f4] dark:border-gray-700 rounded-lg h-10 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/50 outline-none">
                  <option>Vincular a Expediente...</option>
                  <option>EXP-2024-001 (Civil)</option>
                  <option>EXP-2024-042 (Laboral)</option>
                </select>
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                  link
                </span>
              </div>
              <button className="flex items-center gap-2 px-4 bg-primary text-white text-sm font-bold rounded-lg h-10 hover:bg-blue-700 transition-colors">
                <span className="material-symbols-outlined text-lg">
                  download
                </span>
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>
        </div>
        {/* Editor Layout */}
        <div className="flex gap-6 min-h-[700px]">
          {/* Left Sidebar Navigation (SideNavBar style) */}
          <aside className="w-64 flex flex-col gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex flex-col gap-1 px-2 pb-2 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">
                Herramientas
              </h3>
            </div>
            <nav className="flex flex-col gap-1">
              <button className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary font-semibold">
                <span className="material-symbols-outlined">edit_note</span>
                <span className="text-sm">Editor de Celdas</span>
              </button>
              <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                <span className="material-symbols-outlined">table_view</span>
                <span className="text-sm">Vistas de Tabla</span>
              </button>
              <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                <span className="material-symbols-outlined">analytics</span>
                <span className="text-sm">Resumen de Datos</span>
              </button>
              <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                <span className="material-symbols-outlined">settings</span>
                <span className="text-sm">Configuración</span>
              </button>
            </nav>
            <div className="mt-auto p-4 bg-blue-50 dark:bg-primary/10 rounded-lg">
              <p className="text-xs font-semibold text-primary mb-1">
                Tip del sistema
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Puedes arrastrar filas para cambiar el orden del convenio.
              </p>
            </div>
          </aside>
          {/* Main Editor Area */}
          <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-1">
                <button
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Negrita"
                >
                  <span className="material-symbols-outlined text-xl">
                    format_bold
                  </span>
                </button>
                <button
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Itálica"
                >
                  <span className="material-symbols-outlined text-xl">
                    format_italic
                  </span>
                </button>
                <button
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Color de Texto"
                >
                  <span className="material-symbols-outlined text-xl">
                    format_color_text
                  </span>
                </button>
                <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                <button
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Alinear izquierda"
                >
                  <span className="material-symbols-outlined text-xl">
                    format_align_left
                  </span>
                </button>
                <button
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Alinear centro"
                >
                  <span className="material-symbols-outlined text-xl">
                    format_align_center
                  </span>
                </button>
                <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                <button className="flex items-center gap-1 px-3 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm font-medium transition-colors">
                  <span className="material-symbols-outlined text-lg text-primary">
                    add_box
                  </span>
                  <span>Agregar Fila</span>
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs text-gray-500 font-medium">
                  Última sincronización: Hace 30s
                </div>
                <div className="flex -space-x-2">
                  <div
                    className="size-7 rounded-full border-2 border-white dark:border-gray-800 bg-cover bg-center"
                    data-alt="Collaborator avatar"
                    style={{
                      backgroundImage:
                        'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBi_3bmnOCP3G7UqwDHTFRQedS8KtNKJO10kbKo5KaRmIa7ov8k7Ykzdfq1lX60-25sjm7p0pmJsjklyrdxqz4uVCPCgepf-tO9Wks8odQJqn8YFdVWjlKS5n2fjsPJ71PFJgwqgZvLjNC3Fj8jEX5vswkwabqosr0mvCydrQcNdjBCJ485jyLS8ETWmvprekM0gnubRfv9D9hMWNNpF_wXHDh2h-kzwKg9t5LSGcpXWVpXexY78SCzONsp-EIvI-bouSjwaonRByQ")',
                    }}
                  ></div>
                  <div className="size-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 flex items-center justify-center text-[10px] font-bold">
                    +2
                  </div>
                </div>
              </div>
            </div>
            {/* Editable Grid */}
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10">
                  <tr>
                    <th className="w-10 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"></th>
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-[200px]">
                      Nombre del Convenio
                    </th>
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-[120px]">
                      ID Institución
                    </th>
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-[150px]">
                      Fecha de Firma
                    </th>
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-[120px]">
                      Estado
                    </th>
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-[300px]">
                      Observaciones Legales
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1 */}
                  <tr className="hover:bg-primary/5 group transition-colors">
                    <td className="p-2 text-center text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 font-mono text-xs">
                      1
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      Convenio Marco Pasantías 2024
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      UNIV-4421
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      15/03/2024
                    </td>
                    <td className="p-3 border border-gray-200 dark:border-gray-700 outline-none">
                      <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs font-bold">
                        VIGENTE
                      </span>
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40 italic text-gray-500"
                      contentEditable="true"
                    >
                      Pendiente firma del decano de derecho.
                    </td>
                  </tr>
                  {/* Row 2 */}
                  <tr className="hover:bg-primary/5 group transition-colors">
                    <td className="p-2 text-center text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 font-mono text-xs">
                      2
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      Anexo Técnico Investigación Penal
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      UNIV-8820
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      12/01/2024
                    </td>
                    <td className="p-3 border border-gray-200 dark:border-gray-700 outline-none">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded text-xs font-bold">
                        REVISIÓN
                      </span>
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      Se requiere ajuste en cláusula de confidencialidad.
                    </td>
                  </tr>
                  {/* Row 3 - Highlighted Active Cell simulation */}
                  <tr className="hover:bg-primary/5 group transition-colors">
                    <td className="p-2 text-center text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 font-mono text-xs">
                      3
                    </td>
                    <td
                      className="p-3 border-2 border-primary bg-primary/5 outline-none font-medium"
                      contentEditable="true"
                    >
                      Convenio Intercambio Académico
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      UNIV-1299
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      05/05/2024
                    </td>
                    <td className="p-3 border border-gray-200 dark:border-gray-700 outline-none">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded text-xs font-bold">
                        BORRADOR
                      </span>
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    ></td>
                  </tr>
                  {/* Row 4 */}
                  <tr className="hover:bg-primary/5 group transition-colors">
                    <td className="p-2 text-center text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 font-mono text-xs">
                      4
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      Renovación Clínica Jurídica
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      UNIV-0021
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      20/02/2024
                    </td>
                    <td className="p-3 border border-gray-200 dark:border-gray-700 outline-none">
                      <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-xs font-bold">
                        EXPIRADO
                      </span>
                    </td>
                    <td
                      className="p-3 border border-gray-200 dark:border-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-primary/40"
                      contentEditable="true"
                    >
                      Documento vencido, requiere nueva redacción.
                    </td>
                  </tr>
                  {/* Filler Rows */}
                  {Array.from({ length: 11 }).map((_, index) => (
                    <tr
                      key={index + 5}
                      className="hover:bg-primary/5 transition-colors"
                    >
                      <td className="p-2 text-center text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 font-mono text-xs">
                        {index + 5}
                      </td>
                      <td className="p-3 border border-gray-200 dark:border-gray-700 outline-none"></td>
                      <td className="p-3 border border-gray-200 dark:border-gray-700 outline-none"></td>
                      <td className="p-3 border border-gray-200 dark:border-gray-700 outline-none"></td>
                      <td className="p-3 border border-gray-200 dark:border-gray-700 outline-none"></td>
                      <td className="p-3 border border-gray-200 dark:border-gray-700 outline-none"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Right Sidebar: Historial de Cambios */}
          <aside className="w-80 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-[#111318] dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  history
                </span>
                Historial de Cambios
              </h3>
              <button className="text-xs text-primary font-bold hover:underline">
                Ver todo
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* History Item 1 */}
              <div className="relative pl-6 pb-2 border-l-2 border-primary/20">
                <div className="absolute -left-1.5 top-0 size-3 rounded-full bg-primary border-2 border-white dark:border-gray-800"></div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#111318] dark:text-white">
                      Juan Pérez
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Hace 2 min
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Modificó el{" "}
                    <span className="font-medium text-primary">Estado</span> en
                    la fila 3 a "Borrador".
                  </p>
                </div>
              </div>
              {/* History Item 2 */}
              <div className="relative pl-6 pb-2 border-l-2 border-primary/20">
                <div className="absolute -left-1.5 top-0 size-3 rounded-full bg-gray-300 border-2 border-white dark:border-gray-800"></div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#111318] dark:text-white">
                      María García
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Hace 45 min
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Actualizó{" "}
                    <span className="font-medium text-primary">
                      Observaciones
                    </span>{" "}
                    en fila 1.
                  </p>
                </div>
              </div>
              {/* History Item 3 */}
              <div className="relative pl-6 pb-2 border-l-2 border-primary/20">
                <div className="absolute -left-1.5 top-0 size-3 rounded-full bg-gray-300 border-2 border-white dark:border-gray-800"></div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#111318] dark:text-white">
                      Sistema Abogadosoft
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Hoy, 09:15 AM
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Documento{" "}
                    <span className="font-medium text-primary">Vinculado</span>{" "}
                    al Expediente EXP-2024-001.
                  </p>
                </div>
              </div>
              {/* History Item 4 */}
              <div className="relative pl-6 pb-2 border-l-2 border-primary/20">
                <div className="absolute -left-1.5 top-0 size-3 rounded-full bg-gray-300 border-2 border-white dark:border-gray-800"></div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#111318] dark:text-white">
                      Juan Pérez
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Hoy, 08:30 AM
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Creó el archivo a partir de la plantilla{" "}
                    <span className="font-medium">Universidad Base</span>.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
              <button className="w-full py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#111318] dark:text-white text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors">
                Restaurar Versión Anterior
              </button>
            </div>
          </aside>
        </div>
      </main>
      {/* Simple Feedback Toast (Hidden by default, used for demonstration of 'Saved' state) */}
      <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl transition-all border border-gray-700 animate-in slide-in-from-bottom duration-500">
        <span className="material-symbols-outlined text-green-400">
          check_circle
        </span>
        <span className="text-sm font-medium">Todos los cambios guardados</span>
      </div>
    </div>
  );
};