require('dotenv').config({ path: '.env.dev' })
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./dev.db'
    }
  }
})

async function createDatabase() {
  try {
    await prisma.$connect()
    console.log('Banco de dados criado com sucesso!')

    // Criar documentos de exemplo
    await prisma.documentoTransparencia.createMany({
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

    console.log('Documentos de exemplo criados!')
    process.exit(0)
  } catch (error) {
    console.error('Erro ao criar banco de dados:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createDatabase()