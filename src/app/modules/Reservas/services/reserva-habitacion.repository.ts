import { Observable } from 'rxjs';

import { ReservaHabitacionDetalle, ReservaHabitacionRequest, ReservaHabitacionResponse } from '../interfaces/reserva-habitacion.interface';

export abstract class ReservaHabitacionRepository {
  abstract createReserva(request: ReservaHabitacionRequest): Observable<ReservaHabitacionResponse>;
  abstract getReservaDetalle(codReserva: string): Observable<ReservaHabitacionDetalle>;
  abstract updateReserva(codReserva: string, request: ReservaHabitacionRequest): Observable<ReservaHabitacionResponse>;
  abstract anularReserva(codReserva: string, fecAnulada: string, operador: string, procesa: number): Observable<ReservaHabitacionResponse>;
  abstract cambiarEstadoReserva(codReserva: string, estado: string, operador: string): Observable<ReservaHabitacionResponse>;
  abstract getConfirmacionPdf(codReserva: string): Observable<Blob>;
}
