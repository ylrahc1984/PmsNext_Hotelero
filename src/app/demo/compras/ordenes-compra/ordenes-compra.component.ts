import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type OrdenCompraFiltro = {
  buscar: string;
  estado: string;
  desde: string;
  hasta: string;
};

@Component({
  selector: 'app-ordenes-compra',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ordenes-compra.component.html',
  styleUrls: ['./ordenes-compra.component.scss']
})
export class OrdenesCompraComponent {
  filtros: OrdenCompraFiltro = {
    buscar: '',
    estado: '',
    desde: '',
    hasta: ''
  };

  readonly estados = ['Pendiente', 'Aprobada', 'Recibida', 'Anulada'];

  readonly ordenes: Array<{
    codigo: string;
    proveedor: string;
    fecha: string;
    estado: string;
    total: number;
  }> = [];

  get totalRegistros(): number {
    return this.ordenes.length;
  }

  limpiar(): void {
    this.filtros = {
      buscar: '',
      estado: '',
      desde: '',
      hasta: ''
    };
  }
}
