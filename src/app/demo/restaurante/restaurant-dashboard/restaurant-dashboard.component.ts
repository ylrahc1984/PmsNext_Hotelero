import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RestaurantFloorPlanComponent } from '../restaurant-floor-plan/restaurant-floor-plan.component';
import { SharedModule } from 'src/app/theme/shared/shared.module';

interface RestaurantKpi {
  id: string;
  label: string;
  value: string;
  detail: string;
  icon: string;
  accent: 'cyan' | 'green' | 'blue' | 'purple' | 'magenta' | 'orange';
}

export interface SalonRestaurante {
  id: number;
  nombre: string;
  totalMesas: number;
  mesasOcupadas: number;
  porcentajeOcupacion: number;
}

interface EstadoOperativoItem {
  id: string;
  titulo: string;
  valor: string;
  detalle: string;
  icon: string;
}

@Component({
  selector: 'app-restaurant-dashboard',
  standalone: true,
  imports: [CommonModule, SharedModule, RestaurantFloorPlanComponent],
  templateUrl: './restaurant-dashboard.component.html',
  styleUrls: ['./restaurant-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantDashboardComponent {
  readonly kpis: RestaurantKpi[] = [
    {
      id: 'mesas-ocupadas',
      label: 'Mesas Ocupadas',
      value: '18',
      detail: 'de 32 mesas',
      icon: 'icon-grid',
      accent: 'cyan'
    },
    {
      id: 'mesas-libres',
      label: 'Mesas Libres',
      value: '14',
      detail: '43.75% disponibles',
      icon: 'icon-check-circle',
      accent: 'green'
    },
    {
      id: 'pedidos-activos',
      label: 'Pedidos Activos',
      value: '42',
      detail: 'en cocina y barra',
      icon: 'icon-clipboard',
      accent: 'blue'
    },
    {
      id: 'ventas-hoy',
      label: 'Ventas Hoy',
      value: '₡1,250,000',
      detail: '+12.5%',
      icon: 'icon-dollar-sign',
      accent: 'purple'
    },
    {
      id: 'ticket-promedio',
      label: 'Ticket Promedio',
      value: '₡18,500',
      detail: 'por mesa atendida',
      icon: 'icon-bar-chart-2',
      accent: 'magenta'
    },
    {
      id: 'room-service',
      label: 'Room Service',
      value: '5',
      detail: 'pedidos activos',
      icon: 'icon-phone-call',
      accent: 'orange'
    }
  ];

  readonly salones: SalonRestaurante[] = [
    { id: 1, nombre: 'Salón Principal', totalMesas: 32, mesasOcupadas: 12, porcentajeOcupacion: 37 } 
  ];

  readonly estadoOperativo: EstadoOperativoItem[] = [
    { id: 'cocina', titulo: 'Pedidos Cocina', valor: '12', detalle: 'En preparación', icon: 'icon-activity' },
    { id: 'barra', titulo: 'Pedidos Barra', valor: '6', detalle: 'En preparación', icon: 'icon-coffee' },
    { id: 'pendientes', titulo: 'Pendientes por Servir', valor: '3', detalle: 'Listos para entregar', icon: 'icon-clock' },
    { id: 'facturas', titulo: 'Facturas Abiertas', valor: '18', detalle: 'Sin cerrar', icon: 'icon-file-text' },
    { id: 'room-service', titulo: 'Room Service', valor: '5', detalle: 'Pedidos activos', icon: 'icon-phone-call' },
    { id: 'meseros', titulo: 'Meseros Activos', valor: '7', detalle: 'En servicio', icon: 'icon-users' }
  ];
}
