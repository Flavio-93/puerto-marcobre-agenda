-- =========================================================================================
-- SCRIPT DE LIMPIEZA TOTAL Y RECONSTRUCCIÓN - MARCOBRE PUERTO
-- Compatible 100% con PostgreSQL / Supabase SQL Editor
-- =========================================================================================

-- 1. ELIMINACIÓN EN CASCADA DE TABLAS ANTIGUAS
DROP TABLE IF EXISTS public.historial_tareas CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
DROP TABLE IF EXISTS public.guardias_activas_config CASCADE;
DROP TABLE IF EXISTS public.tareas CASCADE;
DROP TABLE IF EXISTS public.perfiles CASCADE;

-- 2. ELIMINACIÓN DE TIPOS / ENUMS ANTIGUOS
DROP TYPE IF EXISTS rol_usuario CASCADE;
DROP TYPE IF EXISTS tipo_guardia CASCADE;
DROP TYPE IF EXISTS criticidad_tarea CASCADE;
DROP TYPE IF EXISTS estado_tarea CASCADE;
DROP TYPE IF EXISTS visibilidad_tarea CASCADE;

-- 3. HABILITAR EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 4. CREACIÓN DE NUEVAS ENUMERACIONES MARCOBRE
CREATE TYPE rol_usuario AS ENUM ('superintendente', 'jefe', 'supervisor_planta', 'supervisor_descarga');
CREATE TYPE tipo_guardia AS ENUM ('A', 'B', 'C', 'D', 'Staff');
CREATE TYPE criticidad_tarea AS ENUM ('Baja', 'Media', 'Alta', 'Critica');
CREATE TYPE estado_tarea AS ENUM ('Por Hacer', 'En Progreso', 'Completado', 'Cancelado');
CREATE TYPE visibilidad_tarea AS ENUM ('Personal', 'General');

-- 5. TABLA DE PERFILES DE USUARIO (Vinculada a auth.users)
CREATE TABLE public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    rol rol_usuario NOT NULL,
    area VARCHAR(50) NOT NULL,
    guardia tipo_guardia NOT NULL,
    telefono VARCHAR(20),
    correo_teams VARCHAR(150),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA DE TAREAS (Regla de Cero Eliminaciones)
CREATE TABLE public.tareas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_tarea SERIAL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    creador_id UUID NOT NULL REFERENCES public.perfiles(id),
    asignado_a_id UUID REFERENCES public.perfiles(id),
    guardia_creador tipo_guardia NOT NULL,
    guardia_objetivo tipo_guardia,
    nivel_criticidad criticidad_tarea DEFAULT 'Media',
    estado estado_tarea DEFAULT 'Por Hacer',
    visibilidad visibilidad_tarea DEFAULT 'General',
    frecuencia_notificacion VARCHAR(50) DEFAULT '1 hora antes',
    motivo_vencimiento TEXT,
    explicado_por_id UUID REFERENCES public.perfiles(id),
    etiquetas TEXT[] DEFAULT '{}',
    motivo_cancelacion TEXT,
    cancelado_por_id UUID REFERENCES public.perfiles(id),
    fecha_limite TIMESTAMPTZ,
    fecha_completado TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA DE HISTORIAL Y REASIGNACIONES (Audit Trail)
CREATE TABLE public.historial_tareas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tarea_id UUID NOT NULL REFERENCES public.tareas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.perfiles(id),
    accion VARCHAR(50) NOT NULL,
    estado_anterior estado_tarea,
    estado_nuevo estado_tarea,
    asignado_anterior_id UUID REFERENCES public.perfiles(id),
    asignado_nuevo_id UUID REFERENCES public.perfiles(id),
    motivo_reasignacion TEXT,
    detalles TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLA DE SUSCRIPCIONES PUSH
CREATE TABLE public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CONFIGURACIÓN DE GUARDIAS ACTIVAS (10x10)
CREATE TABLE public.guardias_activas_config (
    id INT PRIMARY KEY DEFAULT 1,
    guardia_1 tipo_guardia NOT NULL DEFAULT 'A',
    guardia_2 tipo_guardia NOT NULL DEFAULT 'B',
    modificado_por UUID REFERENCES public.perfiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT solo_una_fila CHECK (id = 1)
);

INSERT INTO public.guardias_activas_config (id, guardia_1, guardia_2)
VALUES (1, 'A', 'B')
ON CONFLICT (id) DO NOTHING;

-- =========================================================================================
-- TRIGGERS Y FUNCIONES DE NEGOCIO
-- =========================================================================================

-- Trigger Regla de Transparencia
CREATE OR REPLACE FUNCTION trg_forzar_transparencia_visibilidad()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.asignado_a_id IS NOT NULL AND NEW.asignado_a_id <> NEW.creador_id THEN
        NEW.visibilidad := 'General';
    END IF;
    
    IF NEW.estado = 'Completado' AND (OLD.estado IS NULL OR OLD.estado <> 'Completado') THEN
        NEW.fecha_completado := NOW();
    ELSIF NEW.estado <> 'Completado' THEN
        NEW.fecha_completado := NULL;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_forzar_transparencia ON public.tareas;
CREATE TRIGGER trigger_forzar_transparencia
    BEFORE INSERT OR UPDATE ON public.tareas
    FOR EACH ROW
    EXECUTE FUNCTION trg_forzar_transparencia_visibilidad();

-- Trigger Bloqueo Físico de DELETE (Cero Eliminaciones)
CREATE OR REPLACE FUNCTION trg_prevenir_delete_tareas()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'POLÍTICA DE CERO ELIMINACIONES: Está estrictamente prohibido eliminar tareas. Utilice Cancelar Tarea con motivo obligatorio.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bloqueo_delete_tareas ON public.tareas;
CREATE TRIGGER trigger_bloqueo_delete_tareas
    BEFORE DELETE ON public.tareas
    FOR EACH ROW
    EXECUTE FUNCTION trg_prevenir_delete_tareas();

-- =========================================================================================
-- PERMISOS Y SEGURIDAD RLS
-- =========================================================================================
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardias_activas_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION es_jefatura_o_superintendente(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = user_id AND rol IN ('superintendente', 'jefe') AND activo = TRUE
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Políticas de acceso
CREATE POLICY "Lectura perfiles" ON public.perfiles FOR SELECT TO public USING (true);
CREATE POLICY "Modificar perfiles" ON public.perfiles FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Lectura tareas" ON public.tareas FOR SELECT TO public USING (true);
CREATE POLICY "Insertar tareas" ON public.tareas FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Actualizar tareas" ON public.tareas FOR UPDATE TO public USING (true);

CREATE POLICY "Acceso historial" ON public.historial_tareas FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Acceso guardias" ON public.guardias_activas_config FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Acceso push" ON public.push_subscriptions FOR ALL TO public USING (true) WITH CHECK (true);

-- HABILITAR REALTIME WEBSOCKETS EN SUPABASE
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tareas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.guardias_activas_config;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.historial_tareas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================================================
-- SEED DATA - USUARIOS REALES MARCOBRE PUERTO
-- =========================================================================================
CREATE OR REPLACE FUNCTION crear_usuario_semilla(
    p_id UUID,
    p_username TEXT,
    p_email TEXT,
    p_nombre TEXT,
    p_rol rol_usuario,
    p_area TEXT,
    p_guardia tipo_guardia,
    p_telefono TEXT DEFAULT NULL,
    p_correo_teams TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_id) THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            aud
        ) VALUES (
            p_id,
            '00000000-0000-0000-0000-000000000000',
            p_email,
            crypt('Marcobre2025!', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('nombre_completo', p_nombre, 'username', p_username, 'rol', p_rol, 'guardia', p_guardia),
            NOW(),
            NOW(),
            'authenticated',
            'authenticated'
        );
    END IF;

    INSERT INTO public.perfiles (id, username, nombre_completo, rol, area, guardia, telefono, correo_teams, activo)
    VALUES (p_id, p_username, p_nombre, p_rol, p_area, p_guardia, p_telefono, p_correo_teams, TRUE)
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        nombre_completo = EXCLUDED.nombre_completo,
        rol = EXCLUDED.rol,
        area = EXCLUDED.area,
        guardia = EXCLUDED.guardia,
        telefono = EXCLUDED.telefono,
        correo_teams = EXCLUDED.correo_teams,
        activo = TRUE;
END;
$$ LANGUAGE plpgsql;

-- 1. Administrador General
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000000'::uuid, 'fespinoza', 'fespinoza@puerto.local', 'FLAVIO RUBEN ESPINOZA CHUMBIAUCA', 'superintendente', 'Superintendencia', 'Staff', '+51 987654300', 'flavio.espinoza@marcobre.com');

-- 2. Jefatura
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000001'::uuid, 'fpaolillo', 'fpaolillo@puerto.local', 'FRANCISCO JAVIER PAOLILLO TAPIA', 'superintendente', 'Superintendencia', 'Staff', '+51 987654301', 'francisco.paolillo@marcobre.com');
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000002'::uuid, 'mcaceres',  'mcaceres@puerto.local',  'MANUEL ANTONIO CACERES FALCONI',  'jefe',             'Jefatura',         'Staff', '+51 987654302', 'manuel.caceres@marcobre.com');

-- 3. Guardia A
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000003'::uuid, 'cnanfuñay', 'cnanfunay@puerto.local', 'CRONWEL VLADIMIR NANFUÑAY LORA', 'supervisor_planta',   'Planta',   'A', '+51 987654303', 'cronwel.nanfunay@marcobre.com');
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000004'::uuid, 'jhuaman',  'jhuaman@puerto.local',  'JUAN CARLOS HUAMAN QUISPE',      'supervisor_descarga', 'Descarga', 'A', '+51 987654304', 'juan.huaman@marcobre.com');

-- 4. Guardia B
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000005'::uuid, 'cmachuca',  'cmachuca@puerto.local',  'CESAR ARNALDO MACHUCA POLO',     'supervisor_planta',   'Planta',   'B', '+51 987654305', 'cesar.machuca@marcobre.com');
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000006'::uuid, 'ydiaz',     'ydiaz@puerto.local',     'YOFRE ALBERTO DÍAZ GUARDERAS',    'supervisor_descarga', 'Descarga', 'B', '+51 987654306', 'yofre.diaz@marcobre.com');

-- 5. Guardia C
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000007'::uuid, 'jchambergo', 'jchambergo@puerto.local', 'JORGE MARCO CHAMBERGO VARGAS',  'supervisor_planta',   'Planta',   'C', '+51 987654307', 'jorge.chambergo@marcobre.com');

-- 6. Guardia D
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000008'::uuid, 'crudas',    'crudas@puerto.local',    'CARLOS ALBERTO RUDAS RAMIREZ',   'supervisor_planta',   'Planta',   'D', '+51 987654308', NULL);
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000009'::uuid, 'wlopez',     'wlopez@puerto.local',     'WILLIAM JOSE LOPEZ QUIROZ',     'supervisor_descarga', 'Descarga', 'D', '+51 987654309', 'william.lopez@marcobre.com');

-- TAREAS INICIALES EN NUBE
INSERT INTO public.tareas (id, titulo, descripcion, creador_id, asignado_a_id, guardia_creador, guardia_objetivo, nivel_criticidad, estado, visibilidad, etiquetas)
VALUES
(
    'b0000001-0000-0000-0000-000000000001'::uuid,
    'Inspección de cinta transportadora CV-001 previo a carguío',
    'Revisión estructural de polines de carga, alineamiento de banda y pruebas de parada de emergencia en muelle.',
    'a0000001-0000-0000-0000-000000000003'::uuid, -- cnanfuñay (Guardia A)
    'a0000001-0000-0000-0000-000000000003'::uuid,
    'A',
    'A',
    'Alta',
    'En Progreso',
    'General',
    ARRAY['Mecánico', 'Seguridad', 'Operativo']
),
(
    'b0000001-0000-0000-0000-000000000002'::uuid,
    'Monitoreo de calado y manguerotes en Duque de Alba',
    'Verificar sondaje y amarras del buque mercante durante marea viva de las 14:00 hrs.',
    'a0000001-0000-0000-0000-000000000004'::uuid, -- jhuaman (Guardia A)
    'a0000001-0000-0000-0000-000000000006'::uuid, -- ydiaz (Guardia B)
    'A',
    'B',
    'Critica',
    'Por Hacer',
    'General',
    ARRAY['Operativo', 'Muelle', 'Descarga']
);
