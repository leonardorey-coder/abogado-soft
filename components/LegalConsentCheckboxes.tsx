import React from "react";
import { Link } from "react-router-dom";
import { LEGAL_PUBLIC_PREFIX } from "../lib/legalRoutes";

export type LegalConsentFrom = "login" | "registro";

export interface LegalConsentCheckboxesProps {
  from: LegalConsentFrom;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  onChangeTerms: (v: boolean) => void;
  onChangePrivacy: (v: boolean) => void;
  disabled?: boolean;
}

const q = (from: LegalConsentFrom) => `?from=${from}`;

export const LegalConsentCheckboxes: React.FC<LegalConsentCheckboxesProps> = ({
  from,
  acceptedTerms,
  acceptedPrivacy,
  onChangeTerms,
  onChangePrivacy,
  disabled,
}) => {
  const suffix = q(from);
  const termsPath = `${LEGAL_PUBLIC_PREFIX}/terminos${suffix}`;
  const privacyPath = `${LEGAL_PUBLIC_PREFIX}/privacidad${suffix}`;
  return (
    <div className="space-y-3 pt-1">
      <div className="flex gap-2.5 items-start">
        <input
          id={`legal-terms-${from}`}
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => onChangeTerms(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-slate-300 dark:border-slate-500 text-primary focus:ring-primary focus:ring-offset-0 disabled:opacity-50"
        />
        <label
          htmlFor={`legal-terms-${from}`}
          className="text-sm text-slate-600 dark:text-slate-300 leading-snug cursor-pointer select-none"
        >
          He leído y acepto los{" "}
          <Link
            to={termsPath}
            className="text-primary font-semibold underline underline-offset-2 hover:opacity-90"
            onClick={(e) => e.stopPropagation()}
          >
            Términos y condiciones
          </Link>
          .
        </label>
      </div>
      <div className="flex gap-2.5 items-start">
        <input
          id={`legal-privacy-${from}`}
          type="checkbox"
          checked={acceptedPrivacy}
          onChange={(e) => onChangePrivacy(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-slate-300 dark:border-slate-500 text-primary focus:ring-primary focus:ring-offset-0 disabled:opacity-50"
        />
        <label
          htmlFor={`legal-privacy-${from}`}
          className="text-sm text-slate-600 dark:text-slate-300 leading-snug cursor-pointer select-none"
        >
          He leído y acepto la{" "}
          <Link
            to={privacyPath}
            className="text-primary font-semibold underline underline-offset-2 hover:opacity-90"
            onClick={(e) => e.stopPropagation()}
          >
            Política de privacidad
          </Link>
          .
        </label>
      </div>
    </div>
  );
};
