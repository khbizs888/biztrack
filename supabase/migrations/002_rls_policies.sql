-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CUSTOMERS policies
CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "customers_delete" ON customers FOR DELETE TO authenticated USING (is_admin());

-- ORDERS policies
CREATE POLICY "orders_select" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "orders_update" ON orders FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "orders_delete" ON orders FOR DELETE TO authenticated USING (is_admin());

-- PROJECTS policies
CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_insert" ON projects FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "projects_update" ON projects FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "projects_delete" ON projects FOR DELETE TO authenticated USING (is_admin());

-- PRODUCTS policies
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "products_delete" ON products FOR DELETE TO authenticated USING (is_admin());

-- PACKAGES policies
CREATE POLICY "packages_select" ON packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "packages_insert" ON packages FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "packages_update" ON packages FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "packages_delete" ON packages FOR DELETE TO authenticated USING (is_admin());

-- SALARIES policies
CREATE POLICY "salaries_select" ON salaries FOR SELECT TO authenticated USING (true);
CREATE POLICY "salaries_insert" ON salaries FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "salaries_update" ON salaries FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "salaries_delete" ON salaries FOR DELETE TO authenticated USING (is_admin());

-- EXPENSES policies
CREATE POLICY "expenses_select" ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "expenses_update" ON expenses FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "expenses_delete" ON expenses FOR DELETE TO authenticated USING (is_admin());
