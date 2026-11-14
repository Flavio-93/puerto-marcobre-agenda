import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTareas } from '../context/TareasContext';
import { useTheme } from '../context/ThemeContext';
import { TipoGuardia } from '../types';
import { 
  Sun, 
  Moon, 
  LogOut, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Users, 
  Kanban, 
  Archive, 
  KeyRound
} from 'lucide-react';
import { AdminUsuariosModal } from './AdminUsuariosModal';
import { InstallPwaButton } from './InstallPwaButton';

interface NavbarProps {
  vistaActual: 'kanban' | 'archivo';
  setVistaActual: (v: 'kanban' | 'archivo') => void;
  onNuevaTarea: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  vistaActual,
  setVistaActual,
  onNuevaTarea,
}) => {
  const { usuario, logout, esAdmin } = useAuth();
  const { guardiasActivas, cambiarGuardias, isOnline, isSyncing, refreshTareas } = useTareas();
  const { theme, toggleTheme } = useTheme();

  const [modalGuardias, setModalGuardias] = useState(false);
  const [modalAdminPass, setModalAdminPass] = useState(false);
  const [g1Temp, setG1Temp] = useState<TipoGuardia>(guardiasActivas.guardia_1);
  const [g2Temp, setG2Temp] = useState<TipoGuardia>(guardiasActivas.guardia_2);

  const guardiasDisponibles: TipoGuardia[] = ['A', 'B', 'C', 'D'];

  const guardarGuardias = async () => {
    if (g1Temp === g2Temp) {
      alert('Las dos guardias activas deben ser diferentes (régimen 10x10).');
      return;
    }
    await cambiarGuardias(g1Temp, g2Temp);
    setModalGuardias(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#2b5c8f] text-white shadow-md border-b border-[#1e4570] transition-colors dark:bg-[#1a3857] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* LOGO & Identidad Corporativa */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center bg-white p-1.5 rounded-lg shadow-sm border border-slate-200">
                <img 
                  src="/logo.png" 
                  alt="Marcobre - Puerto" 
                  onError={(e) => {
                    // Fallback visual si el usuario aún no coloca su logo.png
                    (e.target as HTMLElement).style.display = 'none';
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent && !parent.querySelector('.logo-fallback')) {
                      const span = document.createElement('span');
                      span.className = 'logo-fallback font-black text-xs text-[#2b5c8f] tracking-tighter px-1';
                      span.innerText = 'MARCOBRE';
                      parent.appendChild(span);
                    }
                  }}
                  className="h-7 w-auto object-contain max-w-[110px]" 
                />
              </div>

              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight leading-none text-white flex items-center gap-1.5">
                  Marcobre <span className="text-[#fca5a5] font-light">| Puerto</span>
                </h1>
                <p className="text-[11px] text-blue-100 hidden sm:block mt-0.5">
                  Gestión Portuaria de Tareas y Relevos 10x10
                </p>
              </div>
            </div>

            {/* SELECCIÓN DE GUARDIAS ACTIVAS (10x10) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setG1Temp(guardiasActivas.guardia_1);
                  setG2Temp(guardiasActivas.guardia_2);
                  setModalGuardias(true);
                }}
                className="flex items-center gap-1.5 bg-[#1e4570] hover:bg-[#153252] text-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold border border-blue-400/30 transition shadow-inner"
                title="Configurar Guardias Activas en Sitio"
              >
                <Users className="w-4 h-4 text-amber-300" />
                <span className="hidden md:inline font-normal text-blue-200">Guardias Activas:</span>
                <span className="bg-amber-400 text-slate-900 font-bold px-1.5 py-0.5 rounded text-xs shadow-sm">
                  {guardiasActivas.guardia_1} & {guardiasActivas.guardia_2}
                </span>
              </button>

              {/* Indicador de Conexión y Sync Offline */}
              <div 
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border ${
                  isOnline 
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40' 
                    : 'bg-rose-950/60 text-rose-300 border-rose-500/60 animate-pulse'
                }`}
                title={isOnline ? 'Conectado a Supabase en tiempo real' : 'Modo Offline activo (IndexedDB)'}
              >
                {isOnline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden lg:inline">{isSyncing ? 'Sincronizando...' : 'Online'}</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden lg:inline">Offline</span>
                  </>
                )}
              </div>

              {/* Toggle Tema Claro / Oscuro */}
              <button
                onClick={toggleTheme}
                aria-label="Alternar modo oscuro"
                className="p-2 rounded-lg bg-[#1e4570] hover:bg-[#153252] text-amber-300 transition"
                title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-blue-200" />}
              </button>

              {/* Botón de Instalación PWA (Android / iOS) */}
              <InstallPwaButton />

              {/* Botón Exclusivo para el Administrador: Cambiar Contraseñas */}
              {esAdmin && (
                <button
                  type="button"
                  onClick={() => setModalAdminPass(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-xs font-bold transition shadow-xs"
                  title="Gestionar y cambiar contraseñas de usuarios"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Claves</span>
                </button>
              )}

              {/* Perfil Usuario y Logout */}
              {usuario && (
                <div className="flex items-center gap-1.5 pl-1 border-l border-blue-400/20">
                  <div className="hidden xl:flex flex-col text-right">
                    <span className="text-xs font-semibold leading-tight text-white">{usuario.nombre_completo.split(' ')[0]}</span>
                    <span className="text-[10px] text-blue-200 uppercase font-mono">Gda {usuario.guardia} • {usuario.area}</span>
                  </div>
                  <button
                    onClick={() => logout()}
                    className="p-2 rounded-lg bg-rose-900/40 hover:bg-rose-800 text-rose-200 transition"
                    title="Cerrar Sesión"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Navegación Secundaria Mobile-First (Tabs y botón Crear Tarea) */}
          <div className="flex items-center justify-between pb-2.5 pt-1 border-t border-blue-400/20 text-xs sm:text-sm">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setVistaActual('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  vistaActual === 'kanban'
                    ? 'bg-white text-[#2b5c8f] shadow font-bold dark:bg-slate-800 dark:text-blue-300'
                    : 'text-blue-100 hover:bg-white/10'
                }`}
              >
                <Kanban className="w-4 h-4" />
                <span>Tablero Operativo</span>
              </button>

              <button
                onClick={() => setVistaActual('archivo')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                  vistaActual === 'archivo'
                    ? 'bg-white text-[#2b5c8f] shadow font-bold dark:bg-slate-800 dark:text-blue-300'
                    : 'text-blue-100 hover:bg-white/10'
                }`}
              >
                <Archive className="w-4 h-4" />
                <span>Historial / Archivo</span>
              </button>

              <button
                onClick={() => refreshTareas()}
                className="p-1.5 text-blue-200 hover:text-white rounded hover:bg-white/10 transition"
                title="Refrescar datos"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onNuevaTarea}
              className="bg-[#c13127] hover:bg-[#9e251e] text-white px-3 sm:px-4 py-1.5 rounded-lg font-bold shadow-md hover:shadow-lg transition flex items-center gap-1.5 active:scale-95"
            >
              <span className="text-base leading-none">+</span>
              <span className="text-xs sm:text-sm">Nueva Tarea</span>
            </button>
          </div>
        </div>
      </header>

      {/* Modal Exclusivo Administrador: Cambio de Contraseñas */}
      <AdminUsuariosModal
        isOpen={modalAdminPass}
        onClose={() => setModalAdminPass(false)}
      />

      {/* Modal para Cambiar Guardias Activas */}
      {modalGuardias && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
            <h3 className="text-base font-bold text-[#2b5c8f] dark:text-blue-400 mb-1 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              Guardias en Sitio (Régimen 10x10)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Seleccione las 2 guardias que se encuentran operando actualmente en el muelle y planta.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Guardia Activa 1
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {guardiasDisponibles.map((g) => (
                    <button
                      key={`g1-${g}`}
                      type="button"
                      onClick={() => setG1Temp(g)}
                      className={`py-2 text-sm font-bold rounded-lg border transition ${
                        g1Temp === g
                          ? 'bg-[#2b5c8f] text-white border-[#2b5c8f]'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Guardia Activa 2
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {guardiasDisponibles.map((g) => (
                    <button
                      key={`g2-${g}`}
                      type="button"
                      onClick={() => setG2Temp(g)}
                      className={`py-2 text-sm font-bold rounded-lg border transition ${
                        g2Temp === g
                          ? 'bg-[#c13127] text-white border-[#c13127]'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalGuardias(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarGuardias}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#2b5c8f] text-white hover:bg-[#1e4570] transition shadow"
              >
                Aplicar Relevo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

