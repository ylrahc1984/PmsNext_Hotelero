import { ReservaHabitacionRequest } from 'src/app/modules/Reservas/interfaces/reserva-habitacion.interface';
import { ReservaHabitacionFormValue, ReservaHabitacionMapper } from 'src/app/modules/Reservas/services/reserva-habitacion.mapper';
import { ReservaImportacion } from '../models/reserva-importacion.model';

export class ReservaImportacionMapper {
  static toRequest(reserva: ReservaImportacion, operador: string): ReservaHabitacionRequest {
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
      tCambio: 1,
      folio: '',
      estado: reserva.estadoPms || 'ABI',
      moneda: reserva.moneda || 'USD',
      totalRsv: reserva.total,
      observaciones: [
        `MIGRACION - RESERVA ORIGEN: ${reserva.numeroExterno}`,
        reserva.nacionalidad ? `NACIONALIDAD: ${reserva.nacionalidad}` : '',
        reserva.telefono ? `TELEFONO: ${reserva.telefono}` : ''
      ]
        .filter(Boolean)
        .join(' | '),
      procesa: '0',
      directo: reserva.directo === 'S',
      operador,
      habitaciones: reserva.detalleHabitaciones.map((item) => ({
        categoria: item.catHabita,
        tipo: item.tipHabita,
        cantidad: item.cantHab,
        pax: item.numPax,
        precio: item.precio,
        cantidadNinos: item.numChild,
        precioNino: reserva.noches > 0 && item.numChild > 0 ? item.totChild / item.numChild / reserva.noches : 0,
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
}
