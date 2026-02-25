import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type RecepcionFiltro = {
  buscar: string;
  estado: string;
  desde: string;
  hasta: string;
};

@Component({
  selector: 'app-recepcion-facturas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recepcion-facturas.component.html',
  styleUrls: ['./recepcion-facturas.component.scss']
})
export class RecepcionFacturasComponent {
  filtros: RecepcionFiltro = {
    buscar: '',
    estado: '',
    desde: '',
    hasta: ''
  };

  readonly estados = ['Pendiente', 'Recibida', 'Observada', 'Rechazada'];

  readonly facturas: Array<{
    factura: string;
    proveedor: string;
    fecha: string;
    estado: string;
    monto: number;
  }> = [];

  get totalRegistros(): number {
    return this.facturas.length;
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
