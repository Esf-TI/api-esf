-- CreateTable
CREATE TABLE "treinamentos" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "categoria" VARCHAR(100) NOT NULL DEFAULT 'Geral',
    "capa_url" VARCHAR(500),
    "visibilidade" VARCHAR(20) NOT NULL DEFAULT 'todos',
    "status" VARCHAR(20) NOT NULL DEFAULT 'rascunho',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "autor_tipo" VARCHAR(20) NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "autor_nome" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treinamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinamento_aulas" (
    "id" SERIAL NOT NULL,
    "treinamento_id" INTEGER NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "texto" TEXT,
    "video_url" VARCHAR(255),
    "video_id" VARCHAR(20),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treinamento_aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinamento_anexos" (
    "id" SERIAL NOT NULL,
    "aula_id" INTEGER NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "tamanho" INTEGER,
    "tipo" VARCHAR(120),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treinamento_anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinamento_progresso" (
    "id" SERIAL NOT NULL,
    "aula_id" INTEGER NOT NULL,
    "ator_tipo" VARCHAR(20) NOT NULL,
    "ator_id" INTEGER NOT NULL,
    "concluida_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treinamento_progresso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinamento_pedidos" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "autor_tipo" VARCHAR(20) NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "autor_nome" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'aberto',
    "resposta" TEXT,
    "respondido_por" VARCHAR(255),
    "respondido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treinamento_pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treinamentos_status_idx" ON "treinamentos"("status");

-- CreateIndex
CREATE INDEX "treinamentos_categoria_idx" ON "treinamentos"("categoria");

-- CreateIndex
CREATE INDEX "treinamento_aulas_treinamento_id_idx" ON "treinamento_aulas"("treinamento_id");

-- CreateIndex
CREATE INDEX "treinamento_anexos_aula_id_idx" ON "treinamento_anexos"("aula_id");

-- CreateIndex
CREATE INDEX "treinamento_progresso_ator_tipo_ator_id_idx" ON "treinamento_progresso"("ator_tipo", "ator_id");

-- CreateIndex
CREATE UNIQUE INDEX "treinamento_progresso_aula_id_ator_tipo_ator_id_key" ON "treinamento_progresso"("aula_id", "ator_tipo", "ator_id");

-- CreateIndex
CREATE INDEX "treinamento_pedidos_status_idx" ON "treinamento_pedidos"("status");

-- CreateIndex
CREATE INDEX "treinamento_pedidos_autor_tipo_autor_id_idx" ON "treinamento_pedidos"("autor_tipo", "autor_id");

-- AddForeignKey
ALTER TABLE "treinamento_aulas" ADD CONSTRAINT "treinamento_aulas_treinamento_id_fkey" FOREIGN KEY ("treinamento_id") REFERENCES "treinamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamento_anexos" ADD CONSTRAINT "treinamento_anexos_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "treinamento_aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamento_progresso" ADD CONSTRAINT "treinamento_progresso_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "treinamento_aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
