require('dotenv').config({ path: '.env.dev' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Criar uma instância do Prisma client para desenvolvimento
global.prisma = prisma

// Restante do código do index.js
require('dotenv').config({ path: '.env.dev' })
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const app = express()

app.use(express.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({ limit: '10mb' }))
app.use(cors({ origin: '*' }))

// Rotas
const NucleosRoutes = require('./routes/NucleosRoutes')
const ProjectsRoutes = require('./routes/ProjectsRoutes')
const BlogRoutes = require('./routes/BlogRoutes')
const AdminRoutes = require('./routes/AdminRoutes')
const ContatoRoutes = require('./routes/ContatoRoutes')
const AnaisRoutes = require('./routes/AnaisRoutes')
const TransparenciaRoutes = require('./routes/TransparenciaRoutes')
const uploadRouter = require('./routes/UploadRouter')
const MigrationRoutes = require('./routes/MigrationRoutes')

app.use('/api/upload', uploadRouter)
app.use('/nucleos', NucleosRoutes)
app.use('/projetos', ProjectsRoutes)
app.use('/blog', BlogRoutes)
app.use('/admin', AdminRoutes)
app.use('/contato', ContatoRoutes)
app.use('/anais', AnaisRoutes)
app.use('/transparencia', TransparenciaRoutes)
app.use('/admin', MigrationRoutes)

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'ESF API rodando (modo dev)', version: '2.0.0' })
})

// Probe do Chrome DevTools — responde 200 para evitar 404 nos logs
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.json([])
})

const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT} (modo desenvolvimento)`)

  // Rodar o setup inicial
  try {
    const { setupDatabase } = require('./scripts/setup-dev')
    await setupDatabase()
    console.log('Banco de dados configurado')
  } catch (err) {
    console.error('[bootstrap] Falha ao configurar banco de dados:', err.message)
  }
})