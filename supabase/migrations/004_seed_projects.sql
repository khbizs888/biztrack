-- Seed the 5 core projects (upsert on code so re-running is safe)
INSERT INTO projects (name, code)
VALUES
  ('FIOR', 'FIOR'),
  ('NE',   'NE'),
  ('DD',   'DD'),
  ('KHH',  'KHH'),
  ('Juji', 'JUJI')
ON CONFLICT (code) DO NOTHING;
