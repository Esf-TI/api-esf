-- CreateTable
CREATE TABLE "materiais" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "categoria" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'arquivo',
    "arquivo_url" VARCHAR(500),
    "arquivo_nome" VARCHAR(255),
    "arquivo_tamanho" INTEGER,
    "link_externo" VARCHAR(500),
    "visibilidade" VARCHAR(20) NOT NULL DEFAULT 'nucleos',
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materiais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "materiais_categoria_idx" ON "materiais"("categoria");

-- CreateIndex
CREATE INDEX "materiais_visibilidade_idx" ON "materiais"("visibilidade");

-- CreateIndex
CREATE INDEX "materiais_status_idx" ON "materiais"("status");

-- CreateIndex
CREATE INDEX "materiais_created_by_idx" ON "materiais"("created_by");

-- AddForeignKey
ALTER TABLE "materiais" ADD CONSTRAINT "materiais_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
