import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTareas } from '../context/TareasContext';
import { Tarea, EstadoTarea } from '../types';
import { SEED_USUARIOS } from '../services/supabase';
import { 
  AlertTriangle, 
  User, 
  Tag, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Globe,
  Bell,
  History,
  RotateCcw,
  MessageSquare
} from 'lucide-react';

interface TaskCardProps {
  tarea: Tarea;
  onVerDetalle?: (tarea: Tarea) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ tarea }) => {
  const { usuario } = useAuth();
  const { 
    actualizarEstado, 
    reasignarTarea, 
    cancelarTarea, 
    actualizarFrecuenciaNotificacion,
    registrarMotivoVencimiento,
    historialReasignaciones 
  } = useTareas();

  const [modalCancelar, setModalCancelar] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);

  // Estados para Modal de Reasignación con Motivo
  const [modalReasignar, setModalReasignar] = useState(false);
  const [nuevoAsignado, setNuevoAsignado] = useState(tarea.asignado_a_id || '');
  const [motivoReasignacion, setMotivoReasignacion] = useState('');
  const [errorReasignar, setErrorReasignar] = useState<string | null>(null);

  // Estados para Justificación de Vencimiento de Fecha
  const [modalVencimiento, setModalVencimiento] = useState(false);
  const [motivoVencimientoInput, setMotivoVencimientoInput] = useState('');
  const [errorVencimiento, setErrorVencimiento] = useState<string | null>(null);

  // Modal para ver Historial de Reasignaciones de esta tarea
  const [modalHistorial, setModalHistorial] = useState(false);

  // Editar Frecuencia de Alerta
  const [editandoFrecuencia, setEditandoFrecuencia] = useState(false);

  const reasignaciones = historialReasignaciones[tarea.id] || [];
  const soyElAsignado = usuario?.id === tarea.asignado_a_id;
  const soyElCreador = usuario?.id === tarea.creador_id;
  const esJefeOSuperintendente = usuario?.rol === 'superintendente' || usuario?.rol === 'jefe';
  const esSupervisor = usuario?.rol === 'supervisor_planta' || usuario?.rol === 'supervisor_descarga';

  // Supervisores solo pueden reasignar a otros supervisores (no a jefatura)
  const candidatosReasignacion = SEED_USUARIOS.filter((u) => {
    if (u.id === tarea.asignado_a_id) return false;
    if (esSupervisor) {
      return u.rol === 'supervisor_planta' || u.rol === 'supervisor_descarga';
    }
    return true;
  });

  // Regla estricta: Solo Creador, Asignado Actual, Jefe o Superintendente pueden reasignar
  const puedeReasignar = soyElAsignado || soyElCreador || esJefeOSuperintendente;

  // Verificación de Vencimiento de Fecha
  const estaVencida = Boolean(
    tarea.fecha_limite && 
    new Date(tarea.fecha_limite).getTime() < Date.now() && 
    tarea.estado !== 'Completado' && 
    tarea.estado !== 'Cancelado'
  );

  // Colores por criticidad
  const criticidadBadge = {
    Baja: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    Media: 'bg-blue-100 text-[#2b5c8f] border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    Alta: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    Critica: 'bg-rose-100 text-[#c13127] border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-extrabold animate-pulse',
  }[tarea.nivel_criticidad] || 'bg-slate-100 text-slate-800';

  const creadorNombre = tarea.creador?.nombre_completo || 
    SEED_USUARIOS.find((u) => u.id === tarea.creador_id)?.nombre_completo || 'Usuario';
  const asignadoNombre = tarea.asignado?.nombre_completo || 
    SEED_USUARIOS.find((u) => u.id === tarea.asignado_a_id)?.nombre_completo || 'Sin Asignar';

  const confirmarCancelacion = async () => {
    if (!motivoCancelacion.trim() || motivoCancelacion.trim().length < 4) {
      setErrorCancelar('El motivo de cancelación es obligatorio (mínimo 4 caracteres).');
      return;
    }
    const res = await cancelarTarea(tarea.id, motivoCancelacion);
    if (res.success) {
      setModalCancelar(false);
      setMotivoCancelacion('');
      setErrorCancelar(null);
    } else {
      setErrorCancelar(res.error || 'Error al cancelar');
    }
  };

  const confirmarReasignacion = async () => {
    if (!puedeReasignar) {
      setErrorReasignar('No tienes permisos para reasignar esta tarea. Solo el creador, el supervisor asignado o la jefatura pueden hacerlo.');
      return;
    }
    if (!nuevoAsignado || nuevoAsignado === tarea.asignado_a_id) {
      setErrorReasignar('Seleccione a un supervisor diferente al actual.');
      return;
    }
    if (!motivoReasignacion.trim() || motivoReasignacion.trim().length < 5) {
      setErrorReasignar('Debe detallar el motivo por el cual no se concluyó o complicó la tarea.');
      return;
    }

    const res = await reasignarTarea(tarea.id, nuevoAsignado, motivoReasignacion);
    if (res.success) {
      setModalReasignar(false);
      setMotivoReasignacion('');
      setErrorReasignar(null);
    } else {
      setErrorReasignar(res.error || 'Error al reasignar');
    }
  };

  const confirmarJustificacionVencimiento = async () => {
    if (!motivoVencimientoInput.trim() || motivoVencimientoInput.trim().length < 5) {
      setErrorVencimiento('Debe detallar el porqué no se cumplió la tarea dentro del plazo de su guardia.');
      return;
    }
    const res = await registrarMotivoVencimiento(tarea.id, motivoVencimientoInput);
    if (res.success) {
      setModalVencimiento(false);
      setMotivoVencimientoInput('');
      setErrorVencimiento(null);
    } else {
      setErrorVencimiento(res.error || 'Error al guardar justificación');
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition text-slate-800 dark:text-slate-100 flex flex-col justify-between">
        <div>
          {/* Fila Superior: Badges de Criticidad, Visibilidad y Guardia */}
          <div className="flex items-center justify-between gap-1.5 mb-2.5 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${criticidadBadge}`}>
              {tarea.nivel_criticidad}
            </span>

            <div className="flex items-center gap-1.5">
              {tarea.visibilidad === 'Personal' ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-md" title="Visible solo para ti y Jefatura">
                  <Lock className="w-3 h-3" />
                  Personal
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-semibold bg-blue-50 dark:bg-blue-950 text-[#2b5c8f] dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md" title="Visible para todo el puerto">
                  <Globe className="w-3 h-3" />
                  General
                </span>
              )}

              <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold px-1.5 py-0.5 rounded">
                Gda {tarea.guardia_creador} {tarea.guardia_objetivo && tarea.guardia_objetivo !== tarea.guardia_creador ? `➔ ${tarea.guardia_objetivo}` : ''}
              </span>
            </div>
          </div>

          {/* Título de la Tarea */}
          <h3 className="font-bold text-sm sm:text-base leading-snug mb-1 text-slate-900 dark:text-white">
            {tarea.titulo}
          </h3>

          {/* ALERTA DE FECHA VENCIDA SIN CUMPLIR */}
          {estaVencida && (
            <div className="mb-2.5 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-[11px]">
              <div className="flex items-center justify-between text-rose-700 dark:text-rose-300 font-bold mb-1">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Plazo Vencido en Guardia
                </span>
                <span className="text-[10px]">{tarea.fecha_limite ? new Date(tarea.fecha_limite).toLocaleDateString() : ''}</span>
              </div>
              {tarea.motivo_vencimiento ? (
                <div className="text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 p-1.5 rounded text-[10px] border border-rose-200 dark:border-rose-900">
                  <span className="font-semibold text-rose-800 dark:text-rose-400">Justificación:</span> "{tarea.motivo_vencimiento}"
                </div>
              ) : (
                <div className="flex items-center justify-between gap-1 mt-1">
                  <span className="text-rose-600 dark:text-rose-400 font-medium">Falta justificar incumplimiento:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMotivoVencimientoInput('');
                      setErrorVencimiento(null);
                      setModalVencimiento(true);
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2 py-0.5 rounded text-[10px] shadow transition active:scale-95"
                  >
                    Explicar Por Qué
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Descripción */}
          {tarea.descripcion && (
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 mb-3 whitespace-pre-line">
              {tarea.descripcion}
            </p>
          )}

          {/* Etiquetas y Frecuencia de Notificación */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {tarea.frecuencia_notificacion && tarea.frecuencia_notificacion !== 'Sin Notificación' && (
              <div className="relative">
                {editandoFrecuencia ? (
                  <select
                    value={tarea.frecuencia_notificacion}
                    onChange={(e) => {
                      actualizarFrecuenciaNotificacion(tarea.id, e.target.value);
                      setEditandoFrecuencia(false);
                    }}
                    onBlur={() => setEditandoFrecuencia(false)}
                    autoFocus
                    className="text-[10px] bg-white dark:bg-slate-800 border border-[#2b5c8f] rounded p-1 font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <option value="5 minutos antes">5 minutos antes</option>
                    <option value="10 minutos antes">10 minutos antes</option>
                    <option value="30 minutos antes">30 minutos antes</option>
                    <option value="1 hora antes">1 hora antes</option>
                    <option value="3 horas antes">3 horas antes</option>
                    <option value="12 horas antes">12 horas antes</option>
                    <option value="1 día antes">1 día antes</option>
                    <option value="1 semana antes">1 semana antes</option>
                    <option value="Cada hora">Cada hora</option>
                    <option value="Cada 3 horas">Cada 3 horas</option>
                    <option value="Diaria en relevo">Diaria en relevo</option>
                    <option value="Sin Notificación">Sin Notificación</option>
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditandoFrecuencia(true)}
                    className="text-[10px] bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded font-semibold flex items-center gap-1 transition"
                    title="Haz clic para modificar la frecuencia de alerta"
                  >
                    <Bell className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                    <span>🔔 {tarea.frecuencia_notificacion}</span>
                    <span className="text-[9px] text-amber-500 opacity-80 underline">cambiar</span>
                  </button>
                )}
              </div>
            )}

            {/* Contador de Reasignaciones si existen */}
            {reasignaciones.length > 0 && (
              <button
                type="button"
                onClick={() => setModalHistorial(true)}
                className="text-[10px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded font-bold flex items-center gap-1 hover:bg-purple-100 transition"
                title="Ver historial de reasignaciones y motivos"
              >
                <History className="w-2.5 h-2.5" />
                <span>Reasignada {reasignaciones.length} {reasignaciones.length === 1 ? 'vez' : 'veces'}</span>
              </button>
            )}

            {tarea.etiquetas && tarea.etiquetas.length > 0 && (
              tarea.etiquetas.map((t, idx) => (
                <span
                  key={idx}
                  className="text-[10px] bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-medium flex items-center gap-0.5"
                >
                  <Tag className="w-2.5 h-2.5 opacity-60" />
                  {t}
                </span>
              ))
            )}
          </div>

          {/* Responsables */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg text-[11px] space-y-1 mb-3 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Creado por:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                {creadorNombre.split(' ')[0]} {creadorNombre.split(' ')[1] || ''}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-[#2b5c8f]" />
                Asignado:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                  {asignadoNombre.split(' ')[0]} {asignadoNombre.split(' ')[2] || asignadoNombre.split(' ')[1] || ''}
                </span>
                {puedeReasignar ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoAsignado('');
                      setMotivoReasignacion('');
                      setErrorReasignar(null);
                      setModalReasignar(true);
                    }}
                    className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-[#2b5c8f] dark:text-blue-300 hover:bg-[#2b5c8f] hover:text-white px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 transition flex items-center gap-1"
                    title="Reasignar a otro supervisor con motivo"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reasignar</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono italic" title="Solo el creador, el asignado o jefatura pueden reasignar">
                    (Protegido)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ACCIONES Y BOTONES GRANDES (TOUCH-FRIENDLY PARA CAMPO) */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-2">
          {/* Flujo de Estados Directo */}
          <div className="grid grid-cols-1 gap-1.5">
            {tarea.estado === 'Por Hacer' && (
              <button
                onClick={() => actualizarEstado(tarea.id, 'Completado')}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Marcar como Completado</span>
              </button>
            )}

            {tarea.estado === 'En Progreso' && (
              <button
                onClick={() => actualizarEstado(tarea.id, 'Completado')}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Marcar como Completado</span>
              </button>
            )}

            {tarea.estado === 'Completado' && (
              <div className="w-full py-2 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Trabajo Concluido</span>
              </div>
            )}
          </div>

          {/* Botón Cancelar Tarea (NO HAY BOTÓN ELIMINAR - CERO ELIMINACIONES) */}
          {tarea.estado !== 'Completado' && tarea.estado !== 'Cancelado' && (
            <button
              onClick={() => setModalCancelar(true)}
              className="w-full py-1.5 text-[11px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-medium flex items-center justify-center gap-1 transition"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Suspender / Cancelar Tarea</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal Justificación de Vencimiento de Fecha */}
      {modalVencimiento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 shadow-2xl border border-rose-200 dark:border-rose-900 text-slate-800 dark:text-slate-100">
            <h3 className="font-bold text-base text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              Justificar Incumplimiento de Plazo
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Esta tarea tenía como fecha límite el {tarea.fecha_limite ? new Date(tarea.fecha_limite).toLocaleString() : ''}. Debe registrar por qué no se completó en su turno/guardia:
            </p>

            {errorVencimiento && (
              <div className="mb-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 p-2.5 rounded-lg border border-rose-300 dark:border-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorVencimiento}</span>
              </div>
            )}

            <textarea
              rows={3}
              required
              value={motivoVencimientoInput}
              onChange={(e) => setMotivoVencimientoInput(e.target.value)}
              placeholder="Detalla qué impidió cumplir la tarea a tiempo (ej: condiciones climáticas adversas, demoras en el atraque, falta de repuestos, etc.)..."
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none mb-3"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalVencimiento(false)}
                className="px-3 py-2 text-xs font-semibold rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarJustificacionVencimiento}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow"
              >
                Guardar Justificación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reasignar Tarea con Motivo Obligatorio */}
      {modalReasignar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
            <h3 className="font-bold text-base text-[#2b5c8f] dark:text-blue-400 mb-1 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-amber-500" />
              Reasignar Tarea a Otro Supervisor
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Actualmente asignada a: <strong className="text-slate-800 dark:text-slate-200">{asignadoNombre}</strong>
            </p>

            {errorReasignar && (
              <div className="mb-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 p-2.5 rounded-lg border border-rose-300 dark:border-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorReasignar}</span>
              </div>
            )}

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Nuevo Supervisor Responsable *
                </label>
                <select
                  value={nuevoAsignado}
                  onChange={(e) => setNuevoAsignado(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
                >
                  <option value="">-- Seleccionar supervisor de relevo --</option>
                  {candidatosReasignacion.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre_completo} ({u.guardia === 'Staff' ? 'Jefatura' : `Gda ${u.guardia} - ${u.area}`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  ¿Por qué no se realizó o qué se complicó? (Motivo Obligatorio) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={motivoReasignacion}
                  onChange={(e) => setMotivoReasignacion(e.target.value)}
                  placeholder="Detalla qué impidió completar la tarea, qué quedó pendiente o qué condiciones de muelle/planta se presentaron..."
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-[#2b5c8f] focus:outline-none"
                />
              </div>
            </div>

            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-300 mb-4 space-y-1">
              <div>
                Reasignado por: <strong>{usuario?.nombre_completo}</strong> ({usuario?.rol === 'superintendente' ? 'Superintendente' : usuario?.rol === 'jefe' ? 'Jefe de Área' : soyElCreador ? 'Creador de la Tarea' : 'Supervisor Asignado'})
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                ℹ️ Quedará registrado en la auditoría con tu nombre y fecha exacta.
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalReasignar(false)}
                className="px-3 py-2 text-xs rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarReasignacion}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[#2b5c8f] hover:bg-[#1e4570] text-white shadow"
              >
                Confirmar Reasignación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial de Reasignaciones de esta Tarea */}
      {modalHistorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Historial de Reasignaciones ({reasignaciones.length})
                </h3>
              </div>
              <button
                onClick={() => setModalHistorial(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {reasignaciones.map((h, i) => (
                <div key={h.id || i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
                    <span className="font-bold text-[#2b5c8f] dark:text-blue-300">
                      Reasignación #{reasignaciones.length - i}
                    </span>
                    <span>{new Date(h.created_at).toLocaleString()}</span>
                  </div>

                  <div className="text-slate-700 dark:text-slate-300 mb-2">
                    De: <strong className="text-slate-900 dark:text-white">{h.asignado_anterior_nombre}</strong> ➔ A: <strong className="text-[#2b5c8f] dark:text-blue-300">{h.asignado_nuevo_nombre}</strong>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                    <div className="font-semibold text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                      <MessageSquare className="w-3 h-3 text-amber-500" />
                      <span>Motivo / Complicación reportada:</span>
                    </div>
                    <p className="whitespace-pre-line text-xs font-medium italic">
                      "{h.motivo}"
                    </p>
                  </div>

                  <div className="mt-2 text-[10px] text-slate-400 text-right">
                    Registrado por: {h.usuario_nombre}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-right mt-3">
              <button
                type="button"
                onClick={() => setModalHistorial(false)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelación Obligatoria con Motivo (SOFT DELETE) */}
      {modalCancelar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 shadow-2xl border border-rose-200 dark:border-rose-900 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-base">Cancelar Tarea (Cero Eliminaciones)</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Por política estricta de auditoría portuaria, ninguna tarea puede borrarse del sistema. Para cancelar esta tarea debe registrar un motivo detallado:
            </p>

            {errorCancelar && (
              <div className="mb-3 text-xs bg-rose-50 text-rose-700 p-2 rounded border border-rose-300">
                {errorCancelar}
              </div>
            )}

            <textarea
              rows={3}
              required
              value={motivoCancelacion}
              onChange={(e) => setMotivoCancelacion(e.target.value)}
              placeholder="ej: Suspensión de faena por oleaje anómalo / Cambio de prioridad por jefatura..."
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalCancelar(false);
                  setErrorCancelar(null);
                }}
                className="px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={confirmarCancelacion}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow"
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

