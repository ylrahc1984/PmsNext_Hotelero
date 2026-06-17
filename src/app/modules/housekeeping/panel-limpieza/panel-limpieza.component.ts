import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SharedModule } from 'src/app/theme/shared/shared.module';

type EstadoHousekeeping = 'LIMPIA' | 'SUCIA' | 'EN PROCESO' | 'INSPECCION' | 'FUERA DE SERVICIO' | 'PRIORIDAD';

interface HabitacionHousekeeping {
  id: number;
  numero: string;
  categoria: CategoriaHabitacion;
  piso: string;
  estado: EstadoHousekeeping;
  camareraId: number;
}

type CategoriaHabitacion = 'Stand' | 'Junior' | 'Deluxe' | 'Suite';

interface CamareraActiva {
  id: number;
  nombre: string;
  habitacionesAsignadas: number;
  porcentajeCarga: number;
}

interface HabitacionPrioritaria {
  habitacion: string;
  categoria: CategoriaHabitacion;
  horaCheckIn: string;
}

interface KpiHousekeeping {
  titulo: string;
  valor: number;
  icono: string;
  color: 'green' | 'orange' | 'blue' | 'red' | 'cyan' | 'emerald';
}

@Component({
  selector: 'app-panel-limpieza',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './panel-limpieza.component.html',
  styleUrls: ['./panel-limpieza.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PanelLimpiezaComponent {
  isLoading = false;

  filtroPiso = 'Todos';
  filtroTipo = 'Todos';
  filtroEstado = 'Todos';
  filtroCamarera = 'Todas';

  readonly pisos = ['Todos', 'Piso 1', 'Piso 2', 'Piso 3', 'Piso 4', 'Piso 5', 'Piso 6', 'Piso 7'];
  readonly tiposHabitacion = ['Todos', 'Stand', 'Junior', 'Deluxe', 'Suite'];
  readonly estados = ['Todos', 'LIMPIA', 'SUCIA', 'EN PROCESO', 'INSPECCION', 'FUERA DE SERVICIO', 'PRIORIDAD'];

  readonly kpis: KpiHousekeeping[] = [
    { titulo: 'Habitaciones Limpias', valor: 74, icono: 'check_circle', color: 'green' },
    { titulo: 'Pendientes de Limpieza', valor: 16, icono: 'cleaning_services', color: 'orange' },
    { titulo: 'En Proceso', valor: 9, icono: 'autorenew', color: 'blue' },
    { titulo: 'Prioridad Alta', valor: 5, icono: 'error_outline', color: 'red' },
    { titulo: 'Camareras Activas', valor: 12, icono: 'groups', color: 'cyan' },
    { titulo: 'Ready Check-In', valor: 38, icono: 'bed', color: 'emerald' }
  ];

  readonly camareras: CamareraActiva[] = [
    { id: 1, nombre: 'Maria Lopez', habitacionesAsignadas: 8, porcentajeCarga: 92 },
    { id: 2, nombre: 'Ana Vargas', habitacionesAsignadas: 5, porcentajeCarga: 64 },
    { id: 3, nombre: 'Sandra Ruiz', habitacionesAsignadas: 11, porcentajeCarga: 88 },
    { id: 4, nombre: 'Laura Medina', habitacionesAsignadas: 7, porcentajeCarga: 76 },
    { id: 5, nombre: 'Carmen Solis', habitacionesAsignadas: 6, porcentajeCarga: 58 }
  ];

  readonly habitacionesPrioritarias: HabitacionPrioritaria[] = [
    { habitacion: '203', categoria: 'Deluxe', horaCheckIn: '14:00' },
    { habitacion: '305', categoria: 'Suite', horaCheckIn: '15:00' },
    { habitacion: '412', categoria: 'Deluxe', horaCheckIn: '16:00' },
    { habitacion: '607', categoria: 'Suite', horaCheckIn: '16:30' },
    { habitacion: '708', categoria: 'Suite', horaCheckIn: '17:00' }
  ];

  readonly habitaciones: HabitacionHousekeeping[] = this.generarHabitaciones();

  get camarerasFiltro(): string[] {
    return ['Todas', ...this.camareras.map((camarera) => camarera.nombre)];
  }

  get habitacionesFiltradas(): HabitacionHousekeeping[] {
    return this.habitaciones.filter((room) => {
      const camarera = this.camareras.find((item) => item.id === room.camareraId);

      return (
        (this.filtroPiso === 'Todos' || room.piso === this.filtroPiso) &&
        (this.filtroTipo === 'Todos' || room.categoria === this.filtroTipo) &&
        (this.filtroEstado === 'Todos' || room.estado === this.filtroEstado) &&
        (this.filtroCamarera === 'Todas' || camarera?.nombre === this.filtroCamarera)
      );
    });
  }

  onRoomSelected(room: HabitacionHousekeeping): void {
    console.log(room);
  }

  limpiarFiltros(): void {
    this.filtroPiso = 'Todos';
    this.filtroTipo = 'Todos';
    this.filtroEstado = 'Todos';
    this.filtroCamarera = 'Todas';
  }

  actualizar(): void {
    console.log('Actualizar panel de limpieza');
    this.isLoading = true;
    window.setTimeout(() => {
      this.isLoading = false;
    }, 450);
  }

  imprimir(): void {
    console.log('Imprimir panel de limpieza');
  }

  exportarExcel(): void {
    console.log('Exportar Excel panel de limpieza');
  }

  verTodasCamareras(): void {
    console.log('Ver todas las camareras');
  }

  verTodasPrioritarias(): void {
    console.log('Ver todas las habitaciones prioritarias');
  }

  getRoomClass(estado: EstadoHousekeeping): string {
    return `room-card--${this.slugEstado(estado)}`;
  }

  getLegendClass(estado: EstadoHousekeeping): string {
    return `legend-dot--${this.slugEstado(estado)}`;
  }

  trackByRoom(_: number, room: HabitacionHousekeeping): number {
    return room.id;
  }

  trackByCamarera(_: number, camarera: CamareraActiva): number {
    return camarera.id;
  }

  trackByKpi(_: number, kpi: KpiHousekeeping): string {
    return kpi.titulo;
  }

  trackByPrioritaria(_: number, room: HabitacionPrioritaria): string {
    return room.habitacion;
  }

  private slugEstado(estado: EstadoHousekeeping): string {
    return estado.toLowerCase().replace(/\s+/g, '-');
  }

  private generarHabitaciones(): HabitacionHousekeeping[] {
    const categorias: CategoriaHabitacion[] = ['Stand', 'Junior', 'Deluxe', 'Suite'];
    const estados: EstadoHousekeeping[] = ['INSPECCION', 'FUERA DE SERVICIO', 'PRIORIDAD', 'LIMPIA', 'EN PROCESO', 'SUCIA'];
    const habitaciones: HabitacionHousekeeping[] = [];

    for (let piso = 1; piso <= 7; piso++) {
      for (let numero = 1; numero <= 12; numero++) {
        const index = habitaciones.length;

        habitaciones.push({
          id: index + 1,
          numero: `${piso}${numero.toString().padStart(2, '0')}`,
          categoria: categorias[index % categorias.length],
          piso: `Piso ${piso}`,
          estado: estados[index % estados.length],
          camareraId: (index % this.camareras.length) + 1
        });
      }
    }

    return habitaciones;
  }
}
