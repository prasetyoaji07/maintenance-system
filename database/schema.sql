CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  nama VARCHAR(100) NOT NULL,
  role ENUM('operator','teknisi','supervisor') NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS mesin (
  id INT NOT NULL AUTO_INCREMENT,
  nama VARCHAR(100) NOT NULL,
  lokasi VARCHAR(100) DEFAULT NULL,
  status ENUM('jalan','rusak','maintenance') NOT NULL DEFAULT 'jalan',
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS spare_parts (
  id INT NOT NULL AUTO_INCREMENT,
  part_number VARCHAR(50) NOT NULL,
  nama VARCHAR(100) NOT NULL,
  kategori VARCHAR(50) NOT NULL,
  stok INT NOT NULL DEFAULT 0,
  satuan VARCHAR(20) NOT NULL DEFAULT 'pcs',
  minimum_stok INT NOT NULL DEFAULT 0,
  harga INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_part_number (part_number)
);

CREATE TABLE IF NOT EXISTS tiket_kerusakan (
  id INT NOT NULL AUTO_INCREMENT,
  mesin_id INT NOT NULL,
  operator_id INT NOT NULL,
  teknisi_id INT DEFAULT NULL,
  keluhan TEXT NOT NULL,
  status ENUM('pending','diproses','menunggu_approval','selesai') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  diproses_at TIMESTAMP NULL DEFAULT NULL,
  selesai_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY mesin_id (mesin_id),
  CONSTRAINT tiket_mesin_fk FOREIGN KEY (mesin_id) REFERENCES mesin (id),
  CONSTRAINT tiket_operator_fk FOREIGN KEY (operator_id) REFERENCES users (id),
  CONSTRAINT tiket_teknisi_fk FOREIGN KEY (teknisi_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS tiket_part (
  id INT NOT NULL AUTO_INCREMENT,
  tiket_id INT NOT NULL,
  part_id INT NOT NULL,
  qty_dipakai INT NOT NULL,
  status ENUM('menunggu_approval','disetujui','dipakai') NOT NULL DEFAULT 'dipakai',
  PRIMARY KEY (id),
  KEY tiket_id (tiket_id),
  CONSTRAINT tiket_part_tiket_fk FOREIGN KEY (tiket_id) REFERENCES tiket_kerusakan (id) ON DELETE CASCADE,
  CONSTRAINT tiket_part_part_fk FOREIGN KEY (part_id) REFERENCES spare_parts (id)
);

CREATE TABLE IF NOT EXISTS riwayat_stok (
  id INT NOT NULL AUTO_INCREMENT,
  part_id INT NOT NULL,
  supervisor_id INT NOT NULL,
  qty_tambah INT NOT NULL,
  stok_sebelum INT NOT NULL,
  stok_sesudah INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY part_id (part_id),
  CONSTRAINT riwayat_stok_part_fk FOREIGN KEY (part_id) REFERENCES spare_parts (id),
  CONSTRAINT riwayat_stok_supervisor_fk FOREIGN KEY (supervisor_id) REFERENCES users (id)
);