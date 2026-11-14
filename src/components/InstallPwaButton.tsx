import React, { useState, useEffect } from 'react';
import { Download, Share2, X, Smartphone, CheckCircle } from 'lucide-react';

export const InstallPwaButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [esIos, setEsIos] = useState(false);
  const [yaInstalado, setYaInstalado] = useState(false);
  const [modalIosVisible, setModalIosVisible] = useState(false);

  useEffect(() => {
    // 1. Detección de iOS (iPhone / iPad / iPod)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setEsIos(isIosDevice);

    // 2. Verificar si ya se está ejecutando como PWA instalada (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) {
      setYaInstalado(true);
    }

    // 3. Capturar evento de instalación nativa para Android / Chrome / Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('📱 [PWA] Evento beforeinstallprompt capturado listo para el botón.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Escuchar cuando el usuario completa la instalación
    window.addEventListener('appinstalled', () => {
      setYaInstalado(true);
      setDeferredPrompt(null);
      console.log('🎉 [PWA] Aplicación instalada con éxito en el dispositivo!');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (esIos) {
      // En Apple iOS / Safari mostramos el modal instructivo
      setModalIosVisible(true);
      return;
    }

    if (deferredPrompt) {
      // Disparar el aviso nativo de instalación de Android
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] Elección del usuario: ${outcome}`);
      if (outcome === 'accepted') {
        setYaInstalado(true);
      }
      setDeferredPrompt(null);
    } else {
      // Si el navegador de Android aún no emitió el prompt o es otro navegador compatible
      alert('Para instalar en tu celular: Abre el menú de opciones de tu navegador (los 3 puntos arriba a la derecha) y selecciona "Instalar aplicación" o "Agregar a pantalla principal".');
    }
  };

  // Si ya está abierta en modo app nativa instalada, no mostramos el botón
  if (yaInstalado) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition active:scale-95 border border-emerald-400/30"
        title="Instalar Marcobre Puerto en tu celular"
      >
        <Download className="w-4 h-4 animate-bounce" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">Instalar</span>
      </button>

      {/* Modal Instructivo para Apple (iOS / Safari) */}
      {modalIosVisible && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#2b5c8f] dark:text-blue-400" />
                <h3 className="font-extrabold text-sm text-[#2b5c8f] dark:text-blue-400">
                  Instalar en iPhone / iPad
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalIosVisible(false)}
                className="text-slate-400 hover:text-slate-600 p-1 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Apple no permite la instalación automática con un solo clic. Sigue estos 2 sencillos pasos en Safari:
            </p>

            <div className="space-y-3 mb-5 text-xs">
              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="w-6 h-6 rounded-full bg-[#2b5c8f] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </span>
                <div>
                  <div className="font-bold flex items-center gap-1 text-slate-900 dark:text-white">
                    <span>Toca el icono</span>
                    <Share2 className="w-3.5 h-3.5 text-[#2b5c8f] inline" />
                    <span className="underline font-bold">Compartir</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    (Se encuentra en la barra inferior de Safari).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="w-6 h-6 rounded-full bg-[#2b5c8f] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </span>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    Selecciona <span className="underline text-[#2b5c8f] dark:text-blue-400">"Agregar a inicio"</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Se creará el icono de Marcobre en tu pantalla principal como una app nativa.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalIosVisible(false)}
              className="w-full py-2.5 bg-[#2b5c8f] hover:bg-[#1e4570] text-white text-xs font-bold rounded-xl shadow transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

