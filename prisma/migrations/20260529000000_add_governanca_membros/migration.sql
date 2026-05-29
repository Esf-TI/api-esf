CREATE TABLE IF NOT EXISTS "governanca_membros" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "cargo" VARCHAR(255) NOT NULL,
    "conselho" VARCHAR(150) NOT NULL,
    "nucleo" VARCHAR(255),
    "foto_url" VARCHAR(500),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governanca_membros_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "governanca_membros_conselho_idx" ON "governanca_membros"("conselho");
CREATE INDEX IF NOT EXISTS "governanca_membros_ativo_idx" ON "governanca_membros"("ativo");
