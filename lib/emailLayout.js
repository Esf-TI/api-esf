/**
 * Layout unico dos e-mails automaticos do site (as confirmacoes enviadas a quem
 * preenche os formularios). Sem dependencias: monta o HTML e a versao em texto
 * puro, de modo que o mesmo template possa ser renderizado fora do servidor.
 *
 * Restricoes de e-mail que explicam as escolhas daqui:
 * - tabelas e estilo inline: Gmail e Outlook descartam CSS externo, flex e grid
 * - JPG no lugar do SVG da marca: Gmail nao renderiza SVG
 * - sempre acompanha versao `text`: cliente sem HTML, e melhora entregabilidade
 */

const CORES = {
  verde: "#00aa77",
  verdeEscuro: "#00875f",
  texto: "#1b1b1b",
  textoSuave: "#4a5568",
  borda: "#e5e7eb",
  fundo: "#f1f4f3",
}

const SITE_URL = String(process.env.FRONTEND_URL || "https://esf.org.br").replace(/\/+$/, "")
const LOGO_URL = SITE_URL + "/esf-fav.jpg"
const FONTE = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

function escapeHtml(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Preserva os paragrafos que a pessoa digitou, ao ecoar a mensagem dela. */
function textoParaHtml(valor) {
  return escapeHtml(valor).replace(/\r?\n/g, "<br />")
}

/**
 * @param {object} opts
 * @param {string} opts.titulo     Titulo dentro do card
 * @param {string} opts.preheader  Linha de previa que o inbox mostra ao lado do assunto
 * @param {string[]} opts.paragrafos  Aceitam <strong> e <a>; o resto vem escapado
 * @param {{rotulo:string, itens:Array<{rotulo:string, valor:string}>}} [opts.resumo]
 *        Eco do que a pessoa enviou, para ela conferir o que chegou
 * @param {string} [opts.aviso]    Observacao final, em destaque discreto
 * @param {{texto:string, href:string}} [opts.cta]  Botao principal; padrao leva ao site
 * @param {string} [opts.rodape]   Linha final; padrao fala em confirmacao de formulario
 */
function montarHtml({ titulo, preheader, paragrafos = [], resumo, aviso, cta, rodape }) {
  const botao = cta || { texto: "Visitar o site", href: SITE_URL }
  const textoRodape = rodape || "Confirmacao automatica do formulario que voce preencheu no site." 
  const paragrafosHtml = paragrafos
    .map(
      (p) =>
        '<p style="margin:0 0 16px;font-family:' +
        FONTE +
        ";font-size:16px;line-height:1.6;color:" +
        CORES.texto +
        ';">' +
        p +
        "</p>",
    )
    .join("")

  const itensHtml = resumo
    ? resumo.itens
        .map(
          (item) =>
            '<p style="margin:0 0 10px;font-family:' +
            FONTE +
            ";font-size:15px;line-height:1.55;color:" +
            CORES.texto +
            ';"><strong style="font-weight:600;color:' +
            CORES.textoSuave +
            ';">' +
            escapeHtml(item.rotulo) +
            ":</strong> " +
            textoParaHtml(item.valor) +
            "</p>",
        )
        .join("")
    : ""

  const resumoHtml = resumo
    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;background-color:' +
      CORES.fundo +
      ";border-left:4px solid " +
      CORES.verde +
      ';border-radius:4px;">' +
      '<tr><td style="padding:16px 20px;">' +
      '<p style="margin:0 0 12px;font-family:' +
      FONTE +
      ";font-size:12px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase;color:" +
      CORES.textoSuave +
      ';">' +
      escapeHtml(resumo.rotulo) +
      "</p>" +
      itensHtml +
      "</td></tr></table>"
    : ""

  const avisoHtml = aviso
    ? '<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ' +
      CORES.borda +
      ";font-family:" +
      FONTE +
      ";font-size:14px;line-height:1.6;color:" +
      CORES.textoSuave +
      ';">' +
      aviso +
      "</p>"
    : ""

  return [
    "<!DOCTYPE html>",
    '<html lang="pt-BR"><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "<title>" + escapeHtml(titulo) + "</title></head>",
    '<body style="margin:0;padding:0;background-color:' + CORES.fundo + ';">',
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + escapeHtml(preheader) + "</div>",
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' +
      CORES.fundo +
      ';padding:24px 12px;"><tr><td align="center">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;">',

    // Cabecalho da marca
    '<tr><td style="background-color:' + CORES.verde + ';padding:24px 32px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
    '<td style="padding-right:14px;" valign="middle">',
    '<img src="' +
      LOGO_URL +
      '" width="44" height="44" alt="ESF" style="display:block;width:44px;height:44px;border-radius:50%;background-color:#ffffff;" />',
    "</td>",
    '<td valign="middle">',
    '<span style="font-family:' +
      FONTE +
      ';font-size:17px;font-weight:700;color:#ffffff;">Engenheiros Sem Fronteiras</span><br />',
    '<span style="font-family:' + FONTE + ';font-size:13px;color:#d8f1e7;">Brasil</span>',
    "</td></tr></table></td></tr>",

    // Corpo
    '<tr><td style="padding:32px 32px 8px;">',
    '<h1 style="margin:0 0 20px;font-family:' +
      FONTE +
      ";font-size:22px;line-height:1.35;font-weight:700;color:" +
      CORES.texto +
      ';">' +
      escapeHtml(titulo) +
      "</h1>",
    paragrafosHtml,
    resumoHtml,
    avisoHtml,
    "</td></tr>",

    // Botao
    '<tr><td style="padding:24px 32px 28px;">',
    '<a href="' +
      botao.href +
      '" style="display:inline-block;padding:12px 22px;background-color:' +
      CORES.verde +
      ";color:#ffffff;font-family:" +
      FONTE +
      ';font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">' +
      escapeHtml(botao.texto) +
      "</a>",
    "</td></tr>",

    // Rodape
    '<tr><td style="background-color:' +
      CORES.fundo +
      ";padding:20px 32px;border-top:1px solid " +
      CORES.borda +
      ';">',
    '<p style="margin:0 0 6px;font-family:' +
      FONTE +
      ";font-size:13px;line-height:1.6;color:" +
      CORES.textoSuave +
      ';">Engenheiros Sem Fronteiras &mdash; Brasil &middot; <a href="' +
      SITE_URL +
      '" style="color:' +
      CORES.verdeEscuro +
      ';text-decoration:none;">' +
      SITE_URL.replace(/^https?:\/\//, "") +
      "</a></p>",
    '<p style="margin:0;font-family:' +
      FONTE +
      ";font-size:12px;line-height:1.6;color:" +
      CORES.textoSuave +
      ';">' +
      escapeHtml(textoRodape) +
      "</p>",
    "</td></tr>",

    "</table></td></tr></table></body></html>",
  ].join("")
}

/** Versao texto puro, a partir dos mesmos dados do HTML. */
function montarTexto({ titulo, paragrafos = [], resumo, aviso, cta, rodape }) {
  const semTags = (v) =>
    String(v)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  const partes = [titulo, ""]
  paragrafos.forEach((p) => partes.push(semTags(p), ""))
  if (resumo) {
    partes.push(resumo.rotulo + ":")
    resumo.itens.forEach((i) => partes.push("  " + i.rotulo + ": " + i.valor))
    partes.push("")
  }
  if (aviso) partes.push(semTags(aviso), "")
  if (cta) partes.push(cta.texto + ": " + cta.href, "")
  partes.push("------------------", "Engenheiros Sem Fronteiras - Brasil", SITE_URL, "")
  partes.push(rodape || "Confirmacao automatica do formulario que voce preencheu no site.")
  return partes.join("\n")
}

function montar(opts) {
  return { subject: opts.assunto, html: montarHtml(opts), text: montarTexto(opts) }
}

function primeiroNomeDe(nome) {
  const limpo = String(nome || "").trim()
  if (!limpo) return "Ola"
  return "Ola, " + limpo.split(/\s+/)[0]
}

/** Confirmacao para quem enviou mensagem em Quem somos -> Contato. */
function confirmacaoContato({ nome, mensagem, assunto }) {
  return montar({
    assunto: "Recebemos sua mensagem - Engenheiros Sem Fronteiras",
    titulo: "Recebemos sua mensagem",
    preheader: "Ficamos felizes com a sua mensagem. Em breve, nossa equipe entrará em contato com você.",
    paragrafos: [
      "Olá " + escapeHtml(String(nome || "").trim()) + ",",
      "Ficamos felizes com a sua mensagem. Em breve, nossa equipe entrará em contato com você.",
    ],
    resumo: {
      rotulo: "O que recebemos",
      itens: [].concat(
        assunto ? [{ rotulo: "Assunto", valor: assunto }] : [],
        [{ rotulo: "Mensagem", valor: mensagem }],
      ),
    },
    aviso: "Se voce nao preencheu nenhum formulario no nosso site, pode ignorar este e-mail com tranquilidade.",
  })
}

/** Confirmacao para quem assinou o "Receba novidades" da home. */
function confirmacaoNovidades() {
  return montar({
    assunto: "Inscricao confirmada - Engenheiros Sem Fronteiras",
    titulo: "Inscricao confirmada",
    preheader: "Voce vai receber as novidades dos Engenheiros Sem Fronteiras.",
    paragrafos: [
      "Olá,",
      "Seu e-mail foi cadastrado para receber as novidades dos Engenheiros Sem Fronteiras como projetos dos núcleos, editais, eventos e formas de participar.",
      "Enquanto isso, vale conhecer o que a rede tem feito pelo Brasil nas nossas redes sociais.",
    ],
    aviso: "Se voce nao fez essa inscricao, pode ignorar este e-mail com tranquilidade.",
  })
}

/** Confirmacao para quem se inscreveu em "Quero fundar um Nucleo". */
function confirmacaoFundarNucleo({ nome, cidade, mensagem }) {
  return montar({
    assunto: "Recebemos seu interesse em fundar um nucleo - Engenheiros Sem Fronteiras",
    titulo: "Recebemos seu interesse em fundar um nucleo",
    preheader: "Em breve, um de nossos assessores entrará em contato através do e-mail registrado.",
    paragrafos: [
      escapeHtml(primeiroNomeDe(nome)) + "!",
      "Que bom saber do seu interesse em levar os Engenheiros Sem Fronteiras para a sua cidade. Sua inscrição foi registrada e encaminhada para a equipe de acompanhamento.",
      "Em breve, um de nossos assessores entrará em contato, através do e-mail registrado.",
    ],
    resumo: {
      rotulo: "O que recebemos",
      itens: [
        { rotulo: "Nome", valor: nome },
        { rotulo: "Cidade", valor: cidade },
        { rotulo: "Interesse", valor: mensagem },
      ],
    },
    aviso: "Duvida sobre o processo? Basta responder a este e-mail: a equipe de acompanhamento recebe.",
  })
}

/**
 * Convite para o membro definir a senha e ativar o acesso.
 * O link leva para a mesma pagina /redefinir-senha usada na recuperacao.
 */
function conviteMembro({ nome, nucleo, link }) {
  const ondeEntrou = nucleo ? "no <strong>" + escapeHtml(nucleo) + "</strong>" : "em um nucleo"
  return montar({
    assunto: "Seu acesso ao sistema - Engenheiros Sem Fronteiras",
    titulo: "Voce foi cadastrado como membro",
    preheader: "Defina sua senha para ativar o acesso. O link vale por 7 dias.",
    paragrafos: [
      escapeHtml(primeiroNomeDe(nome)) + "!",
      "Voce foi cadastrado como membro " + ondeEntrou + " dos Engenheiros Sem Fronteiras.",
      "Para ativar seu acesso, defina uma senha no botao abaixo. <strong>O link vale por 7 dias.</strong>",
      '<span style="font-size:13px;color:' +
        CORES.textoSuave +
        ';word-break:break-all;">Ou copie este endereco no navegador:<br />' +
        link +
        "</span>",
    ],
    cta: { texto: "Definir minha senha", href: link },
    rodape: "Convite enviado pelo nucleo em que voce foi cadastrado.",
    aviso: "Se voce nao esperava este convite, ignore este e-mail: sem definir a senha, nenhum acesso e criado.",
  })
}

/** Link de redefinicao de senha (fluxo publico e acao do admin usam este). */
function recuperacaoSenha({ nome, link, validade = "1 hora" }) {
  return montar({
    assunto: "Redefinicao de senha - Engenheiros Sem Fronteiras",
    titulo: "Redefinicao de senha",
    preheader: "Link para criar uma nova senha. Vale por " + validade + ".",
    paragrafos: [
      escapeHtml(primeiroNomeDe(nome)) + "!",
      "Recebemos um pedido para redefinir a senha da sua conta. Use o botao abaixo para criar uma nova. <strong>O link vale por " +
        escapeHtml(validade) +
        ".</strong>",
      '<span style="font-size:13px;color:' +
        CORES.textoSuave +
        ';word-break:break-all;">Ou copie este endereco no navegador:<br />' +
        link +
        "</span>",
    ],
    cta: { texto: "Criar nova senha", href: link },
    rodape: "Mensagem automatica do sistema dos Engenheiros Sem Fronteiras.",
    aviso: "Se voce nao pediu isso, ignore este e-mail: sua senha atual continua valendo.",
  })
}

module.exports = {
  confirmacaoContato,
  confirmacaoNovidades,
  confirmacaoFundarNucleo,
  conviteMembro,
  recuperacaoSenha,
}
