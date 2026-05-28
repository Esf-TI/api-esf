-- Migration: add_governanca_membros
-- Criada em: 2026-05-28
-- Execute este SQL no painel do Supabase (SQL Editor) ou no banco PostgreSQL do servidor

CREATE TABLE IF NOT EXISTS "governanca_membros" (
  "id"         SERIAL PRIMARY KEY,
  "nome"       VARCHAR(255) NOT NULL,
  "cargo"      VARCHAR(255) NOT NULL,
  "conselho"   VARCHAR(100) NOT NULL,
  "nucleo"     VARCHAR(255),
  "foto_url"   VARCHAR(500),
  "ordem"      INTEGER NOT NULL DEFAULT 0,
  "ativo"      BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_governanca_membros_updated_at
  BEFORE UPDATE ON "governanca_membros"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices para buscas comuns
CREATE INDEX IF NOT EXISTS idx_governanca_membros_conselho ON "governanca_membros"("conselho");
CREATE INDEX IF NOT EXISTS idx_governanca_membros_ativo ON "governanca_membros"("ativo");
CREATE INDEX IF NOT EXISTS idx_governanca_membros_ordem ON "governanca_membros"("ordem");
