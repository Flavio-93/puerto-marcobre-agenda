import React, { useState, useMemo } from 'react';
import { useTareas } from '../context/TareasContext';
import { useAuth } from '../context/AuthContext';
import { Tarea, EstadoTarea, TipoGuardia } from '../types';
import { SEED_USUARIOS } from '../services/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Search, 
  FileSpreadsheet, 
  FileText, 
  Calendar, 
  Filter, 
  Tag, 
  CheckCircle2, 
  Clock, 
  PlayCircle, 
  XCircle, 
  Lock, 
  Globe,
  AlertTriangle
} from 'lucide-react';

// Función helper para formatear Nombre y Apellido
function formatNombreApellido(nombreCompleto?: string): string {
  if (!nombreCompleto) return 'Sin Asignar';
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 2) {
    return partes.join(' ');
  }
  // Ejemplo: "FLAVIO RUBEN ESPINOZA CHUMBIAUCA" -> "Flavio Espinoza"
  if (partes.length >= 4) {
    return `${partes[0]} ${partes[2]}`;
  }
  return `${partes[0]} ${partes[1]}`;
}

export const HistorialArchivo: React.FC = () => {
  const { tareas } = useTareas();
  const { usuario } = useAuth();

  // Estados de Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroGuardia, setFiltroGuardia] = useState<string>('todas');
  const [filtroEstado, setFiltroEstado] = useState<string>('todas');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string>('todas');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Extraer todas las etiquetas existentes de las tareas
  const todasLasEtiquetas = useMemo(() => {
    const setTags = new Set<string>();
    tareas.forEach((t) => {
      t.etiquetas?.forEach((tag) => setTags.add(tag.trim()));
    });
    return Array.from(setTags);
  }, [tareas]);

  // Filtrado Full-Text y Combinable
  const tareasFiltradas = useMemo(() => {
    return tareas.filter((t) => {
      // 1. Búsqueda Full-Text en vivo para títulos y descripciones
      if (busqueda.trim() !== '') {
        const query = busqueda.toLowerCase();
        const enTitulo = t.titulo.toLowerCase().includes(query);
        const enDescripcion = (t.descripcion || '').toLowerCase().includes(query);
        const enMotivoCancel = (t.motivo_cancelacion || '').toLowerCase().includes(query);
        if (!enTitulo && !enDescripcion && !enMotivoCancel) return false;
      }

      // 2. Filtro Guardia
      if (filtroGuardia !== 'todas') {
        const coincide = t.guardia_creador === filtroGuardia || t.guardia_objetivo === filtroGuardia;
        if (!coincide) return false;
      }

      // 3. Filtro Estado (incluye 'Cancelado' para revisar soft deletes)
      if (filtroEstado !== 'todas') {
        if (t.estado !== filtroEstado) return false;
      }

      // 4. Filtro Etiqueta
      if (filtroEtiqueta !== 'todas') {
        if (!t.etiquetas || !t.etiquetas.includes(filtroEtiqueta)) return false;
      }

      // 5. Rango de Fechas
      if (fechaDesde) {
        const fDesde = new Date(fechaDesde).getTime();
        const fTarea = new Date(t.created_at).getTime();
        if (fTarea < fDesde) return false;
      }
      if (fechaHasta) {
        const fHasta = new Date(fechaHasta).getTime() + 86400000; // Final del día
        const fTarea = new Date(t.created_at).getTime();
        if (fTarea > fHasta) return false;
      }

      return true;
    });
  }, [tareas, busqueda, filtroGuardia, filtroEstado, filtroEtiqueta, fechaDesde, fechaHasta]);

  // Exportar a Excel (.xlsx / .csv)
  const exportarExcel = () => {
    const dataFilas = tareasFiltradas.map((t) => {
      const creadorNombre = formatNombreApellido(
        t.creador?.nombre_completo || SEED_USUARIOS.find((u) => u.id === t.creador_id)?.nombre_completo
      );
      const asignadoNombre = formatNombreApellido(
        t.asignado?.nombre_completo || SEED_USUARIOS.find((u) => u.id === t.asignado_a_id)?.nombre_completo
      );

      return {
        'Código': t.codigo_tarea || t.id.slice(0, 8),
        'Título': t.titulo,
        'Descripción': t.descripcion,
        'Estado': t.estado,
        'Criticidad': t.nivel_criticidad,
        'Guardia Creador': t.guardia_creador,
        'Guardia Relevo': t.guardia_objetivo || '-',
        'Creador': creadorNombre,
        'Responsable Asignado': asignadoNombre,
        'Visibilidad': t.visibilidad,
        'Notificación': t.frecuencia_notificacion || '-',
        'Etiquetas': t.etiquetas ? t.etiquetas.join(', ') : '',
        'Motivo Cancelación': t.motivo_cancelacion || '-',
        'Fecha Creación': new Date(t.created_at).toLocaleString(),
        'Fecha Completado': t.fecha_completado ? new Date(t.fecha_completado).toLocaleString() : '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataFilas);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Marcobre_Tareas');
    XLSX.writeFile(workbook, `Marcobre_Puerto_Tareas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Exportar a PDF (Dashboard Gerencial)
  const exportarPDF = () => {
    const doc = new jsPDF('landscape');

    // Encabezado Corporativo Marcobre
    doc.setFillColor(43, 92, 143); // #2b5c8f
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('MARCOBRE - REPORTE GERENCIAL DE TAREAS Y RELEVOS PORTUARIOS', 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleString()} | Filtradas: ${tareasFiltradas.length} tareas`, 220, 15);

    const headers = [['Cod', 'Título', 'Estado', 'Criticidad', 'Guardia', 'Creador', 'Responsable', 'Notificación', 'Motivo / Nota']];

    const body = tareasFiltradas.map((t) => {
      const creadorNombre = formatNombreApellido(
        t.creador?.nombre_completo || SEED_USUARIOS.find((u) => u.id === t.creador_id)?.nombre_completo
      );
      const asignadoNombre = formatNombreApellido(
        t.asignado?.nombre_completo || SEED_USUARIOS.find((u) => u.id === t.asignado_a_id)?.nombre_completo
      );

      return [
        t.codigo_tarea || t.id.slice(0, 6),
        t.titulo.length > 30 ? t.titulo.slice(0, 30) + '...' : t.titulo,
        t.estado,
        t.nivel_criticidad,
        `Gda ${t.guardia_creador}`,
        creadorNombre,
        asignadoNombre,
        t.frecuencia_notificacion || '-',
        t.motivo_cancelacion ? `CANCEL: ${t.motivo_cancelacion}` : (t.descripcion || '-').slice(0, 25),
      ];
    });

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [43, 92, 143], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
    });

    doc.save(`Marcobre_Reporte_Gerencial_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Barra Superior con Controles de Búsqueda y Exportación */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Barra de Búsqueda Full-Text en vivo */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Búsqueda Full-Text en títulos, descripciones y motivos de cancelación..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2b5c8f]"
            />
          </div>

          {/* Botones de Exportación */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportarExcel}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-1.5 active:scale-95"
              title="Descargar archivo Excel con todas las columnas auditables"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel / CSV</span>
            </button>

            <button
              onClick={exportarPDF}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-[#c13127] hover:bg-[#9e251e] text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-1.5 active:scale-95"
              title="Descargar Reporte Ejecutivo en PDF"
            >
              <FileText className="w-4 h-4" />
              <span>PDF Gerencial</span>
            </button>
          </div>
        </div>

        {/* Filtros Combinables */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          {/* Guardia */}
          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">Guardia</label>
            <select
              value={filtroGuardia}
              onChange={(e) => setFiltroGuardia(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="todas">Todas las Guardias</option>
              <option value="A">Guardia A</option>
              <option value="B">Guardia B</option>
              <option value="C">Guardia C</option>
              <option value="D">Guardia D</option>
              <option value="Staff">Staff / Jefatura</option>
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="todas">Todos los Estados</option>
              <option value="Por Hacer">Por Hacer</option>
              <option value="En Progreso">En Progreso</option>
              <option value="Completado">Completado</option>
              <option value="Cancelado">Cancelado (Suspendidas)</option>
            </select>
          </div>

          {/* Etiqueta */}
          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">Etiqueta</label>
            <select
              value={filtroEtiqueta}
              onChange={(e) => setFiltroEtiqueta(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="todas">Todas las Etiquetas</option>
              {todasLasEtiquetas.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {/* Fecha Desde */}
          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          {/* Fecha Hasta */}
          <div>
            <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Tabla Histórica Completa */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#2b5c8f]/10 dark:bg-slate-800 text-[#2b5c8f] dark:text-blue-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Título y Detalles</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Criticidad</th>
                <th className="p-3">Guardia</th>
                <th className="p-3">Creador</th>
                <th className="p-3">Asignado</th>
                <th className="p-3">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {tareasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                    No se encontraron tareas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                tareasFiltradas.map((t) => {
                  const creadorNombre = formatNombreApellido(
                    t.creador?.nombre_completo || SEED_USUARIOS.find((u) => u.id === t.creador_id)?.nombre_completo
                  );
                  const asignadoNombre = formatNombreApellido(
                    t.asignado?.nombre_completo || SEED_USUARIOS.find((u) => u.id === t.asignado_a_id)?.nombre_completo
                  );

                  return (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="p-3 font-mono font-bold text-slate-500">
                        #{t.codigo_tarea || t.id.slice(0, 6)}
                      </td>
                      <td className="p-3 max-w-sm">
                        <div className="font-bold text-slate-900 dark:text-white mb-0.5">
                          {t.titulo}
                        </div>
                        <div className="text-xs text-slate-500 line-clamp-2">
                          {t.descripcion}
                        </div>
                        {t.frecuencia_notificacion && t.frecuencia_notificacion !== 'Sin Notificación' && (
                          <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                            <span>🔔 Aviso: {t.frecuencia_notificacion}</span>
                          </div>
                        )}
                        {t.motivo_cancelacion && (
                          <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>Motivo Cancelación: {t.motivo_cancelacion}</span>
                          </div>
                        )}
                        {t.etiquetas && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {t.etiquetas.map((tag, i) => (
                              <span key={i} className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                          t.estado === 'Completado'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : t.estado === 'En Progreso'
                            ? 'bg-blue-100 text-[#2b5c8f] dark:bg-blue-950 dark:text-blue-300'
                            : t.estado === 'Cancelado'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {t.estado}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-semibold text-xs">{t.nivel_criticidad}</span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-mono">
                        Gda {t.guardia_creador} {t.guardia_objetivo ? `➔ ${t.guardia_objetivo}` : ''}
                      </td>
                      <td className="p-3 whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                        {creadorNombre}
                      </td>
                      <td className="p-3 whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                        {asignadoNombre}
                      </td>
                      <td className="p-3 whitespace-nowrap text-xs text-slate-500">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

