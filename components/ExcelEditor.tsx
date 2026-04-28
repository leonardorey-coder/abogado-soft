import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { conveniosApi, activityApi, ApiConvenio, ApiActivityLog, TableData } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatTime, formatDate, formatTimeAgo } from '../lib/formatters';
import { HistoryTab } from './HistoryTab';
import { CommentsTab } from './CommentsTab';
import { ShareModal } from './ShareModal';
import { Toast } from './ui';
import { getViewerLabel } from '../lib/viewerIdentity';

type RightPanel = 'NONE' | 'COMMENTS' | 'VERSIONS' | 'HISTORY' | 'DETAILS';

const DEFAULT_COLUMNS: TableData['columns'] = [
  { id: 'nombre', name: 'Nombre del Convenio', type: 'text' },
  { id: 'idInstitucion', name: 'ID Institución', type: 'text' },
  { id: 'fechaFirma', name: 'Fecha de Firma', type: 'date' },
  { id: 'estado', name: 'Estado', type: 'status' },
  { id: 'observaciones', name: 'Observaciones Legales', type: 'text' },
];

const ESTADO_OPTIONS = ['VIGENTE', 'REVISIÓN', 'BORRADOR', 'EXPIRADO', 'CANCELADO'];

function getEstadoBadge(estado: string) {
  const s = estado?.toUpperCase() || '';
  if (s === 'VIGENTE' || s === 'ACTIVO') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (s === 'REVISIÓN' || s === 'PENDIENTE') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  if (s === 'BORRADOR') return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  if (s === 'EXPIRADO' || s === 'VENCIDO') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (s === 'CANCELADO') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-gray-100 text-gray-600';
}

function getConvenioStatusBadge(estado: string) {
  switch (estado) {
    case 'activo': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'pendiente': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'vencido': case 'expirado': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'cancelado': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function generateRowId() {
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const ExcelEditor: React.FC = () => {
  const { id: convenioId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [convenio, setConvenio] = useState<ApiConvenio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>('NONE');

  const [tableData, setTableData] = useState<TableData>({ columns: DEFAULT_COLUMNS, rows: [] });
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({ message: '', type: 'success', visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [documentActivity, setDocumentActivity] = useState<ApiActivityLog[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [showDiff, setShowDiff] = useState(false);
  const [diffData, setDiffData] = useState<any[] | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const [newVersionNote, setNewVersionNote] = useState('');

  const canEdit = authUser?.role === 'admin' || convenio?.responsableId === authUser?.id;

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type, visible: true });
    toastTimer.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  const fetchConvenio = useCallback(async () => {
    if (!convenioId) { setError('No se proporcionó un ID.'); setLoading(false); return; }
    try {
      setError(null);
      const data = await conveniosApi.get(convenioId);
      setConvenio(data);
      if (data.tableData) {
        setTableData(data.tableData);
      }
    } catch (err: any) {
      setError(err.message ?? 'Error al cargar el convenio');
    } finally {
      setLoading(false);
    }
  }, [convenioId]);

  useEffect(() => { fetchConvenio(); }, [fetchConvenio]);

  useEffect(() => {
    if (!convenioId) return;
    activityApi.list({ page: 1, limit: 100, entityType: 'convenio', entityId: convenioId })
      .then(res => setDocumentActivity(res.data ?? []))
      .catch(() => setDocumentActivity([]));
  }, [convenioId]);

  // Auto-save every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasChanges && !isSaving && canEdit) {
        handleSave(true);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [hasChanges, isSaving, canEdit]);

  const handleSave = useCallback(async (isAutoSave = false, createVersion = false, changeNote?: string) => {
    if (!convenioId || !canEdit) return;
    if (isAutoSave && (!hasChanges || isSaving)) return;

    try {
      setIsSaving(true);
      const res = await conveniosApi.saveTable(convenioId, tableData, changeNote, createVersion);
      if (res.ok) {
        setHasChanges(false);
        if (!isAutoSave) showToast(createVersion ? `Versión v${res.version} guardada` : 'Cambios guardados');
        if (createVersion) {
          const freshData = await conveniosApi.get(convenioId);
          setConvenio(freshData);
          activityApi.list({ page: 1, limit: 100, entityType: 'convenio', entityId: convenioId })
            .then(r => setDocumentActivity(r.data ?? [])).catch(() => {});
        } else {
          setConvenio(prev => prev ? { ...prev, updatedAt: new Date().toISOString() } : prev);
        }
      }
    } catch (err: any) {
      if (!isAutoSave) showToast(`Error al guardar: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [convenioId, canEdit, hasChanges, isSaving, tableData, showToast]);

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
    if (!convenioId) return;
    try {
      await conveniosApi.addComment(convenioId, { content });
      await fetchConvenio();
    } catch (err) {
      throw err;
    }
  };

  const handleExport = async () => {
    if (!convenioId || !convenio) return;
    try {
      await conveniosApi.exportXlsx(convenioId, `${convenio.numero}_${convenio.institucion}.xlsx`);
      showToast('Archivo exportado');
    } catch (err: any) {
      showToast('Error al exportar', 'error');
    }
  };

  const toggleVersionSelection = (id: string) => {
    if (selectedVersions.includes(id)) setSelectedVersions(selectedVersions.filter(v => v !== id));
    else if (selectedVersions.length < 2) setSelectedVersions([...selectedVersions, id]);
  };

  const handleCompare = async () => {
    if (selectedVersions.length !== 2 || !convenio || !convenioId) return;
    setShowDiff(true);
    setLoadingDiff(true);
    try {
      const getVNum = (id: string) => id === 'current' ? convenio.version : versions.find(v => v.id === id)?.version;
      const vA = getVNum(selectedVersions[0]);
      const vB = getVNum(selectedVersions[1]);
      if (vA && vB) {
        const res = await fetch(`${(import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4000/api'}/convenios/${convenioId}/diff?v1=${Math.min(vA, vB)}&v2=${Math.max(vA, vB)}`, {
          headers: { Authorization: `Bearer ${(await (await import('../lib/auth')).getAccessToken()) || ''}` },
        });
        if (res.ok) setDiffData(await res.json());
      }
    } catch { /* ignore */ } finally { setLoadingDiff(false); }
  };

  const handleLoadVersion = (versionId: string) => {
    if (versionId === 'current') {
      if (convenio?.tableData) setTableData(convenio.tableData);
      return;
    }
    const ver = versions.find(v => v.id === versionId);
    if (ver?.snapshotData?.tableData) {
      setTableData(ver.snapshotData.tableData);
      showToast(`Cargada versión v${ver.version} (vista previa)`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh] bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
          <p className="text-gray-500 dark:text-gray-400">Cargando convenio...</p>
        </div>
      </div>
    );
  }

  if (error || !convenio) {
    return (
      <div className="bg-background-light dark:bg-background-dark flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-6xl text-red-400 mb-4 block">error</span>
          <h2 className="text-2xl font-bold text-[#0e0e1b] dark:text-white mb-2">Error al cargar convenio</h2>
          <p className="text-gray-500 mb-6">{error ?? 'Convenio no encontrado'}</p>
          <button onClick={() => navigate('/convenios')} className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
            Volver a Convenios
          </button>
        </div>
      </div>
    );
  }

  const versions = convenio.versions ?? [];
  const currentVersionEntry = versions.find(v => v.version === convenio.version) ?? null;
  const historicalVersions = versions.filter(v => v.version !== convenio.version);
  const comments = convenio.comments ?? [];

  const renderDiffView = () => {
    if (loadingDiff) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin size-12 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      );
    }
    if (!diffData) return <div className="flex-1 flex items-center justify-center text-gray-500">No se encontraron diferencias</div>;
    return (
      <div className="flex-1 overflow-auto p-6">
        <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
          {diffData.map((part: any, i: number) => (
            <span key={i} className={part.added ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : part.removed ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 line-through' : ''}>
              {part.value}
            </span>
          ))}
        </pre>
      </div>
    );
  };

  const renderTable = () => (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10">
          <tr>
            <th className="w-10 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-gray-400">#</th>
            {tableData.columns.map(col => (
              <th key={col.id} className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-[150px]">
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
                  {col.type === 'status' ? (
                    <select
                      value={row.cells[col.id] || ''}
                      onChange={e => handleCellChange(row.id, col.id, e.target.value)}
                      disabled={!canEdit}
                      className="w-full h-full p-3 bg-transparent outline-none text-sm disabled:opacity-60"
                    >
                      <option value="">Seleccionar...</option>
                      {ESTADO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={col.type === 'date' ? 'date' : 'text'}
                      value={row.cells[col.id] || ''}
                      onChange={e => handleCellChange(row.id, col.id, e.target.value)}
                      disabled={!canEdit}
                      className="w-full h-full p-3 bg-transparent outline-none text-sm focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                      placeholder={col.type === 'date' ? 'YYYY-MM-DD' : ''}
                    />
                  )}
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
          {tableData.rows.length === 0 && (
            <tr>
              <td colSpan={tableData.columns.length + (canEdit ? 2 : 1)} className="p-12 text-center text-gray-400 border border-gray-200 dark:border-gray-700">
                <span className="material-symbols-outlined text-4xl mb-2 block">table_rows</span>
                <p className="font-medium">Sin datos en la tabla</p>
                {canEdit && <p className="text-xs mt-1">Usa "Agregar Fila" para comenzar</p>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderVersionsPanel = () => (
    <>
      <div className="p-4 border-b border-[#e7e7f3] dark:border-white/10 flex flex-col gap-3">
        {historicalVersions.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Modo Comparación</span>
              <button
                onClick={() => { setIsCompareMode(!isCompareMode); setSelectedVersions([]); setShowDiff(false); setDiffData(null); }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isCompareMode ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isCompareMode ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {isCompareMode && (
              <div className="text-xs text-primary font-bold bg-blue-50 dark:bg-primary/10 p-2.5 rounded-lg">
                Selecciona 2 versiones para comparar
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!isCompareMode && hasChanges && canEdit && (
          <div className="p-4 rounded-xl border border-primary bg-primary/5 shadow-sm">
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded">Nueva Versión</span>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                placeholder="Nota (opcional)"
                value={newVersionNote}
                onChange={e => setNewVersionNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { handleSave(false, true, newVersionNote || undefined); setNewVersionNote(''); } }}
              />
              <button
                onClick={() => { handleSave(false, true, newVersionNote || undefined); setNewVersionNote(''); }}
                className="bg-primary text-white p-2 text-sm rounded-lg hover:bg-blue-700 transition-colors font-bold"
              >
                Guardar
              </button>
            </div>
          </div>
        )}

        <div
          onClick={() => { if (isCompareMode) toggleVersionSelection('current'); else handleLoadVersion('current'); }}
          className={`relative p-4 rounded-xl border transition-all cursor-pointer ${selectedVersions.includes('current') ? 'border-primary ring-2 ring-offset-2 ring-primary bg-primary/5' : 'border-[#e7e7f3] dark:border-white/10 hover:bg-background-light dark:hover:bg-white/5'}`}
        >
          {isCompareMode && (
            <div className="absolute top-3 right-3">
              <div className={`size-5 rounded border flex items-center justify-center ${selectedVersions.includes('current') ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>
                {selectedVersions.includes('current') && <span className="material-symbols-outlined text-white text-xs">check</span>}
              </div>
            </div>
          )}
          <div className="flex justify-between items-start mb-2">
            <span className="bg-primary text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">Versión Actual</span>
            <span className="text-xs text-gray-500">{formatTime(convenio.updatedAt)}</span>
          </div>
          <p className="font-bold text-[#0e0e1b] dark:text-white text-lg">v{convenio.version}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{currentVersionEntry?.changeNote ?? 'Sin nota de cambio'}</p>
          <p className="text-xs text-gray-400 mt-2 border-t pt-2 border-dashed border-gray-200 dark:border-gray-700">
            Por: {convenio.responsable?.name ?? 'Sistema'}
          </p>
        </div>

        {historicalVersions.map(v => (
          <div
            key={v.id}
            onClick={() => { if (isCompareMode) toggleVersionSelection(v.id); else handleLoadVersion(v.id); }}
            className={`p-4 rounded-xl border transition-all cursor-pointer group relative border-[#e7e7f3] dark:border-white/10 hover:bg-background-light dark:hover:bg-white/5 ${selectedVersions.includes(v.id) ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
          >
            {isCompareMode && (
              <div className="absolute top-3 right-3">
                <div className={`size-5 rounded border flex items-center justify-center ${selectedVersions.includes(v.id) ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>
                  {selectedVersions.includes(v.id) && <span className="material-symbols-outlined text-white text-xs">check</span>}
                </div>
              </div>
            )}
            <div className="flex justify-between items-start mb-2 pr-6">
              <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">v{v.version}</span>
              <span className="text-xs text-gray-500">{formatTime(v.createdAt)}</span>
            </div>
            <p className="font-bold text-[#0e0e1b] dark:text-white mt-1">{formatDate(v.createdAt)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{v.changeNote ?? 'Sin nota de cambio'}</p>
            <p className="text-xs text-gray-400 mt-2 border-t pt-2 border-dashed border-gray-200 dark:border-gray-700">
              Por: {getViewerLabel({
                subjectId: v.creator?.id,
                subjectName: v.creator?.name,
                currentUserId: authUser?.id,
                fallback: "Sistema",
              })}
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

      {isCompareMode && selectedVersions.length === 2 && (
        <div className="p-4 border-t border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
          <button onClick={handleCompare} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-white font-bold shadow-lg hover:bg-blue-700 transition-all">
            <span className="material-symbols-outlined">compare_arrows</span>
            Comparar Versiones
          </button>
        </div>
      )}
    </>
  );

  const renderDetailsPanel = () => (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <div className="space-y-4">
        <h3 className="font-bold text-[#0e0e1b] dark:text-white text-lg border-b border-gray-200 dark:border-gray-800 pb-2">Información del Convenio</h3>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Número</label>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{convenio.numero}</p>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Institución</label>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{convenio.institucion}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Estado</label>
            <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getConvenioStatusBadge(convenio.estado)}`}>
              {convenio.estado.toUpperCase()}
            </span>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Versión</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">v{convenio.version}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Fecha Inicio</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatDate(convenio.fechaInicio)}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Fecha Fin</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatDate(convenio.fechaFin)}</p>
          </div>
        </div>
        {convenio.departamento && (
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Departamento</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{convenio.departamento}</p>
          </div>
        )}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Responsable</label>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{convenio.responsable?.name ?? 'Sin asignar'}</p>
        </div>
        {convenio.descripcion && (
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Descripción</label>
            <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-[#e7e7f3] dark:border-white/10">
              {convenio.descripcion}
            </p>
          </div>
        )}
        {convenio.notas && (
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Notas</label>
            <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-[#e7e7f3] dark:border-white/10">
              {convenio.notas}
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Modificado</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatDate(convenio.updatedAt)}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Creado</label>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{formatDate(convenio.createdAt)}</p>
          </div>
        </div>
      </div>

      {convenio.documents && convenio.documents.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <h3 className="font-bold text-[#0e0e1b] dark:text-white text-lg pb-1">Documentos Vinculados</h3>
          {convenio.documents.map(d => (
            <button
              key={d.document.id}
              onClick={() => {
                const t = d.document.type?.toUpperCase();
                navigate(t === 'XLSX' || t === 'XLS' ? `/documento/${d.document.id}/excel` : `/documento/${d.document.id}`);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-primary">description</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{d.document.name}</p>
                <p className="text-xs text-gray-400">{d.document.type.toUpperCase()}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-background-light dark:bg-background-dark font-display flex-1 flex flex-col text-[#111318] dark:text-white">
      <div className="flex grow min-h-0 overflow-hidden relative">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 border-r border-[#e7e7f3] dark:border-white/10 bg-white dark:bg-background-dark flex-col p-4 fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] overflow-y-auto">
          <button type="button" onClick={() => navigate('/convenios')} className="flex items-center gap-2 text-[#0e0e1b] dark:text-white font-bold text-sm hover:text-primary transition-colors mb-6 -ml-1">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            Convenios
          </button>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary">table_view</span>
              <span className="text-xs font-bold text-gray-400 uppercase">TABLA</span>
            </div>
            <h1 className="text-lg font-bold text-[#0e0e1b] dark:text-white leading-tight">{convenio.numero}</h1>
            <p className="text-gray-500 text-sm mt-1">{convenio.institucion}</p>
            <p className="text-gray-400 text-xs mt-1">v{convenio.version}</p>
            <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold ${getConvenioStatusBadge(convenio.estado)}`}>
              {convenio.estado.toUpperCase()}
            </span>
          </div>
          <nav className="flex flex-col gap-2 grow">
            {([
              { key: 'COMMENTS' as RightPanel, icon: 'chat_bubble', label: `Comentarios (${comments.length})` },
              { key: 'VERSIONS' as RightPanel, icon: 'layers', label: 'Versiones' },
              { key: 'HISTORY' as RightPanel, icon: 'history', label: 'Historial' },
              { key: 'DETAILS' as RightPanel, icon: 'info', label: 'Detalles' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setRightPanel(rightPanel === tab.key ? 'NONE' : tab.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors text-left w-full ${rightPanel === tab.key
                  ? 'bg-primary text-white font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 flex flex-col bg-background-light dark:bg-[#0a0a14] overflow-hidden lg:ml-64 min-w-0 transition-all duration-300 ${rightPanel !== 'NONE' ? 'lg:mr-80' : ''}`}>
          {/* Toolbar */}
          <div className={`fixed left-0 lg:left-64 top-16 z-30 h-[72px] flex items-center justify-between bg-white dark:bg-background-dark border-b border-[#e7e7f3] dark:border-white/10 px-4 lg:px-6 transition-all duration-300 ${rightPanel !== 'NONE' ? 'right-0 lg:right-80' : 'right-0'} overflow-x-auto no-scrollbar`}>
            <div className="flex items-center gap-3">
              {showDiff ? (
                <button onClick={() => { setShowDiff(false); setIsCompareMode(false); setSelectedVersions([]); setDiffData(null); }} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-gray-700 transition-colors shrink-0">
                  <span className="material-symbols-outlined text-xl">close</span>
                  <span className="hidden sm:inline">Salir de Comparación</span>
                </button>
              ) : (
                <>
                  {canEdit && (
                    <button
                      onClick={() => handleSave(false)}
                      disabled={isSaving || !hasChanges}
                      className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-primary text-white rounded-xl font-bold text-sm sm:text-lg shadow-lg shadow-primary/20 hover:bg-blue-700 hover:scale-[1.02] transition-transform disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed shrink-0"
                    >
                      <span className={`material-symbols-outlined text-xl sm:text-2xl ${isSaving ? 'animate-spin' : ''}`}>
                        {isSaving ? 'progress_activity' : 'save'}
                      </span>
                      <span className="hidden sm:inline">{isSaving ? 'Guardando...' : 'Guardar'}</span>
                    </button>
                  )}
                  {!canEdit && (
                    <span className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 shrink-0">
                      <span className="material-symbols-outlined text-base">lock</span>
                      Solo lectura
                    </span>
                  )}
                  {canEdit && (
                    <button onClick={handleAddRow} className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 rounded-xl font-bold text-sm hover:bg-background-light dark:hover:bg-white/10 transition-colors shrink-0">
                      <span className="material-symbols-outlined text-xl text-primary">add_box</span>
                      <span className="hidden sm:inline">Agregar Fila</span>
                    </button>
                  )}
                  <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 rounded-xl font-bold text-sm hover:bg-background-light dark:hover:bg-white/10 transition-colors shrink-0">
                    <span className="material-symbols-outlined text-xl">download</span>
                    <span className="hidden sm:inline">Exportar Excel</span>
                  </button>
                  <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 bg-white dark:bg-white/5 border border-[#d0d0e7] dark:border-white/10 rounded-xl font-bold text-sm hover:bg-background-light dark:hover:bg-white/10 transition-colors shrink-0">
                    <span className="material-symbols-outlined text-xl">share</span>
                    <span className="hidden sm:inline">Compartir</span>
                  </button>
                </>
              )}
            </div>
            {!showDiff && (
              <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0 ml-4">
                <span className={`material-symbols-outlined ${hasChanges ? 'text-amber-500' : 'text-green-500'} text-lg`}>
                  {hasChanges ? 'sync_problem' : 'cloud_done'}
                </span>
                <span className="hidden sm:inline">{hasChanges ? 'Cambios sin guardar' : `Actualizado: ${formatTimeAgo(convenio.updatedAt)}`}</span>
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto pt-[72px] pb-24 lg:pb-0 flex flex-col">
            {showDiff ? renderDiffView() : (
              <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 m-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                {renderTable()}
              </div>
            )}
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
          <button
            key={tab.key}
            onClick={() => setRightPanel(rightPanel === tab.key ? 'NONE' : tab.key)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative ${rightPanel === tab.key ? 'text-primary dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}
          >
            {rightPanel === tab.key && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full" />}
            <div className={`p-1 rounded-xl transition-colors ${rightPanel === tab.key ? 'bg-primary/10' : ''}`}>
              <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
            </div>
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </button>
        ))}
      </div>

      {showShareModal && convenio && (
        <ShareModal document={{ id: convenio.id, name: `${convenio.numero} - ${convenio.institucion}` } as any} onClose={() => setShowShareModal(false)} />
      )}

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </div>
  );
};
