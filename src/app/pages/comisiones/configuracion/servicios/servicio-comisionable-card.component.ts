import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ServicioComisionable } from '../../interfaces/config-comision.interface';

@Component({
  selector: 'app-servicio-comisionable-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="service-card">
      <div class="card-head">
        <div>
          <span class="code">{{ servicio.AD16_CodServicio || 'N/D' }}</span>
          <h2>{{ nombreServicio || servicio.AD16_NombreServicio || 'Servicio ' + (servicio.AD16_CodServicio || 'N/D') }}</h2>
        </div>
        <span class="state-badge" [class.inactive]="!servicio.AD16_Activo">{{ servicio.AD16_Activo ? 'ACTIVO' : 'INACTIVO' }}</span>
      </div>

      <div class="badge-row">
        <span class="commission-badge" [class.no]="!servicio.AD16_Comisionable">
          <i [class]="servicio.AD16_Comisionable ? 'feather icon-check' : 'feather icon-x'"></i>
          {{ servicio.AD16_Comisionable ? 'Comisionable' : 'No comisionable' }}
        </span>
        <span class="override-badge" [class.blocked]="!servicio.AD16_PermiteOverride">
          <i [class]="servicio.AD16_PermiteOverride ? 'feather icon-unlock' : 'feather icon-lock'"></i>
          {{ servicio.AD16_PermiteOverride ? 'Permite override' : 'Override bloqueado' }}
        </span>
      </div>

      <div class="meta-box">
        <span>Fecha registro</span>
        <strong>{{ servicio.AD16_FechaRegistro || 'Sin registro' }}</strong>
      </div>

      <p>{{ servicio.AD16_Observaciones || 'Sin observaciones financieras.' }}</p>

      <footer>
        <button class="btn btn-outline-primary btn-sm" type="button" (click)="edit.emit(servicio)">
          <i class="feather icon-edit-2 me-1"></i>
          Editar
        </button>
        <button
          class="btn btn-sm"
          [class.btn-outline-danger]="servicio.AD16_Activo"
          [class.btn-outline-success]="!servicio.AD16_Activo"
          type="button"
          (click)="toggle.emit(servicio)"
        >
          {{ servicio.AD16_Activo ? 'Desactivar' : 'Activar' }}
        </button>
      </footer>
    </article>
  `,
  styleUrl: './servicio-comisionable-card.component.scss'
})
export class ServicioComisionableCardComponent {
  @Input({ required: true }) servicio!: ServicioComisionable;
  @Input() nombreServicio = '';
  @Output() edit = new EventEmitter<ServicioComisionable>();
  @Output() toggle = new EventEmitter<ServicioComisionable>();
}
