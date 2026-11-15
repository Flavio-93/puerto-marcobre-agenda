import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTareas } from '../context/TareasContext';
import { SEED_USUARIOS } from '../services/supabase';
import { CriticidadTarea, TipoGuardia, VisibilidadTarea, FrecuenciaNotificacion } from '../types';
import { X, AlertCircle, ShieldAlert, Tag, UserCheck, Calendar, Bell } from 'lucide-react';

interface NuevaTareaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NuevaTareaModal: React.FC<NuevaTareaModalProps> = ({ isOpen, onClose }) => {
  const { usuario } = useAuth();
  const { crearTarea, guardiasActivas } = useTareas();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [asignadoAId, setAsignadoAId] = useState(usuario?.id || '');
  const [guardiaObjetivo, setGuardiaObjetivo] = useState<TipoGuardia>(guardiasActivas.guardia_1);
  const [criticidad, setCriticidad] = useState<CriticidadTarea>('Media');
  const [visibilidad, setVisibilidad] = useState<VisibilidadTarea>('General');
  const [frecuenciaNotificacion, setFrecuenciaNotificacion] = useState<FrecuenciaNotificacion>('1 hora antes');
  const [etiquetasInput, setEtiquetasInput] = useState('Mecánico, Operativo');
  const [fechaLimite, setFechaLimite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetFormulario = () => {
    setTitulo('');
    setDescripcion('');
    setAsignadoAId(usuario?.id || '');
    setGuardiaObjetivo(guardiasActivas.guardia_1);
    setCriticidad('Media');
    setVisibilidad('General');
    setFrecuenciaNotificacion('1 hora antes');
    setEtiquetasInput('Mecánico, Operativo');
    setFechaLimite('');
    setError(null);
  };

  const handleCerrar = () => {
    resetFormulario();
    onClose();
  };

  if (!isOpen) return null;

  // Si es supervisor, solo puede asignar a otros supervisores (no a Jefatura ni Superintendencia)
  const esSupervisor = usuario?.rol === 'supervisor_planta' || usuario?.rol === 'supervisor_descarga';
  const usuariosAsignables = SEED_USUARIOS.filter((u) => {
    if (esSupervisor) {
      // Solo supervisores de planta y descarga
      return u.rol === 'supervisor_planta' || u.rol === 'supervisor_descarga';
    }
    // Jefatura / Superintendente puede asignar a cualquiera
    return true;
  });

  // Si asigna a alguien más, visibilidad obligatoriamente se fuerza a 'General' (Regla de Transparencia)
  const esAsignadoAOtro = asignadoAId !== '' && asignadoAId !== usuario?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setError('El título de la tarea es requerido.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const etiquetas = etiquetasInput
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await crearTarea({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        asignado_a_id: asignadoAId || null,
        guardia_objetivo: guardiaObjetivo,
        nivel_criticidad: criticidad,
        estado: 'Por Hacer',
        // Si es a otro, forzar General
        visibilidad: esAsignadoAOtro ? 'General' : visibilidad,
        frecuencia_notificacion: frecuenciaNotificacion,
        etiquetas: etiquetas.length > 0 ? etiquetas : ['General'],
        fecha_limite: fechaLimite ? new Date(fechaLimite).toISOString() : null,
      });

      // Limpiar formulario inmediatamente para la próxima tarea
      resetFormulario();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al crear tarea.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 my-8">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-[#2b5c8f] dark:text-blue-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2b5c8f] dark:text-blue-400">
                Registrar Nueva Tarea Portuaria
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Creada por: {usuario?.nombre_completo} (Gda {usuario?.guardia})
              </p>
            </div>
          </div>
          <button
            onClick={handleCerrar}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-3 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* TÍTULO */}
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Título de la Tarea / Actividad *
            </label>
            <input
              type="text"
              required
              placeholder="ej: Inspección de cinta transportadora en Muelle 1"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-[#2b5c8f] focus:outline-none"
            />
          </div>

          {/* DESCRIPCIÓN */}
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Descripción Operativa y Observaciones
            </label>
            <textarea
              rows={3}
              placeholder="Detalle los puntos clave para el relevo o la ejecución técnica..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-[#2b5c8f] focus:outline-none"
            />
          </div>

          {/* ASIGNACIÓN Y GUARDIA OBJETIVO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                Asignado a:
              </label>
              <select
                value={asignadoAId}
                onChange={(e) => setAsignadoAId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
              >
                <option value={usuario?.id}>A mí mismo ({usuario?.nombre_completo.split(' ')[0]})</option>
                <optgroup label={esSupervisor ? "Supervisores de Campo (Guardias A, B, C, D):" : "Personal Marcobre Puerto:"}>
                  {usuariosAsignables.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre_completo} ({u.guardia === 'Staff' ? 'Jefatura' : `Gda ${u.guardia} - ${u.area}`})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Guardia Responsable / Relevo:
              </label>
              <select
                value={guardiaObjetivo}
                onChange={(e) => setGuardiaObjetivo(e.target.value as TipoGuardia)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
              >
                <option value="A">Guardia A</option>
                <option value="B">Guardia B</option>
                <option value="C">Guardia C</option>
                <option value="D">Guardia D</option>
                <option value="Staff">Staff / General</option>
              </select>
            </div>
          </div>

          {/* CRITICIDAD Y VISIBILIDAD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Nivel de Criticidad
              </label>
              <select
                value={criticidad}
                onChange={(e) => setCriticidad(e.target.value as CriticidadTarea)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
              >
                <option value="Baja">Baja (Rutinaria)</option>
                <option value="Media">Media (Estándar)</option>
                <option value="Alta">Alta (Prioridad en Turno)</option>
                <option value="Critica">Crítica (Riesgo / Detención)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Privacidad / Visibilidad
              </label>
              {esAsignadoAOtro ? (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  Forzado a <span className="underline">General</span> por regla de transparencia (asignado a tercero).
                </div>
              ) : (
                <select
                  value={visibilidad}
                  onChange={(e) => setVisibilidad(e.target.value as VisibilidadTarea)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
                >
                  <option value="General">General (Visible para todo el puerto)</option>
                  <option value="Personal">Personal (Solo yo y Jefatura)</option>
                </select>
              )}
            </div>
          </div>

          {/* ETIQUETAS Y FECHA LÍMITE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Fecha / Hora Estimada
              </label>
              <input
                type="datetime-local"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                Frecuencia de Notificación / Recordatorio
              </label>
              <select
                value={frecuenciaNotificacion}
                onChange={(e) => setFrecuenciaNotificacion(e.target.value as FrecuenciaNotificacion)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
              >
                <option value="5 minutos antes">5 minutos antes</option>
                <option value="10 minutos antes">10 minutos antes</option>
                <option value="30 minutos antes">30 minutos antes</option>
                <option value="1 hora antes">1 hora antes</option>
                <option value="3 horas antes">3 horas antes</option>
                <option value="12 horas antes">12 horas antes</option>
                <option value="1 día antes">1 día antes</option>
                <option value="1 semana antes">1 semana antes</option>
                <option value="Cada hora">Cada hora (Repetitivo)</option>
                <option value="Cada 3 horas">Cada 3 horas (Repetitivo)</option>
                <option value="Diaria en relevo">Diaria en relevo de guardia</option>
                <option value="Sin Notificación">Sin Notificación</option>
              </select>
            </div>
          </div>

          {/* ETIQUETAS */}
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              Etiquetas (separadas por comas)
            </label>
            <input
              type="text"
              placeholder="Seguridad, Mecánico, Eléctrico, Muelle..."
              value={etiquetasInput}
              onChange={(e) => setEtiquetasInput(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
            />
          </div>

          {/* ACCIONES */}
          <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-[#c13127] hover:bg-[#9e251e] text-white font-bold shadow-md transition disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : 'Crear Tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

