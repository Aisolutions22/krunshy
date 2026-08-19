DROP POLICY IF EXISTS media_public_read ON storage.objects;

CREATE POLICY media_public_read ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = ANY (ARRAY['menu-images'::text, 'brand-assets'::text])
  AND lower(storage.extension(name)) = ANY (ARRAY['webp','jpg','jpeg','png','avif','gif','svg'])
);

CREATE POLICY media_admin_read ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = ANY (ARRAY['menu-images'::text, 'brand-assets'::text])
  AND public.is_admin()
);