-- ============================================================
-- Migração de URLs antigas do Supabase para o domínio correto
-- Execute este SQL no painel do Supabase: Database > SQL Editor
-- ============================================================

-- Domínio 1: supabase.esf-brasil.cloud → storage.esf.org.br
-- Domínio 2: bd.esf.org.br/site-assets/ → storage.esf.org.br/storage/v1/object/public/site-assets/

-- ── Tabela: Nucleo ──────────────────────────────────────────
UPDATE "Nucleo" SET "fotoCapa" = REPLACE("fotoCapa", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "fotoCapa" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Nucleo" SET "fotoCapa" = REPLACE("fotoCapa", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "fotoCapa" LIKE '%bd.esf.org.br%';

UPDATE "Nucleo" SET "foto1" = REPLACE("foto1", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto1" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Nucleo" SET "foto1" = REPLACE("foto1", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "foto1" LIKE '%bd.esf.org.br%';

UPDATE "Nucleo" SET "foto2" = REPLACE("foto2", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto2" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Nucleo" SET "foto2" = REPLACE("foto2", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "foto2" LIKE '%bd.esf.org.br%';

UPDATE "Nucleo" SET "foto3" = REPLACE("foto3", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto3" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Nucleo" SET "foto3" = REPLACE("foto3", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "foto3" LIKE '%bd.esf.org.br%';

UPDATE "Nucleo" SET "logoUrl" = REPLACE("logoUrl", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "logoUrl" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Nucleo" SET "logoUrl" = REPLACE("logoUrl", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "logoUrl" LIKE '%bd.esf.org.br%';

-- ── Tabela: Projeto ─────────────────────────────────────────
UPDATE "Projeto" SET "fotoCapa" = REPLACE("fotoCapa", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "fotoCapa" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Projeto" SET "fotoCapa" = REPLACE("fotoCapa", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "fotoCapa" LIKE '%bd.esf.org.br%';

UPDATE "Projeto" SET "foto1" = REPLACE("foto1", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto1" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Projeto" SET "foto1" = REPLACE("foto1", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "foto1" LIKE '%bd.esf.org.br%';

UPDATE "Projeto" SET "foto2" = REPLACE("foto2", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto2" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Projeto" SET "foto2" = REPLACE("foto2", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "foto2" LIKE '%bd.esf.org.br%';

UPDATE "Projeto" SET "foto3" = REPLACE("foto3", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto3" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Projeto" SET "foto3" = REPLACE("foto3", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "foto3" LIKE '%bd.esf.org.br%';

UPDATE "Projeto" SET "foto4" = REPLACE("foto4", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto4" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Projeto" SET "foto5" = REPLACE("foto5", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto5" LIKE '%supabase.esf-brasil.cloud%';

-- ── Tabela: Anais ───────────────────────────────────────────
UPDATE "Anais" SET "pdf_url" = REPLACE("pdf_url", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "pdf_url" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Anais" SET "pdf_url" = REPLACE("pdf_url", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "pdf_url" LIKE '%bd.esf.org.br%';

UPDATE "Anais" SET "cover_image_url" = REPLACE("cover_image_url", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "cover_image_url" LIKE '%supabase.esf-brasil.cloud%';

-- ── Tabela: Blog ────────────────────────────────────────────
UPDATE "Blog" SET "imageUrl" = REPLACE("imageUrl", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "imageUrl" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Blog" SET "imageUrl" = REPLACE("imageUrl", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "imageUrl" LIKE '%bd.esf.org.br%';

-- ── Tabela: documentoTransparencia ──────────────────────────
UPDATE "documentoTransparencia" SET "arquivo_url" = REPLACE("arquivo_url", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "arquivo_url" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "documentoTransparencia" SET "arquivo_url" = REPLACE("arquivo_url", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "arquivo_url" LIKE '%bd.esf.org.br%';

-- ── Verificação: ver se ainda existem URLs antigas ──────────
SELECT 'Nucleo.fotoCapa' as campo, COUNT(*) as qtd FROM "Nucleo" WHERE "fotoCapa" LIKE '%supabase.esf-brasil.cloud%' OR "fotoCapa" LIKE '%bd.esf.org.br%'
UNION ALL
SELECT 'Projeto.fotoCapa', COUNT(*) FROM "Projeto" WHERE "fotoCapa" LIKE '%supabase.esf-brasil.cloud%' OR "fotoCapa" LIKE '%bd.esf.org.br%'
UNION ALL
SELECT 'Anais.pdf_url', COUNT(*) FROM "Anais" WHERE "pdf_url" LIKE '%supabase.esf-brasil.cloud%' OR "pdf_url" LIKE '%bd.esf.org.br%'
UNION ALL
SELECT 'Blog.imageUrl', COUNT(*) FROM "Blog" WHERE "imageUrl" LIKE '%supabase.esf-brasil.cloud%' OR "imageUrl" LIKE '%bd.esf.org.br%'
UNION ALL
SELECT 'documentoTransparencia.arquivo_url', COUNT(*) FROM "documentoTransparencia" WHERE "arquivo_url" LIKE '%supabase.esf-brasil.cloud%' OR "arquivo_url" LIKE '%bd.esf.org.br%';
-- Se tudo retornar 0, a migração foi concluída com sucesso!
