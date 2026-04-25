require("dotenv").config()
const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")

const app = express()

app.use(express.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({ limit: "10mb" }))
app.use(cors({ origin: "*" }))

// Rotas
const NucleosRoutes = require("./routes/NucleosRoutes")
const ProjectsRoutes = require("./routes/ProjectsRoutes")
const BlogRoutes = require("./routes/BlogRoutes")
const AdminRoutes = require("./routes/AdminRoutes")
const ContatoRoutes = require("./routes/ContatoRoutes")
const AnaisRoutes = require("./routes/AnaisRoutes")
const uploadRouter = require("./routes/UploadRouter")

app.use("/api/upload", uploadRouter)
app.use("/nucleos", NucleosRoutes)
app.use("/projetos", ProjectsRoutes)
app.use("/blog", BlogRoutes)
app.use("/admin", AdminRoutes)
app.use("/contato", ContatoRoutes)
app.use("/anais", AnaisRoutes)

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "ESF API rodando", version: "2.0.0" })
})

// Probe do Chrome DevTools — responde 200 para evitar 404 nos logs
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
  res.json([])
})

const { ensureDefaultAdmin } = require("./scripts/seed-admin")
const { ensureStorageBuckets } = require("./lib/ensureStorageBuckets")

const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`)
  try {
    await ensureStorageBuckets()
  } catch (err) {
    console.error("[bootstrap] Falha ao garantir buckets de storage:", err.message)
  }

  try {
    await ensureDefaultAdmin()
  } catch (err) {
    console.error("[bootstrap] Falha ao garantir admin padrão:", err.message)
  }
})
