import { ViewState } from '../types';

/** Mapeo centralizado ViewState → path. Útil para migración gradual. */
export const ROUTES: Record<ViewState, string> = {
    [ViewState.LOGIN]: '/login',
    [ViewState.REGISTER]: '/registro',
    [ViewState.COMPLETE_PROFILE]: '/completar-perfil',
    [ViewState.DASHBOARD]: '/',
    [ViewState.DESKTOP]: '/mi-escritorio',
    [ViewState.DOCUMENTS]: '/documentos',
    [ViewState.ASIGNED]: '/asignados',
    [ViewState.AGREEMENTS]: '/convenios',
    [ViewState.TEAM]: '/equipo',
    [ViewState.EDITOR]: '/documento',
    [ViewState.EXCEL_EDITOR]: '/documento',
    [ViewState.ACTIVITY_LOG]: '/actividad',
    [ViewState.SECURITY]: '/seguridad',
    [ViewState.TRASH]: '/papelera',
    [ViewState.TERMS]: '/terminos',
    [ViewState.PRIVACY]: '/privacidad',
    [ViewState.SECURITY_INFO]: '/informacion-seguridad',
};

export function getDocumentRoute(docId: string, docType?: string): string {
    const t = docType?.toUpperCase();
    if (t === 'XLSX' || t === 'XLS') return `/documento/${docId}/excel`;
    return `/documento/${docId}`;
}
