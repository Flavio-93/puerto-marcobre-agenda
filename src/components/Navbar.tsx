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
  KeyRound,
  Menu,
  X,
  Plus
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
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
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
      <header className="sticky top-0 z-40 bg-[#2b5c8f] text-white shadow-md border-b border-[#1e4570] transition-colors dark:bg-[#1a3857] dark:border-slate-800 w-full overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* BARRA PRINCIPAL */}
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            {/* Logo e Identidad */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center justify-center bg-white p-1 rounded-lg shadow-xs border border-slate-200 shrink-0">
                <img 
                  src="/logo.png" 
                  alt="Marcobre - Puerto" 
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent && !parent.querySelector('.logo-fallback')) {
                      const span = document.createElement('span');
                      span.className = 'logo-fallback font-black text-[10px] text-[#2b5c8f] tracking-tighter px-1';
                      span.innerText = 'MARCOBRE';
                      parent.appendChild(span);
                    }
                  }}
                  className="h-5 sm:h-6 w-auto object-contain max-w-[80px] sm:max-w-[110px]" 
                />
              </div>

              <div className="truncate">
                <h1 className="text-xs sm:text-base font-extrabold tracking-tight leading-none text-white truncate">
                  Marcobre <span className="text-[#fca5a5] font-light">| Puerto</span>
                </h1>
                <p className="text-[9px] text-blue-200 hidden sm:block mt-0.5">
                  Operaciones y Relevos 10x10
                </p>
              </div>
            </div>

            {/* ACCIONES COMPACTAS ADAPTABLES A PANTALLA MÓVIL */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Botón Guardias Activas (Compacto para no desbordar) */}
              <button
                onClick={() => {
                  setG1Temp(guardiasActivas.guardia_1);
                  setG2Temp(guardiasActivas.guardia_2);
                  setModalGuardias(true);
                }}
                className="flex items-center gap-1 bg-[#1e4570] hover:bg-[#153252] text-white px-2 py-1 rounded-lg text-xs font-semibold border border-blue-400/30 transition shadow-inner"
                title="Configurar Guardias Activas en Sitio"
              >
                <Users className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden md:inline font-normal text-blue-200 text-[11px]">Guardias:</span>
                <span className="bg-amber-400 text-slate-900 font-extrabold px-1.5 py-0.2 rounded text-[10px]">
                  {guardiasActivas.guardia_1} & {guardiasActivas.guardia_2}
                </span>
              </button>

              {/* Botón PWA Instalable */}
              <InstallPwaButton />

              {/* Menú Móvil Hamburger para herramientas secundarias */}
              <button
                type="button"
                onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
                className="p-1.5 rounded-lg bg-[#1e4570] text-blue-200 hover:text-white sm:hidden border border-blue-400/20"
                aria-label="Abrir opciones de usuario"
              >
                {menuMovilAbierto ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

              {/* Herramientas de Escritorio (Ocultas en celular para evitar desborde) */}
              <div className="hidden sm:flex items-center gap-1.5">
                {/* Conectividad */}
                <div 
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border ${
                    isOnline 
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40' 
                      : 'bg-rose-950/60 text-rose-300 border-rose-500/60'
                  }`}
                >
                  {isOnline ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-rose-400" />}
                </div>

                {/* Dark Mode */}
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg bg-[#1e4570] hover:bg-[#153252] text-amber-300 transition"
                  title="Tema claro/oscuro"
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5 text-blue-200" />}
                </button>

                {/* Claves Admin */}
                {esAdmin && (
                  <button
                    type="button"
                    onClick={() => setModalAdminPass(true)}
                    className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-bold"
                    title="Claves"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Salir */}
                {usuario && (
                  <button
                    onClick={() => logout()}
                    className="p-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-800 text-rose-200 transition"
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* MENÚ DESPLEGABLE MÓVIL (CUANDO SE TOCA HAMBURGER EN IPHONE/ANDROID) */}
          {menuMovilAbierto && (
            <div className="sm:hidden pb-3 pt-2 border-t border-blue-400/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-100 text-[11px] truncate max-w-[140px]">
                  {usuario?.nombre_completo.split(' ')[0]} (Gda {usuario?.guardia})
                </span>
                <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded bg-[#1e4570] text-amber-300"
                  title="Tema claro/oscuro"
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>

                {esAdmin && (
                  <button
                    onClick={() => {
                      setModalAdminPass(true);
                      setMenuMovilAbierto(false);
                    }}
                    className="p-1.5 rounded bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Claves</span>
                  </button>
                )}

                <button
                  onClick={() => logout()}
                  className="p-1.5 rounded bg-rose-900/50 text-rose-200"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* NAVEGACIÓN SECUNDARIA COMPACTA MOBILE-FIRST */}
          <div className="flex items-center justify-between pb-2 pt-1 border-t border-blue-400/20 text-xs gap-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setVistaActual('kanban')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  vistaActual === 'kanban'
                    ? 'bg-white text-[#2b5c8f] shadow dark:bg-slate-800 dark:text-blue-300'
                    : 'text-blue-100 hover:bg-white/10'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Tablero</span>
              </button>

              <button
                onClick={() => setVistaActual('archivo')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  vistaActual === 'archivo'
                    ? 'bg-white text-[#2b5c8f] shadow dark:bg-slate-800 dark:text-blue-300'
                    : 'text-blue-100 hover:bg-white/10'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Historial</span>
              </button>

              <button
                onClick={() => refreshTareas()}
                className="p-1 text-blue-200 hover:text-white rounded"
                title="Refrescar"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onNuevaTarea}
              className="bg-[#c13127] hover:bg-[#9e251e] text-white px-2.5 sm:px-3 py-1.5 rounded-lg font-extrabold shadow transition flex items-center gap-1 active:scale-95 text-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Tarea</span>
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
