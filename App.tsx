import React, { useState } from "react";
import { ViewState } from "./types";
import { AppHeader } from "./components/AppHeader";
import { AppFooter } from "./components/AppFooter";
import { Dashboard } from "./components/Dashboard";
import { DocumentsList } from "./components/DocumentsList";
import { AgreementsList } from "./components/AgreementsList";
import { DocumentEditor } from "./components/DocumentEditor";
import { ExcelEditor } from "./components/ExcelEditor";
import { ActivityLog } from "./components/ActivityLog";
import { SecurityPage } from "./components/SecurityPage";

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleUploadAndSave = () => {
    if (!selectedFile) return;
    setCurrentView(ViewState.EDITOR);
    setIsUploadModalOpen(false);
    setSelectedFile(null);
  };

  const renderView = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return <Dashboard onNavigate={setCurrentView} />;
      case ViewState.DOCUMENTS:
        return <DocumentsList onNavigate={setCurrentView} />;
      case ViewState.AGREEMENTS:
        return <AgreementsList onNavigate={setCurrentView} />;
      case ViewState.EDITOR:
        return <DocumentEditor onNavigate={setCurrentView} />;
      case ViewState.EXCEL_EDITOR:
        return <ExcelEditor onNavigate={setCurrentView} />;
      case ViewState.ACTIVITY_LOG:
        return <ActivityLog onNavigate={setCurrentView} />;
      case ViewState.SECURITY:
        return <SecurityPage onNavigate={setCurrentView} />;
      default:
        return <Dashboard onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark text-[#111318] dark:text-white">
      <AppHeader
        onNavigate={setCurrentView}
        currentView={currentView}
        onUploadClick={() => setIsUploadModalOpen(true)}
      />
      {renderView()}
      <AppFooter />

      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsUploadModalOpen(false);
            }
          }}
        >
          <div className="bg-white dark:bg-[#1a212f] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-8 pb-4 text-center">
              <h2 className="text-3xl font-bold text-[#111318] dark:text-white">Agregar Nuevo Documento</h2>
              <p className="text-[#616f89] dark:text-[#a0aec0] mt-2 text-lg">
                Seleccione el archivo que desea guardar en el sistema legal.
              </p>
            </div>
            <div className="px-8 py-6">
              <label className="group relative border-4 border-dashed border-[#dbdfe6] dark:border-[#2d3748] rounded-2xl p-12 flex flex-col items-center justify-center bg-gray-50 dark:bg-[#101622] hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                <input
                  accept=".doc,.docx,.pdf,.xls,.xlsx,image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  id="fileInput"
                  type="file"
                  onChange={handleFileChange}
                />
                <div className="bg-primary/10 text-primary p-6 rounded-full mb-6 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-6xl">cloud_upload</span>
                </div>
                <p className="text-xl font-semibold text-[#111318] dark:text-white text-center">
                  Arrastre aquí su archivo o haga clic para buscar
                </p>
                <p className="text-[#616f89] dark:text-[#a0aec0] mt-4 text-sm font-medium">
                  Formatos permitidos: Word, PDF, Excel e Imágenes
                </p>
              </label>
              <div className="mt-6 flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary text-sm">
                <span className="material-symbols-outlined">info</span>
                <p>El documento se guardará de forma segura en el expediente correspondiente.</p>
              </div>
            </div>
            <div className="px-8 py-8 flex flex-col sm:flex-row items-center justify-end gap-4 border-t border-[#dbdfe6] dark:border-[#2d3748]">
              <button
                type="button"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-bold text-[#616f89] dark:text-[#a0aec0] hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedFile(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`w-full sm:w-auto px-10 py-3.5 bg-primary text-white text-base font-bold rounded-xl shadow-lg transition-opacity ${
                  selectedFile ? "hover:opacity-90" : "opacity-50 cursor-not-allowed"
                }`}
                disabled={!selectedFile}
                onClick={handleUploadAndSave}
              >
                Subir y Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
