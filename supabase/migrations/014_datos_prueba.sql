-- 014_datos_prueba.sql
-- Datos de prueba para lugares de embarque, comisiones y viajes

-- ============================================================
-- LUGARES DE EMBARQUE
-- ============================================================
INSERT INTO lugares_embarque (nombre, direccion, ciudad) VALUES
  ('Terminal Retiro', 'Av. San Martín 1234', 'Buenos Aires'),
  ('Lacloteca', 'Ruta 14 km 112', 'La Plata'),
  ('Terminal Nogoyá', 'Av. Sarmiento 567', 'Nogoyá'),
  ('Parada Federal', 'Av. 9 de Julio 890', 'Federal');

-- ============================================================
-- ACTUALIZAR VIAJES EXISTENTES CON LUGARES DE EMBARQUE
-- ============================================================
UPDATE viajes SET
  lugar_embarque_id = (SELECT id FROM lugares_embarque WHERE nombre = 'Terminal Nogoyá'),
  lugar_embarque_2_id = (SELECT id FROM lugares_embarque WHERE nombre = 'Terminal Retiro')
WHERE id = 13;

UPDATE viajes SET
  lugar_embarque_id = (SELECT id FROM lugares_embarque WHERE nombre = 'Terminal Nogoyá'),
  lugar_embarque_2_id = (SELECT id FROM lugares_embarque WHERE nombre = 'Parada Federal')
WHERE id = 16;

UPDATE viajes SET
  lugar_embarque_id = (SELECT id FROM lugares_embarque WHERE nombre = 'Terminal Nogoyá'),
  lugar_embarque_2_id = (SELECT id FROM lugares_embarque WHERE nombre = 'Lacloteca')
WHERE id = 17;

-- ============================================================
-- NUEVOS VIAJES DE PRUEBA
-- ============================================================
INSERT INTO viajes (origen, destino, fecha_salida, fecha_llegada, unidad_id, precio_base, activo, lugar_embarque_id, lugar_embarque_2_id)
VALUES
  (
    'Nogoyá', 'Córdoba',
    NOW() + INTERVAL '3 days',
    NOW() + INTERVAL '3 days' + INTERVAL '4 hours',
    13, 280000.00, true,
    (SELECT id FROM lugares_embarque WHERE nombre = 'Terminal Nogoyá'),
    (SELECT id FROM lugares_embarque WHERE nombre = 'Parada Federal')
  ),
  (
    'Buenos Aires', 'Bariloche',
    NOW() + INTERVAL '5 days',
    NOW() + INTERVAL '5 days' + INTERVAL '18 hours',
    16, 650000.00, true,
    (SELECT id FROM lugares_embarque WHERE nombre = 'Terminal Retiro'),
    (SELECT id FROM lugares_embarque WHERE nombre = 'Lacloteca')
  );

-- ============================================================
-- CONFIGURACION DE COMISIONES (10% para vendedores)
-- ============================================================
INSERT INTO comisiones_config (vendedor_id, porcentaje, activo) VALUES
  ('5e9f51c3-24cc-4ad3-8d42-3602733bf0e6', 10.00, true),
  ('9ca2b269-f85e-4749-a913-1e4e38e05b65', 10.00, true),
  ('60b2e39b-f93d-4b5f-99ca-4a817d671116', 10.00, true)
ON CONFLICT (vendedor_id) DO UPDATE SET porcentaje = EXCLUDED.porcentaje;
