import React, { useState } from "react";
import { ViewState } from "./types";
import { Dashboard } from "./components/Dashboard";
import { AgreementsList } from "./components/AgreementsList";
import { DocumentEditor } from "./components/DocumentEditor";
import { ExcelEditor } from "./components/ExcelEditor";
import { ActivityLog } from "./components/ActivityLog";
import { SecurityPage } from "./components/SecurityPage";

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);

  const renderView = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return <Dashboard onNavigate={setCurrentView} />;
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

  return <>{renderView()}</>;
}