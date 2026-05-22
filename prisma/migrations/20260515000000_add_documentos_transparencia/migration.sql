-- CreateTable
CREATE TABLE "documentos_transparencia" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "categoria" VARCHAR(100) NOT NULL,
    "arquivo_url" VARCHAR(500) NOT NULL,
    "arquivo_nome" VARCHAR(255) NOT NULL,
    "arquivo_tamanho" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_transparencia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "documentos_transparencia" ADD CONSTRAINT "documentos_transparencia_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
