-- =========================================================================================
-- ESQUEMA Y SEED DATA - SISTEMA DE GESTIÓN DE TAREAS Y RELEVOS: MARCOBRE PUERTO
-- =========================================================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tablas de Tipos / Enumeraciones
DO $$ BEGIN
    CREATE TYPE rol_usuario AS ENUM ('superintendente', 'jefe', 'supervisor_planta', 'supervisor_descarga');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tipo_guardia AS ENUM ('A', 'B', 'C', 'D', 'Staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE criticidad_tarea AS ENUM ('Baja', 'Media', 'Alta', 'Critica');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_tarea AS ENUM ('Por Hacer', 'En Progreso', 'Completado', 'Cancelado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE visibilidad_tarea AS ENUM ('Personal', 'General');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tabla de Perfiles de Usuario (vinculado a auth.users)
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    rol rol_usuario NOT NULL,
    area VARCHAR(50) NOT NULL, -- 'Superintendencia', 'Jefatura', 'Planta', 'Descarga'
    guardia tipo_guardia NOT NULL, -- 'A', 'B', 'C', 'D' o 'Staff'
    telefono VARCHAR(20),
    correo_teams VARCHAR(150), -- Correo corporativo para @mentions de Teams
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Tareas (con regla de cero eliminaciones físicas)
CREATE TABLE IF NOT EXISTS public.tareas (
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
    etiquetas TEXT[] DEFAULT '{}', -- ['Seguridad', 'Mecánico', 'Eléctrico', 'Operativo', etc.]
    motivo_cancelacion TEXT,
    cancelado_por_id UUID REFERENCES public.perfiles(id),
    fecha_limite TIMESTAMPTZ,
    fecha_completado TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Validación: Si está cancelada, motivo_cancelacion es obligatorio
    CONSTRAINT check_motivo_cancelacion CHECK (
        (estado = 'Cancelado' AND motivo_cancelacion IS NOT NULL AND length(trim(motivo_cancelacion)) > 3)
        OR (estado != 'Cancelado')
    )
);

-- 5. Tabla de Historial / Audit Trail
CREATE TABLE IF NOT EXISTS public.historial_tareas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tarea_id UUID NOT NULL REFERENCES public.tareas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.perfiles(id),
    accion VARCHAR(50) NOT NULL, -- 'CREACION', 'CAMBIO_ESTADO', 'REASIGNACION', 'CANCELACION', 'EDICION'
    estado_anterior estado_tarea,
    estado_nuevo estado_tarea,
    asignado_anterior_id UUID REFERENCES public.perfiles(id),
    asignado_nuevo_id UUID REFERENCES public.perfiles(id),
    motivo_reasignacion TEXT,
    detalles TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabla de Suscripciones Web Push Individuales (Web Push API)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios administran sus propias suscripciones push"
    ON public.push_subscriptions FOR ALL
    TO authenticated
    USING (usuario_id = auth.uid())
    WITH CHECK (usuario_id = auth.uid());

-- 7. Configuración de Guardias Activas (Estado del Sistema)
CREATE TABLE IF NOT EXISTS public.guardias_activas_config (
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

-- Trigger Regla de Transparencia:
-- Si el creador asigna la tarea a alguien diferente de sí mismo, la visibilidad se fuerza a 'General'
CREATE OR REPLACE FUNCTION trg_forzar_transparencia_visibilidad()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.asignado_a_id IS NOT NULL AND NEW.asignado_a_id <> NEW.creador_id THEN
        NEW.visibilidad := 'General';
    END IF;
    
    -- Si se completa la tarea, marcar fecha_completado
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


-- Trigger Auditoría Automática (Audit Trail)
CREATE OR REPLACE FUNCTION trg_auditoria_tareas()
RETURNS TRIGGER AS $$
DECLARE
    accion_str VARCHAR(50);
    detalle_str TEXT := '';
BEGIN
    IF TG_OP = 'INSERT' THEN
        accion_str := 'CREACION';
        detalle_str := 'Tarea creada con estado inicial: ' || NEW.estado;
        INSERT INTO public.historial_tareas (tarea_id, usuario_id, accion, estado_nuevo, asignado_nuevo_id, detalles)
        VALUES (NEW.id, NEW.creador_id, accion_str, NEW.estado, NEW.asignado_a_id, detalle_str);
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.estado <> NEW.estado THEN
            accion_str := CASE WHEN NEW.estado = 'Cancelado' THEN 'CANCELACION' ELSE 'CAMBIO_ESTADO' END;
            detalle_str := 'Cambio de estado: ' || OLD.estado || ' -> ' || NEW.estado;
            IF NEW.estado = 'Cancelado' THEN
                detalle_str := detalle_str || '. Motivo: ' || COALESCE(NEW.motivo_cancelacion, 'Sin motivo');
            END IF;
        ELSIF OLD.asignado_a_id IS DISTINCT FROM NEW.asignado_a_id THEN
            accion_str := 'REASIGNACION';
            detalle_str := 'Reasignación de responsable';
        ELSE
            accion_str := 'EDICION';
            detalle_str := 'Actualización de campos';
        END IF;

        INSERT INTO public.historial_tareas (
            tarea_id, 
            usuario_id, 
            accion, 
            estado_anterior, 
            estado_nuevo, 
            asignado_anterior_id, 
            asignado_nuevo_id, 
            detalles
        )
        VALUES (
            NEW.id, 
            COALESCE(NEW.cancelado_por_id, auth.uid(), NEW.creador_id), 
            accion_str, 
            OLD.estado, 
            NEW.estado, 
            OLD.asignado_a_id, 
            NEW.asignado_a_id, 
            detalle_str
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auditoria_tareas ON public.tareas;
CREATE TRIGGER trigger_auditoria_tareas
    AFTER INSERT OR UPDATE ON public.tareas
    FOR EACH ROW
    EXECUTE FUNCTION trg_auditoria_tareas();


-- =========================================================================================
-- SEGURIDAD ROW LEVEL SECURITY (RLS) & CERO ELIMINACIONES
-- =========================================================================================

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardias_activas_config ENABLE ROW LEVEL SECURITY;

-- Funciones Helper de Rol
CREATE OR REPLACE FUNCTION es_jefatura_o_superintendente(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfiles
        WHERE id = user_id AND rol IN ('superintendente', 'jefe') AND activo = TRUE
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Políticas para PERFILES
CREATE POLICY "Lectura de perfiles para usuarios autenticados"
    ON public.perfiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Actualización de perfil propio o por jefatura"
    ON public.perfiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR es_jefatura_o_superintendente(auth.uid()));

-- 2. Políticas para TAREAS (Regla Visibilidad Personal vs General)
-- SELECT:
-- Si Visibilidad = 'Personal': Creador O Superintendente/Jefe.
-- Si Visibilidad = 'General': Cualquier usuario activo.
CREATE POLICY "Lectura de tareas segun visibilidad y rol"
    ON public.tareas FOR SELECT
    TO authenticated
    USING (
        visibilidad = 'General'
        OR creador_id = auth.uid()
        OR es_jefatura_o_superintendente(auth.uid())
    );

-- INSERT:
CREATE POLICY "Creación de tareas por usuarios autenticados"
    ON public.tareas FOR INSERT
    TO authenticated
    WITH CHECK (creador_id = auth.uid());

-- UPDATE:
CREATE POLICY "Actualización de tareas permitida a usuarios activos"
    ON public.tareas FOR UPDATE
    TO authenticated
    USING (
        creador_id = auth.uid() 
        OR asignado_a_id = auth.uid() 
        OR es_jefatura_o_superintendente(auth.uid())
    );

-- ESTRICTA PROHIBICIÓN DE DELETE (POLÍTICA CERO ELIMINACIONES):
-- NO se crea política FOR DELETE, por lo que PostgreSQL deniega cualquier operación DELETE a nivel RLS.
-- Adicionalmente, creamos un trigger defensivo para prevenir borrado incluso para administradores/roles con bypass:
CREATE OR REPLACE FUNCTION trg_prevenir_delete_tareas()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'POLÍTICA DE CERO ELIMINACIONES: Está estrictamente prohibido eliminar tareas. Utilice la función Cancelar Tarea con motivo obligatorio.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bloqueo_delete_tareas ON public.tareas;
CREATE TRIGGER trigger_bloqueo_delete_tareas
    BEFORE DELETE ON public.tareas
    FOR EACH ROW
    EXECUTE FUNCTION trg_prevenir_delete_tareas();

-- 3. Políticas para HISTORIAL DE TAREAS
CREATE POLICY "Lectura de historial para usuarios autenticados"
    ON public.historial_tareas FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tareas t
            WHERE t.id = historial_tareas.tarea_id
            AND (
                t.visibilidad = 'General'
                OR t.creador_id = auth.uid()
                OR es_jefatura_o_superintendente(auth.uid())
            )
        )
    );

CREATE POLICY "Inserción de historial del sistema"
    ON public.historial_tareas FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 4. Políticas para GUARDIAS ACTIVAS
CREATE POLICY "Lectura guardias activas"
    ON public.guardias_activas_config FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Modificación guardias activas"
    ON public.guardias_activas_config FOR UPDATE
    TO authenticated
    USING (true);

-- Habilitar Supabase Realtime para la tabla de tareas y guardias
ALTER PUBLICATION supabase_realtime ADD TABLE public.tareas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guardias_activas_config;
ALTER PUBLICATION supabase_realtime ADD TABLE public.historial_tareas;


-- =========================================================================================
-- SEED DATA - USUARIOS Y CREDENCIALES
-- =========================================================================================
-- Dominio oculto: @puerto.local
-- Claves por defecto asignadas: Marcobre2025!

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
    -- 1. Insertar en auth.users si no existe
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

    -- 2. Insertar en public.perfiles
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

-- Invocación de Semilla con el Personal Portuario de Marcobre:
-- Administrador General
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000000'::uuid, 'fespinoza', 'fespinoza@puerto.local', 'FLAVIO RUBEN ESPINOZA CHUMBIAUCA', 'superintendente', 'Superintendencia', 'Staff', '+51 987654300', 'flavio.espinoza@marcobre.com');

-- Jefatura
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000001'::uuid, 'fpaolillo', 'fpaolillo@puerto.local', 'FRANCISCO JAVIER PAOLILLO TAPIA', 'superintendente', 'Superintendencia', 'Staff', '+51 987654301', 'francisco.paolillo@marcobre.com');
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000002'::uuid, 'mcaceres',  'mcaceres@puerto.local',  'MANUEL ANTONIO CACERES FALCONI',  'jefe',             'Jefatura',         'Staff', '+51 987654302', 'manuel.caceres@marcobre.com');

-- Guardia A
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000003'::uuid, 'cnanfunay', 'cnanfunay@puerto.local', 'CRONWEL VLADIMIR NANFUÑAY LORA', 'supervisor_planta',   'Planta',   'A', '+51 987654303', 'cronwel.nanfunay@marcobre.com');
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000004'::uuid, 'jchuaman',  'jchuaman@puerto.local',  'JUAN CARLOS HUAMAN QUISPE',      'supervisor_descarga', 'Descarga', 'A', '+51 987654304', 'juan.huaman@marcobre.com');

-- Guardia B
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000005'::uuid, 'cmachuca',  'cmachuca@puerto.local',  'CESAR ARNALDO MACHUCA POLO',     'supervisor_planta',   'Planta',   'B', '+51 987654305', 'cesar.machuca@marcobre.com');
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000006'::uuid, 'ydiaz',     'ydiaz@puerto.local',     'YOFRE ALBERTO DÍAZ GUARDERAS',    'supervisor_descarga', 'Descarga', 'B', '+51 987654306', 'yofre.diaz@marcobre.com');

-- Guardia C (Descarga vacante)
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000007'::uuid, 'jchambergo', 'jchambergo@puerto.local', 'JORGE MARCO CHAMBERGO VARGAS',  'supervisor_planta',   'Planta',   'C', '+51 987654307', 'jorge.chambergo@marcobre.com');

-- Guardia D
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000008'::uuid, 'crudas',    'crudas@puerto.local',    'CARLOS ALBERTO RUDAS RAMIREZ',   'supervisor_planta',   'Planta',   'D', '+51 987654308', NULL); -- Contrata sin correo
SELECT crear_usuario_semilla('a0000001-0000-0000-0000-000000000009'::uuid, 'wlopez',     'wlopez@puerto.local',     'WILLIAM JOSE LOPEZ QUIROZ',     'supervisor_descarga', 'Descarga', 'D', '+51 987654309', 'william.lopez@marcobre.com');

-- Tareas de Ejemplo Iniciales
INSERT INTO public.tareas (id, titulo, descripcion, creador_id, asignado_a_id, guardia_creador, guardia_objetivo, nivel_criticidad, estado, visibilidad, etiquetas)
VALUES
(
    'b0000001-0000-0000-0000-000000000001'::uuid,
    'Inspección de faja transportadora CV-001 previo a carguío',
    'Revisión estructural de polines de carga, alineamiento de banda y pruebas de parada de emergencia en muelle.',
    'a0000001-0000-0000-0000-000000000003'::uuid, -- cnanfunay (Guardia A)
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
    'a0000001-0000-0000-0000-000000000004'::uuid, -- jchuaman (Guardia A)
    'a0000001-0000-0000-0000-000000000006'::uuid, -- Reasignado a ydiaz (Guardia B) -> Regla fuerza Visibilidad General
    'A',
    'B',
    'Critica',
    'Por Hacer',
    'General',
    ARRAY['Operativo', 'Muelle', 'Descarga']
),
(
    'b0000001-0000-0000-0000-000000000003'::uuid,
    'Apunte personal de relevo: Pendiente calibrar sensor de tolva',
    'Observé fluctuación de 4% en balanza dinámica. Revisar en turno noche con instrumentista.',
    'a0000001-0000-0000-0000-000000000005'::uuid, -- cmachuca (Guardia B)
    'a0000001-0000-0000-0000-000000000005'::uuid,
    'B',
    'B',
    'Media',
    'Por Hacer',
    'Personal', -- Solo cmachuca y Jefatura lo verán
    ARRAY['Instrumentación', 'Personal']
);

