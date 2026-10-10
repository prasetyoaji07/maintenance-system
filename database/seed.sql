INSERT INTO users (nama, role) VALUES
  ('Yamal', 'operator'),
  ('Raphinha', 'teknisi'),
  ('Flick', 'supervisor');

INSERT INTO mesin (nama, lokasi) VALUES
  ('Compressor A1', 'Line 1'),
  ('Conveyor B2', 'Line 2'),
  ('Press C3', 'Line 3');

INSERT INTO spare_parts (part_number, nama, kategori, stok, satuan, minimum_stok, harga) VALUES
  ('BRG-6205-01', 'Bearing 6205', 'Bearing', 20, 'pcs', 5, 45000),
  ('VBT-B52-01', 'V-Belt B52', 'Belt', 8, 'pcs', 4, 85000),
  ('OLI-HYD-01', 'Oli hidrolik', 'Oli', 30, 'liter', 10, 60000);