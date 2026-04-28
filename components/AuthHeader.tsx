import React from "react";
import { AppBrand } from "./AppBrand";

interface AuthHeaderProps {
  message: string;
  buttonLabel: string;
  onButtonClick: () => void;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({ message, buttonLabel, onButtonClick }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <AppBrand size="lg" wordmark="responsive" className="scale-95 sm:scale-100 origin-left" />
        <div className="flex items-center gap-4">
          <span className="text-gray-600 dark:text-gray-400 hidden sm:block">{message}</span>
          <button
            type="button"
            className="flex items-center justify-center rounded-lg h-11 px-6 border-2 border-primary text-primary hover:bg-primary/5 transition-colors font-bold text-sm"
            onClick={onButtonClick}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </header>
  );
};
