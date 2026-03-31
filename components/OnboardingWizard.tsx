import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Upload,
  Users,
  Bell,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "abogado_onboarding_done";

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {}
}

// ─── Steps data ────────────────────────────────────────────────────────────

interface Step {
  id: number;
  icon: React.ReactNode;
  color: string;
  title: string;
  description: string;
  tip: string;
}

const STEPS: Step[] = [
  {
    id: 1,
    icon: <Upload className="w-8 h-8" />,
    color: "from-blue-500 to-blue-600",
    title: "Sube tu primer documento",
    description:
      "Arrastra y suelta cualquier PDF, DOCX o Excel directamente en el panel de documentos, o usa el botón \"Nuevo documento\" en la barra superior.",
    tip: "También puedes organizar tus documentos en grupos y casos para encontrarlos más fácilmente.",
  },
  {
    id: 2,
    icon: <Users className="w-8 h-8" />,
    color: "from-violet-500 to-purple-600",
    title: "Colabora con tu equipo",
    description:
      "Asigna documentos a colegas, gestiona permisos de lectura y escritura, y lleva un registro de quién modificó qué y cuándo.",
    tip: "Al asignar un documento, el destinatario recibirá una notificación automática.",
  },
  {
    id: 3,
    icon: <Bell className="w-8 h-8" />,
    color: "from-amber-500 to-orange-500",
    title: "Mantente al tanto",
    description:
      "El panel de notificaciones (🔔) en la barra superior te avisará de asignaciones, compartidos y actualizaciones importantes en tiempo real.",
    tip: "El filtro de fechas en la lista de documentos te ayuda a encontrar archivos dentro de un periodo específico.",
  },
];

// ─── Props ─────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  onDone: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [animIn, setAnimIn] = useState(true);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleDone = useCallback(() => {
    markOnboardingDone();
    setExiting(true);
    setTimeout(onDone, 350);
  }, [onDone]);

  const goTo = useCallback((target: number) => {
    setAnimIn(false);
    setTimeout(() => {
      setStep(target);
      setAnimIn(true);
    }, 200);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDone();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleDone]);

  return (
    <div
      className={`
        fixed inset-0 z-[200] flex items-center justify-center p-4
        bg-black/60 backdrop-blur-sm
        transition-opacity duration-300 ease-in-out
        ${exiting ? "opacity-0" : "opacity-100"}
      `}
      aria-modal="true"
      role="dialog"
      aria-label="Bienvenida a AbogadoSoft"
    >
      <div
        className={`
          relative w-full max-w-md
          bg-white dark:bg-slate-900
          rounded-3xl shadow-2xl
          border border-slate-200 dark:border-slate-700/60
          flex flex-col overflow-hidden
          transition-all duration-300 ease-out
          ${exiting ? "scale-95 opacity-0" : "scale-100 opacity-100"}
        `}
      >
        {/* Gradient header */}
        <div className={`relative bg-gradient-to-br ${current.color} p-8 flex flex-col items-center text-white`}>
          {/* Close button */}
          <button
            type="button"
            onClick={handleDone}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            aria-label="Saltar onboarding"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Step indicator dots */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === step ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/60"
                }`}
                aria-label={`Paso ${i + 1}`}
              />
            ))}
          </div>

          {/* Icon */}
          <div
            className={`
              w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm
              flex items-center justify-center mb-4 mt-4
              transition-all duration-200 ease-out
              ${animIn ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-2"}
            `}
          >
            {current.icon}
          </div>

          {/* Step number */}
          <span className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">
            Paso {step + 1} de {STEPS.length}
          </span>

          {/* Title */}
          <h2
            className={`
              text-xl font-extrabold text-center leading-tight
              transition-all duration-200 ease-out
              ${animIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
            `}
          >
            {current.title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-8 py-6 flex flex-col gap-4">
          <p
            className={`
              text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-center
              transition-all duration-200 ease-out
              ${animIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
            `}
          >
            {current.description}
          </p>

          {/* Tip */}
          <div className="flex gap-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {current.tip}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </button>
          )}

          <div className="flex-1" />

          {isLast ? (
            <button
              type="button"
              onClick={handleDone}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-extrabold bg-gradient-to-r from-blue-500 to-violet-600 text-white hover:opacity-90 shadow-lg transition-opacity"
            >
              <CheckCircle className="w-4 h-4" />
              ¡Entendido!
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-extrabold bg-primary text-white hover:bg-blue-700 shadow transition-colors"
            >
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
