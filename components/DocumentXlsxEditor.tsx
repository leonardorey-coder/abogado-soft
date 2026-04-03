import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { documentsApi, activityApi, permissionsApi, ApiDocument, ApiActivityLog, TableData, downloadDocument } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatTime, formatDate, formatFileSize, formatTimeAgo } from '../lib/formatters';
import { HistoryTab } from './HistoryTab';
import { CommentsTab } from './CommentsTab';
import { ShareModal } from './ShareModal';
import { Toast } from './ui';

type RightPanel = 'NONE' | 'COMMENTS' | 'VERSIONS' | 'HISTORY' | 'DETAILS';

const ESTADO_OPTIONS = ['VIGENTE', 'REVISIÓN', 'BORRADOR', 'EXPIRADO', 'CANCELADO', 'ACTIVO', 'PENDIENTE'];

function generateRowId() {
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const DocumentXlsxEditor: React.FC = () => {
  const { id: documentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [doc, setDoc] = useState<ApiDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>('COMMENTS');

  const [tableData, setTableData] = useState<TableData>({ columns: [], rows: [] });
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({ message: '', type: 'success', visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [documentActivity, setDocumentActivity] = useState<ApiActivityLog[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [newVersionNote, setNewVersionNote] = useState('');

  const [effectivePermission, setEffectivePermission] = useState<string>('admin');
  const canEdit = effectivePermission === 'write' || effectivePermission === 'admin';

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type, visible: true });
    toastTimer.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  const fetchDocument = useCallback(async () => {
    if (!documentId) { setError('No se proporcionó un ID.'); setLoading(false); return; }
    try {
      setError(null);
      const data = await documentsApi.get(documentId);
      setDoc(data);
    } catch (err: any) {
      setError(err.message ?? 'Error al cargar el documento');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => { fetchDocument(); }, [fetchDocument]);

  useEffect(() => {
    if (!documentId) return;
    permissionsApi.getEffective(documentId)
      .then(res => { setEffectivePermission(res.permission); })
      .catch(() => { setEffectivePermission('read'); });
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;
    setLoadingData(true);
    documentsApi.getXlsxData(documentId)
      .then(data => {
        setTableData({ columns: data.columns, rows: data.rows });
      })
      .catch(err => {
        console.error('Error parsing XLSX:', err);
        showToast('Error al leer el archivo Excel', 'error');
      })
      .finally(() => setLoadingData(false));
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;
    activityApi.list({ page: 1, limit: 100, entityType: 'document', entityId: documentId })
      .then(res => setDocumentActivity(res.data ?? []))
      .catch(() => setDocumentActivity([]));
  }, [documentId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (hasChanges && !isSaving && canEdit) handleSave(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [hasChanges, isSaving, canEdit]);

  const handleSave = useCallback(async (isAutoSave = false, createVersion = false, changeNote?: string) => {
    if (!documentId || !canEdit) return;
    if (isAutoSave && (!hasChanges || isSaving)) return;

    try {
      setIsSaving(true);
      const res = await documentsApi.saveXlsx(documentId, tableData, changeNote, createVersion);
      if (res.ok) {
        setHasChanges(false);
        if (!isAutoSave) showToast(createVersion ? `Version v${res.version} guardada` : 'Cambios guardados');
        if (createVersion) {
          await fetchDocument();
          activityApi.list({ page: 1, limit: 100, entityType: 'document', entityId: documentId })
            .then(r => setDocumentActivity(r.data ?? [])).catch(() => {});
        } else {
          setDoc(prev => prev ? { ...prev, updatedAt: new Date().toISOString(), size: String(res.size) } : prev);
        }
      }
    } catch (err: any) {
      if (!isAutoSave) showToast(`Error al guardar: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [documentId, canEdit, hasChanges, isSaving, tableData, showToast, fetchDocument]);

  const handleCellChange = (rowId: string, colId: string, value: string) => {
    setTableData(prev => ({
      ...prev,
      rows: prev.rows.map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r),
    }));
    setHasChanges(true);
  };

  const handleAddRow = () => {
    const newRow = { id: generateRowId(), cells: {} as Record<string, string> };
    tableData.columns.forEach(col => { newRow.cells[col.id] = ''; });
    setTableData(prev => ({ ...prev, rows: [...prev.rows, newRow] }));
    setHasChanges(true);
  };

  const handleDeleteRow = (rowId: string) => {
    setTableData(prev => ({ ...prev, rows: prev.rows.filter(r => r.id !== rowId) }));
    setHasChanges(true);
  };

  const handleAddComment = async (content: string) => {
    if (!documentId) return;
    try {
      await documentsApi.addComment(documentId, { content });
      await fetchDocument();
    } catch (err) { throw err; }
  };

  const handleDownload = async () => {
    if (!documentId || !doc) return;
    try { await downloadDocument(documentId, doc.name); } catch { showToast('Error al descargar', 'error'); }
  };

  const handleLoadVersion = async (versionId: string) => {
    if (!documentId) return;
    if (versionId === 'current') {
      setLoadingData(true);
      documentsApi.getXlsxData(documentId)
        .then(data => setTableData({ columns: data.columns, rows: data.rows }))
        .finally(() => setLoadingData(false));
      return;
    }
    showToast('Cargando version anterior...');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh] bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
          <p className="text-gray-500 dark:text-gray-400">Cargando documento...</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="bg-background-light dark:bg-background-dark flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-6xl text-red-400 mb-4 block">error</span>
          <h2 className="text-2xl font-bold text-[#0e0e1b] dark:text-white mb-2">Error al cargar documento</h2>
          <p className="text-gray-500 mb-6">{error ?? 'Documento no encontrado'}</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  const versions = doc.versions ?? [];
  const currentVersionEntry = versions.find(v => v.version === doc.version) ?? null;
  const historicalVersions = versions.filter(v => v.version !== doc.version);
  const comments = doc.comments ?? [];

  const renderTable = () => {
    if (loadingData) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
            <p className="text-gray-500">Leyendo archivo Excel...</p>
          </div>
        </div>
      );
    }

    if (tableData.columns.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <span className="material-symbols-outlined text-5xl text-gray-400 mb-4 block">table_rows</span>
            <p className="text-gray-500 font-medium mb-2">No se encontraron datos en el archivo</p>
            {canEdit && (
              <button onClick={handleAddRow} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-blue-700">
                Agregar primera fila
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10">
            <tr>
              <th className="w-10 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-gray-400">#</th>
              {tableData.columns.map(col => (
                <th key={col.id} className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-[140px]">
                  {col.name}
                </th>
              ))}
              {canEdit && <th className="w-10 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"></th>}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, idx) => (
              <tr key={row.id} className="hover:bg-primary/5 transition-colors group">
                <td className="p-2 text-center text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 font-mono text-xs">
                  {idx + 1}
                </td>
                {tableData.columns.map(col => (
                  <td key={col.id} className="p-0 border border-gray-200 dark:border-gray-700">
                    <input
                      type="text"
                      value={row.cells[col.id] || ''}
                      onChange={e => handleCellChange(row.id, col.id, e.target.value)}
                      disabled={!canEdit}
                      className="w-full h-full p-3 bg-transparent outline-none text-sm focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                    />
                  </td>
                ))}
                {canEdit && (
                  <td className="p-1 border border-gray-200 dark:border-gray-700 text-center">
                    <button
                      onClick={() => handleDeleteRow(row.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                      title="Eliminar fila"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderVersionsPanel = () => (
    <>
      <div className="p-4 border-b border-[#e7e7f3] dark:border-white/10 flex flex-col gap-3">
        {historicalVersions.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Modo Comparacion</span>
            <button
              onClick={() => { setIsCompareMode(!isCompareMode); setSelectedVersions([]); }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isCompareMode ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isCompareMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!isCompareMode && hasChanges && canEdit && (
          <div className="p-4 rounded-xl border border-primary bg-primary/5 shadow-sm">
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded">Nueva Version</span>
            <div className="flex items-center gap-2 mt-2">
              <input type="text" className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-2 outline-none focus:border-primary dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="Nota (opcional)" value={newVersionNote} onChange={e => setNewVersionNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { handleSave(false, true, newVersionNote || undefined); setNewVersionNote(''); } }}
              />
              <button onClick={() => { handleSave(false, true, newVersionNote || undefined); setNewVersionNote(''); }}
                className="bg-primary text-white p-2 text-sm rounded-lg hover:bg-blue-700 font-bold">Guardar</button>
            </div>
          </div>
        )}

        <div
          onClick={() => handleLoadVersion('current')}
          className="relative p-4 rounded-xl border border-[#e7e7f3] dark:border-white/10 hover:bg-background-light dark:hover:bg-white/5 cursor-pointer"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="bg-primary text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">Version Actual</span>
            <span className="text-xs text-gray-500">{formatTime(doc.updatedAt)}</span>
          </div>
          <p className="font-bold text-[#0e0e1b] dark:text-white text-lg">v{doc.version}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{currentVersionEntry?.changeNote ?? 'Sin nota'}</p>
          <p className="text-xs text-gray-400 mt-2 border-t pt-2 border-dashed border-gray-200 dark:border-gray-700">Por: {doc.owner?.name ?? 'Sistema'}</p>
        </div>

        {historicalVersions.map(v => (
          <div key={v.id} onClick={() => handleLoadVersion(v.id)}
            className="p-4 rounded-xl border border-[#e7e7f3] dark:border-white/10 hover:bg-background-light dark:hover:bg-white/5 cursor-pointer">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">v{v.version}</span>
              <span className="text-xs text-gray-500">{formatTime(v.createdAt)}</span>
            </div>
            <p className="font-bold text-[#0e0e1b] dark:text-white mt-1">{formatDate(v.createdAt)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{v.changeNote ?? 'Sin nota'}</p>
            <p className="text-xs text-gray-400 mt-2 border-t pt-2 border-dashed border-gray-200 dark:border-gray-700">
              Por: {v.creator?.name ?? 'Sistema'} -- {formatFileSize(v.size)}
            </p>
          </div>
        ))}

        {historicalVersions.length === 0 && (
          <div className="p-8 text-center text-gray-400 border border-dashed rounded-xl border-gray-200">
            <span className="material-symbols-outlined text-3xl mb-2 block">history</span>
            <p className="text-sm">Sin versiones anteriores</p>
          </div>
        )}
      </div>
    </>
  );

  const renderDetailsPanel = () => (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <div className="space-y-4">
        <h3 className="font-bold text-[#0e0e1b] dark:text-white text-lg border-b border-gray-200 dark:border-gray-800 pb-2">Informacion</h3>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Nombre</label>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words">{doc.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Tipo</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{doc.type.toUpperCase()}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Tamano</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatFileSize(doc.size)}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Version</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">v{doc.version}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Estado</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{doc.fileStatus}</p>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Propietario</label>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{doc.owner?.name ?? 'Sin asignar'}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Modificado</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatDate(doc.updatedAt)}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Creado</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatDate(doc.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-background-light dark:bg-background-dark font-display flex-1 flex flex-col text-[#111318] dark:text-white">
      <div className="flex grow min-h-0 overflow-hidden relative">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 border-r border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark flex-col p-4 fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] overflow-y-auto">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-[#0e0e1b] dark:text-white font-bold text-sm hover:text-primary transition-colors mb-6 -ml-1">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            Atras
          </button>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">table_view</span>
              <span className="text-xs font-bold text-gray-400 uppercase">{doc.type.toUpperCase()}</span>
            </div>
            <h1 className="text-lg font-bold text-[#0e0e1b] dark:text-white leading-tight">{doc.name}</h1>
            <p className="text-gray-500 text-sm mt-1">v{doc.version} -- {formatFileSize(doc.size)}</p>
            {doc.owner && <p className="text-gray-400 text-xs mt-1">Por: {doc.owner.name}</p>}
          </div>
          <nav className="flex flex-col gap-2 grow">
            {([
              { key: 'COMMENTS' as RightPanel, icon: 'chat_bubble', label: `Comentarios (${comments.length})` },
              { key: 'VERSIONS' as RightPanel, icon: 'layers', label: 'Versiones' },
              { key: 'HISTORY' as RightPanel, icon: 'history', label: 'Historial' },
              { key: 'DETAILS' as RightPanel, icon: 'info', label: 'Detalles' },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setRightPanel(rightPanel === tab.key ? 'NONE' : tab.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors text-left w-full ${rightPanel === tab.key ? 'bg-primary text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5'}`}>
                <span className="material-symbols-outlined">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 flex flex-col bg-background-light dark:bg-[#0a0a14] overflow-hidden lg:ml-64 min-w-0 transition-all duration-300 ${rightPanel !== 'NONE' ? 'lg:mr-80' : ''}`}>
          <div className={`fixed left-0 lg:left-64 top-16 z-30 h-[72px] flex items-center justify-between bg-white dark:bg-background-dark border-b border-[#e7e7f3] dark:border-white/10 px-4 lg:px-6 transition-all duration-300 ${rightPanel !== 'NONE' ? 'right-0 lg:right-80' : 'right-0'} overflow-x-auto no-scrollbar`}>
            <div className="flex items-center gap-3">
              {canEdit && (
                <button onClick={() => handleSave(false)} disabled={isSaving || !hasChanges}
                  className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-primary text-white rounded-xl font-bold text-sm sm:text-lg shadow-lg shadow-primary/20 hover:bg-blue-700 hover:scale-[1.02] transition-transform disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed shrink-0">
                  <span className={`material-symbols-outlined text-xl sm:text-2xl ${isSaving ? 'animate-spin' : ''}`}>{isSaving ? 'progress_activity' : 'save'}</span>
                  <span className="hidden sm:inline">{isSaving ? 'Guardando...' : 'Guardar'}</span>
                </button>
              )}
              {!canEdit && (
                <span className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 shrink-0">
                  <span className="material-symbols-outlined text-base">lock</span> Solo lectura
                </span>
              )}
              {canEdit && (
                <button onClick={handleAddRow} className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 rounded-xl font-bold text-sm hover:bg-background-light dark:hover:bg-white/10 transition-colors shrink-0">
                  <span className="material-symbols-outlined text-xl text-primary">add_box</span>
                  <span className="hidden sm:inline">Agregar Fila</span>
                </button>
              )}
              <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 rounded-xl font-bold text-sm hover:bg-background-light dark:hover:bg-white/10 transition-colors shrink-0">
                <span className="material-symbols-outlined text-xl">download</span>
                <span className="hidden sm:inline">Descargar</span>
              </button>
              <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 rounded-xl font-bold text-sm hover:bg-background-light dark:hover:bg-white/10 transition-colors shrink-0">
                <span className="material-symbols-outlined text-xl">share</span>
                <span className="hidden sm:inline">Compartir</span>
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0 ml-4">
              <span className={`material-symbols-outlined ${hasChanges ? 'text-amber-500' : 'text-green-500'} text-lg`}>
                {hasChanges ? 'sync_problem' : 'cloud_done'}
              </span>
              <span className="hidden sm:inline">{hasChanges ? 'Cambios sin guardar' : `Actualizado: ${formatTimeAgo(doc.updatedAt)}`}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pt-[72px] pb-24 lg:pb-0 flex flex-col">
            <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 m-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              {renderTable()}
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        {rightPanel !== 'NONE' && (
          <aside className="w-full lg:w-80 shrink-0 border-l border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark flex flex-col fixed right-0 top-16 z-50 lg:z-40 h-[calc(100vh-4rem)] shadow-2xl lg:shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e7e7f3] dark:border-white/10 bg-gray-50/50 dark:bg-gray-800/50">
              <span className="font-black text-[#0e0e1b] dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  {rightPanel === 'COMMENTS' && 'chat_bubble'}
                  {rightPanel === 'VERSIONS' && 'layers'}
                  {rightPanel === 'HISTORY' && 'history'}
                  {rightPanel === 'DETAILS' && 'info'}
                </span>
                {rightPanel === 'COMMENTS' && 'Comentarios'}
                {rightPanel === 'VERSIONS' && 'Versiones'}
                {rightPanel === 'HISTORY' && 'Historial Completo'}
                {rightPanel === 'DETAILS' && 'Detalles'}
              </span>
              <button onClick={() => setRightPanel('NONE')} className="text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <span className="material-symbols-outlined text-lg block">close</span>
              </button>
            </div>
            {rightPanel === 'COMMENTS' && <CommentsTab comments={comments as any} onAddComment={handleAddComment} />}
            {rightPanel === 'VERSIONS' && renderVersionsPanel()}
            {rightPanel === 'HISTORY' && (
              <div className="flex-1 overflow-y-auto w-full">
                <HistoryTab versions={(currentVersionEntry ? [currentVersionEntry, ...historicalVersions] : historicalVersions) as any} activityLogs={documentActivity} />
              </div>
            )}
            {rightPanel === 'DETAILS' && renderDetailsPanel()}
          </aside>
        )}
      </div>

      {/* Mobile Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 pb-safe flex items-center justify-around h-16 px-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {([
          { key: 'COMMENTS' as RightPanel, icon: 'chat_bubble', label: 'Comentarios' },
          { key: 'VERSIONS' as RightPanel, icon: 'layers', label: 'Versiones' },
          { key: 'HISTORY' as RightPanel, icon: 'history', label: 'Historial' },
          { key: 'DETAILS' as RightPanel, icon: 'info', label: 'Detalles' },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setRightPanel(rightPanel === tab.key ? 'NONE' : tab.key)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative ${rightPanel === tab.key ? 'text-primary dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {rightPanel === tab.key && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full" />}
            <div className={`p-1 rounded-xl transition-colors ${rightPanel === tab.key ? 'bg-primary/10' : ''}`}>
              <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
            </div>
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </button>
        ))}
      </div>

      {showShareModal && doc && <ShareModal document={doc as any} onClose={() => setShowShareModal(false)} />}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </div>
  );
};
