import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';

import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { resolveEstadoLimpieza } from 'src/app/modules/housekeeping/limpieza-habitaciones/models/limpieza-habitacion.util';
import { LimpiezaHabitacionesService } from 'src/app/modules/housekeeping/limpieza-habitaciones/services/limpieza-habitaciones.service';
import { DashboardHousekeepingView } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardHousekeepingService {
  private readonly limpiezaService = inject(LimpiezaHabitacionesService);

  getSummary(operationalDate: string, operator: string): Observable<DashboardHousekeepingView> {
    const date = normalizePmsDateDDMMYYYY(operationalDate);
    const normalizedOperator = operator.trim();

    if (!date || !normalizedOperator) {
      return throwError(() => new Error('No se pudo determinar la fecha operativa o el operador para Housekeeping.'));
    }

    return this.limpiezaService.prepararLista(date, normalizedOperator).pipe(
      map((response) => {
        const rooms = response.habitaciones;
        const cleaningStates = rooms.map((room) => resolveEstadoLimpieza(room.clean));

        return {
          pending: cleaningStates.filter((state) => state === 'PENDIENTE').length,
          clean: cleaningStates.filter((state) => state === 'LIMPIA').length,
          inProgress: cleaningStates.filter((state) => state === 'EN PROCESO').length,
          inspection: cleaningStates.filter((state) => state === 'INSPECCION').length,
          departuresToday: rooms.filter((room) => room.fechaFin === date).length,
          arrivals: rooms.filter((room) => room.estado === 'LLEGADA').length
        };
      })
    );
  }
}
