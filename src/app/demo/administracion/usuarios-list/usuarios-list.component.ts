import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { DepartamentoService } from 'src/app/demo/administracion/departamento/departamento.service';
import { DepartamentoUI } from 'src/app/demo/administracion/departamento/departamento.models';
import { UsuarioService } from 'src/app/demo/administracion/usuarios/usuario.service';
import { UsuarioUI } from 'src/app/demo/administracion/usuarios/usuario.models';

@Component({
  selector: 'app-usuarios-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './usuarios-list.component.html',
  styleUrls: ['./usuarios-list.component.scss']
})
export class UsuariosListComponent implements OnInit {
  usuarios: UsuarioUI[] = [];
  departamentos: DepartamentoUI[] = [];
  isLoading = false;

  searchUsuario = '';
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
    const filtros = {
      usuario: this.searchUsuario.trim() || undefined,
      departamento: this.departamentoFilter
    };

    this.usuarioService.getUsuarios(this.currentPage, this.pageSize, filtros).subscribe({
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
    this.router.navigate(['/usuarios/nuevo']);
  }

  editUser(user: UsuarioUI): void {
    this.router.navigate(['/usuarios', user.usuario, 'editar']);
  }

  goToProperties(user: UsuarioUI): void {
    this.router.navigate(['/usuarios', user.usuario, 'propiedades']);
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
      this.usuarioService.eliminarUsuario(user.usuario).subscribe({
        next: (response) => {
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
    this.searchUsuario = '';
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
