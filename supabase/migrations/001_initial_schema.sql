-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Projects table (referenced by orders, products, packages, expenses)
CREATE TABLE IF NOT EXISTS projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  code          TEXT UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT UNIQUE NOT NULL,
  address       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  package_name  TEXT,
  total_price   NUMERIC(10,2) NOT NULL,
  status        TEXT CHECK (status IN ('pending','processing','shipped','delivered','cancelled')) DEFAULT 'pending',
  order_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  sku           TEXT NOT NULL,
  name          TEXT NOT NULL,
  cost          NUMERIC(10,2) NOT NULL
);

-- Packages table
CREATE TABLE IF NOT EXISTS packages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price         NUMERIC(10,2)
);

-- Salaries table
CREATE TABLE IF NOT EXISTS salaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_project_id ON orders(project_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
