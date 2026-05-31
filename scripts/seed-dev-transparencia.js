const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Criar alguns documentos de exemplo para testes
  const documentos = await prisma.documentoTransparencia.createMany({
    data: [
      {
        titulo: "Documento de Teste 1",
        descricao: "Este é um documento de teste para transparência",
        categoria: "Documentos Institucionais",
        arquivo_url: "https://example.com/doc1.pdf",
        arquivo_nome: "doc1.pdf",
        arquivo_tamanho: 1024000,
      },
      {
        titulo: "Relatório Financeiro 2024",
        descricao: "Relatório financeiro do ano de 2024",
        categoria: "Prestação de Contas",
        arquivo_url: "https://example.com/relatorio.pdf",
        arquivo_nome: "relatorio.pdf",
        arquivo_tamanho: 2048000,
      },
    ],
    skipDuplicates: true,
  })

  console.log(`Criados ${documentos.count} documentos de exemplo`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })