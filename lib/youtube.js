/**
 * Extrai o ID de um vídeo do YouTube a partir de um link colado pelo usuário.
 *
 * Aceita só endereços do próprio YouTube (watch, youtu.be, shorts, embed, live)
 * e guarda apenas o ID de 11 caracteres: o front monta a URL de incorporação
 * (`youtube-nocookie.com`), então nenhum endereço de terceiros chega a um iframe.
 */

const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
])

const ID_VALIDO = /^[A-Za-z0-9_-]{11}$/

function extrairVideoYoutube(entrada) {
  const texto = String(entrada || "").trim()
  if (!texto) return null

  let url
  try {
    url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`)
  } catch {
    return null
  }
  if (!["http:", "https:"].includes(url.protocol)) return null

  const host = url.hostname.toLowerCase()
  if (!HOSTS.has(host)) return null

  let id = null
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1]
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v")
  } else {
    const partes = url.pathname.split("/").filter(Boolean)
    if (["embed", "shorts", "live", "v"].includes(partes[0])) id = partes[1]
  }

  return id && ID_VALIDO.test(id) ? id : null
}

module.exports = { extrairVideoYoutube }
