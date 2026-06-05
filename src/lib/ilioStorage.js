import { ilioSupabase } from './ilioSupabase'

const BUCKET = 'ticket-files'

function sanitize(name) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._\-/]/g, '_')
}

export async function uploadFile(ticketId, path, fileOrBlob, contentType) {
  const fullPath = sanitize(`${ticketId}/${path}`)
  const { error } = await ilioSupabase.storage
    .from(BUCKET)
    .upload(fullPath, fileOrBlob, { contentType, upsert: true })
  if (error) throw error
  const { data } = ilioSupabase.storage.from(BUCKET).getPublicUrl(fullPath)
  return data.publicUrl
}

export async function uploadDataUrl(ticketId, path, dataUrl) {
  const [header, b64] = dataUrl.split(',')
  const mime  = header.match(/:(.*?);/)[1]
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const blob  = new Blob([bytes], { type: mime })
  return uploadFile(ticketId, path, blob, mime)
}
