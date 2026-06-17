import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SharedModule } from 'src/app/theme/shared/shared.module';

type EstadoHabitacion =
  | 'Disponible'
  | 'Ocupada'
  | 'Salida Hoy'
  | 'Salida Mañana'
  | 'Reservada'
  | 'Bloqueada'
  | 'Sucia'
  | 'Limpia';

interface HabitacionRack {
  numero: string;
  categoria: 'Stand' | 'Junior' | 'Deluxe' | 'Suite';
  estado: EstadoHabitacion;
}

interface EstadoKpi {
  label: string;
  estado: EstadoHabitacion | 'Todas';
  cantidad: number;
  className: string;
}

interface AccionOperativa {
  label: string;
  icon: string;
  accent?: 'primary' | 'muted';
}

@Component({
  selector: 'app-room-rack',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './room-rack.component.html',
  styleUrls: ['./room-rack.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomRackComponent {
  readonly hotelActual = 'Hotel PMSNext Central';
  readonly ultimaActualizacion = new Date();
  readonly compra = 505.24;
  readonly venta = 518.72;

  readonly estados: EstadoHabitacion[] = [
    'Disponible',
    'Ocupada',
    'Salida Hoy',
    'Salida Mañana',
    'Reservada',
    'Bloqueada',
    'Sucia',
    'Limpia'
  ];

  readonly habitaciones: HabitacionRack[] = this.generarHabitaciones();
  readonly kpis: EstadoKpi[] = this.generarKpis();
  readonly resumen = this.generarResumen();

  readonly acciones: AccionOperativa[] = [
    { label: 'Asignar Habitacion', icon: 'home', accent: 'primary' },
    { label: 'Ingresar Arribos', icon: 'login' },
    { label: 'Lista Pax In House', icon: 'groups' },
    { label: 'Imprimir Hoja Registro', icon: 'print' } 
  ];

  seleccionarHabitacion(habitacion: HabitacionRack): void {
    console.log(habitacion);
  }

  actualizarVentana(): void {
    console.log('Actualizar Room Rack');
  }

  getEstadoClass(estado: EstadoHabitacion | 'Todas'): string {
    return `estado-${this.slugEstado(estado)}`;
  }

  trackByHabitacion(_: number, habitacion: HabitacionRack): string {
    return habitacion.numero;
  }

  trackByEstado(_: number, kpi: EstadoKpi): string {
    return kpi.label;
  }

  trackByAccion(_: number, accion: AccionOperativa): string {
    return accion.label;
  }

  private generarHabitaciones(): HabitacionRack[] {
    const categorias: HabitacionRack['categoria'][] = ['Stand', 'Junior', 'Deluxe', 'Suite'];
    const estados: EstadoHabitacion[] = [
      'Disponible',
      'Ocupada',
      'Salida Hoy',
      'Salida Mañana',
      'Reservada',
      'Bloqueada',
      'Sucia',
      'Limpia'
    ];

    return Array.from({ length: 7 }, (_, piso) => piso + 1).flatMap((piso) =>
      Array.from({ length: 12 }, (_, index) => {
        const numero = `${piso}${String(index + 1).padStart(2, '0')}`;
        const mix = piso * 12 + index;

        return {
          numero,
          categoria: categorias[mix % categorias.length],
          estado: estados[mix % estados.length]
        };
      })
    );
  }

  private generarKpis(): EstadoKpi[] {
    const todos: EstadoKpi = {
      label: 'Todas',
      estado: 'Todas',
      cantidad: this.habitaciones.length,
      className: this.getEstadoClass('Todas')
    };

    return [
      todos,
      ...this.estados.map((estado) => ({
        label: estado,
        estado,
        cantidad: this.contarPorEstado(estado),
        className: this.getEstadoClass(estado)
      }))
    ];
  }

  private generarResumen(): EstadoKpi[] {
    return [
      { label: 'Total habitaciones', estado: 'Todas', cantidad: this.habitaciones.length, className: this.getEstadoClass('Todas') },
      ...this.estados
        .filter((estado) => ['Disponible', 'Ocupada', 'Reservada', 'Bloqueada', 'Sucia', 'Limpia'].includes(estado))
        .map((estado) => ({
          label: estado === 'Disponible' ? 'Disponibles' : estado === 'Ocupada' ? 'Ocupadas' : estado,
          estado,
          cantidad: this.contarPorEstado(estado),
          className: this.getEstadoClass(estado)
        }))
    ];
  }

  private contarPorEstado(estado: EstadoHabitacion): number {
    return this.habitaciones.filter((habitacion) => habitacion.estado === estado).length;
  }

  private slugEstado(estado: EstadoHabitacion | 'Todas'): string {
    return estado
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-');
  }
}
