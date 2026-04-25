const supabase = require("./supabaseClient")

const DEFAULT_BUCKETS = ["anais", "nucleos", "projetos", "blog"]

const getRequiredBuckets = () => {
  const raw = process.env.STORAGE_REQUIRED_BUCKETS
  if (!raw) return DEFAULT_BUCKETS

  return raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
}

async function ensureStorageBuckets() {
  const requiredBuckets = getRequiredBuckets()
  if (requiredBuckets.length === 0) return

  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets()
  if (listError) {
    throw new Error(`Falha ao listar buckets: ${listError.message}`)
  }

  const existing = new Set((existingBuckets || []).map((bucket) => bucket.name))

  for (const bucketName of requiredBuckets) {
    if (existing.has(bucketName)) continue

    const { error: createError } = await supabase.storage.createBucket(bucketName, { public: true })
    if (createError) {
      throw new Error(`Falha ao criar bucket "${bucketName}": ${createError.message}`)
    }

    console.log(`[bootstrap] Bucket criado automaticamente: ${bucketName}`)
  }
}

module.exports = { ensureStorageBuckets }
