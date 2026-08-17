-- Fase 5 da curadoria de "Atividades Econômicas" — conferências pós-execução.
-- Somente leitura. Uso:
--   sqlite3 "file:/data/biocultdb.sqlite?mode=ro" < fase5-conferir.sql
-- Toda linha marcada FALHA exige investigação antes de declarar a campanha concluída.

.mode list
.headers off

SELECT '== 1. contagem por status no campo ==';
SELECT status, count(*) FROM etnotermos e
WHERE EXISTS (SELECT 1 FROM json_each(json_extract(e.doc,'$.sourceFields')) x
              WHERE x.value = 'comunidades.atividadesEconomicas')
GROUP BY 1 ORDER BY 1;

SELECT '== 2. total no campo ==';
SELECT count(*) FROM etnotermos e
WHERE EXISTS (SELECT 1 FROM json_each(json_extract(e.doc,'$.sourceFields')) x
              WHERE x.value = 'comunidades.atividadesEconomicas');

SELECT '== 3. ativos sem broader (devem ser apenas as 7 facetas) ==';
SELECT json_extract(doc,'$.prefLabels[0].literalForm') FROM etnotermos e
WHERE status='active'
  AND json_array_length(coalesce(json_extract(doc,'$.broader'),'[]'))=0
  AND EXISTS (SELECT 1 FROM json_each(json_extract(e.doc,'$.sourceFields')) x
              WHERE x.value = 'comunidades.atividadesEconomicas')
ORDER BY 1;

SELECT '== 4. ciclo: conceito ancestral de si mesmo (esperado 0) ==';
SELECT count(*) FROM etnotermos e
WHERE EXISTS (SELECT 1 FROM json_each(coalesce(json_extract(e.doc,'$.ancestors'),'[]')) a
              WHERE a.value = json_extract(e.doc,'$.id'));

SELECT '== 5. broader sem narrower recíproco (esperado 0) ==';
SELECT count(*) FROM etnotermos c, json_each(coalesce(json_extract(c.doc,'$.broader'),'[]')) b
WHERE NOT EXISTS (
  SELECT 1 FROM etnotermos p, json_each(coalesce(json_extract(p.doc,'$.narrower'),'[]')) n
  WHERE p.id = b.value AND n.value = json_extract(c.doc,'$.id'));

SELECT '== 6. pai depreciado com filho ativo (esperado 0) ==';
SELECT count(*) FROM etnotermos c, json_each(coalesce(json_extract(c.doc,'$.broader'),'[]')) b
JOIN etnotermos p ON p.id = b.value
WHERE c.status='active' AND p.status='deprecated';

SELECT '== 7. depreciado sem replacedBy (esperado 0) ==';
SELECT count(*) FROM etnotermos e
WHERE status='deprecated' AND json_extract(doc,'$.replacedBy') IS NULL;

SELECT '== 8. depreciados do campo e seu substituto ==';
SELECT json_extract(e.doc,'$.prefLabels[0].literalForm') || ' -> ' ||
       coalesce((SELECT json_extract(r.doc,'$.prefLabels[0].literalForm') FROM etnotermos r
                 WHERE r.id = json_extract(e.doc,'$.replacedBy')), '(?)')
FROM etnotermos e
WHERE status='deprecated'
  AND EXISTS (SELECT 1 FROM json_each(json_extract(e.doc,'$.sourceFields')) x
              WHERE x.value = 'comunidades.atividadesEconomicas')
ORDER BY 1;

SELECT '== 9. rótulos ocultos criados nesta campanha ==';
SELECT json_extract(e.doc,'$.prefLabels[0].literalForm') || ' <- oculto: ' ||
       json_extract(h.value,'$.literalForm')
FROM etnotermos e, json_each(coalesce(json_extract(e.doc,'$.hiddenLabels'),'[]')) h
WHERE EXISTS (SELECT 1 FROM json_each(json_extract(e.doc,'$.sourceFields')) x
              WHERE x.value = 'comunidades.atividadesEconomicas')
ORDER BY 1;

SELECT '== 10. relações broader e related no campo ==';
SELECT 'broader', count(*) FROM etnotermos e, json_each(coalesce(json_extract(e.doc,'$.broader'),'[]'))
WHERE EXISTS (SELECT 1 FROM json_each(json_extract(e.doc,'$.sourceFields')) x
              WHERE x.value = 'comunidades.atividadesEconomicas')
UNION ALL
SELECT 'related', count(*) FROM etnotermos e, json_each(coalesce(json_extract(e.doc,'$.related'),'[]'))
WHERE EXISTS (SELECT 1 FROM json_each(json_extract(e.doc,'$.sourceFields')) x
              WHERE x.value = 'comunidades.atividadesEconomicas');

SELECT '== 11. definições e notas no campo ==';
SELECT 'definition', count(*) FROM etnotermos e
WHERE json_extract(doc,'$.definition') IS NOT NULL
  AND EXISTS (SELECT 1 FROM json_each(json_extract(e.doc,'$.sourceFields')) x
              WHERE x.value = 'comunidades.atividadesEconomicas')
UNION ALL
SELECT 'scopeNote', count(*) FROM etnotermos e
WHERE json_extract(doc,'$.scopeNote') IS NOT NULL
  AND EXISTS (SELECT 1 FROM json_each(json_extract(e.doc,'$.sourceFields')) x
              WHERE x.value = 'comunidades.atividadesEconomicas');

SELECT '== 12. árvore do campo (pai -> filho) ==';
SELECT coalesce((SELECT json_extract(p.doc,'$.prefLabels[0].literalForm') FROM etnotermos p WHERE p.id=b.value),'(?)')
       || ' -> ' || json_extract(c.doc,'$.prefLabels[0].literalForm')
FROM etnotermos c, json_each(coalesce(json_extract(c.doc,'$.broader'),'[]')) b
WHERE EXISTS (SELECT 1 FROM json_each(json_extract(c.doc,'$.sourceFields')) x
              WHERE x.value = 'comunidades.atividadesEconomicas')
ORDER BY 1;

SELECT '== 13. trilha de auditoria (total de entradas) ==';
SELECT count(*) FROM etnotermos_audit_log;

SELECT '== 14. auditoria por campo alterado ==';
SELECT json_extract(doc,'$.field'), count(*) FROM etnotermos_audit_log GROUP BY 1 ORDER BY 2 DESC;

SELECT '== 15. auditoria gravada nesta campanha (2026-08-17) ==';
SELECT json_extract(doc,'$.field'), count(*) FROM etnotermos_audit_log
WHERE created_at LIKE '2026-08-17%' GROUP BY 1 ORDER BY 2 DESC;
