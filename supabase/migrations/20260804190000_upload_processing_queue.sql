alter table public.photos
drop constraint if exists photos_status_check;

alter table public.photos
add constraint photos_status_check
check (status in ('pending', 'approved', 'hidden', 'failed', 'deleted'));

alter table public.photos
alter column status set default 'pending';
