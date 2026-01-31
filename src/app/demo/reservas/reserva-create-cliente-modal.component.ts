import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ClienteService } from '../catalogos/agencias-comisionistas/cliente.service';
import { ClienteUI } from '../catalogos/agencias-comisionistas/cliente.models';

@Component({
  selector: 'app-reserva-create-cliente-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reserva-create-cliente-modal.component.html',
  styleUrls: ['./reserva-create-cliente-modal.component.scss']
})
export class ReservaCreateClienteModalComponent implements OnChanges {
  @Input() open = false;
  @Output() close = new EventEmitter<void>();
  @Output() clienteSelected = new EventEmitter<ClienteUI>();

  clienteSearchTerm = '';
  clientesLoading = false;
  clientes: ClienteUI[] = [];

  clientePage = 1;
  clientePageSize = 10;
  clienteTotalPages = 1;
  clienteTotalRegistros = 0;

  private clienteService = inject(ClienteService);

  ngOnChanges(changes: SimpleChanges): void {
    const openChange = changes['open'];
    if (openChange?.currentValue === true && openChange?.previousValue !== true) {
      this.clientePage = 1;
      this.buscarClientes();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  buscarClientes(): void {
    this.clientesLoading = true;
    this.clienteService.getClientes(this.clientePage, this.clientePageSize, this.clienteSearchTerm).subscribe({
      next: (res) => {
        this.clientes = res.data ?? [];
        this.clienteTotalRegistros = res.totalRegistros ?? 0;
        this.clienteTotalPages = res.totalPages ?? 1;
        this.clientesLoading = false;
      },
      error: () => {
        this.clientes = [];
        this.clienteTotalRegistros = 0;
        this.clienteTotalPages = 1;
        this.clientesLoading = false;
      }
    });
  }

  limpiarBusquedaClientes(): void {
    this.clienteSearchTerm = '';
    this.clientePage = 1;
    this.buscarClientes();
  }

  seleccionarCliente(cliente: ClienteUI): void {
    this.clienteSelected.emit(cliente);
    this.close.emit();
  }

  paginaAnteriorClientes(): void {
    if (this.clientePage > 1) {
      this.clientePage -= 1;
      this.buscarClientes();
    }
  }

  paginaSiguienteClientes(): void {
    if (this.clientePage < this.clienteTotalPages) {
      this.clientePage += 1;
      this.buscarClientes();
    }
  }
}
