import { ReservaImportacion } from '../models/reserva-importacion.model';

export interface CatalogosValidacion {
  agencias: ReadonlySet<string>;
  tarifas: ReadonlySet<string>;
  planes: ReadonlySet<string>;
  categorias: ReadonlySet<string>;
  tiposPorCategoria: ReadonlyMap<string, ReadonlySet<string>>;
  tiposPorCategoriaYPax: ReadonlyMap<string, ReadonlyMap<number, ReadonlySet<string>>>;
}

export class ReservaImportacionValidator {
  static validate(reserva: ReservaImportacion, catalogos: CatalogosValidacion): void {
    const errors = [...reserva.parserErrores];
    const warnings = [...reserva.parserAdvertencias];
    const roomCount = reserva.detalleHabitaciones.reduce((sum, item) => sum + Number(item.cantHab || 0), 0);
    const paxCount = reserva.detalleHabitaciones.reduce((sum, item) => sum + Number(item.numPax || 0), 0);
    const calculatedTotal = reserva.detalleHabitaciones.reduce((sum, item) => sum + Number(item.total || 0), 0);

    if (!reserva.idReservaOrigen) errors.push('La reserva no posee ID técnico de origen.');
    if (!reserva.numeroExterno) errors.push('La reserva no posee número externo.');
    if (!reserva.nombre) errors.push('La reserva no contiene huésped o reservante.');
    if (!reserva.fechaEntrada) errors.push('La fecha de entrada es obligatoria.');
    if (!reserva.fechaSalida) errors.push('La fecha de salida es obligatoria.');
    if (reserva.fechaEntrada && reserva.fechaSalida && reserva.fechaSalida <= reserva.fechaEntrada) {
      errors.push('La salida debe ser posterior a la entrada.');
    }
    if (reserva.noches <= 0) errors.push('La cantidad de noches debe ser mayor que cero.');
    if (!reserva.fechaCreacion) errors.push('La fecha de reserva/creación es obligatoria.');
    if (reserva.habitaciones <= 0) errors.push('La cantidad de habitaciones debe ser mayor que cero.');
    if (reserva.pax <= 0) errors.push('La cantidad total de Pax debe ser mayor que cero.');
    if (reserva.total < 0) errors.push('El total no puede ser negativo.');
    if (!reserva.codAgencia || !catalogos.agencias.has(reserva.codAgencia)) errors.push('Debe homologar una agencia PMS válida.');
    if (!reserva.codTarifa || !catalogos.tarifas.has(reserva.codTarifa)) errors.push('Debe homologar una tarifa PMS válida.');
    if (!reserva.codPlan || !catalogos.planes.has(reserva.codPlan)) errors.push('Debe homologar un plan alimenticio válido.');
    if (!reserva.estadoPms) errors.push('Debe definir un estado PMS para la reserva.');
    if (!reserva.moneda) errors.push('La reserva no posee una moneda válida.');
    if (reserva.tipoCambio <= 0) errors.push('No existe un tipo de cambio válido para la moneda de la tarifa.');
    if (!reserva.detalleHabitaciones.length) errors.push('La reserva debe contener al menos una línea de habitación.');

    reserva.detalleHabitaciones.forEach((item, index) => {
      const label = `Habitación ${index + 1}${item.filaExcel ? ` (fila ${item.filaExcel})` : ''}`;
      item.errores = [];
      item.advertencias = [];

      if (!item.categoriaOrigen && !item.catHabita) item.errores.push('Categoría no especificada en el archivo.');
      if (!item.catHabita || !catalogos.categorias.has(item.catHabita)) item.errores.push('Categoría PMS pendiente o inválida.');
      if (item.numPax <= 0) item.errores.push('Pax debe ser mayor que cero.');
      if (item.cantHab <= 0) item.errores.push('La cantidad debe ser mayor que cero.');
      if (!Number.isFinite(Number(item.precio)) || item.precio < 0) item.errores.push('El precio no es válido.');
      if (reserva.total > 0 && item.precio <= 0) {
        item.errores.push('Precio de habitación pendiente; no existe detalle tarifario PMS para esta combinación.');
      }

      if (item.catHabita && item.numPax > 0) {
        const typesForPax = catalogos.tiposPorCategoriaYPax.get(item.catHabita)?.get(item.numPax);
        if (!typesForPax?.size) {
          item.errores.push(
            `No existe un tipo de habitación configurado para la categoría ${item.catHabita} con ${item.numPax} Pax.`
          );
        } else if (!item.tipHabita || !typesForPax.has(item.tipHabita)) {
          item.errores.push('El tipo PMS no corresponde a la categoría y Pax indicados.');
        }
      }

      item.estadoValidacion = item.errores.length ? 'ERROR' : item.advertencias.length ? 'ADVERTENCIA' : 'VALIDA';
      item.errores.forEach((message) => errors.push(`${label}: ${message}`));
      item.advertencias.forEach((message) => warnings.push(`${label}: ${message}`));
    });

    if (roomCount !== reserva.habitaciones) {
      errors.push(`La suma de cantidades (${roomCount}) no coincide con las ${reserva.habitaciones} habitaciones reconstruidas.`);
    }
    if (paxCount !== reserva.pax) errors.push(`El Pax de las líneas (${paxCount}) no coincide con el total reconstruido (${reserva.pax}).`);
    if (reserva.detalleHabitaciones.every((room) => room.precio > 0) && Math.abs(calculatedTotal - reserva.total) > 0.01) {
      warnings.push(
        `Los detalles suman ${calculatedTotal.toFixed(2)}, mientras el Total de cabecera es ${reserva.total.toFixed(2)}.`
      );
    }
    if (!reserva.telefono) warnings.push('La reserva no contiene teléfono.');
    if (!reserva.otaId) warnings.push('La reserva no contiene OTA ID.');
    if (reserva.monedaOrigen && reserva.moneda && reserva.monedaOrigen !== reserva.moneda) {
      warnings.push(`La moneda origen ${reserva.monedaOrigen} fue homologada como ${reserva.moneda}.`);
    }
    if (reserva.depositado > 0) {
      warnings.push(
        `Esta reserva posee un prepago de ${reserva.monedaOrigen || reserva.moneda} ${reserva.depositado.toFixed(2)}. El prepago no será migrado en esta etapa.`
      );
    }
    if (reserva.total === 0) warnings.push('Reserva con importe total 0. Revisar antes de importar.');

    reserva.errores = [...new Set(errors)];
    reserva.advertencias = [...new Set(warnings)];
    reserva.estadoValidacion = errors.length ? 'ERROR' : warnings.length ? 'ADVERTENCIA' : 'VALIDA';
    if (errors.length) reserva.seleccionado = false;
  }

}
