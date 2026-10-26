import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ShieldAlert, 
  Calendar, 
  CheckSquare, 
  Users, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  UserCheck, 
  HardHat, 
  Building2, 
  Activity, 
  RefreshCw, 
  ArrowRightLeft, 
  Layers, 
  Briefcase, 
  ChevronRight, 
  X,
  Save,
  Download,
  AlertCircle,
  Lock,
  LogOut,
  User,
  Shield,
  Edit3,
  RotateCw,
  Bell,
  Ship,
  Sun,
  Moon,
  Key,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';

// --- SUPABASE CLIENT CONFIGURATION ---
const SUPABASE_URL = 'https://uaqfaqdbejdnonulozad.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iDmuy5vGWPF1a6vqellmHw_Kha-2reP';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('marcobre_dark_mode');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [usersList, setUsersList] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Start with null currentUser to enforce strict login
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('marcobre_user_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed;
      }
    } catch {}
    return null; 
  });

  // Completely blank fields for manual typing
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isUsersManagementModalOpen, setIsUsersManagementModalOpen] = useState(false);

  // --- FETCH DATA FROM SUPABASE ON START & SETUP REALTIME ---
  useEffect(() => {
    fetchDataFromCloud();

    const tasksSubscription = supabase
      .channel('public:tareas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, payload => {
        fetchDataFromCloud();
      })
      .subscribe();

    const usersSubscription = supabase
      .channel('public:usuarios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, payload => {
        fetchDataFromCloud();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tasksSubscription);
      supabase.removeChannel(usersSubscription);
    };
  }, []);

  const fetchDataFromCloud = async () => {
    try {
      const { data: cloudUsers, error: errUsers } = await supabase.from('usuarios').select('*');
      if (!errUsers && cloudUsers && cloudUsers.length > 0) {
        setUsersList(cloudUsers);
        const savedSession = localStorage.getItem('marcobre_user_session');
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          const found = cloudUsers.find(u => u.username === parsed.username);
          if (found) setCurrentUser(found);
        }
      }

      const { data: cloudTasks, error: errTasks } = await supabase.from('tareas').select('*');
      if (!errTasks && cloudTasks) {
        const formattedTasks = cloudTasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          type: t.type,
          priority: t.priority,
          status: t.status,
          assignedTo: t.assigned_to,
          guard: t.guard,
          createdBy: t.created_by,
          auditTrail: t.audit_trail,
          dueDate: t.due_date,
          createdAt: t.created_at,
          remindFrequency: t.remind_frequency
        }));
        setTasks(formattedTasks);
      }
    } catch (err) {
      console.error('Error fetching from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !currentUser) {
      setIsLoginModalOpen(true);
    }
  }, [isLoading, currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('marcobre_dark_mode', JSON.stringify(isDarkMode));
    } catch {}
  }, [isDarkMode]);

  useEffect(() => {
    if (currentUser) {
      try {
        localStorage.setItem('marcobre_user_session', JSON.stringify({ username: currentUser.username }));
      } catch {}
    }
  }, [currentUser]);

  const [regimeCycleDay, setRegimeCycleDay] = useState(4); 
  const [activeTab, setActiveTab] = useState('agenda');
  const [taskFilter, setTaskFilter] = useState('mis-tareas');
  const [searchQuery, setSearchQuery] = useState('');

  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState(null);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    type: 'Mantenimiento / Instalaciones',
    priority: 'Media',
    status: 'Pendiente',
    assignedTo: currentUser?.role === 'supervisor' ? 'Personal (Solo yo)' : 'General / Rotativo',
    guard: currentUser?.guard !== 'Todas' && currentUser?.guard ? currentUser.guard : 'Guardia B',
    dueDate: new Date().toISOString().split('T')[0],
    remindFrequency: 'Diaria'
  });

  // Strict manual username and password validation
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoginError('');
    
    const normalizeStr = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const cleanInputUser = normalizeStr(loginUsername.trim());

    const found = usersList.find(u => normalizeStr(u.username) === cleanInputUser);
    
    if (!found) {
      setLoginError('Usuario no encontrado. Verifique su usuario (Ej: cnanfuñay, fespinoza).');
      return;
    }
    if (found.password && found.password !== loginPassword) {
      setLoginError('Contraseña incorrecta. Recuerde que la contraseña distingue mayúsculas y minúsculas.');
      return;
    }

    setCurrentUser(found);
    setIsLoginModalOpen(false);
    setNewTask(prev => ({
      ...prev,
      guard: found.guard !== 'Todas' ? found.guard : 'Guardia B',
      assignedTo: found.role === 'supervisor' ? 'Personal (Solo yo)' : 'General / Rotativo'
    }));
  };

  const handleUpdateUserPassword = async (userId, newPass) => {
    if (currentUser?.username?.toLowerCase() !== 'fespinoza') {
      alert('Acceso denegado. Solo el Administrador (Flavio Espinoza) puede cambiar las contraseñas.');
      return;
    }
    const { error } = await supabase
      .from('usuarios')
      .update({ password: newPass })
      .eq('id', userId);

    if (error) {
      alert('Error al actualizar contraseña en la nube.');
    } else {
      fetchDataFromCloud();
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('marcobre_user_session');
    } catch {}
    setCurrentUser(null);
    setLoginUsername('');
    setLoginPassword('');
    setIsLoginModalOpen(true);
  };

  const handleDeleteTask = async (taskId) => {
    if (!currentUser || (currentUser.username?.toLowerCase() !== 'fespinoza' && currentUser.role !== 'superintendente')) {
      alert('Acceso restringido. Solo el Administrador (Flavio Espinoza) y el Superintendente pueden eliminar eventos.');
      return;
    }
    if (window.confirm('¿Está seguro de eliminar este registro de la agenda de forma permanente para todo el puerto?')) {
      const { error } = await supabase.from('tareas').delete().eq('id', taskId);
      if (error) {
        alert('Error al eliminar tarea en la nube.');
      } else {
        fetchDataFromCloud();
      }
    }
  };

  const activeGuardsInfo = useMemo(() => {
    if (regimeCycleDay <= 5) {
      return {
        duty: ['Guardia B (César Machuca / Yofre Díaz)', 'Guardia C (Jorge Chambergo - Último día)'],
        rest: ['Guardia A (Cronwel Nanfuñay / Juan Huaman)', 'Guardia D (Carlos Rudas / William Lopez)'],
        phaseText: `Régimen 10x10 Puerto (Día ${regimeCycleDay}/10): Guardia B en turno activo. Guardia C baja mañana.`
      };
    } else {
      return {
        duty: ['Guardia B (César Machuca / Yofre Díaz)', 'Guardia A (Cronwel Nanfuñay / Juan Huaman - Subió de relevo)'],
        rest: ['Guardia C (Jorge Chambergo - Descanso)', 'Guardia D (Carlos Rudas / William Lopez)'],
        phaseText: `Régimen 10x10 Puerto (Día ${regimeCycleDay}/10): Guardia A relevó a Guardia C. Guardia B continúa.`
      };
    }
  }, [regimeCycleDay]);

  const activeNotifications = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(t => {
      if (t.status === 'Completado') return false;
      const dueDateObj = new Date(t.dueDate);
      const todayObj = new Date(today);
      const diffDays = Math.ceil((dueDateObj - todayObj) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) return true;
      if (t.remindFrequency === 'Diaria' && diffDays <= 3) return true;
      if (t.remindFrequency === '2 días antes' && diffDays <= 2) return true;
      if (t.remindFrequency === '3 días antes' && diffDays <= 3) return true;
      if (t.remindFrequency === 'Semanal' && diffDays <= 7) return true;
      return false;
    });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            task.description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (taskFilter === 'mis-tareas') {
        if (currentUser?.role === 'supervisor') {
          return task.assignedTo === currentUser.name || (task.assignedTo.includes('General') && task.guard === currentUser.guard);
        }
        return true; 
      } else if (taskFilter === 'general') {
        return task.assignedTo.includes('General');
      } else if (taskFilter === 'urgentes') {
        return task.priority === 'Alta' && task.status !== 'Completado';
      }
      return true; 
    });
  }, [tasks, taskFilter, searchQuery, currentUser]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title || !currentUser) return;

    let assigned = newTask.assignedTo;
    if (currentUser.role === 'supervisor') {
      if (assigned === 'Personal (Solo yo)') {
        assigned = currentUser.name;
      } else {
        assigned = `General / Rotativo (${currentUser.guard})`;
      }
    }

    let auditText = '';
    if (currentUser.role === 'admin') {
      auditText = `Creado por ${currentUser.name} (Administrador App)`;
    } else if (currentUser.role === 'jefe') {
      auditText = `Creado y asignado por ${currentUser.name} (Jefe de Operaciones)`;
    } else if (currentUser.role === 'superintendente') {
      auditText = `Creado y asignado por ${currentUser.name} (Superintendente de Operaciones Puerto)`;
    } else {
      auditText = `Creado por ${currentUser.name} (Supervisor - ${currentUser.guard})`;
    }

    const newId = 'task-' + Date.now();
    const payload = {
      id: newId,
      title: newTask.title,
      description: newTask.description,
      type: newTask.type,
      priority: newTask.priority,
      status: newTask.status,
      assigned_to: assigned,
      guard: currentUser.guard !== 'Todas' ? currentUser.guard : newTask.guard,
      created_by: currentUser.name,
      audit_trail: auditText,
      due_date: newTask.dueDate,
      created_at: new Date().toISOString().split('T')[0],
      remind_frequency: newTask.remindFrequency
    };

    const { error } = await supabase.from('tareas').insert([payload]);
    if (error) {
      alert('Error al guardar la tarea en la nube.');
    } else {
      setIsNewTaskModalOpen(false);
      setNewTask({
        title: '',
        description: '',
        type: 'Mantenimiento / Instalaciones',
        priority: 'Media',
        status: 'Pendiente',
        assignedTo: currentUser.role === 'supervisor' ? 'Personal (Solo yo)' : 'General / Rotativo',
        guard: currentUser.guard !== 'Todas' ? currentUser.guard : 'Guardia B',
        dueDate: new Date().toISOString().split('T')[0],
        remindFrequency: 'Diaria'
      });
      fetchDataFromCloud();
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!selectedTaskForEdit || !currentUser) return;

    const auditAddition = (currentUser.role === 'jefe' || currentUser.role === 'superintendente' || currentUser.role === 'admin')
      ? ` | Modificado por ${currentUser.name} (${currentUser.role === 'admin' ? 'Admin' : currentUser.role})`
      : ` | Actualizado por ${currentUser.name}`;

    const newAudit = selectedTaskForEdit.auditTrail + auditAddition;

    const { error } = await supabase
      .from('tareas')
      .update({
        title: selectedTaskForEdit.title,
        description: selectedTaskForEdit.description,
        type: selectedTaskForEdit.type,
        priority: selectedTaskForEdit.priority,
        status: selectedTaskForEdit.status,
        assigned_to: selectedTaskForEdit.assignedTo,
        guard: selectedTaskForEdit.guard,
        due_date: selectedTaskForEdit.dueDate,
        remind_frequency: selectedTaskForEdit.remindFrequency,
        audit_trail: newAudit
      })
      .eq('id', selectedTaskForEdit.id);

    if (error) {
      alert('Error al actualizar la tarea en la nube.');
    } else {
      setIsEditTaskModalOpen(false);
      setSelectedTaskForEdit(null);
      fetchDataFromCloud();
    }
  };

  const toggleTaskStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Pendiente' ? 'En Proceso' : currentStatus === 'En Proceso' ? 'Completado' : 'Pendiente';
    
    const { error } = await supabase
      .from('tareas')
      .update({ status: nextStatus })
      .eq('id', id);

    if (!error) {
      fetchDataFromCloud();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-cyan-400 space-y-4">
        <Ship className="w-12 h-12 animate-bounce" />
        <p className="font-bold text-sm tracking-widest uppercase">Conectando con Marcobre Puerto Online...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white' 
        : 'bg-[#f4f7fa] text-slate-800 selection:bg-[#003B6F] selection:text-white'
    }`}>
      
      {/* HEADER BAR */}
      <header className={`border-b sticky top-0 z-40 px-4 lg:px-8 py-3 flex items-center justify-between shadow-xs transition-colors duration-200 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#003B6F] to-[#005B9F] shadow-sm flex items-center justify-center text-white flex-shrink-0">
            <Ship className="w-6 h-6 text-cyan-200" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className={`font-extrabold text-sm lg:text-lg tracking-tight ${isDarkMode ? 'text-cyan-400' : 'text-[#003B6F]'}`}>
                MARCOBRE &bull; PUERTO AGENDA VIVA (ONLINE)
              </h1>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold hidden sm:inline-block border ${
                isDarkMode 
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800' 
                  : 'bg-[#003B6F]/8 text-[#003B6F] border-[#003B6F]/20'
              }`}>
                Superintendencia de Operaciones Puerto
              </span>
            </div>
            <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Control de Pendientes, Reuniones y Régimen 10x10</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2.5 rounded-xl transition flex items-center justify-center border shadow-2xs ${
              isDarkMode 
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
            title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {currentUser?.username?.toLowerCase() === 'fespinoza' && (
            <button
              onClick={() => setIsUsersManagementModalOpen(true)}
              className={`flex items-center space-x-1.5 px-3 py-2.5 rounded-xl transition border shadow-2xs text-xs font-semibold ${
                isDarkMode ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800' : 'bg-[#003B6F]/10 text-[#003B6F] border-[#003B6F]/30'
              }`}
              title="Gestión de Credenciales (Solo Administrador Flavio Espinoza)"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Directorio (Admin)</span>
            </button>
          )}

          <button
            onClick={() => setIsNotificationModalOpen(true)}
            className={`relative p-2.5 rounded-xl transition flex items-center justify-center border shadow-2xs ${
              isDarkMode 
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-400' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-[#003B6F]'
            }`}
            title="Centro de Alertas y Notificaciones"
          >
            <Bell className="w-4 h-4" />
            {activeNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs border-2 border-white animate-pulse">
                {activeNotifications.length}
              </span>
            )}
          </button>

          {currentUser ? (
            <div 
              onClick={() => {
                setLoginUsername(currentUser.username);
                setLoginPassword('');
                setLoginError('');
                setIsLoginModalOpen(true);
              }}
              className={`px-3.5 py-2 rounded-xl flex items-center space-x-2.5 cursor-pointer transition border shadow-2xs ${
                isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-white hover:bg-slate-50 border-slate-300'
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${currentUser.role === 'admin' ? 'bg-cyan-400' : currentUser.role === 'superintendente' ? 'bg-amber-500' : currentUser.role === 'jefe' ? 'bg-[#003B6F]' : 'bg-emerald-500'}`}></div>
              <div className="text-left hidden sm:block">
                <span className={`text-[9px] block leading-none font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Sesión Activa</span>
                <span className={`text-xs font-bold truncate max-w-[170px] ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{currentUser.name}</span>
              </div>
              <Shield className={`w-3.5 h-3.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} ml-1`} />
            </div>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-[#003B6F] text-white text-xs font-bold px-3.5 py-2 rounded-xl"
            >
              Iniciar Sesión
            </button>
          )}

          {currentUser && (
            <button 
              onClick={() => {
                setNewTask(prev => ({
                  ...prev,
                  guard: currentUser.guard !== 'Todas' ? currentUser.guard : 'Guardia B',
                  assignedTo: currentUser.role === 'supervisor' ? 'Personal (Solo yo)' : 'General / Rotativo'
                }));
                setIsNewTaskModalOpen(true);
              }}
              className="bg-[#003B6F] hover:bg-[#002D56] text-white text-xs lg:text-sm font-bold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Pendiente</span>
            </button>
          )}
        </div>
      </header>

      {/* SHIFT & REGIME 10X10 BANNER */}
      <div className={`border-b px-4 lg:px-8 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shadow-2xs transition-colors duration-200 ${
        isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-1.5 rounded-lg border flex items-center space-x-1.5 ${
            isDarkMode ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800' : 'bg-[#003B6F]/8 text-[#003B6F] border-[#003B6F]/20'
          }`}>
            <RotateCw className="w-3.5 h-3.5" />
            <span className="font-bold">Régimen 10x10 Puerto</span>
          </div>
          <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {activeGuardsInfo.phaseText}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-lg border flex items-center space-x-2 ${
            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>En Turno:</span>
            <span className="text-emerald-500 font-bold">{activeGuardsInfo.duty.join(' | ')}</span>
          </div>
          <button
            onClick={() => setRegimeCycleDay(prev => prev <= 5 ? 6 : 1)}
            className={`px-2.5 py-1 rounded-lg font-semibold transition border ${
              isDarkMode 
                ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700' 
                : 'bg-slate-100 hover:bg-slate-200 text-[#003B6F] border-slate-300'
            }`}
            title="Simular relevo de turno"
          >
            Simular Relevo (Día {regimeCycleDay})
          </button>
        </div>
      </div>

      {/* SUB-NAV TABS */}
      <div className={`border-b px-4 lg:px-8 flex space-x-2 overflow-x-auto shadow-2xs transition-colors duration-200 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <button
          onClick={() => setActiveTab('agenda')}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-xs sm:text-sm transition whitespace-nowrap ${
            activeTab === 'agenda' 
              ? (isDarkMode ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30 font-bold' : 'border-[#003B6F] text-[#003B6F] bg-[#003B6F]/5 font-bold') 
              : (isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50')
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Agenda Viva de Pendientes</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
            isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
          }`}>
            {tasks.filter(t => t.status !== 'Completado').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-xs sm:text-sm transition whitespace-nowrap ${
            activeTab === 'audit' 
              ? (isDarkMode ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30 font-bold' : 'border-[#003B6F] text-[#003B6F] bg-[#003B6F]/5 font-bold') 
              : (isDarkMode ? 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50')
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Historial y Trazabilidad de Jefatura</span>
        </button>
      </div>

      {/* MAIN CONTENT CONTAINER */}
      <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        
        {activeTab === 'agenda' && (
          <div className="space-y-6">
            
            {currentUser && (
              <div className={`border p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs transition-colors duration-200 ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl border ${
                    currentUser.role === 'admin' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' :
                    currentUser.role === 'superintendente' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                    currentUser.role === 'jefe' ? (isDarkMode ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-[#003B6F]/10 border-[#003B6F]/30 text-[#003B6F]') :
                    'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                  }`}>
                    {currentUser.role === 'admin' ? <Key className="w-6 h-6" /> : currentUser.role === 'superintendente' ? <Building2 className="w-6 h-6" /> : currentUser.role === 'jefe' ? <Briefcase className="w-6 h-6" /> : <HardHat className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className={`font-bold text-sm sm:text-base ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{currentUser.name}</h2>
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold border ${
                        isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {currentUser.role === 'admin' ? 'Administrador / Creador' : currentUser.role === 'superintendente' ? 'Superintendencia Puerto' : currentUser.role === 'jefe' ? 'Jefe de Operaciones Puerto' : `${currentUser.guard} - ${currentUser.spec}`}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${isDarkMode ? 'bg-slate-800 text-cyan-300' : 'bg-slate-100 text-[#003B6F]'}`}>
                        @{currentUser.username}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {currentUser.role === 'admin'
                        ? 'Eres el administrador general (Flavio Espinoza). Controlas el directorio de credenciales en la nube y la eliminación de eventos.'
                        : currentUser.role === 'superintendente'
                        ? 'Superintendente de Operaciones Puerto. Tienes privilegios para editar, reasignar y eliminar eventos de la agenda en tiempo real.'
                        : currentUser.role === 'supervisor' 
                        ? `Registras pendientes para tu guardia (${currentUser.guard}).` 
                        : 'Tienes privilegios de Jefatura: puedes registrar, editar y reasignar tareas a cualquier supervisor del puerto.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Sesión:</span>
                  <button
                    onClick={() => {
                      setLoginUsername(currentUser.username);
                      setLoginPassword('');
                      setLoginError('');
                      setIsLoginModalOpen(true);
                    }}
                    className={`text-xs font-bold px-3 py-2 rounded-xl transition border flex items-center space-x-1 shadow-2xs ${
                      isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-[#003B6F] border-slate-300'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Cambiar Perfil</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="text-xs font-bold px-3 py-2 rounded-xl transition border bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/30 flex items-center space-x-1 shadow-2xs"
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Salir</span>
                  </button>
                </div>
              </div>
            )}

            <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border p-4 rounded-2xl shadow-2xs transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setTaskFilter('mis-tareas')}
                  className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition ${
                    taskFilter === 'mis-tareas' 
                      ? (isDarkMode ? 'bg-cyan-600 text-white font-bold shadow-xs' : 'bg-[#003B6F] text-white font-bold shadow-xs') 
                      : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200')
                  }`}
                >
                  {currentUser?.role === 'supervisor' ? `Mis Tareas (${currentUser.guard})` : 'Vista General Puerto'}
                </button>

                <button
                  onClick={() => setTaskFilter('general')}
                  className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition ${
                    taskFilter === 'general' 
                      ? (isDarkMode ? 'bg-cyan-600 text-white font-bold shadow-xs' : 'bg-[#003B6F] text-white font-bold shadow-xs') 
                      : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200')
                  }`}
                >
                  Generales / Rotativos
                </button>

                <button
                  onClick={() => setTaskFilter('urgentes')}
                  className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition ${
                    taskFilter === 'urgentes' 
                      ? 'bg-rose-600 text-white font-bold shadow-xs' 
                      : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200')
                  }`}
                >
                  Alta Prioridad
                </button>

                <button
                  onClick={() => setTaskFilter('todos')}
                  className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition ${
                    taskFilter === 'todos' 
                      ? (isDarkMode ? 'bg-cyan-600 text-white font-bold shadow-xs' : 'bg-[#003B6F] text-white font-bold shadow-xs') 
                      : (isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200')
                  }`}
                >
                  Todos ({tasks.length})
                </button>
              </div>

              <div className="relative w-full md:w-72">
                <Search className={`absolute left-3.5 top-3 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <input 
                  type="text"
                  placeholder="Buscar pendiente, reunión, compra..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full border rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none transition shadow-inner ${
                    isDarkMode 
                      ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-cyan-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-[#003B6F]'
                  }`}
                />
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map(task => {
                const canEditTask = currentUser && (currentUser.role === 'admin' || currentUser.role === 'jefe' || currentUser.role === 'superintendente' || task.assignedTo === currentUser.name || task.createdBy === currentUser.name);
                const canDeleteTask = currentUser && (currentUser.username === 'fespinoza' || currentUser.role === 'superintendente');

                return (
                  <div key={task.id} className={`border rounded-2xl p-5 shadow-2xs flex flex-col justify-between transition relative group ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                          task.priority === 'Alta' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30' :
                          task.priority === 'Media' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' :
                          'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        }`}>
                          {task.priority}
                        </span>

                        <div className={`flex items-center space-x-1.5 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <Bell className={`w-3.5 h-3.5 ${isDarkMode ? 'text-cyan-400' : 'text-[#003B6F]'}`} />
                          <span>Frecuencia: {task.remindFrequency || 'Diaria'}</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                            isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>{task.guard}</span>
                          <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-cyan-400' : 'text-[#003B6F]'}`}>{task.type}</span>
                        </div>
                        <h3 className={`font-bold text-sm leading-snug ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{task.title}</h3>
                        <p className={`text-xs mt-2 leading-relaxed line-clamp-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{task.description}</p>
                      </div>
                    </div>

                    <div className={`mt-5 pt-4 border-t space-y-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                      
                      <div className={`p-2.5 rounded-xl border text-[11px] space-y-1 shadow-inner ${
                        isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex justify-between">
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Responsable:</span>
                          <strong className={isDarkMode ? 'text-cyan-300' : 'text-[#003B6F]'}>{task.assignedTo}</strong>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Vencimiento:</span>
                          <span className="text-rose-500 font-semibold">{task.dueDate}</span>
                        </div>
                        <div className={`text-[10px] pt-1 border-t truncate ${isDarkMode ? 'text-slate-500 border-slate-800' : 'text-slate-400 border-slate-200'}`}>
                          {task.auditTrail}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleTaskStatus(task.id, task.status)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1 ${
                            task.status === 'Completado' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' :
                            task.status === 'En Proceso' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                            'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                          }`}
                        >
                          <span>{task.status}</span>
                        </button>

                        <div className="flex items-center space-x-1.5">
                          {canEditTask && (
                            <button
                              onClick={() => {
                                setSelectedTaskForEdit(task);
                                setIsEditTaskModalOpen(true);
                              }}
                              className={`text-xs px-2.5 py-1.5 rounded-lg transition flex items-center space-x-1 border shadow-2xs ${
                                isDarkMode 
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                              }`}
                              title="Editar / Reasignar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canDeleteTask && (
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-xs px-2.5 py-1.5 rounded-lg transition flex items-center space-x-1 border bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/30 shadow-2xs"
                              title="Eliminar evento (Admin y Superintendente)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                    </div>

                  </div>
                );
              })}
            </div>

            {filteredTasks.length === 0 && (
              <div className={`border rounded-2xl p-12 text-center shadow-2xs ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
              }`}>
                <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                <p className="font-medium text-sm">No hay pendientes registrados en esta vista.</p>
              </div>
            )}

          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className={`border p-6 rounded-2xl space-y-4 shadow-2xs transition-colors duration-200 ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div>
                <h2 className={`text-base sm:text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Historial de Trazabilidad y Asignaciones Puerto</h2>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Registro detallado en tiempo real de qué jefatura, admin o superintendencia asignó las tareas y qué supervisores las registraron por guardia.</p>
              </div>

              <div className="space-y-3">
                {tasks.map(t => (
                  <div key={t.id} className={`border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                    isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded font-bold border ${
                          isDarkMode ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800' : 'bg-[#003B6F]/8 text-[#003B6F] border-[#003B6F]/20'
                        }`}>
                          {t.guard} &bull; {t.type}
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Creado el {t.createdAt} (Límite: {t.dueDate})</span>
                      </div>
                      <h4 className={`font-bold text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.title}</h4>
                      <p className={`text-xs font-mono px-2.5 py-1 rounded border inline-block shadow-2xs ${
                        isDarkMode ? 'bg-slate-900 text-slate-300 border-slate-800' : 'bg-white text-slate-600 border-slate-200'
                      }`}>
                        Audit: {t.auditTrail}
                      </p>
                    </div>

                    <div className="text-right flex items-center space-x-3">
                      <div>
                        <span className={`text-[11px] block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Responsable Actual:</span>
                        <strong className={`text-xs ${isDarkMode ? 'text-cyan-300' : 'text-[#003B6F]'}`}>{t.assignedTo}</strong>
                      </div>
                      {currentUser && (currentUser.username === 'fespinoza' || currentUser.role === 'superintendente') && (
                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/30"
                          title="Eliminar evento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className={`border-t py-4 px-6 text-center text-xs transition-colors duration-200 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        MARCOBRE PUERTO &bull; Sistema Online en Tiempo Real &bull; Admin: Flavio Espinoza
      </footer>

      {/* MODAL: NOTIFICATIONS */}
      {isNotificationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-2">
                <Bell className={`w-5 h-5 ${isDarkMode ? 'text-cyan-400' : 'text-[#003B6F]'}`} />
                <h3 className="font-bold text-base">Centro de Alertas y Notificaciones</h3>
              </div>
              <button onClick={() => setIsNotificationModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {activeNotifications.length > 0 ? (
                activeNotifications.map(notif => (
                  <div key={notif.id} className={`border p-3.5 rounded-xl space-y-1.5 shadow-2xs ${
                    isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/30 px-2 py-0.5 rounded font-bold uppercase">
                        Vence: {notif.dueDate}
                      </span>
                      <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-cyan-400' : 'text-[#003B6F]'}`}>Frecuencia: {notif.remindFrequency}</span>
                    </div>
                    <h4 className="font-bold text-xs">{notif.title}</h4>
                    <p className={`text-[11px] line-clamp-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{notif.description}</p>
                    <div className={`text-[10px] pt-1 border-t flex justify-between ${isDarkMode ? 'text-slate-400 border-slate-800' : 'text-slate-500 border-slate-200'}`}>
                      <span>Responsable: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{notif.assignedTo}</strong></span>
                      <span>Guardia: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{notif.guard}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p>No hay alertas pendientes según la frecuencia configurada.</p>
                </div>
              )}
            </div>

            <div className={`flex justify-end pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                onClick={() => setIsNotificationModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition border shadow-2xs ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREDENTIALS MANAGER (STRICTLY FLAVIO ESPINOZA EXCLUSIVE) */}
      {isUsersManagementModalOpen && currentUser?.username?.toLowerCase() === 'fespinoza' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-2">
                <Key className={`w-5 h-5 ${isDarkMode ? 'text-cyan-400' : 'text-[#003B6F]'}`} />
                <h3 className="font-bold text-base">Directorio y Gestión de Credenciales en la Nube (Administrador: Flavio Espinoza)</h3>
              </div>
              <button onClick={() => setIsUsersManagementModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Hola Flavio. Cualquier cambio de contraseña que hagas aquí se actualizará de inmediato en la nube para todos los supervisores. Haz clic fuera del campo para guardar automáticamente.
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {usersList.map(u => (
                <div key={u.id} className={`border p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                  isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                        u.role === 'admin' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                        u.role === 'superintendente' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' :
                        u.role === 'jefe' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                        'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                      }`}>
                        {u.role === 'admin' ? 'Administrador' : u.role === 'superintendente' ? 'Superintendente' : u.role === 'jefe' ? 'Jefe de Operaciones' : `${u.guard} - Supervisor`}
                      </span>
                      <span className={`text-xs font-mono font-semibold ${isDarkMode ? 'text-cyan-400' : 'text-[#003B6F]'}`}>@{u.username}</span>
                    </div>
                    <h4 className="font-bold text-xs">{u.name}</h4>
                    <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{u.spec}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <input 
                        type="text"
                        defaultValue={u.password || '123'}
                        onBlur={(e) => handleUpdateUserPassword(u.id, e.target.value)}
                        className={`w-28 border rounded-lg px-2 py-1.5 text-xs font-mono font-bold shadow-inner ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-cyan-300' : 'bg-white border-slate-300 text-[#003B6F]'
                        }`}
                        title="Edita y haz clic fuera para guardar la nueva contraseña en la nube"
                      />
                    </div>
                    <span className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>(Online)</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={`flex justify-end pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <button
                onClick={() => setIsUsersManagementModalOpen(false)}
                className="bg-[#003B6F] hover:bg-[#002D56] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs"
              >
                Cerrar Directorio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOGIN WITH MANUAL TYPING (NO OPTIONS, BLANK FIELDS) */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-2">
                <Lock className={`w-5 h-5 ${isDarkMode ? 'text-cyan-400' : 'text-[#003B6F]'}`} />
                <h3 className="font-bold text-base">Iniciar Sesión &bull; Puerto Marcobre Online</h3>
              </div>
              {currentUser && (
                <button onClick={() => setIsLoginModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Usuario *</label>
                <input 
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Ingrese su usuario (ej: cnanfuñay, fespinoza)"
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none shadow-inner font-mono ${
                    isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#003B6F]'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Contraseña *</label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Ingrese su contraseña"
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none shadow-inner pr-10 font-mono ${
                      isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#003B6F]'
                    }`}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className={`text-[10px] mt-1 block ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Escriba su usuario exacto. La contraseña distingue mayúsculas y minúsculas.</span>
              </div>

              {loginError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 p-2.5 rounded-xl text-xs font-semibold">
                  {loginError}
                </div>
              )}

              <div className={`flex items-center justify-end pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center space-x-2">
                  {currentUser && (
                    <button
                      type="button"
                      onClick={() => setIsLoginModalOpen(false)}
                      className={`px-4 py-2 rounded-xl font-medium transition border shadow-2xs ${
                        isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                      }`}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-[#003B6F] hover:bg-[#002D56] text-white px-5 py-2 rounded-xl font-bold transition shadow-xs"
                  >
                    Ingresar al Turno Online
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW TASK */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center p-4 overflow-y-auto">
          <div className={`border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className="font-bold text-base">Registrar Nuevo Pendiente / Reunión / Compra</h3>
              <button onClick={() => setIsNewTaskModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Título del Pendiente / Reunión *</label>
                <input 
                  type="text"
                  required
                  placeholder="Ej: Reunión por falla en bomba de ácido en muelle"
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none shadow-inner ${
                    isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#003B6F]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Categoría</label>
                  <select
                    value={newTask.type}
                    onChange={(e) => setNewTask({...newTask, type: e.target.value})}
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none shadow-inner ${
                      isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#003B6F]'
                    }`}
                  >
                    <option value="Mantenimiento / Instalaciones">Mantenimiento / Instalaciones (ej. cerradura)</option>
                    <option value="Compra de equipo/repuesto">Compra de equipo / repuesto</option>
                    <option value="Reunión">Reunión de coordinación</option>
                    <option value="Observación de Seguridad">Observación de Seguridad (SST)</option>
                    <option value="Informe / Justificación Gerencia">Informe / Justificación a Superintendencia</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Prioridad</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none shadow-inner ${
                      isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#003B6F]'
                    }`}
                  >
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Asignación</label>
                  <select
                    value={newTask.assignedTo}
                    onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none shadow-inner ${
                      isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#003B6F]'
                    }`}
                  >
                    {currentUser?.role === 'supervisor' ? (
                      <>
                        <option value="Personal (Solo yo)">Personal (Solo para mí - {currentUser.name})</option>
                        <option value={`General / Rotativo (${currentUser.guard})`}>General para mi Guardia ({currentUser.guard})</option>
                      </>
                    ) : (
                      <>
                        <option value="General / Rotativo">General / Rotativo para Turno</option>
                        <optgroup label="Asignar a Supervisor Específico">
                          {usersList.filter(u => u.role === 'supervisor').map(s => (
                            <option key={s.id} value={s.name}>{s.name} ({s.guard} - {s.spec})</option>
                          ))}
                        </optgroup>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Fecha Límite / Vencimiento</label>
                  <input 
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none shadow-inner ${
                      isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#003B6F]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Frecuencia de Notificación / Recordatorio</label>
                <select
                  value={newTask.remindFrequency}
                  onChange={(e) => setNewTask({...newTask, remindFrequency: e.target.value})}
                  className={`w-full border rounded-xl px-3 py-2.5 font-bold focus:outline-none text-xs shadow-inner ${
                    isDarkMode ? 'bg-slate-950 border-slate-700 text-cyan-400 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-[#003B6F] focus:border-[#003B6F]'
                  }`}
                >
                  <option value="Diaria">Diaria (recordar todos los días hasta vencer)</option>
                  <option value="2 días antes">2 días antes del vencimiento</option>
                  <option value="3 días antes">3 días antes del vencimiento</option>
                  <option value="Semanal">Semanal (una vez a la semana)</option>
                </select>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Descripción y Detalles del Pendiente</label>
                <textarea 
                  rows="3"
                  placeholder="Detalles sobre la cerradura, puntos a tratar en la reunión, repuestos necesarios..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs resize-none focus:outline-none shadow-inner ${
                    isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#003B6F]'
                  }`}
                ></textarea>
              </div>

              <div className={`flex items-center justify-end space-x-3 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className={`px-4 py-2 rounded-xl font-medium transition border shadow-2xs ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#003B6F] hover:bg-[#002D56] text-white px-5 py-2 rounded-xl font-bold transition shadow-xs"
                >
                  Guardar en la Nube
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TASK */}
      {isEditTaskModalOpen && selectedTaskForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center p-4 overflow-y-auto">
          <div className={`border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className="font-bold text-base">
                {currentUser?.role === 'supervisor' ? 'Editar Mi Pendiente (Frecuencia, Detalles, Estado)' : 'Editar y Reasignar Pendiente (Jefatura)'}
              </h3>
              <button onClick={() => setIsEditTaskModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-4 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Título del Pendiente</label>
                <input 
                  type="text"
                  required
                  value={selectedTaskForEdit.title}
                  onChange={(e) => setSelectedTaskForEdit({...selectedTaskForEdit, title: e.target.value})}
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none shadow-inner ${
                    isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#003B6F]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Responsable / Asignación</label>
                  {currentUser?.role === 'supervisor' ? (
                    <input 
                      type="text"
                      disabled
                      value={selectedTaskForEdit.assignedTo}
                      className={`w-full border rounded-xl px-3 py-2.5 text-xs cursor-not-allowed ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    />
                  ) : (
                    <select
                      value={selectedTaskForEdit.assignedTo}
                      onChange={(e) => setSelectedTaskForEdit({...selectedTaskForEdit, assignedTo: e.target.value})}
                      className={`w-full border rounded-xl px-3 py-2.5 font-bold focus:outline-none text-xs shadow-inner ${
                        isDarkMode ? 'bg-slate-950 border-slate-700 text-cyan-400 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-[#003B6F] focus:border-[#003B6F]'
                      }`}
                    >
                      <option value="General / Rotativo">General para la Guardia (Rotativo)</option>
                      {usersList.filter(u => u.role === 'supervisor').map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.guard} - {s.spec})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Estado</label>
                  <select
                    value={selectedTaskForEdit.status}
                    onChange={(e) => setSelectedTaskForEdit({...selectedTaskForEdit, status: e.target.value})}
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none shadow-inner ${
                      isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#003B6F]'
                    }`}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Completado">Completado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Frecuencia de Notificación</label>
                <select
                  value={selectedTaskForEdit.remindFrequency || 'Diaria'}
                  onChange={(e) => setSelectedTaskForEdit({...selectedTaskForEdit, remindFrequency: e.target.value})}
                  className={`w-full border rounded-xl px-3 py-2.5 font-bold focus:outline-none text-xs shadow-inner ${
                    isDarkMode ? 'bg-slate-950 border-slate-700 text-cyan-400 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-[#003B6F] focus:border-[#003B6F]'
                  }`}
                >
                  <option value="Diaria">Diaria</option>
                  <option value="2 días antes">2 días antes del vencimiento</option>
                  <option value="3 días antes">3 días antes del vencimiento</option>
                  <option value="Semanal">Semanal</option>
                </select>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Descripción</label>
                <textarea 
                  rows="3"
                  value={selectedTaskForEdit.description}
                  onChange={(e) => setSelectedTaskForEdit({...selectedTaskForEdit, description: e.target.value})}
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-xs resize-none focus:outline-none shadow-inner ${
                    isDarkMode ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500' : 'bg-slate-50 border-slate-300 text-slate-800 focus:border-[#003B6F]'
                  }`}
                ></textarea>
              </div>

              <div className={`p-3 rounded-xl border text-[11px] shadow-inner ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <span className={`font-bold block mb-0.5 ${isDarkMode ? 'text-cyan-400' : 'text-[#003B6F]'}`}>Sincronización Cloud:</span>
                Los cambios se guardarán de inmediato en la base de datos para todos los supervisores. Actualizado por <strong>{currentUser?.name}</strong>.
              </div>

              <div className={`flex items-center justify-end space-x-3 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsEditTaskModalOpen(false)}
                  className={`px-4 py-2 rounded-xl font-medium transition border shadow-2xs ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#003B6F] hover:bg-[#002D56] text-white px-5 py-2 rounded-xl font-bold transition shadow-xs"
                >
                  Guardar Cambios en la Nube
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
