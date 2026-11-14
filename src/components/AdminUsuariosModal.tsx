import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SEED_USUARIOS } from '../services/supabase';
import { ShieldCheck, KeyRound, Check, AlertCircle, Lock, User, RefreshCw } from 'lucide-react';

interface AdminUsuariosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminUsuariosModal: React.FC<AdminUsuariosModalProps> = ({ isOpen, onClose }) => {
  const { usuario, cambiarPasswordUsuario, esAdmin } = useAuth();

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<string>(usuario?.username || 'fespinoza');
  const [nuevaClave, setNuevaClave] = useState('');
  const [confirmarClave, setConfirmarClave] = useState('');
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !esAdmin) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeExito(null);
    setMensajeError(null);

    if (nuevaClave.length < 4) {
      setMensajeError('La contraseña debe tener mínimo 4 caracteres.');
      return;
    }

    if (nuevaClave !== confirmarClave) {
      setMensajeError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await cambiarPasswordUsuario(usuarioSeleccionado, nuevaClave);
      if (res.success) {
        setMensajeExito(`¡Contraseña actualizada exitosamente para @${usuarioSeleccionado}!`);
        setNuevaClave('');
        setConfirmarClave('');
      } else {
        setMensajeError(res.error || 'Error al actualizar contraseña.');
      }
    } catch (err: any) {
      setMensajeError(err?.message || 'Error en el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  const usuarioObj = SEED_USUARIOS.find((u) => u.username === usuarioSeleccionado);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 my-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#2b5c8f] dark:text-blue-400">
                Gestión de Credenciales de Acceso
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Panel Exclusivo del Administrador ({usuario?.nombre_completo})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1"
          >
            ✕
          </button>
        </div>

        {mensajeExito && (
          <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{mensajeExito}</span>
          </div>
        )}

        {mensajeError && (
          <div className="mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{mensajeError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* Seleccionar Usuario a cambiar contraseña */}
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#2b5c8f]" />
              <span>Seleccionar Usuario del Padrón Marcobre</span>
            </label>
            <select
              value={usuarioSeleccionado}
              onChange={(e) => {
                setUsuarioSeleccionado(e.target.value);
                setMensajeExito(null);
                setMensajeError(null);
              }}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
            >
              <optgroup label="Administrador / Mi Cuenta:">
                <option value="fespinoza">
                  FLAVIO RUBEN ESPINOZA CHUMBIAUCA (Admin / Mi Contraseña)
                </option>
              </optgroup>
              <optgroup label="Jefatura y Superintendencia:">
                <option value="fpaolillo">FRANCISCO JAVIER PAOLILLO TAPIA (Superintendente)</option>
                <option value="mcaceres">MANUEL ANTONIO CACERES FALCONI (Jefe de Puerto)</option>
              </optgroup>
              <optgroup label="Supervisores Guardia A:">
                <option value="cnanfunay">CRONWEL VLADIMIR NANFUÑAY LORA (Gda A - Planta)</option>
                <option value="jchuaman">JUAN CARLOS HUAMAN QUISPE (Gda A - Descarga)</option>
              </optgroup>
              <optgroup label="Supervisores Guardia B:">
                <option value="cmachuca">CESAR ARNALDO MACHUCA POLO (Gda B - Planta)</option>
                <option value="ydiaz">YOFRE DÍAZ GUARDERAS (Gda B - Descarga)</option>
              </optgroup>
              <optgroup label="Supervisores Guardia C:">
                <option value="jchambergo">JORGE MARCO CHAMBERGO VARGAS (Gda C - Planta)</option>
              </optgroup>
              <optgroup label="Supervisores Guardia D:">
                <option value="crudas">CARLOS ALBERTO RUDAS RAMIREZ (Gda D - Planta)</option>
                <option value="wlopez">WILLIAM JOSE LOPEZ QUIROZ (Gda D - Descarga)</option>
              </optgroup>
            </select>

            {usuarioObj && (
              <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex justify-between">
                <span>Usuario: <strong className="font-mono text-[#2b5c8f] dark:text-blue-300">@{usuarioObj.username}</strong></span>
                <span>Guardia: <strong className="font-mono">{usuarioObj.guardia}</strong></span>
                <span>Área: <strong className="font-mono">{usuarioObj.area}</strong></span>
              </div>
            )}
          </div>

          {/* Nueva Contraseña */}
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-400" />
              <span>Nueva Contraseña (case-sensitive)</span>
            </label>
            <input
              type="text"
              required
              value={nuevaClave}
              onChange={(e) => setNuevaClave(e.target.value)}
              placeholder="Ingresa la nueva clave..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-sm focus:ring-2 focus:ring-[#2b5c8f] focus:outline-none"
            />
          </div>

          {/* Confirmar Contraseña */}
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-400" />
              <span>Confirmar Nueva Contraseña</span>
            </label>
            <input
              type="text"
              required
              value={confirmarClave}
              onChange={(e) => setConfirmarClave(e.target.value)}
              placeholder="Vuelve a escribir la clave..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-sm focus:ring-2 focus:ring-[#2b5c8f] focus:outline-none"
            />
          </div>

          {/* Botones de acción */}
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
              className="px-6 py-2.5 rounded-xl bg-[#2b5c8f] hover:bg-[#1e4570] text-white font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? 'Guardando...' : 'Actualizar Contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

