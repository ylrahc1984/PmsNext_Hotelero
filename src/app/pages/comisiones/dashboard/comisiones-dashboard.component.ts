import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { ComisionCalculadaService } from '../services/comision-calculada.service';
import { LiquidacionComisionService } from '../services/liquidacion-comision.service';
import { ResumenCardComponent } from '../shared/components/resumen-card.component';
import { EstadoBadgeComponent } from '../shared/components/estado-badge.component';
import { asArray, readNumber, readText } from '../shared/models/comisiones-normalizers';
import { ComisionCalculada } from '../interfaces/comision-calculada.interface';
import { LiquidacionComision } from '../interfaces/liquidacion-comision.interface';

@Component({
  selector: 'app-comisiones-dashboard',
  standalone: true,
  imports: [CommonModule, ResumenCardComponent, EstadoBadgeComponent],
  templateUrl: './comisiones-dashboard.component.html',
  styleUrl: './comisiones-dashboard.component.scss'
})
export class ComisionesDashboardComponent implements OnInit {
  private readonly comisionesService = inject(ComisionCalculadaService);
  private readonly liquidacionService = inject(LiquidacionComisionService);

  readonly loading = signal(false);
  readonly comisiones = signal<ComisionCalculada[]>([]);
  readonly liquidaciones = signal<LiquidacionComision[]>([]);

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      comisiones: this.comisionesService.listar().pipe(catchError(() => of([]))),
      liquidaciones: this.liquidacionService.listar().pipe(catchError(() => of([])))
    })
      .pipe(
        map(({ comisiones, liquidaciones }) => ({
          comisiones: asArray<ComisionCalculada>(comisiones),
          liquidaciones: asArray<LiquidacionComision>(liquidaciones)
        }))
      )
      .subscribe(({ comisiones, liquidaciones }) => {
        this.comisiones.set(comisiones);
        this.liquidaciones.set(liquidaciones);
        this.loading.set(false);
      });
  }

  totalPendiente(): number {
    return this.comisiones()
      .filter((item) => readText(item, ['AD21_Estado', 'estado'], '').toUpperCase().includes('PENDIENTE'))
      .reduce((total, item) => total + readNumber(item, ['AD21_MontoComision', 'montoComision']), 0);
  }

  totalLiquidado(): number {
    return this.liquidaciones().reduce((total, item) => total + readNumber(item, ['AD22_Total', 'total']), 0);
  }

  money(value: number): string {
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD' }).format(value);
  }

  count(value: number): string {
    return String(value);
  }

  text(record: Record<string, unknown>, keys: string[], fallback = 'N/D'): string {
    return readText(record, keys, fallback);
  }
}
