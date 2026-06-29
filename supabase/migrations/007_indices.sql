CREATE INDEX IF NOT EXISTS idx_reservas_vendedor_id ON reservas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_reservas_viaje_id ON reservas(viaje_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas(estado);
CREATE INDEX IF NOT EXISTS idx_reservas_estado_financiero ON reservas(estado_financiero);

CREATE INDEX IF NOT EXISTS idx_pagos_movimientos_reserva_id ON pagos_movimientos(reserva_id);
CREATE INDEX IF NOT EXISTS idx_pagos_movimientos_estado_pago ON pagos_movimientos(estado_pago);

CREATE INDEX IF NOT EXISTS idx_mapa_asientos_viaje_viaje_id ON mapa_asientos_viaje(viaje_id);
CREATE INDEX IF NOT EXISTS idx_mapa_asientos_viaje_estado ON mapa_asientos_viaje(estado);

CREATE INDEX IF NOT EXISTS idx_auditoria_pasajes_asiento_viaje_id ON auditoria_pasajes(asiento_viaje_id);
