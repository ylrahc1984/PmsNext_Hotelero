import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-servicio-comisionable-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="service-toolbar">
      <button class="btn btn-primary btn-sm" type="button" (click)="newConfig.emit()">
        <i class="feather icon-plus me-1"></i>
        Nuevo Servicio
      </button>

      <div class="search-field">
        <i class="feather icon-search"></i>
        <input
          class="form-control"
          [ngModel]="search"
          (ngModelChange)="searchChange.emit($event)"
          placeholder="Buscar servicio, codigo u observacion"
          autocomplete="off"
        />
      </div>

      <select class="form-select" [ngModel]="status" (ngModelChange)="statusChange.emit($event)">
        <option value="">Todos</option>
        <option value="ACTIVOS">Activos</option>
        <option value="INACTIVOS">Inactivos</option>
      </select>

      <select class="form-select" [ngModel]="commissionStatus" (ngModelChange)="commissionStatusChange.emit($event)">
        <option value="">Elegibilidad</option>
        <option value="COMISIONABLES">Comisionables</option>
        <option value="NO_COMISIONABLES">No comisionables</option>
      </select>

      <select class="form-select" [ngModel]="overrideStatus" (ngModelChange)="overrideStatusChange.emit($event)">
        <option value="">Override</option>
        <option value="PERMITIDO">Permitido</option>
        <option value="BLOQUEADO">Bloqueado</option>
      </select>

      <button class="btn btn-outline-secondary btn-sm icon-btn" type="button" (click)="refresh.emit()" [disabled]="loading">
        <i class="feather icon-refresh-cw"></i>
      </button>
    </section>
  `,
  styleUrl: './servicio-comisionable-toolbar.component.scss'
})
export class ServicioComisionableToolbarComponent {
  @Input() search = '';
  @Input() status = '';
  @Input() commissionStatus = '';
  @Input() overrideStatus = '';
  @Input() loading = false;
  @Output() searchChange = new EventEmitter<string>();
  @Output() statusChange = new EventEmitter<string>();
  @Output() commissionStatusChange = new EventEmitter<string>();
  @Output() overrideStatusChange = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
  @Output() newConfig = new EventEmitter<void>();
}
