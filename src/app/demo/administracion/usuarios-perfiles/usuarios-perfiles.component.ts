import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { DepartamentoService } from 'src/app/demo/administracion/departamento/departamento.service';
import { DepartamentoUI } from 'src/app/demo/administracion/departamento/departamento.models';
import { UsuarioService } from '../usuarios/usuario.service';
import { UsuarioResponse, UsuarioUI } from '../usuarios/usuario.models';

@Component({
  selector: 'app-usuarios-perfiles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios-perfiles.component.html',
  styleUrls: ['./usuarios-perfiles.component.scss']
})
export class UsuariosPerfilesComponent implements OnInit {
  usuarios: UsuarioUI[] = [];
  departamentos: DepartamentoUI[] = [];
  isLoading = false;

  searchNombre = '';
  departamentoFilter: number | null = null;

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalRegistros = 0;
  pageSizeOptions = [5, 10, 20, 50];

  constructor(
    private router: Router,
    private usuarioService: UsuarioService,
    private departamentoService: DepartamentoService
  ) {}

  ngOnInit(): void {
    this.loadDepartamentos();
    this.loadUsuarios();
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
          text: 'No se pudo cargar el catalogo de departamentos.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  loadUsuarios(): void {
    this.isLoading = true;
    const nombre = this.searchNombre.trim();
    const departamentoId = this.departamentoFilter;

    const request$ = nombre
      ? this.usuarioService.getByNombreUsuario(nombre, this.currentPage, this.pageSize)
      : departamentoId !== null
        ? this.usuarioService.getByDepartamento(departamentoId, this.currentPage, this.pageSize)
        : this.usuarioService.getAll(this.currentPage, this.pageSize);

    request$.subscribe({
      next: (result) => {
        this.usuarios = result.data ?? [];
        this.totalRegistros = result.totalRegistros ?? this.usuarios.length;
        this.totalPages = result.totalPages ?? 1;
        this.currentPage = result.paginaActual ?? this.currentPage;
        this.pageSize = result.pageSize ?? this.pageSize;
        if (this.currentPage > this.totalPages) {
          this.currentPage = this.totalPages;
          this.loadUsuarios();
          return;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar usuarios:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los usuarios. Verifique la API.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  createNewUser(): void {
    this.router.navigate(['/usuario-detalle']);
  }

  editUser(user: UsuarioUI): void {
    this.router.navigate(['/usuario-detalle', user.usuario]);
  }

  changePassword(user: UsuarioUI): void {
    this.router.navigate(['/usuario-cambiar-clave', user.usuario]);
  }

  deleteUser(user: UsuarioUI): void {
    Swal.fire({
      title: 'Eliminar usuario',
      text: `Estas seguro de eliminar el usuario "${user.nombreUsu}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.usuarioService.delete(user.usuario).subscribe({
        next: (response: UsuarioResponse) => {
          const message = response?.respuesta || 'Usuario eliminado correctamente.';
          Swal.fire({
            title: 'Eliminado',
            text: message,
            icon: 'success'
          });
          this.loadUsuarios();
        },
        error: (error) => {
          console.error('Error al eliminar usuario:', error);
          const errorMsg = error?.error?.respuesta || 'Error al eliminar el usuario.';
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

  getDepartamentoLabel(id: number): string {
    const dep = this.departamentos.find((item) => item.idDepartamento === id);
    return dep ? dep.departamento : String(id ?? '');
  }

  applySearch(): void {
    this.currentPage = 1;
    this.loadUsuarios();
  }

  clearSearch(): void {
    this.searchNombre = '';
    this.departamentoFilter = null;
    this.applySearch();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadUsuarios();
  }

  goToPageRelative(offset: number): void {
    const next = this.currentPage + offset;
    if (next < 1 || next > this.totalPages) {
      return;
    }
    this.currentPage = next;
    this.loadUsuarios();
  }

  trackByUsuario(index: number, item: UsuarioUI): string {
    return item.usuario;
  }
}
