alter table public.photos
add column if not exists thumbnail_path text,
add column if not exists preview_path text;

update public.photos
set
  thumbnail_path = coalesce(thumbnail_path, 'thumbnails/' || regexp_replace(storage_path, '\.[^./]*$', '') || '.jpg'),
  preview_path = coalesce(preview_path, 'previews/' || regexp_replace(storage_path, '\.[^./]*$', '') || '.jpg')
where mime_type like 'image/%'
  and status in ('approved', 'hidden');
