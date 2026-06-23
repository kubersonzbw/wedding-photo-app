# Supabase setup — Robert & Natalia

1. Create a Supabase project and copy `Project URL`, `anon public` key and `service_role` key into `.env.local` using `.env.example`.
2. In Storage, create a private bucket named `wedding-photos`. Do not make it public; the app generates short-lived signed URLs.
3. Run `supabase/schema.sql` in the SQL editor. It creates `events`, `guests`, `photos`, indexes and RLS policies. New uploads use `approved` as the default photo status, so they can appear in the gallery immediately after upload.
4. Create an admin in Supabase Auth (`Authentication → Users → Add user`). The admin page expects a valid Supabase access token cookie (`sb-access-token`) from your auth flow/provider. In the MVP flow, admin moderation is mainly for hiding or deleting photos; manual approval is not required for new uploads.
5. Seed an event. The guest wedding code is stored as SHA-256 hashes in both event code columns. For the simplest wedding flow, use the same hash for `access_code_hash` and `gallery_code_hash`:

```sql
insert into public.events (slug, title, access_code_hash, gallery_code_hash)
values (
  'robert-natalia',
  'Robert & Natalia',
  'HASH_JEDNEGO_KODU', -- rn-wesele-2026
  'HASH_JEDNEGO_KODU'  -- rn-wesele-2026
);
```

6. Guest links should use the same wedding code for adding photos and viewing the gallery:

```text
/wedding/robert-natalia?code=rn-wesele-2026
/gallery/robert-natalia?code=rn-wesele-2026
```

7. If you already seeded separate hashes, update the event so one guest code works for both functions:

```sql
update public.events
set
  access_code_hash = 'HASH_JEDNEGO_KODU',
  gallery_code_hash = 'HASH_JEDNEGO_KODU'
where slug = 'robert-natalia';
```

8. If you already created the database while `photos.status` defaulted to `pending`, make new uploads visible in the gallery immediately and backfill old uploads:

```sql
update public.photos
set status = 'approved'
where status = 'pending';

alter table public.photos
alter column status set default 'approved';
```

9. Public uploads and gallery reads go only through server Route Handlers using the service role. Full table data is not exposed publicly by RLS. Keep the `wedding-photos` bucket private and do not expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
