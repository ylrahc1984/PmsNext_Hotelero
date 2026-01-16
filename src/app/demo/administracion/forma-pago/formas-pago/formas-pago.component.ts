import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { FormaPagoService } from '../forma-pago.service';
import { FormaPago, FormaPagoResponse } from '../forma-pago.models';

@Component({
  selector: 'app-formas-pago',
  imports: [CommonModule, RouterLink],
  templateUrl: './formas-pago.component.html',
  styleUrls: ['./formas-pago.component.scss']
})
export class FormasPagoComponent implements OnInit {
  formasPago: FormaPago[] = [];
  isLoading = false;

  constructor(private router: Router, private formaPagoService: FormaPagoService) {}

  ngOnInit(): void {
    this.loadFormasPago();
  }

  loadFormasPago(): void {
    this.isLoading = true;
    this.formaPagoService.getAll().subscribe({
      next: (data) => {
        this.formasPago = data ?? [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar formas de pago:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudieron cargar las formas de pago. Verifique la API.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  createNewMethod(): void {
    this.router.navigate(['/forma-pago-detalle']);
  }

  editMethod(method: FormaPago): void {
    Swal.fire({
      title: 'Editar forma de pago',
      text: `Estas seguro de editar la forma de pago "${method.descripcion}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, editar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.router.navigate(['/forma-pago-detalle', method.codigo]);
      }
    });
  }

  deleteMethod(method: FormaPago): void {
    Swal.fire({
      title: 'Eliminar forma de pago',
      text: `Estas seguro de eliminar la forma de pago "${method.descripcion}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isLoading = true;
      this.formaPagoService.delete(method.codigo).subscribe({
        next: (response: FormaPagoResponse) => {
          const message = response?.respuesta || 'Forma de pago eliminada correctamente.';
          Swal.fire({
            title: 'Eliminado',
            text: message,
            icon: 'success'
          });
          this.loadFormasPago();
        },
        error: (error) => {
          console.error('Error al eliminar forma de pago:', error);
          const errorMsg = error?.error?.respuesta || 'Error al eliminar la forma de pago.';
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

  getTipoFrmLabel(value: FormaPago['tipoFrm']): string {
    const labels: Record<FormaPago['tipoFrm'], string> = {
      A: 'Ambos',
      V: 'Venta',
      C: 'Compra'
    };
    return labels[value] || value;
  }

  getTipoPagoLabel(value: FormaPago['tipoPago']): string {
    const labels: Record<FormaPago['tipoPago'], string> = {
      CE: 'Contado Efectivo',
      CR: 'Credito',
      PP: 'Prepago',
      TC: 'Tarjeta Credito/Debito'
    };
    return labels[value] || value;
  }
}
