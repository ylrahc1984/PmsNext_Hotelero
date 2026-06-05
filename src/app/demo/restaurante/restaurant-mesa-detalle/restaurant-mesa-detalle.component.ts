import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

export interface MesaDetalle {
  mesaId: number;
  numeroMesa: string;
  salon: string;
  estado: string;
  mesero: string;
  personas: number;
  horaApertura: string;
  tiempoOcupada: string;
  habitacion?: string;
  cliente?: string;
  comentario?: string;
}

export interface ConsumoMesa {
  id: number;
  producto: string;
  cantidad: number;
  precio: number;
  subtotal: number;
}

interface AccionOperativa {
  id: string;
  titulo: string;
  icono: string;
  tipo?: 'primary' | 'danger';
}

@Component({
  selector: 'app-restaurant-mesa-detalle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './restaurant-mesa-detalle.component.html',
  styleUrls: ['./restaurant-mesa-detalle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestaurantMesaDetalleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly mesaId = Number(this.route.snapshot.paramMap.get('id') ?? '12');

  readonly mesaDetalle: MesaDetalle = {
    mesaId: this.mesaId,
    numeroMesa: String(this.mesaId),
    salon: 'Principal',
    estado: 'Ocupada',
    mesero: 'Carlos Araya',
    personas: 4,
    horaApertura: '12:15 PM',
    tiempoOcupada: '01:25 h',
    habitacion: '203',
    cliente: 'Juan Perez',
    comentario: 'Cliente solicita poca sal.'
  };

  readonly consumoActual: ConsumoMesa[] = [
    { id: 1, producto: 'Hamburguesa Premium', cantidad: 2, precio: 5500, subtotal: 11000 },
    { id: 2, producto: 'Refresco Coca Cola', cantidad: 4, precio: 1200, subtotal: 4800 },
    { id: 3, producto: 'Cheesecake', cantidad: 1, precio: 3500, subtotal: 3500 }
  ];

  readonly subtotal = 19300;
  readonly descuento = 1000;
  readonly impuestos = 2315;
  readonly propina = 1930;
  readonly total = 22545;

  readonly acciones: AccionOperativa[] = [
    { id: 'agregar-producto', titulo: 'Agregar Producto', icono: 'icon-plus', tipo: 'primary' },
    { id: 'transferir-mesa', titulo: 'Transferir Mesa', icono: 'icon-repeat' },
    { id: 'dividir-cuenta', titulo: 'Dividir Cuenta', icono: 'icon-git-merge' },
    { id: 'cargo-habitacion', titulo: 'Cargo Habitacion', icono: 'icon-home' },
    { id: 'imprimir-cuenta', titulo: 'Imprimir Cuenta', icono: 'icon-printer' },
    { id: 'solicitar-facturacion', titulo: 'Solicitar Facturacion', icono: 'icon-file-text' },
    { id: 'cerrar-mesa', titulo: 'Cerrar Mesa', icono: 'icon-check-circle', tipo: 'danger' }
  ];

  onAccionClick(accion: AccionOperativa): void {
    if (accion.id === 'cerrar-mesa') {
      this.router.navigate(['/restaurante/facturacion']);
    }
  }
}
