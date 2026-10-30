-- CreateTable
CREATE TABLE "quadros" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "escopo" VARCHAR(20) NOT NULL,
    "nucleo_id" INTEGER,
    "cena" JSONB NOT NULL,
    "miniatura" TEXT,
    "autor_tipo" VARCHAR(20) NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "autor_nome" VARCHAR(255),
    "versao" INTEGER NOT NULL DEFAULT 1,
    "bloqueio_ator" VARCHAR(40),
    "bloqueio_nome" VARCHAR(255),
    "bloqueio_ate" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quadros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quadro_versoes" (
    "id" SERIAL NOT NULL,
    "quadro_id" INTEGER NOT NULL,
    "versao" INTEGER NOT NULL,
    "cena" JSONB NOT NULL,
    "autor_nome" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quadro_versoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quadros_nucleo_id_idx" ON "quadros"("nucleo_id");

-- CreateIndex
CREATE INDEX "quadros_escopo_idx" ON "quadros"("escopo");

-- CreateIndex
CREATE INDEX "quadros_updated_at_idx" ON "quadros"("updated_at");

-- CreateIndex
CREATE INDEX "quadro_versoes_quadro_id_idx" ON "quadro_versoes"("quadro_id");

-- CreateIndex
CREATE UNIQUE INDEX "quadro_versoes_quadro_id_versao_key" ON "quadro_versoes"("quadro_id", "versao");

-- AddForeignKey
ALTER TABLE "quadros" ADD CONSTRAINT "quadros_nucleo_id_fkey" FOREIGN KEY ("nucleo_id") REFERENCES "Nucleo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quadro_versoes" ADD CONSTRAINT "quadro_versoes_quadro_id_fkey" FOREIGN KEY ("quadro_id") REFERENCES "quadros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
