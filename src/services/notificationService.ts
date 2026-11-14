import { supabase, isSupabaseConfigured } from './supabase';

// Generador de alarma sonora industrial sintetizada mediante Web Audio API (compatible con cualquier móvil/navegador sin requerir archivos mp3 externos)
export function reproducirAlarmaSonoraPersonal() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    
    // Tono de alerta característico portuario (beeps de atención 880Hz / 440Hz)
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    osc.frequency.setValueAtTime(440, ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    console.warn('Audio no permitido antes de interacción:', e);
  }
}

// Registrar suscripción Push en la base de datos vinculada al usuario_id
export async function registrarSuscripcionPush(usuarioId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      // Clave pública VAPID (o fallback demo)
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (vapidKey) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });
      }
    }

    if (sub && isSupabaseConfigured) {
      const subJSON = sub.toJSON();
      await supabase.from('push_subscriptions').upsert({
        usuario_id: usuarioId,
        endpoint: sub.endpoint,
        p256dh: subJSON.keys?.p256dh,
        auth: subJSON.keys?.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });
    }

    return { supported: true, subscription: sub };
  } catch (err) {
    console.warn('Error registrando Push:', err);
    return { supported: true, error: err };
  }
}

