import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';
import webpush from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || 'BHpJ5IXGx8XmYSCGdcGAxeW2cBM0WO7vIA8RuEu_pUoy1xLjkMo1HCAROwvHxruUp8pk5wPHT_VifluEzDa-PW4';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'CYv1o9VW0rleaMGmW_iVaJv6aws8WsC9QshMu3ynjJI';
const VAPID_SUBJECT = 'mailto:operaciones@marcobre.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const payload = await req.json();
    console.log('Evento recibido en Edge Function:', payload);

    // Conectar a Supabase con la service role key o anon
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://uaqfaqdbejdnonulozad.supabase.co';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const record = payload.record || payload;
    const asignadoId = record.asignado_a_id;
    const titulo = record.titulo || 'Nueva actividad';

    if (!asignadoId) {
      return new Response(JSON.stringify({ message: 'Sin asignado' }), { status: 200 });
    }

    // Buscar suscripciones push del usuario asignado
    const { data: subs, error: errSubs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('usuario_id', asignadoId);

    if (errSubs || !subs || subs.length === 0) {
      console.log('No hay suscripciones para el usuario:', asignadoId);
      return new Response(JSON.stringify({ message: 'Usuario no suscrito a push' }), { status: 200 });
    }

    const notificacionContenido = JSON.stringify({
      title: '⚓ Puerto Marcobre - Tarea Asignada',
      body: `Se te ha asignado la tarea: "${titulo}"`,
      tag: record.id || 'alerta-tarea',
    });

    const resultados = await Promise.allSettled(
      subs.map((s) => {
        const pushSubscription = {
          endpoint: s.endpoint,
          keys: {
            p256dh: s.p256dh,
            auth: s.auth,
          },
        };
        return webpush.sendNotification(pushSubscription, notificacionContenido);
      })
    );

    console.log('Resultados de envíos:', resultados);

    return new Response(JSON.stringify({ success: true, count: subs.length }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error enviando push:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
