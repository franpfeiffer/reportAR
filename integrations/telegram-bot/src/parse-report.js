// Esta función también se incorpora al nodo Code de n8n.
function parseUpdate(update) {
  const m = update.message;
  if (!m || m.chat?.type !== 'private' || m.from?.is_bot) return { action: 'ignore' };
  const template = 'Categoría: [tipo de problema]\nDescripción: [contá qué pasa y qué riesgo o impacto tiene]\nDirección: [calle, altura o esquina y localidad]';
  const help = [
    '👋 ¡Hola! Soy el asistente de reportes de tu barrio.',
    '📋 En el siguiente mensaje te dejo una plantilla. Copiala, reemplazá lo que está entre corchetes y enviámela completa en un solo mensaje.',
    '🏷 Categoría: elegí bache, inundacion, alumbrado, basura, arbolado u otro.',
    '✍️ Descripción: contá qué pasa y qué riesgo o impacto tiene. Aclarar si hay peligro inmediato, daños en curso, tránsito o acceso bloqueado, o un servicio esencial interrumpido ayuda a priorizar la reparación.',
    '📍 Dirección: indicá calle, altura o esquina y localidad para ubicar el problema.',
    '📷 Podés adjuntar UNA foto y pegar la plantilla completa en su descripción. Con foto, usá hasta 1024 caracteres en total.',
    'Podés pedirme otra plantilla con /reportar o /plantilla.',
    'Los reclamos válidos se guardan en ReportAR. Si adjuntás una foto al mismo mensaje, ReportAR intentará guardarla y mostrarla en el seguimiento. Para estimar la urgencia de la reparación se envían a TypeSafe/JEV solo la descripción y la categoría; no se envían dirección, foto ni identificadores. La urgencia dudosa se revisa en el municipio. No se confirma envío al municipio. Los mensajes pueden quedar en el historial de n8n. Este canal no atiende emergencias.'
  ].join('\n\n');
  const base = { chat_id: String(m.chat.id) };
  const guide = reply => ({ ...base, action: 'reply', reply, template });
  if (m.media_group_id) return guide('📷 Por ahora no se admiten álbumes. Enviá una sola foto y completá la plantilla en su descripción.');
  if (m.document) return guide('📷 Por ahora solo se aceptan fotos adjuntas como foto, no como archivo. Enviá una sola foto con la plantilla completa en su descripción.');
  const text = (m.text || m.caption || '').trim();
  if (m.photo?.length && !m.caption?.trim()) return guide('📷 Para adjuntar una foto, escribí el reclamo completo en la descripción de la foto y enviá todo en un solo mensaje. También podés mandar el reclamo sin foto.');
  if (m.photo?.length && text.length > 1024) return guide('📷 El texto de una foto supera el límite de Telegram (1024 caracteres). Acortá la descripción o enviá el reclamo sin foto; no se recortó ningún dato.');
  if (/^\/(start|help|ayuda|reportar|plantilla)(?:@\w+)?(?:\s|$)/i.test(text) || /^(hola|buenas|buen dia|buen día)[!.\s]*$/i.test(text)) return guide(help);
  // Leer campos línea por línea permite espacios, líneas vacías, emojis y otro orden.
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const fields = {};
  let current;
  let duplicate = false;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const clean = line.trim().replace(/^[^\p{L}\p{N}]+/u, '');
    const header = clean.match(/^(categor[ií]a|descripci[oó]n|direcci[oó]n)\s*[:：]\s*(.*)$/i);
    if (header) {
      current = normalize(header[1]);
      if (Object.hasOwn(fields, current)) duplicate = true;
      fields[current] = header[2];
    } else if (current && line.trim()) fields[current] += '\n' + line.trim();
  }
  const unbox = value => value.trim().replace(/^\[([\s\S]*)\]$/, '$1').trim();
  const parts = Object.keys(fields).length
    ? ['categoria', 'descripcion', 'direccion'].map(key => unbox(fields[key] || ''))
    : text.split('|').map(unbox);
  const aliases = { baches: 'bache', inundaciones: 'inundacion', arbolados: 'arbolado', otros: 'otro' };
  const rawCategory = normalize(parts[0] || '');
  const category = aliases[rawCategory] || rawCategory;
  const errors = [];
  if (duplicate) errors.push('Hay campos repetidos: dejá una sola categoría, descripción y dirección.');
  if (parts.length !== 3 || !['bache', 'inundacion', 'alumbrado', 'basura', 'arbolado', 'otro'].includes(category)) errors.push('Categoría: elegí bache, inundacion, alumbrado, basura, arbolado u otro.');
  if (!parts[1] || parts[1].length < 10 || parts[1].length > 2000 || ['contá qué está pasando', 'contá qué pasa y qué riesgo o impacto tiene'].includes(parts[1])) errors.push('Descripción: escribí entre 10 y 2000 caracteres contando qué pasa.');
  if (!parts[2] || parts[2].length < 5 || parts[2].length > 300 || ['calle, altura o esquina y localidad', 'dirección'].includes(parts[2])) errors.push('Dirección: escribí entre 5 y 300 caracteres con calle, altura o esquina y localidad.');
  if (errors.length) return guide('📝 Falta ajustar estos datos:\n\n' + errors.map(error => '• ' + error).join('\n') + '\n\nCompletá la plantilla del siguiente mensaje y enviámela entera.');
  return { ...base, action: 'create', report: {
    source: 'telegram', external_id: `telegram:${m.chat.id}:${m.message_id}`,
    category, description: parts[1], address: parts[2],
    reporter: { telegram_user_id: String(m.from.id), telegram_chat_id: String(m.chat.id) },
    photo: m.photo?.length ? { telegram_file_id: m.photo[m.photo.length - 1].file_id } : null,
    reported_at: new Date(m.date * 1000).toISOString()
  } };
}
module.exports = { parseUpdate };
