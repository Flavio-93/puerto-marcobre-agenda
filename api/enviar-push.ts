import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || 'BHpJ5IXGx8XmYSCGdcGAxeW2cBM0WO7vIA8RuEu_pUoy1xLjkMo1HCAROwvHxruUp8pk5wPHT_VifluEzDa-PW4';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'CYv1o9VW0rleaMGmW_iVaJv6aws8WsC9QshMu3ynjJI';
const VAPID_SUBJECT = 'mailto:operaciones@marcobre.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uaqfaqdbejdnonulozad.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_iDmuy5vGWPF1a6vqellmHw_Kha-2reP';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { asignado_a_id, titulo, creador_nombre, mensaje, tag } = req.body || {};

    if (!asignado_a_id) {
      return res.status(400).json({ error: 'Falta asignado_a_id' });
    }

    // 1. Obtener todas las suscripciones Push registradas para este supervisor
    const { data: subs, error: errSubs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('usuario_id', asignado_a_id);

    if (errSubs || !subs || subs.length === 0) {
      return res.status(200).json({ success: true, count: 0, message: 'Usuario no tiene suscripciones push activas' });
    }

    // 2. Construir el paquete de notificación con vibración y sonido
    const payload = JSON.stringify({
      title: '⚓ Puerto Marcobre - Tarea Asignada',
      body: mensaje || (creador_nombre ? `${creador_nombre} te ha asignado: "${titulo}"` : `Nueva tarea asignada: "${titulo}"`),
      tag: tag || 'alerta-marcobre',
      data: {
        url: '/'
      }
    });

    // 3. Enviar a los servidores Push de Google (FCM / Android) y Apple (APNs / iPhone)
    const envios = await Promise.allSettled(
      subs.map(async (s: any) => {
        const pushSubscription = {
          endpoint: s.endpoint,
          keys: {
            p256dh: s.p256dh,
            auth: s.auth,
          },
        };
        return webpush.sendNotification(pushSubscription, payload, {
          TTL: 60 * 60 * 24, // 24 horas de vigencia
          urgency: 'high',
        });
      })
    );

    console.log(`Enviados ${envios.length} pushes para el usuario ${asignado_a_id}`);

    return res.status(200).json({
      success: true,
      enviados: envios.length,
      detalles: envios.map((r: any) => r.status)
    });
  } catch (err: any) {
    console.error('Error enviando push:', err);
    return res.status(500).json({ error: err.message || 'Error interno enviando push' });
  }
}
