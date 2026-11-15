import React, { createContext, useContext, useState, useEffect } from 'react';
import { Perfil, RolUsuario, TipoGuardia } from '../types';
import { supabase, isSupabaseConfigured, SEED_USUARIOS } from '../services/supabase';

interface AuthContextType {
  usuario: Perfil | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  cambiarPasswordUsuario: (targetUserId: string, nuevaClave: string) => Promise<{ success: boolean; error?: string }>;
  esJefatura: boolean;
  esAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [passwordsMap, setPasswordsMap] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('marcobre_user_passwords');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      'fespinoza': 'ian07',
    };
  });

  useEffect(() => {
    // Cargar sesión persistida localmente
    const savedUser = localStorage.getItem('marcobre_user_session');
    if (savedUser) {
      try {
        setUsuario(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parseando sesion:', e);
      }
    }
    setLoading(false);
  }, []);

  const login = async (usernameInput: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUsername = usernameInput.trim().toLowerCase();
    
    if (!cleanUsername || !password) {
      return { success: false, error: 'Ingrese usuario y contraseña' };
    }

    if (isSupabaseConfigured) {
      // Login con Supabase Auth usando dominio oculto @puerto.local
      const email = `${cleanUsername}@puerto.local`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: 'Credenciales inválidas en Supabase: ' + error.message };
      }

      // Obtener el perfil
      if (data.user) {
        const { data: perfil, error: errPerfil } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (perfil) {
          setUsuario(perfil);
          localStorage.setItem('marcobre_user_session', JSON.stringify(perfil));
          return { success: true };
        }
      }
    }

    // Modo Standalone / Demo Offline con usuarios semilla
    const found = SEED_USUARIOS.find((u) => u.username.toLowerCase() === cleanUsername);
    if (found) {
      // Clave personalizada en passwordsMap o por defecto
      const claveEsperada = passwordsMap[cleanUsername] || (cleanUsername === 'fespinoza' ? 'ian07' : 'Marcobre2025!');
      if (password === claveEsperada) {
        setUsuario(found);
        localStorage.setItem('marcobre_user_session', JSON.stringify(found));
        return { success: true };
      } else {
        return { success: false, error: 'Contraseña incorrecta.' };
      }
    }

    return { success: false, error: 'Usuario no encontrado en el padrón de Marcobre Puerto.' };
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.removeItem('marcobre_user_session');
    setUsuario(null);
  };

  const esJefatura = usuario?.rol === 'superintendente' || usuario?.rol === 'jefe';
  // Exclusividad total: SOLO Flavio Espinoza tiene privilegios de Administrador General
  const esAdmin = usuario?.username === 'fespinoza';

  // Función exclusiva para que el Administrador cambie contraseñas
  const cambiarPasswordUsuario = async (targetUsername: string, nuevaClave: string): Promise<{ success: boolean; error?: string }> => {
    if (!esAdmin) {
      return { success: false, error: 'Solo el Administrador General puede cambiar contraseñas.' };
    }
    if (!nuevaClave || nuevaClave.length < 4) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' };
    }

    const cleanUsername = targetUsername.trim().toLowerCase();
    const updated = {
      ...passwordsMap,
      [cleanUsername]: nuevaClave,
    };
    setPasswordsMap(updated);
    localStorage.setItem('marcobre_user_passwords', JSON.stringify(updated));

    if (isSupabaseConfigured) {
      try {
        // En Supabase Auth se invoca RPC o Auth Admin API
        await supabase.rpc('admin_cambiar_password', {
          p_username: cleanUsername,
          p_new_password: nuevaClave,
        });
      } catch (err) {
        console.warn('Supabase RPC cambiar clave:', err);
      }
    }

    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout, cambiarPasswordUsuario, esJefatura, esAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

