import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ClienteService } from './cliente.service';
import { ClienteUI } from './cliente.models';

@Component({
  selector: 'app-agencias-comisionistas',
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './agencias-comisionistas.component.html',
  styleUrls: ['./agencias-comisionistas.component.scss']
})
export class AgenciasComisionistasComponent implements OnInit {
  private clientesService = inject(ClienteService);
  private router = inject(Router);

  get baseRoute(): string {
    if (this.router.url.startsWith('/restaurante/agencias')) {
      return '/restaurante/agencias';
    }
    if (this.router.url.startsWith('/reservas/clientes')) {
      return '/reservas/clientes';
    }
    return '/catalogos/clientes';
  }

  clientes: ClienteUI[] = [];
  filteredClientes: ClienteUI[] = [];
  isLoading = false;

  filterNombre = '';
  filterTipo = '';

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [10, 25, 50, 100];

  ngOnInit(): void {
    this.loadClientes();
  }

  loadClientes() {
    this.isLoading = true;
    const nombre = this.filterNombre.trim() || undefined;
    this.clientesService.getClientes(this.currentPage, this.pageSize, nombre).subscribe({
      next: (result) => {
        this.clientes = result.data ?? [];
        this.totalRegistros = result.totalRegistros ?? this.clientes.length;
        this.currentPage = result.paginaActual ?? this.currentPage;
        this.pageSize = result.pageSize ?? this.pageSize;
        this.totalPages = result.totalPages ?? 1;
        this.applyLocalFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar clientes:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los clientes.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  applyLocalFilters() {
    if (!this.filterTipo) {
      this.filteredClientes = [...this.clientes];
      return;
    }
    this.filteredClientes = this.clientes.filter((item) => item.tipoCli === this.filterTipo);
  }

  onBuscar() {
    this.currentPage = 1;
    this.loadClientes();
  }

  onLimpiar() {
    this.filterNombre = '';
    this.filterTipo = '';
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

  openForm() {
    this.router.navigate([this.baseRoute, 'nuevo']);
  }

  editar(cliente: ClienteUI) {
    this.router.navigate([this.baseRoute, cliente.codigo, 'editar']);
  }

  verDetalle(cliente: ClienteUI) {
    this.router.navigate([this.baseRoute, cliente.codigo, 'detalle']);
  }

  eliminar(cliente: ClienteUI) {
    Swal.fire({
      title: 'Eliminar cliente',
      text: `Desea eliminar el cliente ${cliente.codigo}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.isLoading = true;
      this.clientesService.eliminarCliente(cliente.codigo).subscribe({
        next: () => {
          Swal.fire({
            title: 'Eliminado',
            text: 'Cliente eliminado correctamente.',
            icon: 'success'
          });
          this.loadClientes();
        },
        error: (error) => {
          console.error('Error al eliminar cliente:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar el cliente.',
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
    });
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

  getContactoLabel(cliente: ClienteUI): string {
    return cliente.contactoPrincipal || cliente.nombreContacto || cliente.contacto || 'N/D';
  }

  getTelefonoLabel(cliente: ClienteUI): string {
    return cliente.telefonoPrincipal || cliente.telefono1 || 'N/D';
  }

  getEmailLabel(cliente: ClienteUI): string {
    return cliente.emailPrincipal || cliente.email || 'N/D';
  }

  getComprobanteLabel(cliente: ClienteUI): string {
    return cliente.enviarCorreo ? 'Factura electronica' : 'Tiquete electronico';
  }

  getComprobanteBadgeClass(cliente: ClienteUI): string {
    return cliente.enviarCorreo ? 'badge bg-success-subtle text-success border border-success-subtle' : 'badge bg-info-subtle text-info border border-info-subtle';
  }
}
