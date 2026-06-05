import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

export interface MesaDemo {
  id: number;
  nombre: string;
  estado: 'LIBRE' | 'OCUPADA' | 'CUENTA' | 'RESERVADA' | 'LIMPIEZA';
  tipo: 'CUADRADA' | 'REDONDA' | 'VIP';
  personas?: number;
  consumo?: number;
  horaReserva?: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-restaurant-floor-plan',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './restaurant-floor-plan.component.html',
  styleUrls: ['./restaurant-floor-plan.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantFloorPlanComponent {
  private readonly router = inject(Router);
  private readonly baseWidth = 1180;
  private readonly baseHeight = 620;

  readonly mesas: MesaDemo[] = [
    { id: 1, nombre: 'Mesa 1', estado: 'LIBRE', tipo: 'CUADRADA', x: 98, y: 68 },
    { id: 2, nombre: 'Mesa 2', estado: 'OCUPADA', tipo: 'CUADRADA', personas: 4, consumo: 45200, x: 292, y: 74 },
    { id: 3, nombre: 'Mesa 3', estado: 'OCUPADA', tipo: 'REDONDA', personas: 2, consumo: 24100, x: 515, y: 66 },
    { id: 4, nombre: 'Mesa 4', estado: 'LIBRE', tipo: 'CUADRADA', x: 770, y: 84 },
    { id: 5, nombre: 'Mesa 5', estado: 'OCUPADA', tipo: 'CUADRADA', personas: 3, consumo: 33200, x: 182, y: 176 },
    { id: 6, nombre: 'Mesa 6', estado: 'LIMPIEZA', tipo: 'REDONDA', x: 398, y: 184 },
    { id: 7, nombre: 'Mesa 7', estado: 'CUENTA', tipo: 'CUADRADA', x: 628, y: 176 },
    { id: 8, nombre: 'Mesa 8', estado: 'LIBRE', tipo: 'REDONDA', x: 862, y: 196 },
    { id: 9, nombre: 'Mesa 9', estado: 'OCUPADA', tipo: 'CUADRADA', personas: 4, consumo: 51750, x: 88, y: 286 },
    { id: 10, nombre: 'Mesa 10', estado: 'OCUPADA', tipo: 'REDONDA', personas: 5, consumo: 68800, x: 322, y: 296 },
    { id: 11, nombre: 'Mesa 11', estado: 'LIBRE', tipo: 'CUADRADA', x: 548, y: 292 },
    { id: 12, nombre: 'Mesa 12', estado: 'OCUPADA', tipo: 'CUADRADA', personas: 4, consumo: 45200, x: 782, y: 286 },
    { id: 13, nombre: 'Mesa 13', estado: 'RESERVADA', tipo: 'REDONDA', horaReserva: '7:00 PM', x: 188, y: 404 },
    { id: 14, nombre: 'Mesa 14', estado: 'LIBRE', tipo: 'CUADRADA', x: 425, y: 414 },
    { id: 15, nombre: 'Mesa 15', estado: 'CUENTA', tipo: 'CUADRADA', x: 660, y: 406 },
    { id: 16, nombre: 'Mesa 16', estado: 'OCUPADA', tipo: 'REDONDA', personas: 6, consumo: 88500, x: 906, y: 412 },
    { id: 17, nombre: 'Mesa 17', estado: 'LIBRE', tipo: 'CUADRADA', x: 108, y: 520 },
    { id: 18, nombre: 'Mesa 18', estado: 'RESERVADA', tipo: 'REDONDA', horaReserva: '8:30 PM', x: 352, y: 520 },
    { id: 19, nombre: 'Mesa 19', estado: 'LIBRE', tipo: 'CUADRADA', x: 624, y: 522 },
    { id: 20, nombre: 'Mesa 20', estado: 'LIBRE', tipo: 'VIP', x: 908, y: 506 }
  ];

  mesaSeleccionada: MesaDemo | null = this.mesas[1];

  onMesaClick(mesa: MesaDemo): void {
    this.mesaSeleccionada = mesa;
    this.router.navigate(['/restaurante/mesa', mesa.id]);
  }

  getMesaStyle(mesa: MesaDemo): Record<string, string> {
    return {
      left: `${(mesa.x / this.baseWidth) * 100}%`,
      top: `${(mesa.y / this.baseHeight) * 100}%`
    };
  }

  getMesaEstadoClass(mesa: MesaDemo): string {
    return `mesa-card--${mesa.estado.toLowerCase()}`;
  }

  getMesaTipoClass(mesa: MesaDemo): string {
    return `mesa-card--${mesa.tipo.toLowerCase()}`;
  }
}
