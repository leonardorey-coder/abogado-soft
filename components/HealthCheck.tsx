// ============================================================================
// HealthCheck — Prueba todas las APIs del backend y muestra el estado
// Ruta: /health
// ============================================================================

import React, { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";

const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000/api";

interface CheckResult {
    name: string;
    group: string;
    endpoint: string;
    status: "pending" | "ok" | "fail" | "warn";
    ms: number;
    detail?: string;
    httpStatus?: number;
}

// Obtener token de Supabase para requests autenticados
async function getToken(): Promise<string | null> {
    try {
        const { supabase } = await import("../lib/supabaseAuth");
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
    } catch {
        return null;
    }
}

async function checkEndpoint(
    name: string,
    group: string,
    path: string,
    token: string | null,
    method: string = "GET"
): Promise<CheckResult> {
    const endpoint = `${method} ${path}`;
    const start = performance.now();
    try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}${path}`, {
            method,
            headers,
            signal: AbortSignal.timeout(10000),
        });

        const ms = Math.round(performance.now() - start);
        const httpStatus = res.status;

        if (res.ok) {
            let detail = `${httpStatus} OK`;
            try {
                const json = await res.json();
                if (json.data && Array.isArray(json.data)) {
                    detail += ` — ${json.data.length} items`;
                } else if (json.pagination) {
                    detail += ` — total: ${json.pagination.total}`;
                }
            } catch {
                detail += " (no JSON)";
            }
            return { name, group, endpoint, status: "ok", ms, detail, httpStatus };
        }

        // 401 sin token es esperado
        if (httpStatus === 401 && !token) {
            return { name, group, endpoint, status: "warn", ms, detail: "401 — Sin autenticación", httpStatus };
        }

        let errorText = "";
        try { errorText = await res.text(); } catch { /* */ }
        return {
            name,
            group,
            endpoint,
            status: httpStatus >= 500 ? "fail" : "warn",
            ms,
            detail: `${httpStatus} — ${errorText.slice(0, 120)}`,
            httpStatus,
        };
    } catch (err: any) {
        const ms = Math.round(performance.now() - start);
        const detail = err?.name === "AbortError" ? "Timeout (10s)" : err?.message ?? "Error desconocido";
        return { name, group, endpoint, status: "fail", ms, detail };
    }
}

const CHECKS = [
    // Auth
    { name: "Backend: Health", group: "Backend", path: "/health" },
    { name: "Auth: Me", group: "Auth", path: "/auth/me" },
    // Documentos
    { name: "Documentos: Listar", group: "Documentos", path: "/documents?limit=1" },
    { name: "Documentos: Papelera", group: "Documentos", path: "/documents/trash" },
    // Convenios
    { name: "Convenios: Listar", group: "Convenios", path: "/convenios?limit=1" },
    // Casos
    { name: "Casos: Listar", group: "Casos", path: "/cases?limit=1" },
    // Asignaciones
    { name: "Asignaciones: Recibidas", group: "Asignaciones", path: "/assignments?limit=1" },
    { name: "Asignaciones: Enviadas", group: "Asignaciones", path: "/assignments/sent?limit=1" },
    // Actividad
    { name: "Actividad: Listar", group: "Actividad", path: "/activity?limit=1" },
    { name: "Actividad: Estadísticas", group: "Actividad", path: "/activity/stats" },
    // Grupos
    { name: "Grupos: Listar", group: "Grupos", path: "/groups" },
    // Usuarios
    { name: "Usuarios: Listar", group: "Usuarios", path: "/users?limit=1" },
    // Notificaciones
    { name: "Notificaciones: Listar", group: "Notificaciones", path: "/notifications?limit=1" },
    // Backups
    { name: "Backups: Listar", group: "Backups", path: "/backups?limit=1" },
];

export const HealthCheck: React.FC = () => {
    const [results, setResults] = useState<CheckResult[]>([]);
    const [running, setRunning] = useState(false);
    const [serverReachable, setServerReachable] = useState<boolean | null>(null);
    const [serverMs, setServerMs] = useState(0);
    const [copied, setCopied] = useState(false);

    const buildLogText = useCallback(() => {
        const lines: string[] = [];
        lines.push(`═══════════════════════════════════════════════`);
        lines.push(`  ABOGADOSOFT — API Health Check Report`);
        lines.push(`═══════════════════════════════════════════════`);
        lines.push(`Fecha:    ${new Date().toLocaleString('es-MX')}`);
        lines.push(`API URL:  ${API_URL}`);
        lines.push(`Servidor: ${serverReachable === true ? '✅ Online' : serverReachable === false ? '❌ Offline' : '⏳ Pendiente'} (${serverMs}ms)`);
        lines.push(``);
        lines.push(`Resumen:  ✅ ${results.filter(r => r.status === 'ok').length} OK  |  ⚠️ ${results.filter(r => r.status === 'warn').length} Warn  |  ❌ ${results.filter(r => r.status === 'fail').length} Fail  |  ⏳ ${results.filter(r => r.status === 'pending').length} Pending`);
        lines.push(`───────────────────────────────────────────────`);
        lines.push(``);

        const groups = [...new Set(results.map(r => r.group))];
        for (const group of groups) {
            const groupResults = results.filter(r => r.group === group);
            lines.push(`▸ ${group}`);
            for (const r of groupResults) {
                const icon = r.status === 'ok' ? '✅' : r.status === 'fail' ? '❌' : r.status === 'warn' ? '⚠️' : '⏳';
                lines.push(`  ${icon} ${r.name}`);
                lines.push(`     Endpoint: ${r.endpoint}`);
                lines.push(`     Status:   ${r.status.toUpperCase()}  |  ${r.ms}ms${r.httpStatus ? `  |  HTTP ${r.httpStatus}` : ''}`);
                if (r.detail) lines.push(`     Detail:   ${r.detail}`);
                lines.push(``);
            }
        }

        lines.push(`───────────────────────────────────────────────`);
        lines.push(`▸ Supabase Auth`);
        lines.push(`  (Ver componente Supabase Auth arriba)`);
        lines.push(``);
        lines.push(`═══════════════════════════════════════════════`);
        return lines.join('\n');
    }, [results, serverReachable, serverMs]);

    const handleCopyLogs = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(buildLogText());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback para navegadores sin clipboard API
            const textarea = document.createElement('textarea');
            textarea.value = buildLogText();
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [buildLogText]);

    const runChecks = useCallback(async () => {
        setRunning(true);
        setResults([]);

        // 1. Check server reachability (ping root)
        const pingStart = performance.now();
        try {
            const res = await fetch(API_URL.replace("/api", ""), { signal: AbortSignal.timeout(5000) });
            setServerMs(Math.round(performance.now() - pingStart));
            setServerReachable(res.status < 500);
        } catch {
            setServerMs(Math.round(performance.now() - pingStart));
            setServerReachable(false);
            setRunning(false);
            return;
        }

        // 2. Get token
        const token = await getToken();

        // 3. Run all checks in parallel
        const initialResults: CheckResult[] = CHECKS.map((c) => ({
            name: c.name,
            group: c.group,
            endpoint: `GET ${c.path}`,
            status: "pending" as const,
            ms: 0,
        }));
        setResults(initialResults);

        const promises = CHECKS.map(async (c, i) => {
            const result = await checkEndpoint(c.name, c.group, c.path, token);
            setResults((prev) => {
                const copy = [...prev];
                copy[i] = result;
                return copy;
            });
            return result;
        });

        await Promise.all(promises);
        setRunning(false);
    }, []);

    useEffect(() => {
        runChecks();
    }, [runChecks]);

    const groups = [...new Set(CHECKS.map((c) => c.group))];
    const counts = {
        ok: results.filter((r) => r.status === "ok").length,
        warn: results.filter((r) => r.status === "warn").length,
        fail: results.filter((r) => r.status === "fail").length,
        pending: results.filter((r) => r.status === "pending").length,
    };
    const totalDone = counts.ok + counts.warn + counts.fail;

    const statusIcon = (s: CheckResult["status"]) => {
        switch (s) {
            case "ok":
                return <span className="material-symbols-outlined text-green-500 text-xl">check_circle</span>;
            case "fail":
                return <span className="material-symbols-outlined text-red-500 text-xl">cancel</span>;
            case "warn":
                return <span className="material-symbols-outlined text-amber-500 text-xl">warning</span>;
            case "pending":
                return (
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
                );
        }
    };

    return (
        <main className="max-w-[900px] w-full mx-auto px-6 py-8 flex-1 space-y-8">
            {/* Breadcrumb */}
            <div className="flex flex-col gap-2">
                <nav className="flex gap-2 text-sm font-medium text-[#616f89] dark:text-[#a0aec0]">
                    <Link to="/" className="hover:text-primary">
                        Inicio
                    </Link>
                    <span>/</span>
                    <span className="text-[#111318] dark:text-white">Health Check</span>
                </nav>
                <div className="flex flex-wrap justify-between items-end gap-4">
                    <div>
                        <h1 className="text-[#111318] dark:text-white text-3xl font-black tracking-tight flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-[36px]">monitor_heart</span>
                            API Health Check
                        </h1>
                        <p className="text-[#616f89] dark:text-[#a0aec0] text-lg mt-1">
                            Estado de todos los servicios del backend — <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">{API_URL}</code>
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleCopyLogs}
                            disabled={running || results.length === 0}
                            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold shadow-md transition-all disabled:opacity-40 ${copied
                                ? 'bg-green-500 text-white'
                                : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary'
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">
                                {copied ? 'check' : 'content_copy'}
                            </span>
                            {copied ? '¡Copiado!' : 'Copiar Logs'}
                        </button>
                        <button
                            type="button"
                            onClick={runChecks}
                            disabled={running}
                            className="flex items-center gap-2 bg-primary hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors disabled:opacity-60"
                        >
                            <span className={`material-symbols-outlined ${running ? 'animate-spin' : ''}`}>
                                {running ? 'sync' : 'refresh'}
                            </span>
                            {running ? 'Probando…' : 'Re-ejecutar'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Server status overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`p-5 rounded-xl border-2 ${serverReachable === true ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" : serverReachable === false ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"}`}>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Servidor</p>
                    <p className={`text-2xl font-black ${serverReachable === true ? "text-green-600" : serverReachable === false ? "text-red-600" : "text-slate-400"}`}>
                        {serverReachable === null ? "…" : serverReachable ? "Online" : "Offline"}
                    </p>
                    {serverMs > 0 && <p className="text-xs text-slate-400 mt-1">{serverMs}ms ping</p>}
                </div>

                <div className="p-5 rounded-xl border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">OK</p>
                    <p className="text-2xl font-black text-green-600">{counts.ok}</p>
                </div>
                <div className="p-5 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Advertencias</p>
                    <p className="text-2xl font-black text-amber-600">{counts.warn}</p>
                </div>
                <div className="p-5 rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Fallos</p>
                    <p className="text-2xl font-black text-red-600">{counts.fail}</p>
                </div>
            </div>

            {/* Progress */}
            {running && (
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${CHECKS.length > 0 ? (totalDone / CHECKS.length) * 100 : 0}%` }}
                    />
                </div>
            )}

            {/* Server offline */}
            {serverReachable === false && (
                <div className="p-8 rounded-2xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 text-center">
                    <span className="material-symbols-outlined text-5xl text-red-400 mb-3 block">cloud_off</span>
                    <p className="text-xl font-bold text-red-700 dark:text-red-300 mb-2">Servidor no disponible</p>
                    <p className="text-red-600 dark:text-red-400 text-sm">
                        No se puede conectar a <code className="bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded font-mono text-xs">{API_URL}</code>
                    </p>
                    <p className="text-red-500 dark:text-red-500 text-sm mt-2">
                        Verifica que el servidor backend esté corriendo en el puerto correcto.
                    </p>
                </div>
            )}

            {/* Results by group */}
            {serverReachable !== false && groups.map((group) => {
                const groupResults = results.filter((r) => r.group === group);
                if (groupResults.length === 0) return null;

                const allOk = groupResults.every((r) => r.status === "ok");
                const hasFail = groupResults.some((r) => r.status === "fail");

                return (
                    <div key={group} className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className={`px-5 py-3 flex items-center justify-between ${hasFail ? "bg-red-50 dark:bg-red-900/10" :
                            allOk ? "bg-green-50 dark:bg-green-900/10" :
                                "bg-slate-50 dark:bg-slate-800"
                            }`}>
                            <h3 className="font-bold text-sm dark:text-white flex items-center gap-2">
                                {hasFail ? (
                                    <span className="material-symbols-outlined text-red-500 text-lg">error</span>
                                ) : allOk ? (
                                    <span className="material-symbols-outlined text-green-500 text-lg">verified</span>
                                ) : (
                                    <span className="material-symbols-outlined text-slate-400 text-lg">pending</span>
                                )}
                                {group}
                            </h3>
                            <span className="text-xs text-slate-400 font-medium">
                                {groupResults.filter((r) => r.status === "ok").length}/{groupResults.length} OK
                            </span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {groupResults.map((r) => (
                                <div
                                    key={r.name}
                                    className={`px-5 py-3 flex items-center gap-4 ${r.status === "fail" ? "bg-red-50/50 dark:bg-red-900/5" : "bg-white dark:bg-slate-900/30"
                                        }`}
                                >
                                    <div className="shrink-0">{statusIcon(r.status)}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                                            {r.name}
                                        </p>
                                        <p className="text-xs text-slate-400 font-mono truncate">{r.endpoint}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        {r.status !== "pending" && (
                                            <p className={`text-xs font-bold ${r.ms > 2000 ? "text-red-500" : r.ms > 500 ? "text-amber-500" : "text-slate-400"}`}>
                                                {r.ms}ms
                                            </p>
                                        )}
                                        {r.detail && (
                                            <p className={`text-[11px] max-w-[260px] truncate ${r.status === "fail" ? "text-red-500" : r.status === "warn" ? "text-amber-500" : "text-slate-400"
                                                }`}>
                                                {r.detail}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Supabase check */}
            <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800">
                    <h3 className="font-bold text-sm dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-green-500 text-lg">database</span>
                        Supabase Auth
                    </h3>
                </div>
                <SupabaseCheck />
            </div>
        </main>
    );
};

// Sub-component for Supabase check
const SupabaseCheck: React.FC = () => {
    const [status, setStatus] = useState<"pending" | "ok" | "fail">("pending");
    const [detail, setDetail] = useState("");
    const [ms, setMs] = useState(0);

    useEffect(() => {
        (async () => {
            const start = performance.now();
            try {
                const { supabase } = await import("../lib/supabaseAuth");
                const { data, error } = await supabase.auth.getSession();
                setMs(Math.round(performance.now() - start));
                if (error) {
                    setStatus("fail");
                    setDetail(error.message);
                } else {
                    setStatus("ok");
                    setDetail(
                        data.session
                            ? `Sesión activa — ${data.session.user.email}`
                            : "Sin sesión activa (no autenticado)"
                    );
                }
            } catch (err: any) {
                setMs(Math.round(performance.now() - start));
                setStatus("fail");
                setDetail(err?.message ?? "Error desconocido");
            }
        })();
    }, []);

    return (
        <div className={`px-5 py-3 flex items-center gap-4 ${status === "fail" ? "bg-red-50/50 dark:bg-red-900/5" : "bg-white dark:bg-slate-900/30"}`}>
            <div className="shrink-0">
                {status === "pending" ? (
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
                ) : status === "ok" ? (
                    <span className="material-symbols-outlined text-green-500 text-xl">check_circle</span>
                ) : (
                    <span className="material-symbols-outlined text-red-500 text-xl">cancel</span>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">Supabase Auth Session</p>
                <p className="text-xs text-slate-400 font-mono">supabase.auth.getSession()</p>
            </div>
            <div className="text-right shrink-0">
                {ms > 0 && <p className="text-xs font-bold text-slate-400">{ms}ms</p>}
                <p className={`text-[11px] max-w-[260px] truncate ${status === "fail" ? "text-red-500" : "text-slate-400"}`}>{detail}</p>
            </div>
        </div>
    );
};
