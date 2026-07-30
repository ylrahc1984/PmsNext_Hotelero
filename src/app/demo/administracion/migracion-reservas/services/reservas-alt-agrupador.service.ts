import { LineaReservaOrigen, ReservaImportacion } from '../models/reserva-importacion.model';

export class ReservasAltAgrupador {
  static group(lines: LineaReservaOrigen[]): ReservaImportacion[] {
    const groups = new Map<string, ReservaImportacion>();

    for (const line of lines) {
      const key = this.key(line.idReservaOrigen);
      if (!key) continue;
      let reservation = groups.get(key);
      if (!reservation) {
        reservation = this.createReservation(line);
        groups.set(key, reservation);
      } else {
        this.validateRepeatedHeader(reservation, line);
        reservation.filasExcel.push(line.filaExcel);
      }

      reservation.detalleHabitaciones.push({
        filaExcel: line.filaExcel,
        idCategoriaOrigen: line.idCategoriaOrigen,
        codigoCategoriaOrigen: line.codigoCategoriaOrigen,
        descripcionCategoriaOrigen: line.descripcionCategoriaOrigen,
        categoriaOrigen: line.codigoCategoriaOrigen || line.descripcionCategoriaOrigen,
        idHabitacionOrigen: line.idHabitacionOrigen,
        habitacionOrigen: line.habitacionOrigen,
        maxAdultos: line.maxAdultos,
        maxNinos: line.maxNinos,
        homologacionCategoria: 'PENDIENTE',
        catHabita: '',
        tipHabita: '',
        cantHab: 1,
        precio: 0,
        moneda: line.codigoMonedaOrigen,
        total: 0,
        cpl: 0,
        impuesto: 0,
        numPax: line.maxAdultos,
        numChild: 0,
        totChild: 0,
        cCosto: 'HOSPED',
        orden: reservation.detalleHabitaciones.length + 1,
        estadoValidacion: 'PENDIENTE',
        errores: [],
        advertencias: []
      });
    }

    return [...groups.values()].map((reservation) => this.finalize(reservation));
  }

  private static createReservation(line: LineaReservaOrigen): ReservaImportacion {
    return {
      id: `reservas-alt-${this.key(line.idReservaOrigen)}`,
      idReservaOrigen: line.idReservaOrigen,
      filaExcel: line.filaExcel,
      filasExcel: [line.filaExcel],
      numeroExterno: line.numeroReservaOrigen,
      estadoOrigen: line.estadoOrigen,
      idEstadoOrigen: line.idEstadoOrigen,
      tarifaOrigen: this.commercialKey(line),
      idContratoOrigen: line.idContratoOrigen,
      contratoOrigen: line.contratoOrigen,
      idOrigen: line.idOrigen,
      origen: line.origen,
      cplOrigen: String(line.cplOrigen || ''),
      nombre: line.nombre,
      nombreReservante: line.nombreReservante,
      nacionalidad: line.nacionalidadOrigen,
      idNacionalidadOrigen: line.idNacionalidadOrigen,
      vip: line.vip,
      telefono: line.telefono,
      email: line.email,
      otaId: line.otaId,
      comentarios: line.observaciones,
      referencia: line.referencia,
      fechaEntrada: line.fechaEntrada,
      fechaSalida: line.fechaSalida,
      fechaCreacion: line.fechaReserva,
      fechaAnulada: line.fechaAnulada,
      noches: this.daysBetween(line.fechaEntrada, line.fechaSalida),
      nochesOrigen: line.nochesCabecera,
      habitaciones: line.cantidadHabitacionesCabecera,
      lineasHabitacion: 0,
      pax: line.paxTotalCabecera,
      total: line.totalReservaCabecera,
      impuesto: 0,
      neto: line.totalReservaCabecera,
      depositado: line.prepagadoCabecera,
      pendiente: line.totalReservaCabecera - line.prepagadoCabecera,
      codAgencia: '',
      codTarifa: '',
      codPlan: '',
      estadoPms: '',
      directo: 'N',
      idMonedaOrigen: line.idMonedaOrigen,
      monedaOrigen: line.codigoMonedaOrigen,
      descripcionMonedaOrigen: line.descripcionMonedaOrigen,
      moneda: line.codigoMonedaOrigen,
      tipoCambio: 0,
      detalleHabitaciones: [],
      parserErrores: [],
      parserAdvertencias: [],
      estadoValidacion: 'PENDIENTE',
      errores: [],
      advertencias: [],
      seleccionado: true,
      estadoImportacion: 'PENDIENTE'
    };
  }

  private static validateRepeatedHeader(reservation: ReservaImportacion, line: LineaReservaOrigen): void {
    const errors: Array<[string, unknown, unknown]> = [
      ['número de reserva', reservation.numeroExterno, line.numeroReservaOrigen],
      ['fecha de entrada', reservation.fechaEntrada, line.fechaEntrada],
      ['fecha de salida', reservation.fechaSalida, line.fechaSalida],
      ['fecha de reserva', reservation.fechaCreacion, line.fechaReserva],
      ['nombre', reservation.nombre, line.nombre],
      ['cantidad de habitaciones', reservation.habitaciones, line.cantidadHabitacionesCabecera],
      ['Pax total', reservation.pax, line.paxTotalCabecera],
      ['Total', reservation.total, line.totalReservaCabecera],
      ['Prepagado', reservation.depositado, line.prepagadoCabecera],
      ['moneda', reservation.moneda, line.codigoMonedaOrigen],
      ['estado', reservation.estadoOrigen, line.estadoOrigen],
      ['contrato', reservation.contratoOrigen, line.contratoOrigen]
    ];
    errors.forEach(([label, current, incoming]) => {
      if (!this.equal(current, incoming)) {
        reservation.parserErrores.push(
          `ID origen ${reservation.idReservaOrigen}: ${label} inconsistente en la fila ${line.filaExcel}.`
        );
      }
    });

    if (reservation.telefono && line.telefono && this.phone(reservation.telefono) !== this.phone(line.telefono)) {
      reservation.parserAdvertencias.push(`El teléfono difiere entre las filas de la reserva ${reservation.numeroExterno}.`);
    }
  }

  private static finalize(reservation: ReservaImportacion): ReservaImportacion {
    reservation.lineasHabitacion = reservation.detalleHabitaciones.length;
    if (reservation.nochesOrigen > 0 && reservation.nochesOrigen !== reservation.noches) {
      reservation.parserAdvertencias.push(
        `El archivo declara ${reservation.nochesOrigen} noches y las fechas calculan ${reservation.noches}.`
      );
    }
    reservation.parserErrores = [...new Set(reservation.parserErrores)];
    reservation.parserAdvertencias = [...new Set(reservation.parserAdvertencias)];
    return reservation;
  }

  private static commercialKey(line: LineaReservaOrigen): string {
    const contract = [line.idContratoOrigen, line.contratoOrigen].filter(Boolean).join(' · ');
    const origin = [line.idOrigen, line.origen].filter(Boolean).join(' · ');
    return contract || origin || 'SIN CONTRATO/ORIGEN';
  }

  private static equal(left: unknown, right: unknown): boolean {
    if (typeof left === 'number' || typeof right === 'number') {
      return Math.abs(Number(left ?? 0) - Number(right ?? 0)) < 0.005;
    }
    return this.key(String(left ?? '')) === this.key(String(right ?? ''));
  }

  private static key(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private static phone(value: string): string {
    return value.replace(/\D/g, '');
  }

  private static daysBetween(start: string, end: string): number {
    if (!start || !end) return 0;
    return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000));
  }
}
