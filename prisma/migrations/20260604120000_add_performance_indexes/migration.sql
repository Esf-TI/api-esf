-- Índices de performance para colunas frequentemente filtradas/ordenadas e chaves estrangeiras.
-- Idempotente (IF NOT EXISTS) para ser seguro com `prisma migrate deploy` em bases já existentes.

-- Admin
CREATE INDEX IF NOT EXISTS "Admin_status_idx" ON "Admin"("status");

-- AdminToken
CREATE INDEX IF NOT EXISTS "AdminToken_adminId_idx" ON "AdminToken"("adminId");

-- AdminLog
CREATE INDEX IF NOT EXISTS "AdminLog_adminId_idx" ON "AdminLog"("adminId");
CREATE INDEX IF NOT EXISTS "AdminLog_timestamp_idx" ON "AdminLog"("timestamp");

-- AdminAuditLog
CREATE INDEX IF NOT EXISTS "AdminAuditLog_admin_id_idx" ON "AdminAuditLog"("admin_id");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_created_at_idx" ON "AdminAuditLog"("created_at");

-- Blog
CREATE INDEX IF NOT EXISTS "Blog_status_idx" ON "Blog"("status");
CREATE INDEX IF NOT EXISTS "Blog_author_id_idx" ON "Blog"("author_id");
CREATE INDEX IF NOT EXISTS "Blog_featured_idx" ON "Blog"("featured");
CREATE INDEX IF NOT EXISTS "Blog_created_at_idx" ON "Blog"("created_at");

-- Nucleo
CREATE INDEX IF NOT EXISTS "Nucleo_status_idx" ON "Nucleo"("status");
CREATE INDEX IF NOT EXISTS "Nucleo_Estado_idx" ON "Nucleo"("Estado");
CREATE INDEX IF NOT EXISTS "Nucleo_Cidade_idx" ON "Nucleo"("Cidade");
CREATE INDEX IF NOT EXISTS "Nucleo_approved_by_idx" ON "Nucleo"("approved_by");
CREATE INDEX IF NOT EXISTS "Nucleo_created_at_idx" ON "Nucleo"("created_at");

-- NucleoToken
CREATE INDEX IF NOT EXISTS "NucleoToken_nucleoId_idx" ON "NucleoToken"("nucleoId");

-- Projeto (tabela "Projetos")
CREATE INDEX IF NOT EXISTS "Projetos_NucleoResponsavel_idx" ON "Projetos"("NucleoResponsavel");
CREATE INDEX IF NOT EXISTS "Projetos_status_idx" ON "Projetos"("status");
CREATE INDEX IF NOT EXISTS "Projetos_Area_idx" ON "Projetos"("Area");

-- Anais
CREATE INDEX IF NOT EXISTS "Anais_category_idx" ON "Anais"("category");
CREATE INDEX IF NOT EXISTS "Anais_year_idx" ON "Anais"("year");
CREATE INDEX IF NOT EXISTS "Anais_status_idx" ON "Anais"("status");
CREATE INDEX IF NOT EXISTS "Anais_featured_idx" ON "Anais"("featured");
CREATE INDEX IF NOT EXISTS "Anais_created_by_idx" ON "Anais"("created_by");
CREATE INDEX IF NOT EXISTS "Anais_created_at_idx" ON "Anais"("created_at");

-- DocumentoTransparencia (tabela "documentos_transparencia")
CREATE INDEX IF NOT EXISTS "documentos_transparencia_categoria_idx" ON "documentos_transparencia"("categoria");
CREATE INDEX IF NOT EXISTS "documentos_transparencia_created_by_idx" ON "documentos_transparencia"("created_by");
CREATE INDEX IF NOT EXISTS "documentos_transparencia_created_at_idx" ON "documentos_transparencia"("created_at");

-- GovernancaMembro (tabela "governanca_membros") — já podem existir de migração anterior
CREATE INDEX IF NOT EXISTS "governanca_membros_conselho_idx" ON "governanca_membros"("conselho");
CREATE INDEX IF NOT EXISTS "governanca_membros_ativo_idx" ON "governanca_membros"("ativo");

-- ContatoMessage (tabela "contato_messages")
CREATE INDEX IF NOT EXISTS "contato_messages_status_idx" ON "contato_messages"("status");
CREATE INDEX IF NOT EXISTS "contato_messages_replied_by_idx" ON "contato_messages"("replied_by");
CREATE INDEX IF NOT EXISTS "contato_messages_created_at_idx" ON "contato_messages"("created_at");
