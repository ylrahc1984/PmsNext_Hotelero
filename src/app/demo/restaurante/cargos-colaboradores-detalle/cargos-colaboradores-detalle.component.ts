import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from 'src/app/theme/shared/shared.module';
import {
  CargoColaborador,
  CargoColaboradorDetalle,
  RestaurantCollaboratorChargeService
} from '../services/restaurant-collaborator-charge.service';

@Component({
  selector: 'app-cargos-colaboradores-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './cargos-colaboradores-detalle.component.html',
  styleUrls: ['./cargos-colaboradores-detalle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CargosColaboradoresDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(RestaurantCollaboratorChargeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  tipOpe = '';
  numOpe = '';
  encabezado: CargoColaborador | null = null;
  detalle: CargoColaboradorDetalle[] = [];
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.tipOpe = (params.get('tipOpe') ?? '').trim();
      this.numOpe = (params.get('numOpe') ?? '').trim();
      if (!this.tipOpe || !this.numOpe) {
        void this.router.navigate(['/restaurante/cargos-colaboradores']);
        return;
      }
      this.cargarDetalle();
    });
  }

  get totalDetalle(): number {
    return this.detalle.reduce((sum, item) => sum + (Number(item.PPV11_Total) || 0), 0);
  }

  get diferencia(): number {
    return (Number(this.encabezado?.PPV10_TotalDocu) || 0) - this.totalDetalle;
  }

  reload(): void {
    this.cargarDetalle();
  }

  estadoClass(estado: string | undefined): string {
    const normalized = (estado ?? '').trim().toUpperCase();
    if (normalized === 'PEN' || normalized === 'P') return 'cargo-estado cargo-estado--pendiente';
    if (normalized === 'ANU' || normalized === 'A' || normalized.includes('ANUL')) return 'cargo-estado cargo-estado--anulado';
    if (normalized === 'PAG' || normalized === 'C') return 'cargo-estado cargo-estado--completado';
    return 'cargo-estado';
  }

  trackByDetalle(index: number, item: CargoColaboradorDetalle): string {
    return `${item.PPV11_Orden ?? index}-${item.PPV11_CodProducto ?? ''}`;
  }

  private cargarDetalle(): void {
    this.loading = true;
    this.error = null;
    this.encabezado = null;
    this.detalle = [];
    this.cdr.markForCheck();

    this.service
      .consultarDetalle(this.tipOpe, this.numOpe)
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
          this.detalle = response.detalle ?? [];
          if (!this.encabezado) {
            this.error = response.mensaje && response.mensaje !== 'OK'
              ? response.mensaje
              : 'No se encontró el encabezado del cargo solicitado.';
          }
        },
        error: (error: unknown) => {
          this.error = error instanceof Error ? error.message : 'No se pudo consultar el detalle del cargo.';
        }
      });
  }
}
