import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { LiquidacionComision, LiquidacionDetalle } from '../../interfaces/liquidacion-comision.interface';
import { LiquidacionComisionService } from '../../services/liquidacion-comision.service';
import { LiquidacionDetalleService } from '../../services/liquidacion-detalle.service';
import { EstadoBadgeComponent } from '../../shared/components/estado-badge.component';
import { TimelineLiquidacionComponent, TimelineLiquidacionItem } from '../../shared/components/timeline-liquidacion.component';
import { asArray, readNumber, readText } from '../../shared/models/comisiones-normalizers';
import { ComisionesStore } from '../../store/comisiones.store';

@Component({
  selector: 'app-liquidaciones-lista',
  standalone: true,
  imports: [CommonModule, RouterLink, EstadoBadgeComponent, TimelineLiquidacionComponent],
  templateUrl: './liquidaciones-lista.component.html',
  styleUrl: './liquidaciones-lista.component.scss'
})
export class LiquidacionesListaComponent implements OnInit {
  private readonly liquidacionService = inject(LiquidacionComisionService);
  private readonly detalleService = inject(LiquidacionDetalleService);
  readonly store = inject(ComisionesStore);

  readonly liquidaciones = signal<LiquidacionComision[]>([]);
  readonly detalles = signal<LiquidacionDetalle[]>([]);

  readonly selected = computed(() => this.store.selectedLiquidacion() ?? this.liquidaciones()[0] ?? null);
  readonly timeline = computed<TimelineLiquidacionItem[]>(() => {
    const item = this.selected();
    const estado = readText(item as Record<string, unknown>, ['AD22_Estado'], 'BORRADOR').toUpperCase();
    return [
      { label: 'Borrador', date: readText(item as Record<string, unknown>, ['AD22_FechaLiquidacion'], ''), active: true },
      { label: 'Cerrada', detail: 'Aprobacion financiera', active: ['CERRADO', 'PAGADO'].includes(estado) },
      { label: 'Pagada', detail: 'Salida bancaria aplicada', active: estado === 'PAGADO' }
    ];
  });

  ngOnInit(): void {
    this.liquidacionService
      .listar()
      .pipe(catchError(() => of([])))
      .subscribe((data) => {
        const rows = asArray<LiquidacionComision>(data);
        this.liquidaciones.set(rows);
        this.store.selectLiquidacion(rows[0] ?? null);
        this.loadDetalle(rows[0]);
      });
  }

  select(item: LiquidacionComision): void {
    this.store.selectLiquidacion(item);
    this.loadDetalle(item);
  }

  cerrar(): void {
    const id = this.selected()?.AD22_Id;
    if (id) this.liquidacionService.cerrar(id).pipe(catchError(() => of(null))).subscribe();
  }

  pagar(): void {
    const id = this.selected()?.AD22_Id;
    if (id) this.liquidacionService.pagar(id).pipe(catchError(() => of(null))).subscribe();
  }

  anular(): void {
    const id = this.selected()?.AD22_Id;
    if (id) this.liquidacionService.anular(id).pipe(catchError(() => of(null))).subscribe();
  }

  loadDetalle(item: LiquidacionComision | null | undefined): void {
    const id = item?.AD22_Id;
    if (!id) {
      this.detalles.set([]);
      return;
    }

    this.detalleService
      .porLiquidacion(id)
      .pipe(catchError(() => of([])))
      .subscribe((data) => this.detalles.set(asArray<LiquidacionDetalle>(data)));
  }

  text(record: Record<string, unknown> | null | undefined, keys: string[], fallback = 'N/D'): string {
    return readText(record, keys, fallback);
  }

  money(record: Record<string, unknown> | null | undefined, keys: string[]): string {
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD' }).format(readNumber(record, keys));
  }
}
