import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { ImpuestoService } from '../impuesto.service';
import { ImpuestoResponse, ImpuestoUI } from '../impuesto.models';

@Component({
  selector: 'app-impuesto',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './impuesto.component.html',
  styleUrls: ['./impuesto.component.scss']
})
export class ImpuestoComponent implements OnInit {
  impuestos: ImpuestoUI[] = [];
  isLoading = false;

  constructor(private router: Router, private impuestoService: ImpuestoService) {}

  ngOnInit(): void {
    this.loadImpuestos();
  }

  loadImpuestos(): void {
    this.isLoading = true;
    this.impuestoService.getAll().subscribe({
      next: (data) => {
        this.impuestos = data ?? [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar impuestos:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los impuestos. Verifique la API.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  createNew(): void {
    this.router.navigate(['/administracion/configuracion/impuestos/nuevo']);
  }

  editImpuesto(impuesto: ImpuestoUI): void {
    this.router.navigate(['/administracion/configuracion/impuestos/editar', impuesto.codigo]);
  }

  deleteImpuesto(impuesto: ImpuestoUI): void {
    Swal.fire({
      title: 'Eliminar impuesto',
      text: `Estas seguro de eliminar el impuesto "${impuesto.nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.impuestoService.delete(impuesto.codigo).subscribe({
        next: (response: ImpuestoResponse) => {
          const message = response?.respuesta || 'Impuesto eliminado correctamente.';
          Swal.fire({
            title: 'Eliminado',
            text: message,
            icon: 'success'
          });
          this.loadImpuestos();
        },
        error: (error) => {
          console.error('Error al eliminar impuesto:', error);
          const errorMsg = error?.error?.respuesta || 'Error al eliminar el impuesto.';
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

  getGrabadoLabel(value: number): string {
    return value === 1 ? 'Si' : 'No';
  }
}
