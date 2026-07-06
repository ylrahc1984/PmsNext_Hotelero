import { Observable } from 'rxjs';

import { ReservaHabitacionRequest, ReservaHabitacionResponse } from '../interfaces/reserva-habitacion.interface';

export abstract class ReservaHabitacionRepository {
  abstract createReserva(request: ReservaHabitacionRequest): Observable<ReservaHabitacionResponse>;
}

