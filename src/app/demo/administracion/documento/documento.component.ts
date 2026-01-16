import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { DocumentoService } from './documento.service';
import { DocumentoDto, DocumentoResponse } from './documento.models';

@Component({
  selector: 'app-documento',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './documento.component.html',
  styleUrls: ['./documento.component.scss']
})
export class DocumentoComponent implements OnInit {
  documentos: DocumentoDto[] = [];
  filteredDocumentos: DocumentoDto[] = [];
  searchTerm = '';
  isLoading = false;

  constructor(private router: Router, private documentoService: DocumentoService) {}

  ngOnInit(): void {
    this.loadDocumentos();
  }

  loadDocumentos(): void {
    this.isLoading = true;
    this.documentoService.getDocumentos().subscribe({
      next: (data) => {
        this.documentos = data ?? [];
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar documentos:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar los documentos. Verifique la API.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredDocumentos = [...this.documentos];
      return;
    }

    this.filteredDocumentos = this.documentos.filter((item) => {
      return (
        item.CA04_CodDocu.toLowerCase().includes(term) ||
        item.CA04_NomDocu.toLowerCase().includes(term)
      );
    });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  createNew(): void {
    this.router.navigate(['/administracion/configuracion/documento/nuevo']);
  }

  editDocumento(documento: DocumentoDto): void {
    this.router.navigate(['/administracion/configuracion/documento/editar', documento.CA04_CodDocu]);
  }

  deleteDocumento(documento: DocumentoDto): void {
    Swal.fire({
      title: 'Eliminar documento',
      text: `Esta seguro de eliminar el documento "${documento.CA04_CodDocu}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.documentoService.eliminarDocumento(documento.CA04_CodDocu).subscribe({
        next: (response: DocumentoResponse) => {
          const message = response?.respuesta || 'Documento eliminado correctamente.';
          Swal.fire({
            title: 'Eliminado',
            text: message,
            icon: 'success'
          });
          this.loadDocumentos();
        },
        error: (error) => {
          console.error('Error al eliminar documento:', error);
          const errorMsg = error?.error?.respuesta || 'Error al eliminar el documento.';
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

  getFlagLabel(value: number): string {
    return value === 1 ? 'Si' : 'No';
  }
}
