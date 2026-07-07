-- CreateTable
CREATE TABLE "livros" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "autores" JSONB,
    "editora" VARCHAR(255),
    "ano" INTEGER NOT NULL,
    "edicao" VARCHAR(50),
    "isbn" VARCHAR(50),
    "capa_url" VARCHAR(500),
    "pdf_url" VARCHAR(500),
    "link_compra" VARCHAR(500),
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "livros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "livros_status_idx" ON "livros"("status");

-- CreateIndex
CREATE INDEX "livros_ano_idx" ON "livros"("ano");

-- CreateIndex
CREATE INDEX "livros_featured_idx" ON "livros"("featured");

-- CreateIndex
CREATE INDEX "livros_created_by_idx" ON "livros"("created_by");

-- CreateIndex
CREATE INDEX "livros_created_at_idx" ON "livros"("created_at");

-- AddForeignKey
ALTER TABLE "livros" ADD CONSTRAINT "livros_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
