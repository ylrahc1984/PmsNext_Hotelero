import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ClienteService } from '../agencias-comisionistas/cliente.service';
import { ClienteUI } from '../agencias-comisionistas/cliente.models';
import { ListaPrecioService } from './lista-precio.service';
import { ListaPrecioUI } from './lista-precio.models';
import { TarifasClienteService } from './tarifas-cliente.service';
import { TarifaClienteUI } from './tarifas-cliente.models';

@Component({
  selector: 'app-listas-precios-asignaciones',
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: './listas-precios-asignaciones.component.html',
  styleUrls: ['./listas-precios-asignaciones.component.scss']
})
export class ListasPreciosAsignacionesComponent implements OnInit {
  private clientesService = inject(ClienteService);
  private listasPreciosService = inject(ListaPrecioService);
  private tarifasClienteService = inject(TarifasClienteService);

  clientes: ClienteUI[] = [];
  filteredClientes: ClienteUI[] = [];
  listasPrecios: ListaPrecioUI[] = [];
  listasPreciosVigentes: ListaPrecioUI[] = [];
  asignaciones: TarifaClienteUI[] = [];

  selectedCliente: ClienteUI | null = null;
  selectedListaCodigo = '';
  listaByCodigo = new Map<string, ListaPrecioUI>();

  isLoadingClientes = false;
  isLoadingListas = false;
  isLoadingAsignaciones = false;

  filterNombreCliente = '';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [10, 25, 50, 100];

  ngOnInit(): void {
    this.loadListasPrecios();
    this.loadClientes();
  }

  loadClientes() {
    this.isLoadingClientes = true;
    const nombre = this.filterNombreCliente.trim() || undefined;
    this.clientesService.getClientes(this.currentPage, this.pageSize, nombre).subscribe({
      next: (result) => {
        this.clientes = result.data ?? [];
        this.filteredClientes = [...this.clientes];
        this.totalRegistros = result.totalRegistros ?? this.clientes.length;
        this.currentPage = result.paginaActual ?? this.currentPage;
        this.pageSize = result.pageSize ?? this.pageSize;
        this.totalPages = result.totalPages ?? 1;
        this.isLoadingClientes = false;
      },
      error: (error) => {
        console.error('Error al cargar clientes:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los clientes.',
          icon: 'error'
        });
        this.isLoadingClientes = false;
      }
    });
  }

  loadListasPrecios() {
    this.isLoadingListas = true;
    this.listasPreciosService.getListas({ pageNumber: 1, pageSize: 200 }).subscribe({
      next: (result) => {
        this.listasPrecios = result.data ?? [];
        this.listasPreciosVigentes = this.listasPrecios.filter((lista) => lista.vigente === 'S');
        this.listaByCodigo = new Map(this.listasPrecios.map((item) => [item.codigo, item]));
        this.isLoadingListas = false;
      },
      error: (error) => {
        console.error('Error al cargar listas de precios:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar las listas de precios.',
          icon: 'error'
        });
        this.isLoadingListas = false;
      }
    });
  }

  loadAsignaciones() {
    if (!this.selectedCliente) {
      this.asignaciones = [];
      return;
    }
    this.isLoadingAsignaciones = true;
    this.tarifasClienteService.getAsignaciones(this.selectedCliente.codigo).subscribe({
      next: (data) => {
        this.asignaciones = [...(data ?? [])].sort((a, b) => a.codTari.localeCompare(b.codTari));
        this.isLoadingAsignaciones = false;
      },
      error: (error) => {
        console.error('Error al cargar asignaciones:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar las asignaciones del cliente.',
          icon: 'error'
        });
        this.isLoadingAsignaciones = false;
      }
    });
  }

  onBuscarClientes() {
    this.currentPage = 1;
    this.loadClientes();
  }

  onLimpiarClientes() {
    this.filterNombreCliente = '';
    this.currentPage = 1;
    this.loadClientes();
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.loadClientes();
  }

  goToPageRelative(delta: number) {
    const nextPage = this.currentPage + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.loadClientes();
  }

  seleccionarCliente(cliente: ClienteUI) {
    if (this.selectedCliente?.codigo === cliente.codigo) {
      return;
    }
    this.selectedCliente = cliente;
    this.selectedListaCodigo = '';
    this.loadAsignaciones();
  }

  asignarLista() {
    if (!this.selectedCliente || !this.selectedListaCodigo) {
      return;
    }
    if (this.asignaciones.some((item) => item.codTari === this.selectedListaCodigo)) {
      Swal.fire({
        title: 'Asignacion existente',
        text: 'Esta lista ya esta asignada al cliente.',
        icon: 'info'
      });
      return;
    }
    this.isLoadingAsignaciones = true;
    this.tarifasClienteService.createAsignacion(this.selectedCliente.codigo, this.selectedListaCodigo).subscribe({
      next: () => {
        Swal.fire({
          title: 'Asignado',
          text: 'La lista fue asignada correctamente.',
          icon: 'success'
        });
        this.loadAsignaciones();
      },
      error: (error) => {
        console.error('Error al asignar lista:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo asignar la lista al cliente.',
          icon: 'error'
        });
        this.isLoadingAsignaciones = false;
      }
    });
  }

  quitarAsignacion(asignacion: TarifaClienteUI) {
    Swal.fire({
      title: 'Quitar lista',
      text: `Desea quitar la lista ${asignacion.codTari}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, quitar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.isLoadingAsignaciones = true;
      this.tarifasClienteService.deleteAsignacion(asignacion.id).subscribe({
        next: () => {
          Swal.fire({
            title: 'Eliminado',
            text: 'La asignacion fue eliminada correctamente.',
            icon: 'success'
          });
          this.loadAsignaciones();
        },
        error: (error) => {
          console.error('Error al eliminar asignacion:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar la asignacion.',
            icon: 'error'
          });
          this.isLoadingAsignaciones = false;
        }
      });
    });
  }

  getListaDescripcion(codigo: string) {
    return this.listaByCodigo.get(codigo)?.descripcion || codigo;
  }

  getListaMoneda(codigo: string) {
    return this.listaByCodigo.get(codigo)?.moneda || '-';
  }

  getTipoLabel(tipo: string) {
    if (tipo === 'AGE') {
      return 'Agencia';
    }
    if (tipo === 'CLI') {
      return 'Cliente final';
    }
    return tipo || 'N/D';
  }
}
