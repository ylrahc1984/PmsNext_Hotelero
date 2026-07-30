import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OperationalDateService } from 'src/app/core/services/operational-date.service';
import { normalizePmsDateDDMMYYYY } from 'src/app/core/utils/pms-date.util';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { switchMap } from 'rxjs/operators';
import { TipoCambioService } from './tipo-cambio.service';

@Component({
  selector: 'app-tipo-cambio',
  imports: [CommonModule, FormsModule, SharedModule, RouterLink],
  templateUrl: './tipo-cambio.component.html',
  styleUrls: ['./tipo-cambio.component.scss']
})
export class TipoCambioComponent implements OnInit {
  private readonly tipoCambioService = inject(TipoCambioService);
  private readonly operationalDateService = inject(OperationalDateService);
  private readonly destroyRef = inject(DestroyRef);

  fechaDesde = signal('');
  fechaHasta = signal('');

  tipoCambioActual = computed(() => this.tipoCambioService.getActual());

  historialFiltrado = computed(() => {
    return this.tipoCambioService.getByRangoFechas(this.fechaDesde() || undefined, this.fechaHasta() || undefined);
  });

  ngOnInit(): void {
    this.operationalDateService
      .ensureLoaded()
      .pipe(
        switchMap((operationalDate) =>
          this.tipoCambioService.fetchTipoCambio(normalizePmsDateDDMMYYYY(operationalDate), 'usd')
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        error: (error) => console.error('No se pudo consultar el tipo de cambio de la fecha operativa.', error)
      });
  }

  clearFilters() {
    this.fechaDesde.set('');
    this.fechaHasta.set('');
  }
}
