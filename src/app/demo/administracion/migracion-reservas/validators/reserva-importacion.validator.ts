import { ReservaImportacion } from '../models/reserva-importacion.model';

export interface CatalogosValidacion {
  agencias: ReadonlySet<string>;
  tarifas: ReadonlySet<string>;
  planes: ReadonlySet<string>;
  categorias: ReadonlySet<string>;
  tiposPorCategoria: ReadonlyMap<string, ReadonlySet<string>>;
}

export class ReservaImportacionValidator {
  static validate(reserva: ReservaImportacion, catalogos: CatalogosValidacion): void {
    const errors: string[] = [];
    const warnings: string[] = [];
    const roomCount = reserva.detalleHabitaciones.reduce((sum, item) => sum + Number(item.cantHab || 0), 0);
    const paxCount = reserva.detalleHabitaciones.reduce((sum, item) => sum + Number(item.numPax || 0), 0);
    const distributedTotal = reserva.detalleHabitaciones.reduce((sum, item) => sum + Number(item.total || 0), 0);

    if (!reserva.numeroExterno) errors.push('La reserva no posee número externo.');
    if (!reserva.fechaEntrada) errors.push('La fecha de entrada es obligatoria.');
    if (!reserva.fechaSalida) errors.push('La fecha de salida es obligatoria.');
    if (reserva.fechaEntrada && reserva.fechaSalida && reserva.fechaSalida <= reserva.fechaEntrada) {
      errors.push('La salida debe ser posterior a la entrada.');
    }
    if (reserva.noches <= 0) errors.push('La cantidad de noches debe ser mayor que cero.');
    if (reserva.habitaciones <= 0) errors.push('La cantidad de habitaciones debe ser mayor que cero.');
    if (reserva.pax < 0) errors.push('La cantidad de Pax no es válida.');
    if (reserva.total < 0) errors.push('El total no puede ser negativo.');
    if (!reserva.codAgencia || !catalogos.agencias.has(reserva.codAgencia)) errors.push('Debe homologar una agencia PMS válida.');
    if (!reserva.codTarifa || !catalogos.tarifas.has(reserva.codTarifa)) errors.push('Debe homologar una tarifa PMS válida.');
    if (!reserva.codPlan || !catalogos.planes.has(reserva.codPlan)) errors.push('Debe homologar un plan alimenticio válido.');
    if (!reserva.estadoPms) errors.push('Debe homologar el estado de la reserva.');
    if (!reserva.detalleHabitaciones.length) errors.push('Debe configurar al menos una línea de habitación.');

    reserva.detalleHabitaciones.forEach((item, index) => {
      const label = `Línea ${index + 1}`;
      if (!item.catHabita || !catalogos.categorias.has(item.catHabita)) errors.push(`${label}: categoría inválida.`);
      const validTypes = catalogos.tiposPorCategoria.get(item.catHabita);
      if (!item.tipHabita || !validTypes?.has(item.tipHabita)) errors.push(`${label}: tipo de habitación inválido para la categoría.`);
      if (item.cantHab <= 0) errors.push(`${label}: la cantidad debe ser mayor que cero.`);
      if (item.numPax < 0) errors.push(`${label}: Pax no puede ser negativo.`);
      if (item.total < 0) errors.push(`${label}: el total no puede ser negativo.`);
    });

    if (roomCount !== reserva.habitaciones) {
      errors.push(
        roomCount < reserva.habitaciones
          ? `Se esperaban ${reserva.habitaciones} habitaciones y solamente se han configurado ${roomCount}.`
          : `Se esperaban ${reserva.habitaciones} habitaciones y se han configurado ${roomCount}.`
      );
    }
    if (paxCount !== reserva.pax) errors.push(`El Pax distribuido (${paxCount}) no coincide con el Excel (${reserva.pax}).`);
    if (Math.abs(distributedTotal - reserva.total) > 0.01) {
      errors.push(`El total distribuido (${distributedTotal.toFixed(2)}) no coincide con el total de la reserva (${reserva.total.toFixed(2)}).`);
    }
    if (reserva.depositado > 0) {
      warnings.push(`Esta reserva posee un depósito de USD ${reserva.depositado.toFixed(2)}. El depósito no será migrado en esta etapa.`);
    }
    if (reserva.total === 0 && reserva.depositado > 0) {
      warnings.push('La reserva tiene total cero y un depósito; requiere revisión antes de importar.');
    }
    if (!reserva.nombre) warnings.push('La reserva no contiene nombre de huésped.');
    if (!reserva.telefono) warnings.push('La reserva no contiene teléfono.');

    reserva.errores = [...new Set(errors)];
    reserva.advertencias = [...new Set(warnings)];
    reserva.estadoValidacion = errors.length ? 'ERROR' : warnings.length ? 'ADVERTENCIA' : 'VALIDA';
    if (errors.length) reserva.seleccionado = false;
  }
}

