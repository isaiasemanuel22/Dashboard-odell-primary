-- Ejecutar en MySQL como usuario con permisos de administración
CREATE DATABASE IF NOT EXISTS odell_dashboard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'odell'@'localhost' IDENTIFIED BY 'TU_PASSWORD';
GRANT ALL PRIVILEGES ON odell_dashboard.* TO 'odell'@'localhost';

-- Para acceso desde otras PCs en la LAN (opcional):
-- CREATE USER IF NOT EXISTS 'odell'@'%' IDENTIFIED BY 'TU_PASSWORD';
-- GRANT ALL PRIVILEGES ON odell_dashboard.* TO 'odell'@'%';

FLUSH PRIVILEGES;
