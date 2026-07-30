import { ReservaHabitacionRequest } from 'src/app/modules/Reservas/interfaces/reserva-habitacion.interface';
import { ReservaHabitacionFormValue, ReservaHabitacionMapper } from 'src/app/modules/Reservas/services/reserva-habitacion.mapper';
import { ReservaImportacion } from '../models/reserva-importacion.model';

export class ReservaImportacionMapper {
  static toRequest(reserva: ReservaImportacion): ReservaHabitacionRequest {
    const formValue: ReservaHabitacionFormValue = {
      codReserva: 'AUTO',
      codAgencia: reserva.codAgencia,
      codTarifa: reserva.codTarifa,
      codPlan: reserva.codPlan,
      fecIngreso: reserva.fechaEntrada,
      fecSalida: reserva.fechaSalida,
      fecCreacion: reserva.fechaCreacion || reserva.fechaEntrada,
      fecConfirma: reserva.estadoPms === 'CCR' ? reserva.fechaCreacion || reserva.fechaEntrada : '',
      fecPrepago: '',
      fecAnulada: reserva.estadoPms === 'ANU' ? reserva.fechaAnulada : '',
      totNoches: reserva.noches,
      totDias: reserva.noches + 1,
      descripcion: reserva.nombre,
      tCambio: reserva.tipoCambio,
      folio: '',
      estado: reserva.estadoPms || 'ABI',
      moneda: reserva.moneda || 'USD',
      totalRsv: reserva.total,
      observaciones: this.observations(reserva),
      procesa: 'WEB',
      directo: reserva.directo === 'S',
      operador: 'CHANNEL',
      habitaciones: reserva.detalleHabitaciones.map((item) => ({
        categoria: item.catHabita,
        tipo: item.tipHabita,
        cantidad: item.cantHab,
        pax: item.numPax,
        precio: item.precio,
        cantidadNinos: 0,
        precioNino: 0,
        total: item.total
      })),
      inclusiones: [],
      servicios: []
    };

    const request = ReservaHabitacionMapper.toRequest(formValue, reserva.total, 0, () => 0);
    return {
      ...request,
      directo: reserva.directo,
      habitaciones: request.habitaciones.map((item, index) => ({
        ...item,
        cpl: reserva.detalleHabitaciones[index]?.cpl ?? 0,
        impuesto: reserva.detalleHabitaciones[index]?.impuesto ?? 0
      })),
      inclusiones: [],
      servicios: []
    };
  }

  private static observations(reserva: ReservaImportacion): string {
    const originRooms = [
      ...new Set(reserva.detalleHabitaciones.map((item) => item.habitacionOrigen?.trim()).filter(Boolean))
    ].join(', ');
    const value = [
        'MIGRACIÓN',
        `Reserva origen: ${reserva.numeroExterno}`,
        `ID origen: ${reserva.idReservaOrigen}`,
        reserva.otaId ? `OTA: ${reserva.otaId}` : '',
        reserva.nacionalidad ? `NACIONALIDAD: ${reserva.nacionalidad}` : '',
        reserva.telefono ? `Teléfono: ${reserva.telefono}` : '',
        reserva.email ? `Email: ${reserva.email}` : '',
        originRooms ? `Habitaciones origen: ${originRooms}` : '',
        reserva.comentarios ? `Comentarios: ${reserva.comentarios}` : ''
      ]
        .filter(Boolean)
        .join('\n');
    // El flujo Walk-in limita las observaciones a 500 caracteres. Se usa el
    // mismo límite para no enviar un texto que la UI normal no aceptaría.
    return value.length <= 500 ? value : `${value.slice(0, 497)}...`;
  }
}
