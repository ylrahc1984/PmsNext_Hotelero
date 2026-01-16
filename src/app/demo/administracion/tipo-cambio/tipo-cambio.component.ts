import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { TipoCambioService } from './tipo-cambio.service';

@Component({
  selector: 'app-tipo-cambio',
  imports: [CommonModule, FormsModule, SharedModule, RouterLink],
  templateUrl: './tipo-cambio.component.html',
  styleUrls: ['./tipo-cambio.component.scss']
})
export class TipoCambioComponent {
  private tipoCambioService = inject(TipoCambioService);

  fechaDesde = signal('');
  fechaHasta = signal('');

  tipoCambioActual = computed(() => this.tipoCambioService.getActual());

  historialFiltrado = computed(() => {
    return this.tipoCambioService.getByRangoFechas(this.fechaDesde() || undefined, this.fechaHasta() || undefined);
  });

  clearFilters() {
    this.fechaDesde.set('');
    this.fechaHasta.set('');
  }
}
