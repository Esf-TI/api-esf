-- ============================================================
-- Seed / Migration: Renomeia conselhos na tabela governanca_membros
-- Execute no SQL Editor do Supabase (ou psql) UMA ÚNICA VEZ.
-- ============================================================

-- 1. "Conselho de Administração" -> "Coordenação"
UPDATE governanca_membros
SET conselho = 'Coordenação'
WHERE conselho = 'Conselho de Administração';

-- 2. "Diretoria Executiva" existente vira "Conselho de Diretores"
--    (só se você quiser mover esses membros para o novo conselho)
--    Descomente abaixo se necessário:
-- UPDATE governanca_membros
-- SET conselho = 'Conselho de Diretores'
-- WHERE conselho = 'Diretoria Executiva';

-- ============================================================
-- Verificação: mostra a contagem por conselho depois da mudança
-- ============================================================
SELECT conselho, COUNT(*) AS total
FROM governanca_membros
GROUP BY conselho
ORDER BY conselho;
