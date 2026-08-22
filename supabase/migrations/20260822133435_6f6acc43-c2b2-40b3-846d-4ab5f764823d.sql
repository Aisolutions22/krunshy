ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_staff';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;