import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { SuplidorService, SuplidorUI } from './suplidor.service';
import { environment } from 'src/environments/environment';

interface SuplidorFormData {
  codigo: string;
  descripcion: string;
  tipCedula: string;
  ruc: string;
  contacto: string;
  email: string;
  telefono1: string;
  telefono2: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  pais: string;
  limiteCre: number;
  banco: string;
  ctaBanco: string;
  estado: string;
}

@Component({
  selector: 'app-suplidor-form',
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './suplidor-form.component.html',
  styleUrls: ['./suplidor-form.component.scss']
})
export class SuplidorFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private suplidorService = inject(SuplidorService);
  private http = inject(HttpClient);

  formData: SuplidorFormData = this.createEmpty();
  isEditing = false;
  isLoading = false;
  readOnly = false;

  tipCedulaOptions: Array<{ value: string; label: string }> = [];
  estadoOptions: Array<{ value: string; label: string }> = [
    { value: 'ACT', label: 'Activo' },
    { value: 'INA', label: 'Inactivo' }
  ];

  ngOnInit(): void {
    this.loadTipCedula();
    const codSuplidor = this.route.snapshot.paramMap.get('codSuplidor') ?? '';
    if (codSuplidor) {
      this.isEditing = true;
      this.loadSuplidor(codSuplidor);
    } else {
      this.formData = this.createEmpty();
    }
  }

  private createEmpty(): SuplidorFormData {
    return {
      codigo: '',
      descripcion: '',
      tipCedula: '01',
      ruc: '',
      contacto: '',
      email: '',
      telefono1: '',
      telefono2: '',
      direccion: '',
      ciudad: '',
      provincia: '',
      pais: '',
      limiteCre: 0,
      banco: '',
      ctaBanco: '',
      estado: 'ACT'
    };
  }

  private loadTipCedula(): void {
    const apiUrl = `${environment.apiUrl}/tipoidentificacion`;
    this.http.get<Array<{ CA24_Codigo: string; CA24_Tipo: string }> | null>(apiUrl).subscribe({
      next: (response) => {
        const data = response ?? [];
        this.tipCedulaOptions = data.map((item) => ({
          value: item.CA24_Codigo,
          label: item.CA24_Tipo
        }));
      },
      error: (error) => {
        console.error('Error al cargar tipos de identificación:', error);
        this.tipCedulaOptions = [];
      }
    });
  }

  private loadSuplidor(codSuplidor: string): void {
    this.isLoading = true;
    this.suplidorService.getSuplidorByCodigo(codSuplidor).subscribe({
      next: (suplidor) => {
        if (!suplidor) {
          Swal.fire({
            title: 'No encontrado',
            text: 'No se encontró el suplidor.',
            icon: 'warning'
          });
          this.isLoading = false;
          this.router.navigate(['/catalogos/suplidores']);
          return;
        }
        this.applySuplidor(suplidor);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar suplidor:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el suplidor.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  private applySuplidor(suplidor: SuplidorUI): void {
    this.formData = {
      ...this.createEmpty(),
      codigo: suplidor.codigo,
      descripcion: suplidor.descripcion,
      tipCedula: suplidor.tipCedula || '01',
      ruc: suplidor.ruc,
      contacto: suplidor.contacto || '',
      email: suplidor.email || '',
      telefono1: suplidor.telefono1 || '',
      telefono2: suplidor.telefono2 || '',
      direccion: suplidor.direccion || '',
      ciudad: suplidor.ciudad || '',
      provincia: suplidor.provincia || '',
      pais: suplidor.pais || '',
      limiteCre: Number(suplidor.limiteCre || 0),
      banco: suplidor.banco || '',
      ctaBanco: suplidor.ctaBanco || '',
      estado: suplidor.estado || 'ACT'
    };
  }

  submit(form: NgForm): void {
    if (!form.valid) {
      Swal.fire({
        title: 'Formulario incompleto',
        text: 'Por favor complete todos los campos obligatorios.',
        icon: 'warning'
      });
      return;
    }

    const cleaned: SuplidorUI = {
      codigo: this.formData.codigo.trim(),
      descripcion: this.formData.descripcion.trim(),
      tipCedula: (this.formData.tipCedula || '01').trim(),
      ruc: this.formData.ruc.trim(),
      contacto: this.formData.contacto?.trim() || '',
      email: this.formData.email?.trim() || '',
      telefono1: this.formData.telefono1?.trim() || '',
      telefono2: this.formData.telefono2?.trim() || '',
      direccion: this.formData.direccion?.trim() || '',
      ciudad: this.formData.ciudad?.trim() || '',
      provincia: this.formData.provincia?.trim() || '',
      pais: this.formData.pais?.trim() || '',
      limiteCre: Number(this.formData.limiteCre || 0),
      banco: this.formData.banco?.trim() || '',
      ctaBanco: this.formData.ctaBanco?.trim() || '',
      estado: this.formData.estado || 'ACT',
      operador: '',
      fechaReg: ''
    };

    const payload = this.suplidorService.buildPayloadFromUI(cleaned, this.isEditing ? 2 : 1);
    const request = this.isEditing
      ? this.suplidorService.editarSuplidor(cleaned.codigo, payload)
      : this.suplidorService.crearSuplidor(payload);

    this.isLoading = true;
    request.subscribe({
      next: () => {
        Swal.fire({
          title: 'Éxito',
          text: this.isEditing ? 'Suplidor actualizado correctamente.' : 'Suplidor creado correctamente.',
          icon: 'success'
        });
        this.router.navigate(['/catalogos/suplidores']);
      },
      error: (error) => {
        console.error('Error al guardar suplidor:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo guardar el suplidor.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  cancelForm(): void {
    this.router.navigate(['/catalogos/suplidores']);
  }
}
