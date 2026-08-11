-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','employee');
CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.order_type AS ENUM ('ACCOUNT','CASH');
CREATE TYPE public.order_status AS ENUM ('pending','confirmed','preparing','ready','completed','cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid','paid');

-- UPDATED_AT HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  display_name TEXT,
  department TEXT,
  phone TEXT,
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_approved_customer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approval_status = 'approved');
$$;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "profiles_update_own_basic" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- NEW USER TRIGGER: first user becomes approved admin, everyone else pending employee
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO admin_exists;
  INSERT INTO public.profiles (id, email, full_name, display_name, approval_status, approved_at)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'full_name',''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name',''),
    CASE WHEN admin_exists THEN 'pending'::public.approval_status ELSE 'approved'::public.approval_status END,
    CASE WHEN admin_exists THEN NULL ELSE now() END
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN admin_exists THEN 'employee'::public.app_role ELSE 'admin'::public.app_role END);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories_admin_insert" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "categories_admin_update" ON public.categories FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  image_url TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "products_admin_insert" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "products_admin_update" ON public.products FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGSERIAL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  visitor_name TEXT,
  visitor_phone TEXT,
  order_type public.order_type NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  client_token TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_own_or_admin" ON public.orders FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_admin());
CREATE POLICY "orders_admin_update" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX orders_customer_idx ON public.orders (customer_id);
CREATE INDEX orders_created_idx ON public.orders (created_at DESC);

-- ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  product_name_en_snapshot TEXT,
  unit_price_snapshot NUMERIC(12,2) NOT NULL CHECK (unit_price_snapshot >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select_own_or_admin" ON public.order_items FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid()));
CREATE INDEX order_items_order_idx ON public.order_items (order_id);

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'cash',
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select_own_or_admin" ON public.payments FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_admin());
CREATE POLICY "payments_admin_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND recorded_by = auth.uid());
CREATE INDEX payments_customer_idx ON public.payments (customer_id);

-- EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_admin_all" ON public.expenses FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ACCOUNT CLOSINGS
CREATE TABLE public.account_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  period_start DATE,
  period_end DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_settled NUMERIC(12,2) NOT NULL DEFAULT 0,
  outstanding_after NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  closed_by UUID NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.account_closings TO authenticated;
GRANT ALL ON public.account_closings TO service_role;
ALTER TABLE public.account_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closings_select_own_or_admin" ON public.account_closings FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_admin());
CREATE POLICY "closings_admin_insert" ON public.account_closings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND closed_by = auth.uid());

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  previous_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_select" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit_insert_self" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- RESTAURANT SETTINGS (single row)
CREATE TABLE public.restaurant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  name_ar TEXT NOT NULL DEFAULT 'كرانشي',
  name_en TEXT NOT NULL DEFAULT 'Krunshy',
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#E2571E',
  accent_color TEXT NOT NULL DEFAULT '#F4B23F',
  currency_code TEXT NOT NULL DEFAULT 'EGP',
  currency_symbol_ar TEXT NOT NULL DEFAULT 'ج.م',
  currency_symbol_en TEXT NOT NULL DEFAULT 'EGP',
  contact_phone TEXT,
  contact_email TEXT,
  address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurant_settings TO anon;
GRANT SELECT, UPDATE ON public.restaurant_settings TO authenticated;
GRANT ALL ON public.restaurant_settings TO service_role;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_public_read" ON public.restaurant_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings_admin_update" ON public.restaurant_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.restaurant_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.restaurant_settings (singleton) VALUES (true);

-- GUARDED ORDER CREATION
CREATE OR REPLACE FUNCTION public.create_order(
  _items JSONB,
  _order_type public.order_type,
  _visitor_name TEXT DEFAULT NULL,
  _visitor_phone TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL,
  _client_token TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id UUID;
  v_customer UUID := auth.uid();
  v_total NUMERIC(12,2) := 0;
  v_item JSONB;
  v_product public.products%ROWTYPE;
  v_qty INTEGER;
  v_existing UUID;
BEGIN
  IF _client_token IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.orders WHERE client_token = _client_token;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  IF _order_type = 'ACCOUNT' THEN
    IF v_customer IS NULL THEN RAISE EXCEPTION 'Sign in required for account orders'; END IF;
    IF NOT public.is_approved_customer() THEN RAISE EXCEPTION 'Account not approved'; END IF;
  ELSE
    v_customer := NULL;
  END IF;

  INSERT INTO public.orders (customer_id, visitor_name, visitor_phone, order_type, notes, client_token, payment_status)
  VALUES (v_customer, NULLIF(_visitor_name,''), NULLIF(_visitor_phone,''), _order_type, NULLIF(_notes,''), _client_token, 'unpaid')
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := GREATEST(1, LEAST(999, COALESCE((v_item ->> 'quantity')::INT, 1)));
    SELECT * INTO v_product FROM public.products
      WHERE id = (v_item ->> 'product_id')::UUID AND is_available AND NOT is_archived;
    IF v_product.id IS NULL THEN RAISE EXCEPTION 'Product unavailable'; END IF;
    INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, product_name_en_snapshot, unit_price_snapshot, quantity, line_total)
    VALUES (v_order_id, v_product.id, v_product.name_ar, v_product.name_en, v_product.price, v_qty, v_product.price * v_qty);
    v_total := v_total + (v_product.price * v_qty);
  END LOOP;

  UPDATE public.orders SET subtotal = v_total, total = v_total WHERE id = v_order_id;
  RETURN v_order_id;
END; $$;

REVOKE ALL ON FUNCTION public.create_order(JSONB, public.order_type, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(JSONB, public.order_type, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- CUSTOMER BALANCE VIEW HELPER
CREATE OR REPLACE FUNCTION public.customer_balance(_customer_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT SUM(total) FROM public.orders
      WHERE customer_id = _customer_id AND order_type = 'ACCOUNT' AND status <> 'cancelled'), 0)
       - COALESCE((SELECT SUM(amount) FROM public.payments WHERE customer_id = _customer_id), 0);
$$;
GRANT EXECUTE ON FUNCTION public.customer_balance(UUID) TO authenticated;