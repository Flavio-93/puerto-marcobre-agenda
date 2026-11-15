import React, { useState } from 'react';
import { useTareas } from '../context/TareasContext';
import { useAuth } from '../context/AuthContext';
import { TaskCard } from './TaskCard';
import { EstadoTarea, TipoGuardia } from '../types';
import { 
  Filter, 
  Layers, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Globe, 
  Lock,
  ListTodo,
  Search,
  X
} from 'lucide-react';

export const KanbanBoard: React.FC = () => {
  const { tareas, guardiasActivas } = useTareas();
  const { usuario, esJefatura } = useAuth();

  // Vista predeterminada: 'mis_asignadas' al iniciar la app
  const [vistaTareas, setVistaTareas] = useState<'mis_asignadas' | 'general' | 'mis_personales' | 'completadas'>('mis_asignadas');
  const [filtroGuardiaSoloActivas, setFiltroGuardiaSoloActivas] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // Filtrado de Tareas
  const tareasFiltradas = tareas.filter((tarea) => {
    // Las canceladas salen del Kanban principal hacia el módulo Archivo (Requisito 6)
    if (tarea.estado === 'Cancelado') return false;

    // Filtro por Buscador (Título, Descripción, Creador, Asignado, Etiquetas)
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      const coincideTitulo = tarea.titulo.toLowerCase().includes(q);
      const coincideDesc = tarea.descripcion?.toLowerCase().includes(q) || false;
      const coincideCreador = tarea.creador?.nombre_completo.toLowerCase().includes(q) || false;
      const coincideAsignado = tarea.asignado?.nombre_completo.toLowerCase().includes(q) || false;
      const coincideEtiquetas = tarea.etiquetas?.some(tag => tag.toLowerCase().includes(q)) || false;

      if (!coincideTitulo && !coincideDesc && !coincideCreador && !coincideAsignado && !coincideEtiquetas) {
        return false;
      }
    }

    // 1. Selector Principal de Vistas
    if (vistaTareas === 'mis_asignadas') {
      // Solo las tareas en las que este usuario está asignado y que estén pendientes (Por Hacer / En Progreso)
      if (tarea.asignado_a_id !== usuario?.id || tarea.estado === 'Completado') return false;
    } else if (vistaTareas === 'mis_personales') {
      // Tareas generadas por mí como apunte o tarea personal
      if (tarea.creador_id !== usuario?.id || tarea.visibilidad !== 'Personal') return false;
    } else if (vistaTareas === 'general') {
      // Todas las tareas en general de todos activas (pendientes)
      if (tarea.estado === 'Completado') return false;
      if (tarea.visibilidad === 'Personal' && tarea.creador_id !== usuario?.id && !esJefatura) {
        return false;
      }
    } else if (vistaTareas === 'completadas') {
      // Solo tareas completadas en turno
      if (tarea.estado !== 'Completado') return false;
      if (tarea.visibilidad === 'Personal' && tarea.creador_id !== usuario?.id && !esJefatura) {
        return false;
      }
    }

    // 2. Filtro opcional por Guardias Activas (Régimen 10x10)
    if (filtroGuardiaSoloActivas) {
      const correspondeG1 = tarea.guardia_creador === guardiasActivas.guardia_1 || tarea.guardia_objetivo === guardiasActivas.guardia_1;
      const correspondeG2 = tarea.guardia_creador === guardiasActivas.guardia_2 || tarea.guardia_objetivo === guardiasActivas.guardia_2;
      const esStaff = tarea.guardia_creador === 'Staff' || tarea.guardia_objetivo === 'Staff';
      if (!correspondeG1 && !correspondeG2 && !esStaff) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Rápidos de Campo (Mobile-First) */}
      <div className="bg-white dark:bg-slate-900 p-2.5 sm:p-4 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 space-y-2.5 w-full overflow-hidden">
        {/* Campo de Búsqueda Rápida */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por tarea, supervisor, equipo, etiqueta..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2b5c8f] transition"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Selector Principal de Vistas: Mis Tareas Asignadas (Inicio) / General / Generadas por Mí / Hecho */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-full">
          <button
            type="button"
            onClick={() => setVistaTareas('mis_asignadas')}
            className={`py-2 px-0.5 rounded-lg text-[10px] sm:text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 text-center ${
              vistaTareas === 'mis_asignadas'
                ? 'bg-[#2b5c8f] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Por Hacer</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaTareas('general')}
            className={`py-2 px-0.5 rounded-lg text-[10px] sm:text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 text-center ${
              vistaTareas === 'general'
                ? 'bg-[#2b5c8f] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">General</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaTareas('mis_personales')}
            className={`py-2 px-0.5 rounded-lg text-[10px] sm:text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 text-center ${
              vistaTareas === 'mis_personales'
                ? 'bg-[#2b5c8f] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Personal</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaTareas('completadas')}
            className={`py-2 px-0.5 rounded-lg text-[10px] sm:text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 text-center ${
              vistaTareas === 'completadas'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Hecho</span>
          </button>
        </div>

        {/* Sub-filtros e Indicadores */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFiltroGuardiaSoloActivas(!filtroGuardiaSoloActivas)}
              className={`px-2.5 py-1 rounded-lg font-bold border transition flex items-center gap-1 text-[11px] ${
                filtroGuardiaSoloActivas
                  ? 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Gdas Activas ({guardiasActivas.guardia_1} & {guardiasActivas.guardia_2})</span>
            </button>
          </div>

          <div className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
            Total: <strong className="text-[#2b5c8f] dark:text-blue-300">{tareasFiltradas.length}</strong>
          </div>
        </div>
      </div>

      {/* Contenedor de Tareas / Tablero */}
      <div className="w-full">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-3 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-[500px]">
          {/* Encabezado de la lista actual */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {vistaTareas === 'completadas' ? (
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1.5 bg-blue-50 dark:bg-blue-950/60 rounded-lg text-[#2b5c8f] dark:text-blue-400">
                  <Clock className="w-4 h-4" />
                </div>
              )}
              <h2 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white">
                {vistaTareas === 'mis_asignadas' && 'Mis Tareas por Cumplir'}
                {vistaTareas === 'general' && 'Todas las Tareas Activas'}
                {vistaTareas === 'mis_personales' && 'Mis Tareas Personales'}
                {vistaTareas === 'completadas' && 'Tareas Completadas en Turno'}
              </h2>
            </div>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              vistaTareas === 'completadas' 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                : 'bg-blue-100 text-[#2b5c8f] dark:bg-blue-950 dark:text-blue-300'
            }`}>
              {tareasFiltradas.length} {tareasFiltradas.length === 1 ? 'tarea' : 'tareas'}
            </span>
          </div>

          {/* Lista de Tarjetas */}
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5">
            {tareasFiltradas.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
                <p className="font-medium">No hay tareas en esta sección.</p>
                {busqueda && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Prueba cambiando el término de búsqueda.
                  </p>
                )}
              </div>
            ) : (
              tareasFiltradas.map((tarea) => (
                <TaskCard key={tarea.id} tarea={tarea} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

