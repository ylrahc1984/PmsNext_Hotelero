import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { UnidadMedidaService } from './unidad-medida.service';
import { UnidadMedidaDto, UnidadMedidaResponse } from './unidad-medida.models';

@Component({
  selector: 'app-unidad-medida',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './unidad-medida.component.html',
  styleUrls: ['./unidad-medida.component.scss']
})
export class UnidadMedidaComponent implements OnInit {
  unidades: UnidadMedidaDto[] = [];
  filteredUnidades: UnidadMedidaDto[] = [];
  searchTerm = '';
  isLoading = false;

  constructor(private router: Router, private unidadMedidaService: UnidadMedidaService) {}

  ngOnInit(): void {
    this.loadUnidades();
  }

  loadUnidades(): void {
    this.isLoading = true;
    this.unidadMedidaService.getUnidades().subscribe({
      next: (data) => {
        this.unidades = data ?? [];
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar unidades de medida:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar las unidades de medida. Verifique la API.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredUnidades = [...this.unidades];
      return;
    }

    this.filteredUnidades = this.unidades.filter((item) => {
      return (
        item.CAC04_UnmMed.toLowerCase().includes(term) ||
        item.CAC04_Descripcion.toLowerCase().includes(term)
      );
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  createNew(): void {
    this.router.navigate(['/administracion/configuracion/unidad-medida/nuevo']);
  }

  editUnidad(unidad: UnidadMedidaDto): void {
    this.router.navigate(['/administracion/configuracion/unidad-medida/editar', unidad.CAC04_UnmMed]);
  }

  deleteUnidad(unidad: UnidadMedidaDto): void {
    Swal.fire({
      title: 'Eliminar unidad',
      text: `Esta seguro de eliminar la unidad "${unidad.CAC04_UnmMed}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.unidadMedidaService.eliminarUnidad(unidad.CAC04_UnmMed).subscribe({
        next: (response: UnidadMedidaResponse) => {
          const message = response?.respuesta || 'Unidad eliminada correctamente.';
          Swal.fire({
            title: 'Eliminado',
            text: message,
            icon: 'success'
          });
          this.loadUnidades();
        },
        error: (error) => {
          console.error('Error al eliminar unidad:', error);
          const errorMsg = error?.error?.respuesta || 'Error al eliminar la unidad.';
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
