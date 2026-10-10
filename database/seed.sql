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
-- Login: email + password_hash (bcrypt)
UPDATE users SET email = 'yamal@operator.com', password_hash = '$2b$10$BB7nZmpoJvdqPLCBATTCDuCAQ8XoPXeyhmPeEdslITd/A6IMltNfS' WHERE id = 1;
UPDATE users SET email = 'raphinha@teknisi.com', password_hash = '$2b$10$nliwRzKthLB2YXz2UTAa8OlZzH4SElvgaadr0ArSML/RkNcuOg0RW' WHERE id = 2;
UPDATE users SET email = 'flick@supervisor.com', password_hash = '$2b$10$cj83YRUpcSVX7tDN6Ndj/.tZVvg2q5gFDDHImPVRS6Y8Gm.u0FKx6' WHERE id = 3;
