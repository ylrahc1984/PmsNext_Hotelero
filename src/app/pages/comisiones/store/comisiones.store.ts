import { Injectable, computed, signal } from '@angular/core';
import { FiltroFinanciero } from '../shared/models/comisiones-ui.model';
import { LiquidacionComision } from '../interfaces/liquidacion-comision.interface';

const DEFAULT_FILTER: FiltroFinanciero = {
  busqueda: '',
  estado: '',
  desde: '',
  hasta: '',
  agencia: '',
  servicio: ''
};

@Injectable({ providedIn: 'root' })
export class ComisionesStore {
  readonly filtros = signal<FiltroFinanciero>({ ...DEFAULT_FILTER });
  readonly page = signal(1);
  readonly pageSize = signal(15);
  readonly selectedLiquidacion = signal<LiquidacionComision | null>(null);
  readonly dashboardRefreshTick = signal(0);

  readonly hasActiveFilters = computed(() => {
    const filtros = this.filtros();
    return Object.values(filtros).some((value) => String(value ?? '').trim() !== '');
  });

  readonly queryParams = computed(() => {
    const filtros = this.filtros();
    return {
      ...filtros,
      pageNumber: this.page(),
      pageSize: this.pageSize()
    };
  });

  updateFiltros(value: Partial<FiltroFinanciero>): void {
    this.filtros.update((current) => ({ ...current, ...value }));
    this.page.set(1);
  }

  resetFiltros(): void {
    this.filtros.set({ ...DEFAULT_FILTER });
    this.page.set(1);
  }

  selectLiquidacion(liquidacion: LiquidacionComision | null): void {
    this.selectedLiquidacion.set(liquidacion);
  }

  refreshDashboard(): void {
    this.dashboardRefreshTick.update((value) => value + 1);
  }
}
