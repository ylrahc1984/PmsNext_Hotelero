import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { DepartamentoService } from '../departamento.service';
import { DepartamentoResponse, DepartamentoUI } from '../departamento.models';

@Component({
  selector: 'app-departamento',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './departamento.component.html',
  styleUrls: ['./departamento.component.scss']
})
export class DepartamentoComponent implements OnInit {
  departamentos: DepartamentoUI[] = [];
  isLoading = false;

  constructor(private router: Router, private departamentoService: DepartamentoService) {}

  ngOnInit(): void {
    this.loadDepartamentos();
  }

  loadDepartamentos(): void {
    this.isLoading = true;
    this.departamentoService.getAll().subscribe({
      next: (data) => {
        this.departamentos = data ?? [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar departamentos:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los departamentos. Verifique la API.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  createNew(): void {
    this.router.navigate(['/administracion/configuracion/departamentos/nuevo']);
  }

  editDepartamento(depto: DepartamentoUI): void {
    this.router.navigate(['/administracion/configuracion/departamentos/editar', depto.idDepartamento]);
  }

  deleteDepartamento(depto: DepartamentoUI): void {
    Swal.fire({
      title: 'Eliminar departamento',
      text: `Estas seguro de eliminar el departamento "${depto.departamento}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.departamentoService.delete(depto.idDepartamento).subscribe({
        next: (response: DepartamentoResponse) => {
          const message = response?.respuesta || 'Departamento eliminado correctamente.';
          Swal.fire({
            title: 'Eliminado',
            text: message,
            icon: 'success'
          });
          this.loadDepartamentos();
        },
        error: (error) => {
          console.error('Error al eliminar departamento:', error);
          const errorMsg = error?.error || 'Error al eliminar el departamento.';
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
