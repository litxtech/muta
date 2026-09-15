-- PK özelliğini aç (plan: host PK başlatabilsin)
update public.feature_flags
set enabled = true, description = coalesce(description, 'PK')
where key = 'pk_enabled';
