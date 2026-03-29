-- Seed: 3 projects
INSERT INTO projects (id, name, code) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dropship Deals', 'DD'),
  ('22222222-2222-2222-2222-222222222222', 'Nature Essence', 'NE'),
  ('33333333-3333-3333-3333-333333333333', 'Juji Beauty', 'JUJI');

-- Seed: 10 customers
INSERT INTO customers (id, name, phone, address) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'Siti Aminah', '0123456789', 'Kuala Lumpur'),
  ('aaaa0002-0000-0000-0000-000000000002', 'Ahmad Fauzi', '0134567890', 'Selangor'),
  ('aaaa0003-0000-0000-0000-000000000003', 'Nurul Ain', '0145678901', 'Johor Bahru'),
  ('aaaa0004-0000-0000-0000-000000000004', 'Mohd Rizal', '0156789012', 'Penang'),
  ('aaaa0005-0000-0000-0000-000000000005', 'Farah Diyana', '0167890123', 'Ipoh'),
  ('aaaa0006-0000-0000-0000-000000000006', 'Hakim Zulkifli', '0178901234', 'Kota Kinabalu'),
  ('aaaa0007-0000-0000-0000-000000000007', 'Aisyah Khalid', '0189012345', 'Kuching'),
  ('aaaa0008-0000-0000-0000-000000000008', 'Rahmat Sulaiman', '0190123456', 'Shah Alam'),
  ('aaaa0009-0000-0000-0000-000000000009', 'Zainab Ismail', '0112345678', 'Melaka'),
  ('aaaa0010-0000-0000-0000-000000000010', 'Hafiz Othman', '0113456789', 'Kuala Terengganu');

-- Seed: products
INSERT INTO products (project_id, sku, name, cost) VALUES
  ('11111111-1111-1111-1111-111111111111', 'DD-001', 'Premium Watch', 45.00),
  ('22222222-2222-2222-2222-222222222222', 'NE-001', 'Organic Face Serum', 22.00),
  ('33333333-3333-3333-3333-333333333333', 'JUJI-001', 'Whitening Cream', 18.00);

-- Seed: packages
INSERT INTO packages (project_id, name, price) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Basic Pack', 99.00),
  ('11111111-1111-1111-1111-111111111111', 'Premium Pack', 179.00),
  ('22222222-2222-2222-2222-222222222222', 'Starter Kit', 89.00),
  ('22222222-2222-2222-2222-222222222222', 'Full Set', 159.00),
  ('33333333-3333-3333-3333-333333333333', 'Trial Pack', 59.00),
  ('33333333-3333-3333-3333-333333333333', 'Value Bundle', 129.00);

-- Seed: salaries
INSERT INTO salaries (employee_name, amount, start_date) VALUES
  ('Ali Hassan', 3500.00, '2024-01-01'),
  ('Nurul Hidayah', 3000.00, '2024-03-01');

-- Seed: 20 orders spread across projects and customers
INSERT INTO orders (customer_id, project_id, product_name, package_name, total_price, status, order_date) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Premium Watch', 'Basic Pack', 99.00, 'delivered', CURRENT_DATE - 5),
  ('aaaa0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Organic Face Serum', 'Starter Kit', 89.00, 'delivered', CURRENT_DATE - 8),
  ('aaaa0003-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Whitening Cream', 'Trial Pack', 59.00, 'shipped', CURRENT_DATE - 3),
  ('aaaa0004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Premium Watch', 'Premium Pack', 179.00, 'processing', CURRENT_DATE - 2),
  ('aaaa0005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'Organic Face Serum', 'Full Set', 159.00, 'delivered', CURRENT_DATE - 12),
  ('aaaa0006-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'Whitening Cream', 'Value Bundle', 129.00, 'pending', CURRENT_DATE - 1),
  ('aaaa0007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Premium Watch', 'Basic Pack', 99.00, 'delivered', CURRENT_DATE - 15),
  ('aaaa0008-0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'Organic Face Serum', 'Starter Kit', 89.00, 'shipped', CURRENT_DATE - 4),
  ('aaaa0009-0000-0000-0000-000000000009', '33333333-3333-3333-3333-333333333333', 'Whitening Cream', 'Trial Pack', 59.00, 'delivered', CURRENT_DATE - 20),
  ('aaaa0010-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'Premium Watch', 'Premium Pack', 179.00, 'delivered', CURRENT_DATE - 25),
  ('aaaa0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Organic Face Serum', 'Full Set', 159.00, 'delivered', CURRENT_DATE - 18),
  ('aaaa0002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Whitening Cream', 'Value Bundle', 129.00, 'processing', CURRENT_DATE - 6),
  ('aaaa0003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Premium Watch', 'Basic Pack', 99.00, 'delivered', CURRENT_DATE - 22),
  ('aaaa0004-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Organic Face Serum', 'Starter Kit', 89.00, 'cancelled', CURRENT_DATE - 10),
  ('aaaa0005-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'Whitening Cream', 'Trial Pack', 59.00, 'delivered', CURRENT_DATE - 28),
  ('aaaa0006-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Premium Watch', 'Premium Pack', 179.00, 'shipped', CURRENT_DATE - 7),
  ('aaaa0007-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'Organic Face Serum', 'Full Set', 159.00, 'delivered', CURRENT_DATE - 14),
  ('aaaa0008-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 'Whitening Cream', 'Value Bundle', 129.00, 'delivered', CURRENT_DATE - 9),
  ('aaaa0009-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'Premium Watch', 'Basic Pack', 99.00, 'pending', CURRENT_DATE),
  ('aaaa0010-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'Organic Face Serum', 'Starter Kit', 89.00, 'delivered', CURRENT_DATE - 30);

-- Seed: expenses
INSERT INTO expenses (project_id, type, amount, date, notes) VALUES
  ('11111111-1111-1111-1111-111111111111', 'marketing', 500.00, CURRENT_DATE - 10, 'Facebook Ads'),
  ('22222222-2222-2222-2222-222222222222', 'marketing', 300.00, CURRENT_DATE - 8, 'Instagram Ads'),
  ('33333333-3333-3333-3333-333333333333', 'logistics', 150.00, CURRENT_DATE - 5, 'Courier fees'),
  ('11111111-1111-1111-1111-111111111111', 'other', 200.00, CURRENT_DATE - 15, 'Packaging materials');
