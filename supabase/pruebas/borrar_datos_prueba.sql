-- Borra todo lo que cargó datos_prueba_vendedor.sql (viajes con destino "... [PRUEBA]").
BEGIN;

CREATE TEMP TABLE viajes_prueba AS SELECT id FROM viajes WHERE destino LIKE '%[PRUEBA]';
CREATE TEMP TABLE reservas_prueba AS SELECT id FROM reservas WHERE viaje_id IN (SELECT id FROM viajes_prueba);

DELETE FROM comisiones WHERE reserva_id IN (SELECT id FROM reservas_prueba);
DELETE FROM pagos_movimientos WHERE reserva_id IN (SELECT id FROM reservas_prueba);
DELETE FROM reservas WHERE id IN (SELECT id FROM reservas_prueba);
DELETE FROM mapa_asientos_viaje WHERE viaje_id IN (SELECT id FROM viajes_prueba);
DELETE FROM viajes WHERE id IN (SELECT id FROM viajes_prueba);

SELECT (SELECT count(*) FROM viajes_prueba) AS viajes_borrados, (SELECT count(*) FROM reservas_prueba) AS reservas_borradas;

COMMIT;
