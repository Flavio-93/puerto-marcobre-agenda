import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { Navbar } from './components/Navbar';
import { KanbanBoard } from './components/KanbanBoard';
import { HistorialArchivo } from './components/HistorialArchivo';
import { NuevaTareaModal } from './components/NuevaTareaModal';
import { NotificationMonitor } from './components/NotificationMonitor';

export const App: React.FC = () => {
  const { usuario, loading } = useAuth();
  const [vistaActual, setVistaActual] = useState<'kanban' | 'archivo'>('kanban');
  const [modalNuevaTarea, setModalNuevaTarea] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-600 dark:text-slate-300">
        <div className="w-10 h-10 border-4 border-[#2b5c8f] border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold uppercase tracking-wider">Cargando Marcobre - Puerto...</p>
      </div>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <Navbar
        vistaActual={vistaActual}
        setVistaActual={setVistaActual}
        onNuevaTarea={() => setModalNuevaTarea(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        {vistaActual === 'kanban' ? <KanbanBoard /> : <HistorialArchivo />}
      </main>

      <footer className="py-3 text-center text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
        Marcobre Puerto • Terminal Marítimo • Régimen de Relevos 10x10 • Política de Cero Eliminaciones
      </footer>

      {/* Modal Nueva Tarea */}
      <NuevaTareaModal
        isOpen={modalNuevaTarea}
        onClose={() => setModalNuevaTarea(false)}
      />

      {/* Monitor de Notificaciones y Alarmas Estrictamente Personales */}
      <NotificationMonitor />
    </div>
  );
};

export default App;
