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

-- ── Tabela: Projetos ────────────────────────────────────────
UPDATE "Projetos" SET "fotoCapa" = REPLACE("fotoCapa", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "fotoCapa" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Projetos" SET "fotoCapa" = REPLACE("fotoCapa", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "fotoCapa" LIKE '%bd.esf.org.br%';

UPDATE "Projetos" SET "foto1" = REPLACE("foto1", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto1" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Projetos" SET "foto1" = REPLACE("foto1", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "foto1" LIKE '%bd.esf.org.br%';

UPDATE "Projetos" SET "foto2" = REPLACE("foto2", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto2" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Projetos" SET "foto2" = REPLACE("foto2", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "foto2" LIKE '%bd.esf.org.br%';

UPDATE "Projetos" SET "foto3" = REPLACE("foto3", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto3" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Projetos" SET "foto3" = REPLACE("foto3", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "foto3" LIKE '%bd.esf.org.br%';

UPDATE "Projetos" SET "foto4" = REPLACE("foto4", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto4" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Projetos" SET "foto5" = REPLACE("foto5", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "foto5" LIKE '%supabase.esf-brasil.cloud%';

-- ── Tabela: Anais ───────────────────────────────────────────
UPDATE "Anais" SET "pdf_url" = REPLACE("pdf_url", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "pdf_url" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Anais" SET "pdf_url" = REPLACE("pdf_url", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "pdf_url" LIKE '%bd.esf.org.br%';

UPDATE "Anais" SET "cover_image_url" = REPLACE("cover_image_url", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "cover_image_url" LIKE '%supabase.esf-brasil.cloud%';

-- ── Tabela: Blog ────────────────────────────────────────────
UPDATE "Blog" SET "image" = REPLACE("image", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "image" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "Blog" SET "image" = REPLACE("image", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "image" LIKE '%bd.esf.org.br%';

-- ── Tabela: documentos_transparencia ──────────────────────────
UPDATE "documentos_transparencia" SET "arquivo_url" = REPLACE("arquivo_url", 'https://supabase.esf-brasil.cloud', 'https://storage.esf.org.br') WHERE "arquivo_url" LIKE '%supabase.esf-brasil.cloud%';
UPDATE "documentos_transparencia" SET "arquivo_url" = REPLACE("arquivo_url", 'https://bd.esf.org.br/site-assets/', 'https://storage.esf.org.br/storage/v1/object/public/site-assets/') WHERE "arquivo_url" LIKE '%bd.esf.org.br%';

-- ── Verificação: ver se ainda existem URLs antigas ──────────
SELECT 'Nucleo.fotoCapa' as campo, COUNT(*) as qtd FROM "Nucleo" WHERE "fotoCapa" LIKE '%supabase.esf-brasil.cloud%' OR "fotoCapa" LIKE '%bd.esf.org.br%'
UNION ALL
SELECT 'Projetos.fotoCapa', COUNT(*) FROM "Projetos" WHERE "fotoCapa" LIKE '%supabase.esf-brasil.cloud%' OR "fotoCapa" LIKE '%bd.esf.org.br%'
UNION ALL
SELECT 'Anais.pdf_url', COUNT(*) FROM "Anais" WHERE "pdf_url" LIKE '%supabase.esf-brasil.cloud%' OR "pdf_url" LIKE '%bd.esf.org.br%'
UNION ALL
SELECT 'Blog.image', COUNT(*) FROM "Blog" WHERE "image" LIKE '%supabase.esf-brasil.cloud%' OR "image" LIKE '%bd.esf.org.br%'
UNION ALL
SELECT 'documentos_transparencia.arquivo_url', COUNT(*) FROM "documentos_transparencia" WHERE "arquivo_url" LIKE '%supabase.esf-brasil.cloud%' OR "arquivo_url" LIKE '%bd.esf.org.br%';
-- Se tudo retornar 0, a migração foi concluída com sucesso!
