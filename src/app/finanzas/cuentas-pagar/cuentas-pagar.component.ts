// angular import
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-cuentas-pagar',
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './cuentas-pagar.component.html',
  styleUrls: ['./cuentas-pagar.component.scss']
})
export class CuentasPagarComponent {
  cuentas = [
    { suplidor: 'Transportes Costa Rica', monto: 15000, fecha: '2025-12-25', estado: 'pendiente' },
    { suplidor: 'Hoteles San Jose', monto: 30000, fecha: '2025-12-26', estado: 'pagada' },
    { suplidor: 'Servicios Caribe', monto: 52000, fecha: '2026-01-03', estado: 'vencida' },
    { suplidor: 'Agencia Sur', monto: 21000, fecha: '2026-01-01', estado: 'pendiente' },
    { suplidor: 'Logistica Norte', monto: 43000, fecha: '2025-12-30', estado: 'pagada' },
    { suplidor: 'Distribuciones Maya', monto: 27000, fecha: '2025-12-28', estado: 'pendiente' }
  ];

  filtros = {
    buscar: '',
    estado: 'todos',
    desde: '',
    hasta: ''
  };

  page = 1;
  pageSize = 5;
  pageSizes = [5, 10, 20];

  getTotal() {
    return this.cuentas.reduce((sum, c) => sum + c.monto, 0).toLocaleString();
  }

  getTotalFiltrado() {
    return this.filteredCuentas().reduce((sum, c) => sum + c.monto, 0);
  }

  filteredCuentas() {
    const texto = this.filtros.buscar.trim().toLowerCase();
    const desde = this.filtros.desde ? new Date(this.filtros.desde) : null;
    const hasta = this.filtros.hasta ? new Date(this.filtros.hasta) : null;

    return this.cuentas.filter((c) => {
      const coincideTexto = !texto || (c.suplidor || '').toLowerCase().includes(texto);
      const coincideEstado = this.filtros.estado === 'todos' || c.estado === this.filtros.estado;
      const fechaCuenta = new Date(c.fecha);
      const coincideDesde = !desde || fechaCuenta >= desde;
      const coincideHasta = !hasta || fechaCuenta <= hasta;
      return coincideTexto && coincideEstado && coincideDesde && coincideHasta;
    });
  }

  pagedCuentas() {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredCuentas().slice(start, start + this.pageSize);
  }

  totalPaginas() {
    return Math.max(1, Math.ceil(this.filteredCuentas().length / this.pageSize));
  }

  changePage(delta: number) {
    const next = this.page + delta;
    const max = this.totalPaginas();
    this.page = Math.min(Math.max(next, 1), max);
  }

  setPage(page: number) {
    const max = this.totalPaginas();
    this.page = Math.min(Math.max(page, 1), max);
  }

  onPageSizeChange(size: number | string) {
    this.pageSize = Number(size) || 5;
    this.page = 1;
  }

  resetFiltros() {
    this.filtros = { buscar: '', estado: 'todos', desde: '', hasta: '' };
    this.page = 1;
  }

  resetPagina() {
    this.page = 1;
  }

  getEstadoClase(estado: string) {
    switch (estado) {
      case 'pagada':
        return 'estado-pagada';
      case 'vencida':
        return 'estado-vencida';
      default:
        return 'estado-pendiente';
    }
  }

  exportarExcel() {
    console.log('Exportar a Excel', this.filteredCuentas());
  }

  imprimir() {
    window.print();
  }
}
