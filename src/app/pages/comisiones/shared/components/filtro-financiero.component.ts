import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FiltroFinanciero } from '../models/comisiones-ui.model';

@Component({
  selector: 'app-filtro-financiero',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="filtro-financiero">
      <div class="search-box">
        <i class="feather icon-search"></i>
        <input class="form-control" [(ngModel)]="value.busqueda" (ngModelChange)="emit()" placeholder="Buscar documento, agencia o servicio" />
      </div>
      <select class="form-select" [(ngModel)]="value.estado" (ngModelChange)="emit()">
        <option value="">Todos los estados</option>
        <option value="BORRADOR">Borrador</option>
        <option value="PENDIENTE">Pendiente</option>
        <option value="LIQUIDADO">Liquidado</option>
        <option value="PAGADO">Pagado</option>
        <option value="ANULADO">Anulado</option>
        <option value="CERRADO">Cerrado</option>
      </select>
      <input class="form-control" type="date" [(ngModel)]="value.desde" (ngModelChange)="emit()" />
      <input class="form-control" type="date" [(ngModel)]="value.hasta" (ngModelChange)="emit()" />
    </section>
  `,
  styleUrl: './filtro-financiero.component.scss'
})
export class FiltroFinancieroComponent {
  @Input() value: FiltroFinanciero = { busqueda: '', estado: '', desde: '', hasta: '', agencia: '', servicio: '' };
  @Output() valueChange = new EventEmitter<FiltroFinanciero>();

  emit(): void {
    this.valueChange.emit({ ...this.value });
  }
}
