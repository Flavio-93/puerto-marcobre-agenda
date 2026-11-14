export type RolUsuario = 'superintendente' | 'jefe' | 'supervisor_planta' | 'supervisor_descarga';
export type TipoGuardia = 'A' | 'B' | 'C' | 'D' | 'Staff';
export type CriticidadTarea = 'Baja' | 'Media' | 'Alta' | 'Critica';
export type EstadoTarea = 'Por Hacer' | 'En Progreso' | 'Completado' | 'Cancelado';
export type VisibilidadTarea = 'Personal' | 'General';

export interface Perfil {
  id: string;
  username: string;
  nombre_completo: string;
  rol: RolUsuario;
  area: string;
  guardia: TipoGuardia;
  telefono?: string;
  correo_teams?: string | null;
  activo: boolean;
  created_at?: string;
}

export type FrecuenciaNotificacion = 
  | 'Sin Notificación'
  | '5 minutos antes'
  | '10 minutos antes'
  | '30 minutos antes'
  | '1 hora antes'
  | '3 horas antes'
  | '12 horas antes'
  | '1 día antes'
  | '1 semana antes'
  | 'Cada hora'
  | 'Cada 3 horas'
  | 'Diaria en relevo';

export interface Tarea {
  id: string;
  codigo_tarea?: number;
  titulo: string;
  descripcion: string;
  creador_id: string;
  asignado_a_id?: string | null;
  guardia_creador: TipoGuardia;
  guardia_objetivo?: TipoGuardia | null;
  nivel_criticidad: CriticidadTarea;
  estado: EstadoTarea;
  visibilidad: VisibilidadTarea;
  etiquetas: string[];
  frecuencia_notificacion?: FrecuenciaNotificacion;
  motivo_vencimiento?: string | null;
  explicado_por_id?: string | null;
  motivo_cancelacion?: string | null;
  cancelado_por_id?: string | null;
  fecha_limite?: string | null;
  fecha_completado?: string | null;
  created_at: string;
  updated_at?: string;
  // Campos anidados para visualización
  creador?: Perfil;
  asignado?: Perfil;
}

export interface HistorialTarea {
  id: string;
  tarea_id: string;
  usuario_id: string;
  accion: string;
  estado_anterior?: EstadoTarea | null;
  estado_nuevo?: EstadoTarea | null;
  asignado_anterior_id?: string | null;
  asignado_nuevo_id?: string | null;
  motivo_reasignacion?: string | null;
  detalles: string;
  created_at: string;
  usuario?: Perfil;
  asignado_anterior?: Perfil;
  asignado_nuevo?: Perfil;
}

export interface GuardiasActivasConfig {
  guardia_1: TipoGuardia;
  guardia_2: TipoGuardia;
  updated_at?: string;
}

export interface SyncQueueItem {
  id: string;
  tipo: 'INSERT_TAREA' | 'UPDATE_TAREA' | 'CAMBIO_ESTADO';
  payload: any;
  timestamp: number;
}

