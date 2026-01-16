import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { ContadorService } from '../contador.service';
import { ContadorResponse, ContadorUI } from '../contador.models';

@Component({
  selector: 'app-contador',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './contador.component.html',
  styleUrls: ['./contador.component.scss']
})
export class ContadorComponent implements OnInit {
  contadores: ContadorUI[] = [];
  isLoading = false;

  constructor(private router: Router, private contadorService: ContadorService) {}

  ngOnInit(): void {
    this.loadContadores();
  }

  loadContadores(): void {
    this.isLoading = true;
    this.contadorService.getAll().subscribe({
      next: (data) => {
        this.contadores = data ?? [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar contadores:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los contadores. Verifique la API.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  createNew(): void {
    this.router.navigate(['/administracion/configuracion/contadores/nuevo']);
  }

  editContador(cont: ContadorUI): void {
    this.router.navigate(['/administracion/configuracion/contadores/editar', cont.codigo]);
  }

  deleteContador(cont: ContadorUI): void {
    Swal.fire({
      title: 'Eliminar contador',
      text: `Estas seguro de eliminar el contador "${cont.descripcion}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.contadorService.delete(cont.codigo).subscribe({
        next: (response: ContadorResponse) => {
          const message = response?.respuesta || 'Contador eliminado correctamente.';
          Swal.fire({
            title: 'Eliminado',
            text: message,
            icon: 'success'
          });
          this.loadContadores();
        },
        error: (error) => {
          console.error('Error al eliminar contador:', error);
          const errorMsg = error?.error?.respuesta || 'Error al eliminar el contador.';
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

  getBoolLabel(value: number): string {
    return value === 1 ? 'Si' : 'No';
  }
}
