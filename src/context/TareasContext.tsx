import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Tarea, GuardiasActivasConfig, TipoGuardia, EstadoTarea } from '../types';
import { supabase, isSupabaseConfigured, INITIAL_MOCK_TAREAS, SEED_USUARIOS } from '../services/supabase';
import { useAuth } from './AuthContext';
import { 
  cacheTareas, 
  getCachedTareas, 
  enqueueOfflineSync, 
  getPendingSyncItems, 
  removePendingSyncItem 
} from '../services/indexedDb';
import { notificarTeams } from '../services/teamsService';
import { reproducirAlarmaSonoraPersonal, dispararNotificacionSistema, enviarPushRemoto } from '../services/notificationService';

interface TareasContextType {
  tareas: Tarea[];
  guardiasActivas: GuardiasActivasConfig;
  setGuardiasActivas: (config: GuardiasActivasConfig) => void;
  cambiarGuardias: (g1: TipoGuardia, g2: TipoGuardia) => Promise<void>;
  crearTarea: (nueva: Omit<Tarea, 'id' | 'created_at' | 'creador_id' | 'guardia_creador'>) => Promise<void>;
  actualizarEstado: (id: string, nuevoEstado: EstadoTarea, motivoCancelacion?: string) => Promise<void>;
  actualizarFrecuenciaNotificacion: (id: string, frecuencia: any) => Promise<void>;
  registrarMotivoVencimiento: (id: string, motivo: string) => Promise<{ success: boolean; error?: string }>;
  reasignarTarea: (id: string, nuevoAsignadoId: string, motivo: string) => Promise<{ success: boolean; error?: string }>;
  cancelarTarea: (id: string, motivo: string) => Promise<{ success: boolean; error?: string }>;
  historialReasignaciones: Record<string, any[]>;
  isOnline: boolean;
  isSyncing: boolean;
  refreshTareas: () => Promise<void>;
}

const TareasContext = createContext<TareasContextType | undefined>(undefined);

export const TareasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { usuario, esJefatura } = useAuth();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [historialReasignaciones, setHistorialReasignaciones] = useState<Record<string, any[]>>(() => {
    const saved = localStorage.getItem('marcobre_historial_reasignaciones');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return {
      'b0000001-0000-0000-0000-000000000002': [
        {
          id: 'hist-1',
          tarea_id: 'b0000001-0000-0000-0000-000000000002',
          usuario_id: 'a0000001-0000-0000-0000-000000000004',
          usuario_nombre: 'JUAN CARLOS HUAMAN QUISPE',
          asignado_anterior_nombre: 'JUAN CARLOS HUAMAN QUISPE',
          asignado_nuevo_nombre: 'YOFRE DÍAZ GUARDERAS',
          motivo: 'Salida de turno programada y relevo de guardia. Se concluyó la verificación inicial de amarras y queda pendiente monitorear marea viva de las 14:00 hrs.',
          created_at: new Date(Date.now() - 3600000 * 3).toISOString()
        }
      ]
    };
  });

  const [guardiasActivas, setGuardiasActivasState] = useState<GuardiasActivasConfig>(() => {
    const saved = localStorage.getItem('marcobre_guardias_activas');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return { guardia_1: 'A', guardia_2: 'B' };
  });

  // Escuchar conectividad online/offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      sincronizarPendientes();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar tareas (con Realtime o Offline/Local)
  const loadTareas = useCallback(async () => {
    if (!usuario) return;

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('tareas')
          .select(`
            *,
            creador:perfiles!creador_id(*),
            asignado:perfiles!asignado_a_id(*)
          `)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setTareas(data as Tarea[]);
          await cacheTareas(data as Tarea[]);
          return;
        }
      } catch (err) {
        console.warn('Fallo cargando desde Supabase, recurriendo a IndexedDB caché:', err);
      }
    }

    // Fallback a IndexedDB / Local
    const cached = await getCachedTareas();
    if (cached && cached.length > 0) {
      const filtradas = cached.filter((t) => {
        if (t.visibilidad === 'General') return true;
        if (t.creador_id === usuario.id) return true;
        if (esJefatura) return true;
        return false;
      });
      setTareas(filtradas);
    } else {
      const inicial = INITIAL_MOCK_TAREAS.filter((t) => {
        if (t.visibilidad === 'General') return true;
        if (t.creador_id === usuario.id) return true;
        if (esJefatura) return true;
        return false;
      });
      setTareas(inicial);
      await cacheTareas(INITIAL_MOCK_TAREAS);
    }
  }, [usuario?.id, esJefatura]);

  useEffect(() => {
    loadTareas();
  }, [loadTareas]);

  // Suscripción Supabase Realtime para WebSockets en vivo + Polling de Respaldo silencioso
  useEffect(() => {
    if (!isSupabaseConfigured || !usuario) return;

    // Canal único por sesión/usuario para evitar colisiones de canal en HMR o múltiples pestañas
    const channelName = `realtime_tareas_${usuario.id}_${Date.now().toString(36)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tareas' },
        (payload: any) => {
          console.log('⚡ Cambio Realtime instantáneo en Tareas:', payload);
          
          // NOTIFICACIÓN INMEDIATA AL ASIGNADO CUANDO SE LE ASIGNA O CREA UNA NUEVA TAREA
          if (payload.eventType === 'INSERT' && payload.new) {
            const nueva = payload.new;
            // Solo si la tarea recién creada ha sido asignada a este usuario
            if (nueva.asignado_a_id === usuario.id && nueva.creador_id !== usuario.id) {
              const creadorNom = SEED_USUARIOS.find((u) => u.id === nueva.creador_id)?.nombre_completo || 'Un supervisor';
              reproducirAlarmaSonoraPersonal();
              dispararNotificacionSistema(
                '⚓ ¡Nueva Tarea Asignada! - Puerto Marcobre',
                `${creadorNom} te ha asignado la tarea: "${nueva.titulo}"`,
                nueva.id
              );
            }
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const actualizada = payload.new;
            // Si la tarea fue reasignada a este usuario
            if (actualizada.asignado_a_id === usuario.id && payload.old?.asignado_a_id !== usuario.id) {
              reproducirAlarmaSonoraPersonal();
              dispararNotificacionSistema(
                '⚓ ¡Tarea Reasignada a Ti! - Puerto Marcobre',
                `Se te ha transferido la tarea: "${actualizada.titulo}"`,
                actualizada.id
              );
            }
          }

          loadTareas();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guardias_activas_config' },
        (payload: any) => {
          if (payload.new) {
            setGuardiasActivasState({
              guardia_1: payload.new.guardia_1,
              guardia_2: payload.new.guardia_2,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Estado conexión Realtime (${channelName}):`, status);
      });

    // Polling ligero de respaldo (cada 5 segundos) por si la conexión de red móvil entra en reposo
    const backupInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        loadTareas();
      }
    }, 5000);

    // Al volver a la app en celular (cuando se desbloquea o pasa a primer plano)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        loadTareas();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(backupInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [usuario?.id, loadTareas]);

  // Sincronizar cola pendiente acumulada en Offline
  const sincronizarPendientes = async () => {
    if (!isSupabaseConfigured || !navigator.onLine) return;
    setIsSyncing(true);
    try {
      const pendingItems = await getPendingSyncItems();
      for (const item of pendingItems) {
        try {
          if (item.tipo === 'INSERT_TAREA') {
            await supabase.from('tareas').insert(item.payload);
          } else if (item.tipo === 'UPDATE_TAREA' || item.tipo === 'CAMBIO_ESTADO') {
            await supabase.from('tareas').update(item.payload.data).eq('id', item.payload.id);
          }
          await removePendingSyncItem(item.id);
        } catch (itemErr) {
          console.error('Error sincronizando item:', item, itemErr);
        }
      }
      await loadTareas();
    } catch (err) {
      console.error('Error en sincronización background:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const setGuardiasActivas = (config: GuardiasActivasConfig) => {
    setGuardiasActivasState(config);
    localStorage.setItem('marcobre_guardias_activas', JSON.stringify(config));
  };

  const cambiarGuardias = async (g1: TipoGuardia, g2: TipoGuardia) => {
    const config = { guardia_1: g1, guardia_2: g2 };
    setGuardiasActivas(config);

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        await supabase
          .from('guardias_activas_config')
          .update({
            guardia_1: g1,
            guardia_2: g2,
            modificado_por: usuario?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 1);
      } catch (err) {
        console.error('Error actualizando guardias activas en Supabase:', err);
      }
    }
  };

  // Crear Tarea
  const crearTarea = async (nueva: Omit<Tarea, 'id' | 'created_at' | 'creador_id' | 'guardia_creador'>) => {
    if (!usuario) return;

    let visibilidadFinal = nueva.visibilidad;
    if (nueva.asignado_a_id && nueva.asignado_a_id !== usuario.id) {
      visibilidadFinal = 'General';
    }

    const tareaCompleta: Tarea = {
      ...nueva,
      id: crypto.randomUUID(),
      creador_id: usuario.id,
      guardia_creador: usuario.guardia,
      visibilidad: visibilidadFinal,
      created_at: new Date().toISOString(),
      creador: usuario,
      asignado: SEED_USUARIOS.find((u) => u.id === nueva.asignado_a_id) || (nueva.asignado_a_id === usuario.id ? usuario : undefined),
    };

    setTareas((prev) => [tareaCompleta, ...prev]);

    const cached = await getCachedTareas();
    await cacheTareas([tareaCompleta, ...cached]);

    // DISPARO TEAMS: Únicamente si es Criticidad 'Alta' (o 'Critica')
    if (tareaCompleta.nivel_criticidad === 'Alta' || tareaCompleta.nivel_criticidad === 'Critica') {
      notificarTeams({
        tipo: 'EMERGENCIA_ALTA',
        tarea: tareaCompleta,
        creadorNombre: usuario.nombre_completo,
        asignadoNombre: tareaCompleta.asignado?.nombre_completo || 'Sin Asignar',
      });
    }

    // DISPARO PUSH REMOTO (Para despertar el celular del asignado con app cerrada / pantalla bloqueada)
    if (tareaCompleta.asignado_a_id && tareaCompleta.asignado_a_id !== usuario.id) {
      enviarPushRemoto({
        asignado_a_id: tareaCompleta.asignado_a_id,
        titulo: tareaCompleta.titulo,
        creador_nombre: usuario.nombre_completo,
        tag: tareaCompleta.id,
      });
    }

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { error } = await supabase.from('tareas').insert({
          id: tareaCompleta.id,
          titulo: tareaCompleta.titulo,
          descripcion: tareaCompleta.descripcion,
          creador_id: tareaCompleta.creador_id,
          asignado_a_id: tareaCompleta.asignado_a_id,
          guardia_creador: tareaCompleta.guardia_creador,
          guardia_objetivo: tareaCompleta.guardia_objetivo,
          nivel_criticidad: tareaCompleta.nivel_criticidad,
          estado: tareaCompleta.estado,
          visibilidad: tareaCompleta.visibilidad,
          frecuencia_notificacion: tareaCompleta.frecuencia_notificacion,
          etiquetas: tareaCompleta.etiquetas,
          fecha_limite: tareaCompleta.fecha_limite,
        });
        if (error) throw error;
      } catch (err) {
        console.warn('Error al insertar en Supabase, encolando offline:', err);
        await enqueueOfflineSync({
          id: crypto.randomUUID(),
          tipo: 'INSERT_TAREA',
          payload: tareaCompleta,
          timestamp: Date.now(),
        });
      }
    } else {
      await enqueueOfflineSync({
        id: crypto.randomUUID(),
        tipo: 'INSERT_TAREA',
        payload: tareaCompleta,
        timestamp: Date.now(),
      });
    }
  };

  // Actualizar Estado
  const actualizarEstado = async (id: string, nuevoEstado: EstadoTarea, motivoCancelacion?: string) => {
    if (!usuario) return;

    const tarea = tareas.find((t) => t.id === id);
    if (!tarea) return;

    const updatedData: Partial<Tarea> = {
      estado: nuevoEstado,
      updated_at: new Date().toISOString(),
      fecha_completado: nuevoEstado === 'Completado' ? new Date().toISOString() : null,
    };

    if (nuevoEstado === 'Cancelado') {
      updatedData.motivo_cancelacion = motivoCancelacion || 'Cancelado por el usuario';
      updatedData.cancelado_por_id = usuario.id;
    }

    setTareas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updatedData } : t))
    );

    const cached = await getCachedTareas();
    const updatedCache = cached.map((t) => (t.id === id ? { ...t, ...updatedData } : t));
    await cacheTareas(updatedCache);

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        await supabase.from('tareas').update(updatedData).eq('id', id);
      } catch (err) {
        await enqueueOfflineSync({
          id: crypto.randomUUID(),
          tipo: 'CAMBIO_ESTADO',
          payload: { id, data: updatedData },
          timestamp: Date.now(),
        });
      }
    } else {
      await enqueueOfflineSync({
        id: crypto.randomUUID(),
        tipo: 'CAMBIO_ESTADO',
        payload: { id, data: updatedData },
        timestamp: Date.now(),
      });
    }
  };

  // Actualizar Frecuencia de Alertas
  const actualizarFrecuenciaNotificacion = async (id: string, frecuencia: any) => {
    setTareas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, frecuencia_notificacion: frecuencia } : t))
    );

    const cached = await getCachedTareas();
    await cacheTareas(cached.map((t) => (t.id === id ? { ...t, frecuencia_notificacion: frecuencia } : t)));

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        await supabase.from('tareas').update({ frecuencia_notificacion: frecuencia }).eq('id', id);
      } catch (err) {
        console.warn('Error actualizando frecuencia en Supabase:', err);
      }
    }
  };

  // Registrar Justificación por Vencimiento de Fecha en Turno
  const registrarMotivoVencimiento = async (id: string, motivo: string): Promise<{ success: boolean; error?: string }> => {
    if (!usuario) return { success: false, error: 'No autenticado' };
    if (!motivo || motivo.trim().length < 5) {
      return { success: false, error: 'Debe ingresar una justificación detallada de por qué no se cumplió la tarea antes del vencimiento (mínimo 5 caracteres).' };
    }

    const payload = {
      motivo_vencimiento: motivo.trim(),
      explicado_por_id: usuario.id,
      updated_at: new Date().toISOString()
    };

    setTareas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...payload } : t))
    );

    const cached = await getCachedTareas();
    await cacheTareas(cached.map((t) => (t.id === id ? { ...t, ...payload } : t)));

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        await supabase.from('tareas').update(payload).eq('id', id);
        await supabase.from('historial_tareas').insert({
          tarea_id: id,
          usuario_id: usuario.id,
          accion: 'JUSTIFICACION_VENCIMIENTO',
          detalles: `Justificación por no cumplimiento en fecha: ${motivo.trim()}`
        });
      } catch (err) {
        console.warn('Error en Supabase justificando vencimiento:', err);
      }
    }

    return { success: true };
  };

  // Reasignar Responsable con Motivo Obligatorio e Historial de Auditoría
  const reasignarTarea = async (id: string, nuevoAsignadoId: string, motivo: string): Promise<{ success: boolean; error?: string }> => {
    if (!usuario) return { success: false, error: 'No autenticado' };
    if (!motivo || motivo.trim().length < 5) {
      return { success: false, error: 'Debe ingresar un motivo detallado de por qué no realizó o se complicó la tarea (mínimo 5 caracteres).' };
    }

    const tarea = tareas.find((t) => t.id === id);
    if (!tarea) return { success: false, error: 'Tarea no encontrada' };

    const nuevoAsignado = SEED_USUARIOS.find((u) => u.id === nuevoAsignadoId);
    const asignadoAnterior = tarea.asignado || SEED_USUARIOS.find((u) => u.id === tarea.asignado_a_id);

    let visibilidad = tarea.visibilidad || 'General';
    if (nuevoAsignadoId !== tarea.creador_id) {
      visibilidad = 'General';
    }

    const payload = {
      asignado_a_id: nuevoAsignadoId,
      visibilidad,
      updated_at: new Date().toISOString(),
    };

    const nuevoRegistroHistorial = {
      id: crypto.randomUUID(),
      tarea_id: id,
      usuario_id: usuario.id,
      usuario_nombre: usuario.nombre_completo,
      asignado_anterior_nombre: asignadoAnterior?.nombre_completo || 'Sin Asignar',
      asignado_nuevo_nombre: nuevoAsignado?.nombre_completo || 'Sin Asignar',
      motivo: motivo.trim(),
      created_at: new Date().toISOString()
    };

    const nuevoHistorialMap = {
      ...historialReasignaciones,
      [id]: [nuevoRegistroHistorial, ...(historialReasignaciones[id] || [])]
    };
    setHistorialReasignaciones(nuevoHistorialMap);
    localStorage.setItem('marcobre_historial_reasignaciones', JSON.stringify(nuevoHistorialMap));

    setTareas((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, asignado_a_id: nuevoAsignadoId, asignado: nuevoAsignado, visibilidad }
          : t
      )
    );

    const cached = await getCachedTareas();
    await cacheTareas(
      cached.map((t) =>
        t.id === id
          ? { ...t, asignado_a_id: nuevoAsignadoId, asignado: nuevoAsignado, visibilidad }
          : t
      )
    );

    // DISPARO TEAMS: Notificar Relevo de Guardia a Teams
    notificarTeams({
      tipo: 'RELEVO_TURNO',
      tarea: { ...tarea, asignado_a_id: nuevoAsignadoId, asignado: nuevoAsignado },
      creadorNombre: usuario.nombre_completo,
      asignadoNombre: nuevoAsignado?.nombre_completo || 'Sin Asignar',
      detallesRelevo: `Reasignado de ${asignadoAnterior?.nombre_completo || 'N/A'} a ${nuevoAsignado?.nombre_completo || 'N/A'}. Motivo: ${motivo.trim()}`
    });

    // DISPARO PUSH REMOTO POR REASIGNACIÓN
    if (nuevoAsignadoId && nuevoAsignadoId !== usuario.id) {
      enviarPushRemoto({
        asignado_a_id: nuevoAsignadoId,
        titulo: tarea.titulo,
        mensaje: `${usuario.nombre_completo} te ha transferido la tarea: "${tarea.titulo}"`,
        tag: id,
      });
    }

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        await supabase.from('tareas').update(payload).eq('id', id);
        await supabase.from('historial_tareas').insert({
          tarea_id: id,
          usuario_id: usuario.id,
          accion: 'REASIGNACION',
          asignado_anterior_id: tarea.asignado_a_id,
          asignado_nuevo_id: nuevoAsignadoId,
          motivo_reasignacion: motivo.trim(),
          detalles: `Reasignado de ${asignadoAnterior?.nombre_completo || 'N/A'} a ${nuevoAsignado?.nombre_completo || 'N/A'}. Motivo: ${motivo.trim()}`
        });
      } catch (err) {
        await enqueueOfflineSync({
          id: crypto.randomUUID(),
          tipo: 'UPDATE_TAREA',
          payload: { id, data: payload },
          timestamp: Date.now(),
        });
      }
    } else {
      await enqueueOfflineSync({
        id: crypto.randomUUID(),
        tipo: 'UPDATE_TAREA',
        payload: { id, data: payload },
        timestamp: Date.now(),
      });
    }

    return { success: true };
  };

  // Cancelar Tarea
  const cancelarTarea = async (id: string, motivo: string): Promise<{ success: boolean; error?: string }> => {
    if (!motivo || motivo.trim().length < 4) {
      return { success: false, error: 'Debe ingresar un motivo de cancelación detallado (mínimo 4 caracteres).' };
    }
    await actualizarEstado(id, 'Cancelado', motivo.trim());
    return { success: true };
  };

  return (
    <TareasContext.Provider
      value={{
        tareas,
        guardiasActivas,
        setGuardiasActivas,
        cambiarGuardias,
        crearTarea,
        actualizarEstado,
        actualizarFrecuenciaNotificacion,
        registrarMotivoVencimiento,
        reasignarTarea,
        cancelarTarea,
        historialReasignaciones,
        isOnline,
        isSyncing,
        refreshTareas: loadTareas,
      }}
    >
      {children}
    </TareasContext.Provider>
  );
};

export const useTareas = () => {
  const context = useContext(TareasContext);
  if (!context) {
    throw new Error('useTareas debe usarse dentro de un TareasProvider');
  }
  return context;
};
