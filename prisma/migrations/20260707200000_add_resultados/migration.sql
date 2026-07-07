-- CreateTable
CREATE TABLE "resultados" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "ano" INTEGER,
    "arquivo_url" VARCHAR(500) NOT NULL,
    "arquivo_nome" VARCHAR(255) NOT NULL,
    "arquivo_tamanho" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resultados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resultados_ordem_idx" ON "resultados"("ordem");

-- CreateIndex
CREATE INDEX "resultados_created_by_idx" ON "resultados"("created_by");

-- AddForeignKey
ALTER TABLE "resultados" ADD CONSTRAINT "resultados_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
