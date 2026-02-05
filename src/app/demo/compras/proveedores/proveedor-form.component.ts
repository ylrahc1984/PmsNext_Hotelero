import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ProveedorService, ProveedorUI } from './proveedor.service';

interface ProveedorFormData {
  codigo: string;
  descripcion: string;
  tipCedula: string;
  ruc: string;
  codTipo: string;
  contacto: string;
  email: string;
  telefono1: string;
  telefono2: string;
  fax: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  pais: string;
  limiteCre: number;
  banco: string;
  ctaBanco: string;
}

@Component({
  selector: 'app-proveedor-form',
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './proveedor-form.component.html',
  styleUrls: ['./proveedor-form.component.scss']
})
export class ProveedorFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private proveedorService = inject(ProveedorService);
  private http = inject(HttpClient);

  formData: ProveedorFormData = this.createEmpty();
  isEditing = false;
  isLoading = false;
  readOnly = false;

  tipCedulaOptions: Array<{ value: string; label: string }> = [];
  tipoOptions: Array<{ value: string; label: string }> = [];

  ngOnInit(): void {
    this.loadTipCedula();
    this.loadTipoProveedor();
    const codProve = this.route.snapshot.paramMap.get('codProve') ?? '';
    if (codProve) {
      this.isEditing = true;
      this.loadProveedor(codProve);
    } else {
      this.formData = this.createEmpty();
    }
  }

  private createEmpty(): ProveedorFormData {
    return {
      codigo: '',
      descripcion: '',
      tipCedula: '01',
      ruc: '',
      codTipo: '001',
      contacto: '',
      email: '',
      telefono1: '',
      telefono2: '',
      fax: '',
      direccion: '',
      ciudad: '',
      provincia: '',
      pais: '',
      limiteCre: 0,
      banco: '',
      ctaBanco: ''
    };
  }

  private loadTipCedula(): void {
    const apiUrl = 'http://localhost:5000/api/tipoidentificacion';
    this.http.get<Array<{ CA24_Codigo: string; CA24_Tipo: string }> | null>(apiUrl).subscribe({
      next: (response) => {
        const data = response ?? [];
        this.tipCedulaOptions = data.map((item) => ({
          value: item.CA24_Codigo,
          label: item.CA24_Tipo
        }));
      },
      error: (error) => {
        console.error('Error al cargar tipos de identificacion:', error);
        this.tipCedulaOptions = [];
      }
    });
  }

  private loadTipoProveedor(): void {
    const apiUrl = 'http://localhost:5000/api/tipoproveedor';
    this.http.get<Array<{ CAC01_CodTipo: string; CAC01_TipoProve: string }> | null>(apiUrl).subscribe({
      next: (response) => {
        const data = response ?? [];
        this.tipoOptions = data.map((item) => ({
          value: item.CAC01_CodTipo,
          label: item.CAC01_TipoProve
        }));
      },
      error: (error) => {
        console.error('Error al cargar tipos de proveedor:', error);
        this.tipoOptions = [];
      }
    });
  }

  private loadProveedor(codProve: string): void {
    this.isLoading = true;
    this.proveedorService.getProveedorByCodigo(codProve).subscribe({
      next: (proveedor) => {
        if (!proveedor) {
          Swal.fire({
            title: 'No encontrado',
            text: 'No se encontro el proveedor.',
            icon: 'warning'
          });
          this.isLoading = false;
          this.router.navigate(['/compras/proveedores']);
          return;
        }
        this.applyProveedor(proveedor);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar proveedor:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el proveedor.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  private applyProveedor(proveedor: ProveedorUI): void {
    this.formData = {
      ...this.createEmpty(),
      codigo: proveedor.codigo,
      descripcion: proveedor.descripcion,
      tipCedula: proveedor.tipCedula || '01',
      ruc: proveedor.ruc,
      codTipo: proveedor.codTipo || '001',
      contacto: proveedor.contacto || '',
      email: proveedor.email || '',
      telefono1: proveedor.telefono1 || '',
      telefono2: proveedor.telefono2 || '',
      fax: proveedor.fax || '',
      direccion: proveedor.direccion || '',
      ciudad: proveedor.ciudad || '',
      provincia: proveedor.provincia || '',
      pais: proveedor.pais || '',
      limiteCre: Number(proveedor.limiteCre || 0),
      banco: proveedor.banco || '',
      ctaBanco: proveedor.ctaBanco || ''
    };
  }

  submit(form: NgForm): void {
    if (!form.valid) {
      return;
    }

    const cleaned: ProveedorUI = {
      codigo: this.formData.codigo.trim(),
      descripcion: this.formData.descripcion.trim(),
      tipCedula: (this.formData.tipCedula || '01').trim(),
      ruc: this.formData.ruc.trim(),
      contacto: this.formData.contacto?.trim() || '',
      email: this.formData.email?.trim() || '',
      telefono1: this.formData.telefono1?.trim() || '',
      telefono2: this.formData.telefono2?.trim() || '',
      fax: this.formData.fax?.trim() || '',
      direccion: this.formData.direccion?.trim() || '',
      ciudad: this.formData.ciudad?.trim() || '',
      provincia: this.formData.provincia?.trim() || '',
      pais: this.formData.pais?.trim() || '',
      limiteCre: Number(this.formData.limiteCre || 0),
      banco: this.formData.banco?.trim() || '',
      ctaBanco: this.formData.ctaBanco?.trim() || '',
      codTipo: this.formData.codTipo || '001',
      tipoProveedor: ''
    };

    const payload = this.proveedorService.buildPayloadFromUI(cleaned, this.isEditing ? 2 : 1);
    const request = this.isEditing
      ? this.proveedorService.editarProveedor(cleaned.codigo, payload)
      : this.proveedorService.crearProveedor(payload);

    this.isLoading = true;
    request.subscribe({
      next: () => {
        Swal.fire({
          title: 'Exito',
          text: this.isEditing ? 'Proveedor actualizado correctamente.' : 'Proveedor creado correctamente.',
          icon: 'success'
        });
        this.router.navigate(['/compras/proveedores']);
      },
      error: (error) => {
        console.error('Error al guardar proveedor:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo guardar el proveedor.',
          icon: 'error'
        });
        this.isLoading = false;
      }
    });
  }

  cancelForm(): void {
    this.router.navigate(['/compras/proveedores']);
  }
}
