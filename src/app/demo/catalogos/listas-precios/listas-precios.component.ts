import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ListaPrecioService } from './lista-precio.service';
import { ListaPrecioUI } from './lista-precio.models';
import { PlanesTarifasService, PlanTarifaUI } from './planes-tarifas.service';

@Component({
  selector: 'app-listas-precios',
  imports: [CommonModule, SharedModule, FormsModule, RouterModule],
  templateUrl: './listas-precios.component.html',
  styleUrls: ['./listas-precios.component.scss']
})
export class ListasPreciosComponent implements OnInit {
  private listasPreciosService = inject(ListaPrecioService);
  private planesTarifasService = inject(PlanesTarifasService);
  private router = inject(Router);

  listasPrecios: ListaPrecioUI[] = [];
  filteredListas: ListaPrecioUI[] = [];
  planesTarifas: PlanTarifaUI[] = [];
  isLoading = false;

  filterDescripcion = '';
  filterVigente = '';
  filterPlanRate: number | null = null;
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [5, 10, 20, 50];

  ngOnInit() {
    this.loadPlanesTarifas();
    this.loadListas();
  }

  loadPlanesTarifas() {
    this.planesTarifasService.getPlanesTarifas().subscribe({
      next: (planes) => {
        this.planesTarifas = planes;
      },
      error: (error) => {
        console.error('Error al cargar planes tarifarios:', error);
      }
    });
  }

  loadListas() {
    this.isLoading = true;
    const filtro = this.filterDescripcion.trim() || undefined;

    // Si hay filtro por planRate, usar el endpoint específico
    if (this.filterPlanRate !== null && this.filterPlanRate !== undefined) {
      this.listasPreciosService
        .getListasByPlanRate(this.filterPlanRate, this.currentPage, this.pageSize)
        .subscribe({
          next: (result) => {
            this.listasPrecios = result.data ?? [];
            this.totalRegistros = result.totalRegistros ?? this.listasPrecios.length;
            this.currentPage = result.paginaActual ?? this.currentPage;
            this.pageSize = result.pageSize ?? this.pageSize;
            this.totalPages = result.totalPages ?? 1;
            this.applyLocalFilters();
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error al cargar listas de precios por planRate:', error);
            Swal.fire({
              title: 'Error',
              text: 'No se pudieron cargar las listas de precios por plan tarifario.',
              icon: 'error'
            });
            this.isLoading = false;
          }
        });
      return;
    }

    // Búsqueda estándar
    this.listasPreciosService
      .getListas({ descripcion: filtro, pageNumber: this.currentPage, pageSize: this.pageSize })
      .subscribe({
        next: (result) => {
          this.listasPrecios = result.data ?? [];
          this.totalRegistros = result.totalRegistros ?? this.listasPrecios.length;
          this.currentPage = result.paginaActual ?? this.currentPage;
          this.pageSize = result.pageSize ?? this.pageSize;
          this.totalPages = result.totalPages ?? 1;
        this.applyLocalFilters();
        this.isLoading = false;
        },
        error: (error) => {
          console.error('Error al cargar listas de precios:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudieron cargar las listas de precios.',
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
  }

  applyLocalFilters() {
    if (!this.filterVigente) {
      this.filteredListas = [...this.listasPrecios];
      return;
    }
    this.filteredListas = this.listasPrecios.filter((item) => item.vigente === this.filterVigente);
  }

  onBuscar() {
    this.currentPage = 1;
    this.loadListas();
  }

  onLimpiar() {
    this.filterDescripcion = '';
    this.filterVigente = '';
    this.filterPlanRate = null;
    this.currentPage = 1;
    this.loadListas();
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.loadListas();
  }

  goToPageRelative(delta: number) {
    const nextPage = this.currentPage + delta;
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.currentPage = nextPage;
    this.loadListas();
  }

  openForm(codigo?: string) {
    if (codigo) {
      this.router.navigate(['/catalogos/listas-precios', codigo, 'editar']);
    } else {
      this.router.navigate(['/catalogos/listas-precios/nuevo']);
    }
  }

  openAsignaciones() {
    this.router.navigate(['/catalogos/listas-precios/asignaciones']);
  }

  verDetalle(lista: ListaPrecioUI) {
    const codigo = (lista.codigo || '').trim();
    if (!codigo) {
      return;
    }
    const descripcion = (lista.descripcion || '').trim();
    this.router.navigate(['/comercial/detalle-lista-precio-v2', codigo], {
      queryParams: { desLstPrecio: descripcion }
    });
  }

  eliminar(codigo: string) {
    Swal.fire({
      title: 'Eliminar lista de precios',
      text: `Desea eliminar la lista ${codigo}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.isLoading = true;
      this.listasPreciosService.eliminarLista(codigo).subscribe({
        next: () => {
          Swal.fire({
            title: 'Eliminado',
            text: 'Lista eliminada correctamente.',
            icon: 'success'
          });
          this.loadListas();
        },
        error: (error) => {
          console.error('Error al eliminar lista de precios:', error);
          Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar la lista de precios.',
            icon: 'error'
          });
          this.isLoading = false;
        }
      });
    });
  }

  getVigenteBadge(vigente: string) {
    return vigente === 'S' ? 'bg-success' : 'bg-secondary';
  }

  getVigenteText(vigente: string) {
    return vigente === 'S' ? 'Vigente' : 'No vigente';
  }

}
