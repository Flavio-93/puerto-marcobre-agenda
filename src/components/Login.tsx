import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle, Ship } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Requisito estricto: Username convertido a minúsculas en el frontend + contraseña case-sensitive
      const cleanUsername = username.trim().toLowerCase();
      const res = await login(cleanUsername, password);
      if (!res.success) {
        setError(res.error || 'Credenciales no reconocidas.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  // Función para rellenar rápido un usuario de prueba para evaluación de campo
  const autoCompletar = (user: string) => {
    setUsername(user);
    setPassword('Marcobre2025!');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Cabecera Corporativa Marcobre */}
        <div className="bg-[#2b5c8f] p-6 text-white text-center relative">
          <div className="flex justify-center mb-3">
            <div className="bg-white p-2 rounded-xl shadow-md">
              <img 
                src="/logo.png" 
                alt="Marcobre - Puerto" 
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                  const parent = (e.target as HTMLElement).parentElement;
                  if (parent && !parent.querySelector('.logo-fallback')) {
                    const span = document.createElement('span');
                    span.className = 'logo-fallback font-black text-sm text-[#2b5c8f] tracking-tighter px-2';
                    span.innerText = 'MARCOBRE';
                    parent.appendChild(span);
                  }
                }}
                className="h-10 w-auto object-contain" 
              />
            </div>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Puerto Marcobre</h2>
          <p className="text-xs text-blue-100 mt-1">
            Sistema de Gestión de Tareas y Relevos Portuarios (10x10)
          </p>
          <div className="inline-flex items-center gap-1.5 mt-3 bg-[#1e4570] px-3 py-1 rounded-full text-xs text-amber-300 font-semibold border border-blue-400/30">
            <Ship className="w-3.5 h-3.5" />
            <span>Operación Continua & Relevos</span>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-lg text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Usuario Corporativo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej: cmachuca, cnanfuñay, jhuaman, fpaolillo"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2b5c8f] focus:border-transparent text-sm transition"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              (Se concatena internamente con @puerto.local)
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña case-sensitive"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2b5c8f] focus:border-transparent text-sm transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 bg-[#2b5c8f] hover:bg-[#1e4570] text-white font-bold rounded-xl shadow-lg transition duration-150 flex justify-center items-center gap-2 active:scale-98 disabled:opacity-50"
          >
            {submitting ? 'Verificando Padrón...' : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
};

