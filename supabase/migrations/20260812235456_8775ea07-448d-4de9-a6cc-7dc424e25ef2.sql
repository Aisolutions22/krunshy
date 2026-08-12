UPDATE public.sync_config
SET sync_token = encode(gen_random_bytes(32), 'hex'),
    endpoint_url = 'https://project--1ba71549-6919-485c-b802-dad045d9ebc3.lovable.app/api/public/sync-sheets';

REVOKE ALL ON public.sync_config FROM anon, authenticated, PUBLIC;