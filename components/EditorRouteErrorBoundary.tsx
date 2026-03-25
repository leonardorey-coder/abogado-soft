import React from 'react';

type Props = { children: React.ReactNode };

type State = { error: Error | null };

export class EditorRouteErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 bg-background-light dark:bg-background-dark text-center">
          <span className="material-symbols-outlined text-5xl text-red-400">error</span>
          <h1 className="text-xl font-bold text-[#0e0e1b] dark:text-white">No se pudo cargar el editor</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-700"
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
