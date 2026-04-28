// ============================================================================
// VersionDiffViewer — Visualización de diferencias entre versiones de documento
// Muestra líneas agregadas/eliminadas/sin cambio con navegación entre chunks
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getViewerLabel } from "../lib/viewerIdentity";

export interface DiffLine {
    type: "added" | "removed" | "unchanged";
    content: string;
    lineNumberOld?: number;
    lineNumberNew?: number;
}

export interface VersionInfo {
    version: number;
    createdAt: string;
    changeNote: string | null;
    creator?: { id: string; name: string } | null;
}

interface VersionDiffViewerProps {
    documentId: string;
    versionA: VersionInfo;
    versionB: VersionInfo;
    diff: DiffLine[];
    onClose: () => void;
    entityType?: 'documents' | 'convenios';
}

const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000/api";

// ─── Fetch helper ─────────────────────────────────────────────────────────────
async function fetchRevisionDiff(documentId: string, v1: number, v2: number, entityType: 'documents' | 'convenios' = 'documents'): Promise<DiffLine[]> {
    const { getAccessToken } = await import('../lib/auth');
    const token = await getAccessToken() ?? "";
    const res = await fetch(`${API_URL}/${entityType}/${documentId}/diff?v1=${v1}&v2=${v2}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("No se pudo obtener el diff");
    const data = await res.json();
    return data.diff as DiffLine[];
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function VersionDiffViewer({
    documentId,
    versionA,
    versionB,
    diff: initialDiff,
    onClose,
    entityType = 'documents'
}: VersionDiffViewerProps) {
    const { user } = useAuth();
    const [diff, setDiff] = useState<DiffLine[]>(initialDiff);
    const [loading, setLoading] = useState(!initialDiff.length);
    const [error, setError] = useState<string | null>(null);
    const [currentChunk, setCurrentChunk] = useState(0);
    const [viewMode, setViewMode] = useState<"unified" | "split">("unified");
    const [olderVersion, newerVersion] = useMemo(
        () => [versionA, versionB].sort((a, b) => a.version - b.version),
        [versionA, versionB]
    );

    // Cargar diff si no se pasó inicialmente
    useEffect(() => {
        if (initialDiff.length) return;
        setLoading(true);
        fetchRevisionDiff(documentId, olderVersion.version, newerVersion.version, entityType)
            .then((d) => { setDiff(d); setLoading(false); })
            .catch((e) => { setError(e.message); setLoading(false); });
    }, [documentId, initialDiff.length, olderVersion.version, newerVersion.version, entityType]);

    // Índices de chunks (bloques de cambios)
    const chunks = diff.reduce<number[]>((acc, line, idx) => {
        if (line.type !== "unchanged") {
            if (acc.length === 0 || diff[acc[acc.length - 1]].type === "unchanged") acc.push(idx);
        }
        return acc;
    }, []);

    const stats = {
        added: diff.filter((l) => l.type === "added").length,
        removed: diff.filter((l) => l.type === "removed").length,
        unchanged: diff.filter((l) => l.type === "unchanged").length,
    };

    const jumpToChunk = useCallback((dir: 1 | -1) => {
        const next = currentChunk + dir;
        if (next >= 0 && next < chunks.length) {
            setCurrentChunk(next);
            const el = document.getElementById(`diff-chunk-${chunks[next]}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [currentChunk, chunks]);

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString("es-MX", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
            display: "flex", flexDirection: "column",
        }}>
            {/* ─── Header ─────────────────────────────────────────── */}
            <div style={{
                background: "#1a1d23", borderBottom: "1px solid #2d3748",
                padding: "16px 24px", display: "flex", alignItems: "center", gap: 16,
            }}>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f0f4f8" }}>
                        Comparar versiones
                    </h2>
                    <div style={{ display: "flex", gap: 24, marginTop: 6, fontSize: 13, color: "#94a3b8" }}>
                        <span>
                            <span style={{ color: "#ef4444", fontWeight: 600 }}>v{olderVersion.version}</span>
                            {" — "}{getViewerLabel({
                                subjectId: olderVersion.creator?.id,
                                subjectName: olderVersion.creator?.name,
                                currentUserId: user?.id,
                                fallback: "Sistema",
                            })}{" "}
                            · {formatDate(olderVersion.createdAt)}
                            {olderVersion.changeNote && <em style={{ marginLeft: 8 }}>"{olderVersion.changeNote}"</em>}
                        </span>
                        <span style={{ color: "#475569" }}>→</span>
                        <span>
                            <span style={{ color: "#22c55e", fontWeight: 600 }}>v{newerVersion.version}</span>
                            {" — "}{getViewerLabel({
                                subjectId: newerVersion.creator?.id,
                                subjectName: newerVersion.creator?.name,
                                currentUserId: user?.id,
                                fallback: "Sistema",
                            })}{" "}
                            · {formatDate(newerVersion.createdAt)}
                            {newerVersion.changeNote && <em style={{ marginLeft: 8 }}>"{newerVersion.changeNote}"</em>}
                        </span>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{
                        background: "#16a34a22", border: "1px solid #22c55e44",
                        color: "#22c55e", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    }}>
                        +{stats.added} líneas
                    </span>
                    <span style={{
                        background: "#dc262622", border: "1px solid #ef444444",
                        color: "#ef4444", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    }}>
                        -{stats.removed} líneas
                    </span>
                </div>

                {/* View toggle */}
                <div style={{
                    display: "flex", background: "#2d3748", borderRadius: 8, padding: 2,
                }}>
                    {(["unified", "split"] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => setViewMode(m)}
                            style={{
                                padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                                fontSize: 12, fontWeight: 500,
                                background: viewMode === m ? "#4f46e5" : "transparent",
                                color: viewMode === m ? "#fff" : "#94a3b8",
                            }}
                        >
                            {m === "unified" ? "Unificado" : "Lado a lado"}
                        </button>
                    ))}
                </div>

                {/* Navigation */}
                {chunks.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                            onClick={() => jumpToChunk(-1)}
                            disabled={currentChunk === 0}
                            style={{
                                width: 30, height: 30, borderRadius: 6, border: "1px solid #2d3748",
                                background: "#2d3748", color: "#94a3b8", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: currentChunk === 0 ? 0.4 : 1,
                            }}
                        >↑</button>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                            {currentChunk + 1} / {chunks.length}
                        </span>
                        <button
                            onClick={() => jumpToChunk(1)}
                            disabled={currentChunk === chunks.length - 1}
                            style={{
                                width: 30, height: 30, borderRadius: 6, border: "1px solid #2d3748",
                                background: "#2d3748", color: "#94a3b8", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: currentChunk === chunks.length - 1 ? 0.4 : 1,
                            }}
                        >↓</button>
                    </div>
                )}

                <button
                    onClick={onClose}
                    style={{
                        width: 36, height: 36, borderRadius: 8, border: "1px solid #2d3748",
                        background: "transparent", color: "#94a3b8", cursor: "pointer",
                        fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                >✕</button>
            </div>

            {/* ─── Diff Body ──────────────────────────────────────── */}
            <div style={{ flex: 1, overflow: "auto", background: "#0f1117" }}>
                {loading && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        <div style={{ textAlign: "center", color: "#94a3b8" }}>
                            <div className="spin" style={{
                                width: 32, height: 32, borderRadius: "50%",
                                border: "3px solid #2d3748", borderTopColor: "#4f46e5",
                                animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
                            }} />
                            <p>Calculando diferencias…</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>
                        <p style={{ fontSize: 36 }}>⚠️</p>
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && diff.length === 0 && (
                    <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                        <p style={{ fontSize: 32 }}>✓</p>
                        <p>Las versiones son idénticas.</p>
                    </div>
                )}

                {!loading && !error && diff.length > 0 && viewMode === "unified" && (
                    <table style={{
                        width: "100%", borderCollapse: "collapse",
                        fontFamily: "'Fira Mono', 'Courier New', monospace", fontSize: 13,
                    }}>
                        <colgroup>
                            <col style={{ width: 48 }} />
                            <col style={{ width: 48 }} />
                            <col style={{ width: 24 }} />
                            <col />
                        </colgroup>
                        <tbody>
                            {diff.map((line, idx) => {
                                const isChange = line.type !== "unchanged";
                                const bg =
                                    line.type === "added" ? "#0a2a0f" :
                                        line.type === "removed" ? "#2a0a0a" : "transparent";
                                const prefix =
                                    line.type === "added" ? "+" :
                                        line.type === "removed" ? "−" : " ";
                                const prefixColor =
                                    line.type === "added" ? "#22c55e" :
                                        line.type === "removed" ? "#ef4444" : "#475569";

                                return (
                                    <tr
                                        key={idx}
                                        id={isChange ? `diff-chunk-${idx}` : undefined}
                                        style={{ background: bg }}
                                    >
                                        <td style={{
                                            padding: "1px 8px", color: "#475569", textAlign: "right",
                                            borderRight: "1px solid #1e293b", userSelect: "none", fontSize: 11,
                                        }}>
                                            {line.lineNumberOld ?? ""}
                                        </td>
                                        <td style={{
                                            padding: "1px 8px", color: "#475569", textAlign: "right",
                                            borderRight: "1px solid #1e293b", userSelect: "none", fontSize: 11,
                                        }}>
                                            {line.lineNumberNew ?? ""}
                                        </td>
                                        <td style={{
                                            padding: "1px 6px", color: prefixColor,
                                            fontWeight: 700, userSelect: "none", textAlign: "center",
                                        }}>
                                            {prefix}
                                        </td>
                                        <td style={{
                                            padding: "1px 16px 1px 4px",
                                            color: line.type === "unchanged" ? "#94a3b8" :
                                                line.type === "added" ? "#86efac" : "#fca5a5",
                                            whiteSpace: "pre-wrap", wordBreak: "break-all",
                                        }}>
                                            {line.content || " "}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {!loading && !error && diff.length > 0 && viewMode === "split" && (
                    <div style={{ display: "flex", height: "100%" }}>
                        {/* Left (removed) */}
                        <div style={{ flex: 1, overflow: "auto", borderRight: "2px solid #1e293b" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Fira Mono', monospace", fontSize: 13 }}>
                                <tbody>
                                    {diff.filter((l) => l.type !== "added").map((line, idx) => (
                                        <tr key={idx} style={{ background: line.type === "removed" ? "#2a0a0a" : "transparent" }}>
                                            <td style={{ padding: "1px 8px", color: "#475569", textAlign: "right", borderRight: "1px solid #1e293b", fontSize: 11, userSelect: "none" }}>
                                                {line.lineNumberOld ?? ""}
                                            </td>
                                            <td style={{ padding: "1px 16px", color: line.type === "removed" ? "#fca5a5" : "#94a3b8", whiteSpace: "pre-wrap" }}>
                                                {line.content || " "}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Right (added) */}
                        <div style={{ flex: 1, overflow: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Fira Mono', monospace", fontSize: 13 }}>
                                <tbody>
                                    {diff.filter((l) => l.type !== "removed").map((line, idx) => (
                                        <tr key={idx} style={{ background: line.type === "added" ? "#0a2a0f" : "transparent" }}>
                                            <td style={{ padding: "1px 8px", color: "#475569", textAlign: "right", borderRight: "1px solid #1e293b", fontSize: 11, userSelect: "none" }}>
                                                {line.lineNumberNew ?? ""}
                                            </td>
                                            <td style={{ padding: "1px 16px", color: line.type === "added" ? "#86efac" : "#94a3b8", whiteSpace: "pre-wrap" }}>
                                                {line.content || " "}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
