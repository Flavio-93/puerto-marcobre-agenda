import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTareas } from '../context/TareasContext';
import { Tarea } from '../types';
import { reproducirAlarmaSonoraPersonal, dispararNotificacionSistema, registrarSuscripcionPush, enviarPushRemoto } from '../services/notificationService';
import { Bell, X, AlertTriangle, Clock } from 'lucide-react';

export const NotificationMonitor: React.FC = () => {
  const { usuario } = useAuth();
  const { tareas } = useTareas();

  const [alarmaActiva, setAlarmaActiva] = useState<{
    tarea: Tarea;
    mensaje: string;
  } | null>(null);

  const [alertasNotificadas, setAlertasNotificadas] = useState<Set<string>>(() => {
    const saved = sessionStorage.getItem('marcobre_alertas_notificadas');
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch (e) {}
    }
    return new Set();
  });
  const [permisoNotificaciones, setPermisoNotificaciones] = useState<NotificationPermission>(() => {
    if ('Notification' in window) return Notification.permission;
    return 'default';
  });

  // Solicitar permiso de Notificaciones al usuario
  const pedirPermisoNotificaciones = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setPermisoNotificaciones(perm);
      if (perm === 'granted') {
        if (usuario?.id) {
          await registrarSuscripcionPush(usuario.id);
        }
        reproducirAlarmaSonoraPersonal();
        dispararNotificacionSistema(
          '🔔 Notificaciones Activadas - Puerto Marcobre',
          'Recibirás sonido y vibración en tu celular cuando se te asigne una tarea o venza un plazo.'
        );
      }
    }
  };

  // Si ya tiene permiso concedido, asegurar registro de suscripción en segundo plano
  useEffect(() => {
    if (permisoNotificaciones === 'granted' && usuario?.id) {
      registrarSuscripcionPush(usuario.id);
    }
  }, [permisoNotificaciones, usuario?.id]);

  useEffect(() => {
    if (!usuario) return;

    const interval = setInterval(() => {
      const ahora = Date.now();

      for (const t of tareas) {
        // REGLA CRÍTICA DE DESTINATARIO:
        // Solo evaluar si Asignado_A_ID coincide con el usuario actualmente logueado
        if (t.asignado_a_id !== usuario.id) {
          continue; // Los demás usuarios NO deben escuchar ni ver nada
        }

        // Tarea terminada o cancelada no alerta
        if (t.estado === 'Completado' || t.estado === 'Cancelado') {
          continue;
        }

        if (!t.fecha_limite || !t.frecuencia_notificacion || t.frecuencia_notificacion === 'Sin Notificación') {
          continue;
        }

        const fLimite = new Date(t.fecha_limite).getTime();
        const diffMs = fLimite - ahora;
        const diffMin = Math.round(diffMs / 60000);

        let seCumple = false;
        let mensajeAviso = '';

        switch (t.frecuencia_notificacion) {
          case '5 minutos antes':
            seCumple = diffMin <= 5 && diffMin >= 0;
            mensajeAviso = 'Faltan 5 minutos para el plazo programado.';
            break;
          case '10 minutos antes':
            seCumple = diffMin <= 10 && diffMin >= 0;
            mensajeAviso = 'Faltan 10 minutos para el plazo programado.';
            break;
          case '30 minutos antes':
            seCumple = diffMin <= 30 && diffMin >= 0;
            mensajeAviso = 'Faltan 30 minutos para el plazo programado.';
            break;
          case '1 hora antes':
            seCumple = diffMin <= 60 && diffMin >= 0;
            mensajeAviso = 'Falta 1 hora para el plazo de la tarea.';
            break;
          case '3 horas antes':
            seCumple = diffMin <= 180 && diffMin >= 0;
            mensajeAviso = 'Faltan 3 horas para el plazo de la tarea.';
            break;
          case '12 horas antes':
            seCumple = diffMin <= 720 && diffMin >= 0;
            mensajeAviso = 'Faltan 12 horas para el plazo de la tarea.';
            break;
          case '1 día antes':
            seCumple = diffMin <= 1440 && diffMin >= 0;
            mensajeAviso = 'Falta 1 día para el plazo de la tarea.';
            break;
          case '1 semana antes':
            seCumple = diffMin <= 10080 && diffMin >= 0;
            mensajeAviso = 'Falta 1 semana para el plazo de la tarea.';
            break;
          case 'Cada hora':
            seCumple = diffMin >= 0;
            mensajeAviso = 'Recordatorio horario de actividad asignada.';
            break;
          case 'Cada 3 horas':
            seCumple = diffMin >= 0;
            mensajeAviso = 'Recordatorio cada 3 horas de actividad asignada.';
            break;
          case 'Diaria en relevo':
            seCumple = diffMin >= 0;
            mensajeAviso = 'Recordatorio diario de guardia para esta tarea.';
            break;
        }

        // Si la tarea ya venció y está sin completar: solo alertar una única vez
        if (diffMin < 0) {
          seCumple = true;
          mensajeAviso = '⚠️ Esta tarea tiene el plazo de guardia vencido.';
        }

        // Llave de control permanente para que NUNCA se repita en bucle
        const alertKey = diffMin < 0 
          ? `vencida-${t.id}` 
          : `${t.id}-${t.frecuencia_notificacion}`;

        if (seCumple && !alertasNotificadas.has(alertKey)) {
          setAlertasNotificadas((prev) => {
            const next = new Set(prev).add(alertKey);
            sessionStorage.setItem('marcobre_alertas_notificadas', JSON.stringify(Array.from(next)));
            return next;
          });

          // FILTRO PERSONAL: Reproducir sonido y mostrar banner SOLO una vez para el asignado
          reproducirAlarmaSonoraPersonal();

          setAlarmaActiva({
            tarea: t,
            mensaje: mensajeAviso,
          });

          // Notificación Nativa del Sistema / Celular (suena o vibra incluso fuera de la app)
          dispararNotificacionSistema(
            diffMin < 0 ? '⚠️ Plazo Vencido - Puerto Marcobre' : '⚓ Alerta de Tarea - Puerto Marcobre',
            `${t.titulo}: ${mensajeAviso}`,
            alertKey
          );

          // Si la tarea venció, enviar Push Remoto al servidor para despertar el celular si está bloqueado
          if (diffMin < 0 && t.asignado_a_id) {
            enviarPushRemoto({
              asignado_a_id: t.asignado_a_id,
              titulo: t.titulo,
              mensaje: `La tarea "${t.titulo}" ha vencido sin completarse en tu guardia.`,
              tag: alertKey,
              es_vencida: true,
            });
          }

          break; // Mostrar una alarma a la vez
        }
      }
    }, 10000); // Chequeo periódico cada 10s

    return () => clearInterval(interval);
  }, [usuario, tareas, alertasNotificadas]);

  return (
    <>
      {/* Banner flotante para activar notificaciones de celular si aún no están permitidas */}
      {permisoNotificaciones === 'default' && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] p-3 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl shadow-xl flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded-lg shrink-0">
              <Bell className="w-4 h-4" />
            </span>
            <span className="text-slate-700 dark:text-slate-200 text-[11px] font-medium leading-tight">
              ¿Activar sonido y vibración en este celular para tus tareas?
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={pedirPermisoNotificaciones}
              className="px-2.5 py-1 bg-[#2b5c8f] hover:bg-[#1e4570] text-white font-bold rounded-lg text-[11px] shadow-xs"
            >
              Activar
            </button>
            <button
              type="button"
              onClick={() => setPermisoNotificaciones('denied')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Banner de Alerta Personal cuando suena */}
      {alarmaActiva && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md w-full p-4 bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-2xl shadow-2xl animate-bounce-once text-slate-800 dark:text-slate-100 flex items-start gap-3">
          <div className="p-3 bg-rose-100 dark:bg-rose-950 text-rose-600 rounded-xl animate-pulse shrink-0">
            <Bell className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Alerta Personal para Ti
              </span>
              <button
                onClick={() => setAlarmaActiva(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight truncate">
              {alarmaActiva.tarea.titulo}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {alarmaActiva.mensaje}
            </p>

            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                {alarmaActiva.tarea.frecuencia_notificacion}
              </span>
              <button
                onClick={() => setAlarmaActiva(null)}
                className="px-3 py-1 bg-[#2b5c8f] hover:bg-[#1e4570] text-white font-bold rounded-lg text-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

