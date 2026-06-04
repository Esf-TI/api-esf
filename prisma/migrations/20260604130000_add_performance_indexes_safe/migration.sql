-- Reintrodução dos índices de performance de forma À PROVA DE FALHAS.
-- Substitui a migração 20260604120000 (que abortava o deploy inteiro caso UMA coluna/tabela
-- não existisse ou houvesse timeout). Aqui cada índice é criado isoladamente: se falhar,
-- é ignorado (NOTICE) e a migração continua, garantindo que o deploy nunca trave.
-- Nomes seguem a convenção do Prisma (<tabela>_<coluna>_idx) para evitar drift com o schema.
DO $$
DECLARE
  item RECORD;
  idx_name TEXT;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('Admin', 'status'),
      ('AdminToken', 'adminId'),
      ('AdminLog', 'adminId'),
      ('AdminLog', 'timestamp'),
      ('AdminAuditLog', 'admin_id'),
      ('AdminAuditLog', 'created_at'),
      ('Blog', 'status'),
      ('Blog', 'author_id'),
      ('Blog', 'featured'),
      ('Blog', 'created_at'),
      ('Nucleo', 'status'),
      ('Nucleo', 'Estado'),
      ('Nucleo', 'Cidade'),
      ('Nucleo', 'approved_by'),
      ('Nucleo', 'created_at'),
      ('NucleoToken', 'nucleoId'),
      ('Projetos', 'NucleoResponsavel'),
      ('Projetos', 'status'),
      ('Projetos', 'Area'),
      ('Anais', 'category'),
      ('Anais', 'year'),
      ('Anais', 'status'),
      ('Anais', 'featured'),
      ('Anais', 'created_by'),
      ('Anais', 'created_at'),
      ('documentos_transparencia', 'categoria'),
      ('documentos_transparencia', 'created_by'),
      ('documentos_transparencia', 'created_at'),
      ('governanca_membros', 'conselho'),
      ('governanca_membros', 'ativo'),
      ('contato_messages', 'status'),
      ('contato_messages', 'replied_by'),
      ('contato_messages', 'created_at')
    ) AS t(tbl, col)
  LOOP
    idx_name := item.tbl || '_' || item.col || '_idx';
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (%I)', idx_name, item.tbl, item.col);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Índice % ignorado (%.%): %', idx_name, item.tbl, item.col, SQLERRM;
    END;
  END LOOP;
END $$;
