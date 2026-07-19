import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  CargoHabitacion,
  CargoHabitacionConsultaService,
  CargoHabitacionDetalle
} from '../cargos-habitacion/cargo-habitacion-consulta.service';

@Component({
  selector: 'app-cargos-habitacion-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './cargos-habitacion-detalle.component.html',
  styleUrls: ['./cargos-habitacion-detalle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CargosHabitacionDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(CargoHabitacionConsultaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  tipCrgHab = '';
  numCrgHab = '';
  encabezado: CargoHabitacion | null = null;
  detalle: CargoHabitacionDetalle[] = [];
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.tipCrgHab = (params.get('tipCrgHab') ?? '').trim();
      this.numCrgHab = (params.get('numCrgHab') ?? '').trim();
      if (!this.tipCrgHab || !this.numCrgHab) {
        void this.router.navigate(['/restaurante/cargos-habitacion']);
        return;
      }
      this.cargarDetalle();
    });
  }

  get subtotalDetalle(): number {
    return this.sum((item) => item.PFD02_SubTotal || item.PFD02_PrecioSinImpNeto);
  }

  get descuentoDetalle(): number {
    return this.sum((item) => item.PFD02_Descuento);
  }

  get impuestoDetalle(): number {
    return this.sum((item) => item.PPV08_Impuestos);
  }

  get totalDetalle(): number {
    return this.sum((item) => item.PFD02_Total);
  }

  get diferencia(): number {
    return this.round((Number(this.encabezado?.PFD01_MtoTot) || 0) - this.totalDetalle);
  }

  reload(): void {
    this.cargarDetalle();
  }

  estadoTexto(estado: number | undefined): string {
    return Number(estado) === 1 ? 'Anulado' : 'Activo';
  }

  estadoClass(estado: number | undefined): string {
    return Number(estado) === 1 ? 'cargo-estado cargo-estado--anulado' : 'cargo-estado cargo-estado--activo';
  }

  trackByDetalle(index: number, item: CargoHabitacionDetalle): string {
    return `${item.PFD02_Orden ?? index}-${item.PFD02_CodConsumo ?? ''}`;
  }

  private cargarDetalle(): void {
    this.loading = true;
    this.error = null;
    this.encabezado = null;
    this.detalle = [];
    this.cdr.markForCheck();

    this.service
      .consultarDetalle(this.tipCrgHab, this.numCrgHab)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.encabezado = response.encabezado[0] ?? null;
          this.detalle = response.detalle;
          if (!this.encabezado) {
            this.error = response.mensaje || 'No se encontró el encabezado del cargo a habitación.';
          }
        },
        error: (error: unknown) => {
          this.error = error instanceof Error ? error.message : 'No se pudo consultar el detalle del cargo a habitación.';
        }
      });
  }

  private sum(accessor: (item: CargoHabitacionDetalle) => number): number {
    return this.round(this.detalle.reduce((sum, item) => sum + (Number(accessor(item)) || 0), 0));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
