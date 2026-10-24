// Funciones puras incorporadas también en los nodos Code del export de n8n.
function prepareForm(update) {
  const m = update.message;
  if (!m || m.chat?.type !== 'private' || m.from?.is_bot) return { action: 'ignore' };
  const chat_id = String(m.chat.id);
  return {
    action: 'form', chat_id,
    context: { chat_id, user_id: String(m.from.id), message_id: String(m.message_id), reported_at: new Date(m.date * 1000).toISOString() },
    welcome: '👋 ¡Hola! Podés reportar un problema en cualquier localidad de Argentina. Tocá «Completar reclamo»: elegí la provincia, escribí la localidad y completá los datos. La foto es opcional.\n\nAl enviar el formulario, volvé a este chat para recibir la confirmación y el número.',
  };
}

function prepareProvinces(response, prepared) {
  const provinces = response.statusCode === 200 && Array.isArray(response.body?.provinces)
    ? response.body.provinces.filter(p => p && typeof p.id === 'string' && /^\d{2}$/.test(p.id) && typeof p.name === 'string' && p.name.trim() && p.name.length <= 100).map(p => ({ id: p.id, name: p.name.trim() }))
    : [];
  if (!provinces.length) return {
    action: 'reply', chat_id: prepared.chat_id,
    reply: 'No pudimos cargar el listado de provincias de reportAR. Probá de nuevo con /reportar en unos minutos.',
    error_stage: 'provinces',
  };
  // Resolver las opciones ANTES de enviar el formulario. El editor de campos
  // no representa bien una expresión que sustituye el array interno de opciones.
  const form_fields = [
    { fieldLabel: 'Tipo de problema', fieldType: 'dropdown', fieldOptions: { values: ['Bache o vereda rota', 'Inundación', 'Alumbrado público', 'Basura o limpieza', 'Árboles y espacios verdes', 'Otro problema'].map(option => ({ option })) }, requiredField: true },
    { fieldLabel: 'Descripción', fieldType: 'textarea', placeholder: 'Entre 10 y 2000 caracteres. Contá qué pasa y qué riesgo o impacto tiene.', requiredField: true },
    { fieldLabel: 'Provincia', fieldType: 'dropdown', fieldOptions: { values: provinces.map(p => ({ option: p.name })) }, requiredField: true },
    { fieldLabel: 'Ciudad o localidad', fieldType: 'text', placeholder: 'Escribí el nombre completo de la localidad de la provincia elegida.', requiredField: true },
    { fieldLabel: 'Calle y altura', fieldType: 'text', placeholder: 'Calle, altura o esquina. Ej.: Córdoba 1900.', requiredField: true },
    { fieldLabel: 'Foto', fieldType: 'file', multipleFiles: false, requiredField: false },
  ];
  return { ...prepared, provinces, form_fields };
}

function parseFormResponse(response, context, provinces, binary = {}) {
  const base = { chat_id: context.chat_id };
  const data = response.data;
  if (!data || typeof data !== 'object') return {
    ...base, action: 'reply', reply: 'El formulario venció o no se recibió una respuesta. Escribí /reportar para abrir uno nuevo.',
  };
  const field = key => typeof data[key] === 'string' ? data[key].trim() : '';
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const categories = {
    'Bache o vereda rota': 'bache', 'Inundación': 'inundacion', 'Alumbrado público': 'alumbrado',
    'Basura o limpieza': 'basura', 'Árboles y espacios verdes': 'arbolado', 'Otro problema': 'otro',
  };
  const category = Object.hasOwn(categories, field('Tipo de problema')) ? categories[field('Tipo de problema')] : '';
  const description = field('Descripción');
  const street = field('Calle y altura');
  const city = field('Ciudad o localidad');
  const province = provinces.find(p => normalize(p.name) === normalize(field('Provincia')));
  const photoKeys = Object.keys(binary).filter(key => /^Foto(?:_\d+)?$/.test(key));
  const errors = [];
  if (!category) errors.push('Elegí un tipo de problema de la lista.');
  if (typeof data['Descripción'] !== 'string' || data['Descripción'].length > 2000 || description.length < 10) errors.push('Descripción: entre 10 y 2000 caracteres.');
  if (street.length < 3 || street.length > 300) errors.push('Calle y altura: entre 3 y 300 caracteres.');
  if (city.length < 2 || city.length > 100) errors.push('Indicá la ciudad o localidad (2 a 100 caracteres).');
  if (!province) errors.push('Elegí una provincia válida de la lista.');
  if (photoKeys.length > 1) errors.push('Solo se admite una foto.');
  if (data.Foto && (Array.isArray(data.Foto) ? data.Foto.length > 0 : Boolean(data.Foto.filename)) && !photoKeys.length) errors.push('No pudimos leer la foto adjunta. Volvé a cargarla.');
  if (errors.length) return {
    ...base, action: 'reply', reply: 'No enviamos el reclamo porque hay datos para corregir:\n\n' + errors.join('\n') + '\n\nEscribí /reportar para abrir otro formulario. No se recortó ningún campo.',
  };
  return {
    ...base, action: 'validate_location', form_photo_key: photoKeys[0] || null,
    location: { street, city, province: province.name, province_id: province.id },
    report: {
      source: 'telegram', external_id: `telegram:${context.chat_id}:${context.message_id}`,
      category, description, address: '',
      reporter: { telegram_user_id: context.user_id, telegram_chat_id: context.chat_id },
      reported_at: context.reported_at, photo: null, expectsPhoto: photoKeys.length === 1,
    },
  };
}

function validateLocality(response, original) {
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const localities = response.statusCode === 200 && Array.isArray(response.body?.localities) ? response.body.localities : null;
  const city = localities?.find(p => typeof p.name === 'string' && normalize(p.name) === normalize(original.location.city));
  if (!city) return {
    ...original, action: 'reply', error_stage: 'localities',
    reply: localities
      ? 'No encontramos esa ciudad o localidad en ' + original.location.province + '. Revisá el nombre y escribí /reportar para completar otro formulario. El reclamo no se envió.'
      : 'No pudimos verificar la localidad en reportAR. No enviamos el reclamo. Probá de nuevo con /reportar en unos minutos.',
  };
  // Igual que la web: calle + localidad + provincia, sin repetir componentes.
  const parts = original.location.street.split(',').map(p => p.trim()).filter(Boolean);
  for (const part of [city.name, original.location.province]) {
    if (!parts.some(p => normalize(p) === normalize(part))) parts.push(part);
  }
  const address = parts.join(', ');
  if (address.length < 5 || address.length > 300) return {
    ...original, action: 'reply',
    reply: 'La dirección completa (calle, localidad y provincia) debe tener entre 5 y 300 caracteres. No se recortó ningún dato. Escribí /reportar y acortá la referencia.',
  };
  return { ...original, action: 'create', location: { ...original.location, city: city.name }, report: { ...original.report, address } };
}

function validateFormPhoto(bytes, metadata) {
  if (!bytes.length || bytes.length > 100 * 1024 * 1024) return { ok: false, error: 'La foto debe pesar como máximo 100 MiB y no estar vacía.' };
  // Igual que el formulario web: conservar el original, incluidos HEIC y RAW.
  return { ok: true, mimeType: metadata.mimeType || 'application/octet-stream' };
}

function prepareBlobUpload(response, original, metadata = {}) {
  const body = response.body;
  const received = [200, 201].includes(response.statusCode) && body?.status === 'received'
    && typeof body.id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.id);
  if (!received || !original.form_photo_key || body.photo_status === 'stored') return { action: 'result' };
  if (body.photo_status !== 'pending' || !/^[0-9a-f]{64}$/i.test(body.photoUploadToken || '')) return {
    action: 'result', photo_error: { stage: 'create', code: 'missing_upload_capability' },
  };
  const safeName = (metadata.fileName || 'foto').normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'foto';
  // Reintentar el mismo evento usa el mismo pathname; el token habilita overwrite.
  const pathname = `reports/${body.id}/${body.id}-${safeName}`;
  return {
    action: 'upload', report_id: body.id, photoUploadToken: body.photoUploadToken,
    pathname, form_photo_key: original.form_photo_key,
    content_type: metadata.mimeType || 'application/octet-stream',
    token_request: { type: 'blob.generate-client-token', payload: {
      pathname, multipart: false,
      clientPayload: JSON.stringify({ reportId: body.id, token: body.photoUploadToken, client: 'n8n' }),
    } },
  };
}

function prepareBlobToken(response, upload) {
  const clientToken = response.body?.clientToken;
  if (response.statusCode !== 200 || response.body?.type !== 'blob.generate-client-token'
      || typeof clientToken !== 'string' || !/^vercel_blob_client_[a-zA-Z0-9]+_/.test(clientToken)) return {
    action: 'recheck', photo_error: { stage: 'authorize', status: response.statusCode || null, code: response.body?.error || 'invalid_upload_token' },
  };
  return { ...upload, clientToken, store_id: clientToken.split('_')[3] };
}

function prepareBlobAttachment(response, upload) {
  const blob = response.body;
  const prefix = `https://${upload.store_id.toLowerCase()}.public.blob.vercel-storage.com/`;
  if (![200, 201].includes(response.statusCode) || typeof blob?.url !== 'string'
      || !blob.url.startsWith(prefix) || blob.pathname !== upload.pathname) return {
    action: 'recheck', photo_error: { stage: 'upload', status: response.statusCode || null, code: 'invalid_blob_response' },
  };
  return { action: 'attach', report_id: upload.report_id, attachment: { token: upload.photoUploadToken, url: blob.url } };
}

function formatFormResult(response, original, firstResponse, photoError) {
  const received = value => [200, 201].includes(value?.statusCode)
    && value.body?.status === 'received' && typeof value.body.id === 'string'
    && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.body.id);
  const result = received(response) ? response : received(firstResponse) ? firstResponse : null;
  const hasPhoto = Boolean(original.report.expectsPhoto);
  const body = result?.body;
  const retry_event = { report: original.report, idempotency_key: original.report.external_id, form_photo_key: original.form_photo_key || null };
  const failure = photoError || response.photo_error || (response.error || !result ? {
    stage: result ? 'photo' : 'create', status: response.statusCode || response.error?.status || null,
    code: typeof response.body?.error === 'string' ? response.body.error : response.error?.code || 'request_failed',
  } : null);
  if (!result) return {
    chat_id: original.chat_id, confirmed: false, retry_event,
    diagnostic: failure,
    reply: 'No pudimos confirmar el guardado del reclamo. Conservamos los datos en esta ejecución para reintentar desde n8n con la misma clave.',
  };
  const photoStored = hasPhoto && (body.photo_status === 'stored' || (response.statusCode === 200 && response.body?.ok === true));
  let reply = '✅ Reclamo guardado en reportAR.\nNúmero: ' + body.id + '\nUbicación: ' + original.report.address;
  if (photoStored) reply += '\n📷 La foto quedó adjunta.';
  if (hasPhoto && !photoStored) reply += '\nNo pudimos confirmar que se adjuntara la foto, pero el reclamo quedó guardado.';
  reply += '\n\nPara crear otro reclamo, escribí /reportar.';
  return {
    chat_id: original.chat_id, confirmed: true, report_id: body.id,
    ...(hasPhoto ? { photo_status: photoStored ? 'stored' : 'failed' } : {}),
    ...(hasPhoto && !photoStored ? { retry_event, diagnostic: failure || { stage: 'photo', code: 'not_attached' } } : {}), reply,
  };
}

function prepareFormResults(items, readOutput) {
  const read = (name, branch = 0) => {
    try { return readOutput(name, branch); } catch { return undefined; }
  };
  const original = read('Revisar foto');
  if (!original?.report || !original.chat_id) throw new Error('Falta el contexto del reclamo. Reejecutá la ejecución original desde Telegram Trigger, conservando su mensaje.');
  return items.map((item, i) => {
    const saved = read('Guardar reporte') || read('Guardar reporte', 1);
    const failure = read('Preparar binario Blob')?.photo_error || read('Preparar adjunto')?.photo_error;
    return { json: formatFormResult(item.json, original, saved, failure), pairedItem: { item: i } };
  });
}

module.exports = { prepareForm, prepareProvinces, parseFormResponse, validateLocality, validateFormPhoto, prepareBlobUpload, prepareBlobToken, prepareBlobAttachment, formatFormResult, prepareFormResults };
