/**
 * Script para verificar e corrigir as políticas dos buckets do Supabase
 * Execute: node scripts/fix-bucket-policies.js
 */

require("dotenv").config()
const { createClient } = require("@supabase/supabase-js")

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar no .env")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const REQUIRED_BUCKETS = ["anais", "nucleos", "projetos", "blog", "transparencia", "site-assets"]

async function run() {
  console.log(`\n🔗 Conectando ao Supabase: ${supabaseUrl}\n`)

  // 1. Listar buckets existentes
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) {
    console.error("❌ Erro ao listar buckets:", listError.message)
    process.exit(1)
  }

  const existingMap = {}
  for (const b of buckets || []) {
    existingMap[b.name] = b
  }

  console.log("📦 Buckets encontrados:")
  for (const b of buckets || []) {
    const pub = b.public ? "✅ público" : "🔒 privado"
    console.log(`   - ${b.name}: ${pub}`)
  }

  // 2. Verificar e corrigir cada bucket necessário
  console.log("\n🔧 Verificando/corrigindo buckets...\n")

  for (const name of REQUIRED_BUCKETS) {
    if (!existingMap[name]) {
      // Criar bucket público
      const { error } = await supabase.storage.createBucket(name, { public: true })
      if (error) {
        console.error(`❌ Erro ao criar bucket "${name}":`, error.message)
      } else {
        console.log(`✅ Bucket "${name}" criado como público`)
      }
    } else if (!existingMap[name].public) {
      // Tornar bucket público
      const { error } = await supabase.storage.updateBucket(name, { public: true })
      if (error) {
        console.error(`❌ Erro ao tornar "${name}" público:`, error.message)
      } else {
        console.log(`✅ Bucket "${name}" agora é público`)
      }
    } else {
      console.log(`✔  Bucket "${name}" já é público`)
    }
  }

  // 3. Testar se uma URL pública é acessível
  console.log("\n🌐 Testando geração de URL pública...\n")
  for (const name of REQUIRED_BUCKETS) {
    const { data } = supabase.storage.from(name).getPublicUrl("test-path/sample.jpg")
    console.log(`   ${name}: ${data.publicUrl}`)
  }

  console.log("\n✅ Concluído! Verifique se as URLs acima são acessíveis no navegador.")
  console.log("   Se retornar 400/403, o bucket ainda está privado no painel do Supabase.")
  console.log("   Acesse o painel Storage > [bucket] > Policies e adicione: SELECT para anon.\n")
}

run().catch((e) => {
  console.error("Erro fatal:", e)
  process.exit(1)
})
