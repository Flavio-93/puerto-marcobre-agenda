# 🚀 MARCOBRE - PUERTO: SISTEMA DE GESTIÓN DE TAREAS Y RELEVOS 10x10

PWA Mobile-First de alta disponibilidad desarrollada con React, TypeScript, Tailwind CSS y Supabase (PostgreSQL, Realtime WebSockets, RLS, Audit Trail, Offline-First con IndexedDB).

---

## 📋 Resumen de Cumplimiento de Especificaciones

### 1. Stack Tecnológico & PWA
- **Frontend:** React 19 + TypeScript + Vite.
- **Estilos:** Tailwind CSS con los colores corporativos de Marcobre (Azul Acero `#2b5c8f` y Rojo Óxido `#c13127`).
- **Offline & PWA:** IndexedDB (`idb`) para almacenamiento local de tareas y cola de sincronización + Service Worker (`sw.js`) + Manifest PWA.
- **Tiempo Real:** Supabase Realtime (WebSockets) activado para actualización en vivo de tarjetas Kanban sin recargar la página.

### 2. Identidad y UX/UI Mobile-First para Campo
- Logo corporativo insertado mediante `<img src="/logo.png" alt="Marcobre - Puerto" />` en el Navbar.
- Botones de tamaño grande ("touch-friendly") pensados para operadores y supervisores en muelle y planta.
- Dark Mode nativo con toggle Claro/Oscuro y persistencia.

### 3. Contexto de Negocio: Régimen 10x10 y Guardias Activas
- 4 Guardias: **A, B, C y D**.
- Selector en el Navbar para definir las **2 Guardias Activas en Sitio** (ej. A & B, C & B, etc.), con filtrado dinámico del tablero Kanban.

### 4. Seed Data & Padrón de Usuarios
El archivo [supabase_schema.sql](file:///c:/APP%20MARCOBRE/supabase_schema.sql) contiene las credenciales y perfiles:
- **Jefatura:**
  - `fpaolillo` - FRANCISCO JAVIER PAOLILLO TAPIA (Superintendente)
  - `mcaceres` - MANUEL ANTONIO CACERES FALCONI (Jefe de Puerto)
- **Guardia A:**
  - `cnanfunay` - CRONWEL VLADIMIR NANFUÑAY LORA (Supervisor Planta)
  - `jchuaman` - JUAN CARLOS HUAMAN QUISPE (Supervisor Descarga)
- **Guardia B:**
  - `cmachuca` - CESAR ARNALDO MACHUCA POLO (Supervisor Planta)
  - `ydiaz` - YOFRE DÍAZ GUARDERAS (Supervisor Descarga)
- **Guardia C:**
  - `jchambergo` - JORGE MARCO CHAMBERGO VARGAS (Supervisor Planta)
  - [Vacante Descarga]
- **Guardia D:**
  - `crudas` - CARLOS ALBERTO RUDAS RAMIREZ (Supervisor Planta)
  - `wlopez` - WILLIAM JOSE LOPEZ QUIROZ (Supervisor Descarga)
- **Lógica de Login:** Input de texto puro, username en minúsculas en frontend + `@puerto.local` oculto. Contraseña case-sensitive predeterminada: `Marcobre2025!`.

### 5. Seguridad PostgreSQL RLS & Regla de Transparencia
- **Visibilidad Personal:** Visible únicamente por el Creador O por Superintendente / Jefe.
- **Visibilidad General:** Visible para todos los usuarios.
- **Regla de Transparencia (Trigger PostgreSQL y validación Frontend):** Si `asignado_a_id <> creador_id`, la visibilidad se fuerza automáticamente a `General`.
- **Historial / Audit Trail:** Trigger `trg_auditoria_tareas()` registra automáticamente cualquier cambio de estado, reasignación o cancelación con marca temporal y responsable.

### 6. Política Estricta de Cero Eliminaciones (Soft Delete)
- No existe botón ni endpoint de `DELETE`.
- Trigger en base de datos `trg_prevenir_delete_tareas()` lanza excepción impidiendo borrado físico.
- La suspensión de actividades se realiza mediante "Cancelar Tarea", exigiendo un **motivo de cancelación obligatorio** y archivándose fuera del Kanban principal.

### 7. Historial / Archivo & Exportaciones
- Búsqueda Full-Text en vivo sobre títulos, descripciones y notas de cancelación.
- Filtros combinables: Guardia, Estado, Rango de fechas y Etiquetas operativas.
- Exportación directa a **Excel/CSV** (.xlsx) y **PDF Gerencial** (con membrete Marcobre).

### 8. Arquitectura Offline-First
- Detección de pérdida de señal (ej. bodegas de buques o galerías de fajas).
- Caché automática en IndexedDB y cola de acciones en espera (`sync_queue`).
- Sincronización en background con Supabase al recuperar señal y liberación de cola.

---

## 🛠️ Instrucciones de Ejecución

1. **Instalación:**
   ```bash
   npm install
   ```

2. **Ejecución Local:**
   ```bash
   npm run dev
   ```

3. **Configuración con Supabase (Opcional):**
   - Ejecuta el script SQL [supabase_schema.sql](file:///c:/APP%20MARCOBRE/supabase_schema.sql) en el Editor SQL de tu proyecto Supabase.
   - Copia `.env.example` a `.env` y coloca tu `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
   *(Nota: La aplicación cuenta con un modo Demo/Offline totalmente funcional que permite operar y probar sin conexión o sin credenciales de Supabase).*
