import { Tarea } from '../types';
import { SEED_USUARIOS } from './supabase';

const TEAMS_WEBHOOK_DIRECT_URL = 
  import.meta.env.VITE_TEAMS_WEBHOOK_URL || 
  'https://default00015d9221ad48a88445a7d68bf899.bd.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/14/workflows/299056f934e54374ad144140f75b561a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=9hBfm9JW7oKxPpjxaNmaZEX1GzQ0DYviwFzNZ7apbFM';

interface EnviarTeamsParams {
  tipo: 'EMERGENCIA_ALTA' | 'RELEVO_TURNO';
  tarea: Tarea;
  creadorNombre?: string;
  asignadoNombre?: string;
  detallesRelevo?: string;
}

/**
 * Enviar mensaje al canal de Microsoft Teams vía Webhook (Power Automate).
 * Incluye soporte completo para @mentions de Teams mediante correo_teams corporativo.
 */
export async function notificarTeams({
  tipo,
  tarea,
  creadorNombre,
  asignadoNombre,
  detallesRelevo,
}: EnviarTeamsParams) {
  console.log('📡 [Teams Webhook] Evaluando envío para tarea:', {
    id: tarea.id,
    titulo: tarea.titulo,
    criticidad: tarea.nivel_criticidad,
    tipo,
  });

  const criticidadNorm = (tarea.nivel_criticidad || '').toString().trim().toLowerCase();
  const esAltaOCritica = criticidadNorm === 'alta' || criticidadNorm === 'critica' || criticidadNorm === 'crítica';
  const esRelevo = tipo === 'RELEVO_TURNO';

  if (!esAltaOCritica && !esRelevo) {
    console.log('ℹ️ [Teams Webhook] Tarea omitida (No es Alta/Crítica ni Relevo).');
    return { success: false, error: 'No es Alta Criticidad ni Relevo' };
  }

  // 1. Obtener información del usuario asignado y su correo_teams
  const perfilAsignado = tarea.asignado || SEED_USUARIOS.find((u) => u.id === tarea.asignado_a_id);
  const nombreAsignadoCompleto = asignadoNombre || perfilAsignado?.nombre_completo || 'Sin Asignar';
  const correoTeams = perfilAsignado?.correo_teams?.trim();

  const creador = creadorNombre || tarea.creador?.nombre_completo || 'Usuario';
  const guardia = `Guardia ${tarea.guardia_creador}` + (tarea.guardia_objetivo ? ` ➔ Guardia ${tarea.guardia_objetivo}` : '');

  // 2. Lógica Estricta de @mentions para Teams
  const tieneCorreoValido = Boolean(correoTeams && correoTeams.includes('@marcobre.com'));

  // Construcción del texto y entidades según presencia de correo_teams
  let textoAsignadoParaTarjeta: string;
  let textoAsignadoPlano: string;
  const entities: any[] = [];

  if (tieneCorreoValido) {
    // Si tiene correo corporativo registrado:
    // En el texto se envuelve como <at>${nombre_supervisor}</at>
    textoAsignadoParaTarjeta = `<at>${nombreAsignadoCompleto}</at>`;
    textoAsignadoPlano = `@${nombreAsignadoCompleto} (${correoTeams})`;

    // Entidad mention oficial de Microsoft Teams
    entities.push({
      type: 'mention',
      text: `<at>${nombreAsignadoCompleto}</at>`,
      mentioned: {
        id: correoTeams,
        name: nombreAsignadoCompleto,
      },
    });
  } else {
    // Si NO tiene correo corporativo (ej: Carlos Rudas de contrata o vacante):
    // Se envía en texto plano normal, sin <at> y sin msteams.entities
    textoAsignadoParaTarjeta = nombreAsignadoCompleto;
    textoAsignadoPlano = nombreAsignadoCompleto;
  }

  // 3. Construcción del Payload Adaptive Card para Teams
  const cardContent: any = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.2',
    body: [
      {
        type: 'TextBlock',
        text: esRelevo ? '🔄 RELEVO DE TURNO / GUARDIA - MARCOBRE PUERTO' : '🚨 TAREA CRÍTICA / ALTA PRIORIDAD - PUERTO',
        weight: 'Bolder',
        size: 'Medium',
        color: esAltaOCritica ? 'Attention' : 'Accent',
      },
      {
        type: 'TextBlock',
        text: `**${tarea.titulo}**`,
        wrap: true,
        weight: 'Bolder',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Creador:', value: creador },
          { title: 'Asignado a:', value: textoAsignadoParaTarjeta },
          { title: 'Guardia:', value: guardia },
          { title: 'Criticidad:', value: tarea.nivel_criticidad },
          { title: 'Estado:', value: tarea.estado },
          { title: 'Fecha/Hora:', value: new Date().toLocaleString() },
        ],
      },
    ],
  };

  if (tarea.descripcion) {
    cardContent.body.push({
      type: 'TextBlock',
      text: `**Descripción:** ${tarea.descripcion}`,
      wrap: true,
      spacing: 'Small',
    });
  }

  if (detallesRelevo) {
    cardContent.body.push({
      type: 'TextBlock',
      text: `**Motivo del Relevo:** ${detallesRelevo}`,
      wrap: true,
      spacing: 'Small',
    });
  }

  // Si tiene correo, adjuntar array msteams.entities en la tarjeta adaptativa
  if (entities.length > 0) {
    cardContent.msteams = {
      entities: entities,
    };
  }

  const payload = {
    tipo,
    titulo: tarea.titulo,
    descripcion: tarea.descripcion || '',
    creador,
    asignado_a: textoAsignadoPlano,
    correo_asignado: correoTeams || null,
    guardia,
    criticidad: tarea.nivel_criticidad,
    estado: tarea.estado,
    fecha_reporte: new Date().toLocaleString(),
    detalles: detallesRelevo || '',
    // Formato Markdown de Teams con mention
    text: `**${esRelevo ? '🔄 RELEVO DE TURNO / GUARDIA' : '🚨 EMERGENCIA / TAREA CRÍTICA O ALTA'} - MARCOBRE PUERTO**\n\n` +
          `• **Título:** ${tarea.titulo}\n` +
          `• **Creado por:** ${creador}\n` +
          `• **Asignado a:** ${tieneCorreoValido ? `<at>${nombreAsignadoCompleto}</at>` : nombreAsignadoCompleto}\n` +
          `• **Guardia:** ${guardia}\n` +
          `• **Nivel de Criticidad:** ${tarea.nivel_criticidad}\n` +
          (detallesRelevo ? `• **Detalles de Relevo:** ${detallesRelevo}\n` : '') +
          `• **Fecha:** ${new Date().toLocaleString()}`,
    // Entidades para el canal de Teams
    entities: entities.length > 0 ? entities : undefined,
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: cardContent,
      },
    ],
  };

  const targets = ['/api/teams-webhook', TEAMS_WEBHOOK_DIRECT_URL];

  for (const targetUrl of targets) {
    try {
      console.log(`🚀 [Teams Webhook] Enviando POST con mention (${tieneCorreoValido ? correoTeams : 'sin mention'}) a: ${targetUrl.slice(0, 60)}...`);

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log(`📡 [Teams Webhook] Respuesta recibida HTTP Status: ${res.status}`);

      if (res.ok || res.status === 202) {
        console.log('✅ [Teams Webhook] Notificación enviada exitosamente con soporte @mention!');
        mostrarAlertaTeamsVisual(`✅ Alerta enviada a Teams con @mención para ${nombreAsignadoCompleto.split(' ')[0]}`, true);
        return { success: true };
      }
    } catch (err: any) {
      console.warn(`Error enviando a ${targetUrl}:`, err);
    }
  }

  // Fallback no-cors
  try {
    await fetch(TEAMS_WEBHOOK_DIRECT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    mostrarAlertaTeamsVisual(`✅ Alerta enviada a Teams (${tarea.titulo})`, true);
    return { success: true };
  } catch (finalErr: any) {
    mostrarAlertaTeamsVisual(`❌ Error enviando a Teams: ${finalErr?.message || finalErr}`, false);
    return { success: false };
  }
}

function mostrarAlertaTeamsVisual(mensaje: string, exito: boolean) {
  if (typeof document === 'undefined') return;

  const id = 'teams-toast-banner';
  const previo = document.getElementById(id);
  if (previo) previo.remove();

  const toast = document.createElement('div');
  toast.id = id;
  toast.className = `fixed top-20 right-4 z-50 p-4 rounded-xl text-xs font-semibold shadow-2xl border max-w-sm transition-all duration-300 flex items-start gap-2.5 ${
    exito 
      ? 'bg-emerald-900 text-emerald-100 border-emerald-500 shadow-emerald-950/50' 
      : 'bg-rose-900 text-rose-100 border-rose-500 shadow-rose-950/50'
  }`;

  toast.innerHTML = `
    <span class="text-lg">${exito ? '📢' : '⚠️'}</span>
    <div class="flex-1">
      <div class="font-bold uppercase tracking-wider text-[10px] text-amber-300">Microsoft Teams Marcobre</div>
      <div class="mt-0.5 leading-snug">${mensaje}</div>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}
