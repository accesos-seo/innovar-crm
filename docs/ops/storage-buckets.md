# Supabase Storage — buckets y políticas

> Extraído del CLAUDE.md raíz el 2026-06-12 (optimización de arnés).

## Bucket de avatares

Si el avatar no se sube, ejecutar vía Management API (o SQL Editor):

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Avatar upload authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Avatar update authenticated" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "Avatar public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');
```

Nota: el bucket de **diseño** se reparó el 2026-06-11 (carta cliente — ver
`docs/handover/2026-06-11_ejecucion-carta-cliente.md`). Pendiente verificar políticas de
`avatars` en prod si reaparece el síntoma.
