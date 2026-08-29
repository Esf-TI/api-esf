-- AlterTable
ALTER TABLE "Projetos" ADD COLUMN "fase" VARCHAR(30) NOT NULL DEFAULT 'planejamento';

-- Projetos que ja existiam entram no quadro como "em execucao": foram cadastrados
-- para serem divulgados, entao tratar todos como planejamento seria impreciso.
UPDATE "Projetos" SET "fase" = 'execucao' WHERE "status" = 'active';

-- CreateIndex
CREATE INDEX "Projetos_fase_idx" ON "Projetos"("fase");
