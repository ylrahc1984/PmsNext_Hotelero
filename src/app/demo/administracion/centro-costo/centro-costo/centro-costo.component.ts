import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { CentroCostoService } from '../centro-costo.service';
import { CentroCostoResponse, CentroCostoUI } from '../centro-costo.models';

@Component({
  selector: 'app-centro-costo',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './centro-costo.component.html',
  styleUrls: ['./centro-costo.component.scss']
})
export class CentroCostoComponent implements OnInit {
  centrosCosto: CentroCostoUI[] = [];
  isLoading = false;
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;

  constructor(private router: Router, private centroCostoService: CentroCostoService) {}

  ngOnInit(): void {
    this.loadCentrosCosto();
  }

  loadCentrosCosto(): void {
    this.isLoading = true;
    this.centroCostoService.getAll(this.currentPage, this.pageSize).subscribe({
      next: (result) => {
        this.centrosCosto = result.data ?? [];
        this.totalPages = result.totalPaginas ?? 1;
        this.totalRegistros = result.totalRegistros ?? this.centrosCosto.length;
        this.currentPage = result.paginaActual ?? this.currentPage;
        if (this.currentPage > this.totalPages) {
          this.currentPage = this.totalPages;
          this.loadCentrosCosto();
          return;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar centros de costo:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los centros de costo. Verifique la API.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  createNew(): void {
    this.router.navigate(['/administracion/configuracion/centrocosto/nuevo']);
  }

  editCentroCosto(cc: CentroCostoUI): void {
    this.router.navigate(['/administracion/configuracion/centrocosto/editar', cc.codGrupo]);
  }

  deleteCentroCosto(cc: CentroCostoUI): void {
    Swal.fire({
      title: 'Eliminar centro de costo',
      text: `Estas seguro de eliminar el centro de costo "${cc.descripcion}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.centroCostoService.delete(cc.codGrupo).subscribe({
        next: (response: CentroCostoResponse) => {
          const message = response?.respuesta || 'Centro de costo eliminado correctamente.';
          Swal.fire({
            title: 'Eliminado',
            text: message,
            icon: 'success'
          });
          this.loadCentrosCosto();
        },
        error: (error) => {
          console.error('Error al eliminar centro de costo:', error);
          const errorMsg = error?.error?.respuesta || 'Error al eliminar el centro de costo.';
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

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
    this.loadCentrosCosto();
  }

  goToPageRelative(offset: number): void {
    this.goToPage(this.currentPage + offset);
  }

  getTipoLabel(value: string): string {
    return value === 'M' ? 'Mercancia' : value === 'S' ? 'Servicio' : value;
  }

  getImpuestoLabel(value: number): string {
    return value === 1 ? 'Si' : 'No';
  }

  trackByCodGrupo(index: number, item: CentroCostoUI): string {
    return item.codGrupo;
  }
}
