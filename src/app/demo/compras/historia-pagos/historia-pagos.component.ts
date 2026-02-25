import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type HistoriaPagosFiltro = {
  buscar: string;
  metodo: string;
  desde: string;
  hasta: string;
};

@Component({
  selector: 'app-historia-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historia-pagos.component.html',
  styleUrls: ['./historia-pagos.component.scss']
})
export class HistoriaPagosComponent {
  filtros: HistoriaPagosFiltro = {
    buscar: '',
    metodo: '',
    desde: '',
    hasta: ''
  };

  readonly metodos = ['Transferencia', 'Tarjeta', 'Efectivo', 'Cheque'];

  readonly pagos: Array<{
    referencia: string;
    proveedor: string;
    fecha: string;
    metodo: string;
    monto: number;
    estado: string;
  }> = [];

  get totalRegistros(): number {
    return this.pagos.length;
  }

  limpiar(): void {
    this.filtros = {
      buscar: '',
      metodo: '',
      desde: '',
      hasta: ''
    };
  }
}
