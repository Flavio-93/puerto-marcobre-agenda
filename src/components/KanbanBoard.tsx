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
  ListTodo
} from 'lucide-react';

export const KanbanBoard: React.FC = () => {
  const { tareas, guardiasActivas } = useTareas();
  const { usuario, esJefatura } = useAuth();

  // Vista predeterminada: 'mis_asignadas' al iniciar la app
  const [vistaTareas, setVistaTareas] = useState<'mis_asignadas' | 'general' | 'mis_personales'>('mis_asignadas');
  const [filtroGuardiaSoloActivas, setFiltroGuardiaSoloActivas] = useState(false);

  // Filtrado de Tareas
  const tareasFiltradas = tareas.filter((tarea) => {
    // Las canceladas salen del Kanban principal hacia el módulo Archivo (Requisito 6)
    if (tarea.estado === 'Cancelado') return false;

    // 1. Selector Principal de Vistas
    if (vistaTareas === 'mis_asignadas') {
      // Solo las tareas en las que este usuario está asignado (las que tiene que hacer)
      if (tarea.asignado_a_id !== usuario?.id) return false;
    } else if (vistaTareas === 'mis_personales') {
      // Tareas generadas por mí como apunte o tarea personal
      if (tarea.creador_id !== usuario?.id || tarea.visibilidad !== 'Personal') return false;
    } else if (vistaTareas === 'general') {
      // Todas las tareas en general de todos
      // (Si no es jefatura, las tareas personales ajenas se ocultan por RLS)
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

  const columnas: { estado: EstadoTarea; titulo: string; color: string; icon: React.ReactNode }[] = [
    {
      estado: 'Por Hacer',
      titulo: 'Tareas en Espera / Activas',
      color: 'border-t-4 border-[#2b5c8f] bg-[#2b5c8f]/5',
      icon: <Clock className="w-4 h-4 text-[#2b5c8f]" />,
    },
    {
      estado: 'Completado',
      titulo: 'Completado en Turno',
      color: 'border-t-4 border-emerald-500 bg-emerald-500/5',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Rápidos de Campo (Mobile-First) */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
        {/* Selector Principal de Vistas: Mis Tareas Asignadas (Inicio) / General / Generadas por Mí */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setVistaTareas('mis_asignadas')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              vistaTareas === 'mis_asignadas'
                ? 'bg-[#2b5c8f] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Mis Tareas por Hacer</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaTareas('general')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              vistaTareas === 'general'
                ? 'bg-[#2b5c8f] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Todas las Tareas (General)</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaTareas('mis_personales')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              vistaTareas === 'mis_personales'
                ? 'bg-[#2b5c8f] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Generadas por Mí (Personal)</span>
          </button>
        </div>

        {/* Sub-filtros e Indicadores */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFiltroGuardiaSoloActivas(!filtroGuardiaSoloActivas)}
              className={`px-3 py-1.5 rounded-lg font-bold border transition flex items-center gap-1.5 ${
                filtroGuardiaSoloActivas
                  ? 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Guardias Activas ({guardiasActivas.guardia_1} & {guardiasActivas.guardia_2})</span>
            </button>

            <span className="text-slate-500 dark:text-slate-400 text-xs">
              {vistaTareas === 'mis_asignadas' && 'Mostrando únicamente las actividades donde eres el supervisor responsable.'}
              {vistaTareas === 'general' && 'Mostrando todas las tareas operativas activas en el puerto.'}
              {vistaTareas === 'mis_personales' && 'Mostrando solo tus apuntes y tareas creadas de carácter personal.'}
            </span>
          </div>

          <div className="text-slate-500 dark:text-slate-400 font-semibold text-xs">
            Mostrando: <strong className="text-[#2b5c8f] dark:text-blue-300">{tareasFiltradas.length}</strong> tareas
          </div>
        </div>
      </div>

      {/* Tablero Kanban de Columnas Activas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {columnas.map((col) => {
          const tareasColumna = tareasFiltradas.filter((t) => t.estado === col.estado);

          return (
            <div
              key={col.estado}
              className={`rounded-xl bg-slate-50/80 dark:bg-slate-900/60 p-3 sm:p-4 border border-slate-200 dark:border-slate-800 flex flex-col min-h-[500px] ${col.color}`}
            >
              {/* Encabezado de Columna */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {col.icon}
                  <h2 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white">
                    {col.titulo}
                  </h2>
                </div>
                <span className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold px-2 py-0.5 rounded-full">
                  {tareasColumna.length}
                </span>
              </div>

              {/* Lista de Tarjetas */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
                {tareasColumna.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
                    <p>No hay tareas en esta etapa.</p>
                  </div>
                ) : (
                  tareasColumna.map((tarea) => (
                    <TaskCard key={tarea.id} tarea={tarea} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

