const prisma = require("../lib/prismaClient")

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]

const NucleoMapaController = {
  /** GET /mapa-nucleos — público; { data: { sp: [{ id, cidade }], ... } } */
  async listar(req, res) {
    try {
      const linhas = await prisma.nucleoMapa.findMany({ orderBy: [{ uf: "asc" }, { cidade: "asc" }] })
      const porUf = {}
      for (const l of linhas) {
        const chave = l.uf.toLowerCase()
        ;(porUf[chave] ||= []).push({ id: l.id, cidade: l.cidade })
      }
      return res.json({ success: true, total: linhas.length, data: porUf })
    } catch (error) {
      console.error("Erro ao listar mapa de núcleos:", error)
      return res.status(500).json({ success: false, message: "Erro ao listar núcleos do mapa" })
    }
  },

  /** POST /mapa-nucleos { uf, cidade } */
  async criar(req, res) {
    const uf = String(req.body?.uf || "").trim().toUpperCase()
    const cidade = String(req.body?.cidade || "").trim()

    if (!UFS.includes(uf)) return res.status(400).json({ success: false, message: "UF inválida" })
    if (!cidade || cidade.length > 120) {
      return res.status(400).json({ success: false, message: "Informe a cidade (até 120 caracteres)" })
    }

    try {
      const existente = await prisma.nucleoMapa.findFirst({
        where: { uf, cidade: { equals: cidade, mode: "insensitive" } },
      })
      if (existente) {
        return res.status(409).json({ success: false, message: "Esta cidade já está no mapa" })
      }
      const criado = await prisma.nucleoMapa.create({ data: { uf, cidade } })
      return res.status(201).json({ success: true, message: "Cidade adicionada ao mapa", data: criado })
    } catch (error) {
      console.error("Erro ao adicionar cidade ao mapa:", error)
      return res.status(500).json({ success: false, message: "Erro ao adicionar cidade" })
    }
  },

  /** PUT /mapa-nucleos/:id { cidade } */
  async atualizar(req, res) {
    const id = Number(req.params.id)
    const cidade = String(req.body?.cidade || "").trim()
    if (!id) return res.status(400).json({ success: false, message: "ID inválido" })
    if (!cidade || cidade.length > 120) {
      return res.status(400).json({ success: false, message: "Informe a cidade (até 120 caracteres)" })
    }

    try {
      const atual = await prisma.nucleoMapa.findUnique({ where: { id } })
      if (!atual) return res.status(404).json({ success: false, message: "Cidade não encontrada" })

      const duplicada = await prisma.nucleoMapa.findFirst({
        where: { uf: atual.uf, id: { not: id }, cidade: { equals: cidade, mode: "insensitive" } },
      })
      if (duplicada) return res.status(409).json({ success: false, message: "Esta cidade já está no mapa" })

      const atualizado = await prisma.nucleoMapa.update({ where: { id }, data: { cidade } })
      return res.json({ success: true, message: "Cidade atualizada", data: atualizado })
    } catch (error) {
      console.error("Erro ao atualizar cidade do mapa:", error)
      return res.status(500).json({ success: false, message: "Erro ao atualizar cidade" })
    }
  },

  /** DELETE /mapa-nucleos/:id */
  async deletar(req, res) {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ success: false, message: "ID inválido" })
    try {
      await prisma.nucleoMapa.delete({ where: { id } })
      return res.json({ success: true, message: "Cidade removida do mapa" })
    } catch (error) {
      if (error.code === "P2025") return res.status(404).json({ success: false, message: "Cidade não encontrada" })
      console.error("Erro ao remover cidade do mapa:", error)
      return res.status(500).json({ success: false, message: "Erro ao remover cidade" })
    }
  },
}

module.exports = NucleoMapaController
