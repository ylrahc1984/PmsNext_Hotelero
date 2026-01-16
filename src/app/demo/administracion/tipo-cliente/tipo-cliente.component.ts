import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { TipoClienteService } from './tipo-cliente.service';
import { TipoClienteDto, TipoClienteResponse } from './tipo-cliente.models';

@Component({
  selector: 'app-tipo-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tipo-cliente.component.html',
  styleUrls: ['./tipo-cliente.component.scss']
})
export class TipoClienteComponent implements OnInit {
  tipoClientes: TipoClienteDto[] = [];
  filteredTipoClientes: TipoClienteDto[] = [];
  searchTerm = '';
  isLoading = false;

  constructor(private router: Router, private tipoClienteService: TipoClienteService) {}

  ngOnInit(): void {
    this.loadTipoClientes();
  }

  loadTipoClientes(): void {
    this.isLoading = true;
    this.tipoClienteService.getTipoClientes().subscribe({
      next: (data) => {
        this.tipoClientes = data ?? [];
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar tipos de cliente:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los tipos de cliente. Verifique la API.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredTipoClientes = [...this.tipoClientes];
      return;
    }

    this.filteredTipoClientes = this.tipoClientes.filter((item) => {
      return (
        item.CPV00_Codigo.toLowerCase().includes(term) ||
        item.CPV00_Descripcion.toLowerCase().includes(term)
      );
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  createNew(): void {
    this.router.navigate(['/administracion/configuracion/tipo-cliente/nuevo']);
  }

  editTipoCliente(tipo: TipoClienteDto): void {
    this.router.navigate(['/administracion/configuracion/tipo-cliente/editar', tipo.CPV00_Codigo]);
  }

  deleteTipoCliente(tipo: TipoClienteDto): void {
    Swal.fire({
      title: 'Eliminar tipo de cliente',
      text: `Esta seguro de eliminar el tipo "${tipo.CPV00_Codigo}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.tipoClienteService.eliminarTipoCliente(tipo.CPV00_Codigo).subscribe({
        next: (response: TipoClienteResponse) => {
          const message = response?.respuesta || 'Tipo de cliente eliminado correctamente.';
          Swal.fire({
            title: 'Eliminado',
            text: message,
            icon: 'success'
          });
          this.loadTipoClientes();
        },
        error: (error) => {
          console.error('Error al eliminar tipo de cliente:', error);
          const errorMsg = error?.error?.respuesta || 'Error al eliminar el tipo de cliente.';
          Swal.fire({
            title: 'Error',
            text: errorMsg,
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
    });
  }
}
