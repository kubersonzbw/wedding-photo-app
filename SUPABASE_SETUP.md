# Supabase setup — Robert & Natalia

1. Create a Supabase project and copy `Project URL`, `anon public` key and `service_role` key into `.env.local` using `.env.example`.
2. In Storage, create a private bucket named `wedding-photos`. Do not make it public; the app generates short-lived signed URLs.
3. Run `supabase/schema.sql` in the SQL editor. It creates `events`, `guests`, `photos`, indexes and RLS policies.
4. Create an admin in Supabase Auth (`Authentication → Users → Add user`). The admin page expects a valid Supabase access token cookie (`sb-access-token`) from your auth flow/provider.
5. Seed an event. Access and gallery codes are stored as SHA-256 hashes:

```sql
insert into public.events (slug, title, access_code_hash, gallery_code_hash)
values (
  'robert-natalia',
  'Robert & Natalia',
  'c22a61d3fdb3e8dd0b76729ce05b144e7b544243b60add6567085b7759e8f116', -- upload-2026
  '5cb06614367e985289bad2b916421f21c3ace497af8edf2b442f89fa7948db89'  -- gallery-2026
);
```

6. QR links should point to `/wedding/robert-natalia?code=upload-2026` or your own code.
7. Public uploads and gallery reads go only through server Route Handlers using the service role. Full table data is not exposed publicly by RLS.
