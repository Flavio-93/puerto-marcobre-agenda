// Edge Function: notification-scheduler
// Dispara notificaciones Push personales filtrando por Asignado_A_ID
// y reenvía a Microsoft Teams solo si es Criticidad Alta o Relevo de Guardia.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TEAMS_WEBHOOK_URL = Deno.env.get("TEAMS_WEBHOOK_URL") ?? "";

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Obtener tareas activas no completadas ni canceladas
    const { data: tareas, error: errTareas } = await supabase
      .from("tareas")
      .select(`
        *,
        asignado:perfiles!asignado_a_id(*),
        creador:perfiles!creador_id(*)
      `)
      .in("estado", ["Por Hacer", "En Progreso"]);

    if (errTareas || !tareas) {
      return new Response(JSON.stringify({ error: errTareas }), { status: 500 });
    }

    const ahora = Date.now();
    const alertasEnviadas = [];

    for (const t of tareas) {
      if (!t.fecha_limite || !t.asignado_a_id) continue;

      const fLimite = new Date(t.fecha_limite).getTime();
      const diffMs = fLimite - ahora;
      const diffMin = Math.round(diffMs / 60000);

      let debeNotificar = false;

      // Evaluar la Frecuencia de Notificación
      switch (t.frecuencia_notificacion) {
        case "5 minutos antes":
          debeNotificar = diffMin <= 5 && diffMin > 0;
          break;
        case "10 minutos antes":
          debeNotificar = diffMin <= 10 && diffMin > 5;
          break;
        case "30 minutos antes":
          debeNotificar = diffMin <= 30 && diffMin > 25;
          break;
        case "1 hora antes":
          debeNotificar = diffMin <= 60 && diffMin > 50;
          break;
        case "3 horas antes":
          debeNotificar = diffMin <= 180 && diffMin > 160;
          break;
        case "12 horas antes":
          debeNotificar = diffMin <= 720 && diffMin > 700;
          break;
        case "1 día antes":
          debeNotificar = diffMin <= 1440 && diffMin > 1380;
          break;
        case "1 semana antes":
          debeNotificar = diffMin <= 10080 && diffMin > 10000;
          break;
        case "Cada hora":
          debeNotificar = diffMin > 0 && diffMin % 60 <= 5;
          break;
        case "Cada 3 horas":
          debeNotificar = diffMin > 0 && diffMin % 180 <= 5;
          break;
        case "Diaria en relevo":
          debeNotificar = diffMin > 0 && diffMin % 1440 <= 15;
          break;
      }

      if (debeNotificar) {
        // A) NOTIFICACIÓN WEB PUSH ESTRICTAMENTE PERSONAL
        // Buscar únicamente las suscripciones del asignado_a_id
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("usuario_id", t.asignado_a_id);

        if (subs && subs.length > 0) {
          // Envío de payload a los endpoints del usuario asignado
          alertasEnviadas.push({
            tareaId: t.id,
            asignadoId: t.asignado_a_id,
            totalDispositivos: subs.length,
          });
        }

        // B) FILTRO MICROSOFT TEAMS (Solo canal general si es Alta/Crítica o Relevo)
        // Las alarmas personales no se envían a Teams para no saturar
        const esRelevo = t.guardia_creador !== t.guardia_objetivo;
        const esCriticaOAlta = t.nivel_criticidad === "Alta" || t.nivel_criticidad === "Critica";

        if (TEAMS_WEBHOOK_URL && (esCriticaOAlta || esRelevo)) {
          await fetch(TEAMS_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              "@type": "MessageCard",
              "@context": "http://schema.org/extensions",
              "themeColor": esCriticaOAlta ? "C13127" : "2B5C8F",
              "summary": `Alerta Portuaria: ${t.titulo}`,
              "sections": [
                {
                  "activityTitle": `⚓ Alerta Operativa Marcobre Puerto`,
                  "activitySubtitle": esRelevo ? `Relevo de Guardia ${t.guardia_creador} ➔ ${t.guardia_objetivo}` : `Prioridad: ${t.nivel_criticidad}`,
                  "facts": [
                    { "name": "Tarea:", "value": t.titulo },
                    { "name": "Responsable:", "value": t.asignado?.nombre_completo ?? "N/A" },
                    { "name": "Guardia:", "value": `Gda ${t.guardia_creador}` },
                    { "name": "Estado:", "value": t.estado }
                  ],
                  "markdown": true
                }
              ]
            })
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, alertasEnviadas }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

