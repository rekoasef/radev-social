-- Conteos para comparar la base local con la del servidor en la mudanza (fase 4, T13).
select 'brands', count(*) from brands
union all select 'brand_documents', count(*) from brand_documents
union all select 'brand_assets', count(*) from brand_assets
union all select 'posts', count(*) from posts
union all select 'post_versions', count(*) from post_versions
union all select 'assets', count(*) from assets
union all select 'ideas', count(*) from ideas
union all select 'schedule_slots', count(*) from schedule_slots
order by 1;
