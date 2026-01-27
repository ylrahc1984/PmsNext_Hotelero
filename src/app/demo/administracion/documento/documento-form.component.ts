import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { DocumentoService } from './documento.service';
import { DocumentoDto, DocumentoResponse } from './documento.models';

@Component({
  selector: 'app-documento-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './documento-form.component.html',
  styleUrls: ['./documento-form.component.scss']
})
export class DocumentoFormComponent implements OnInit {
  form!: FormGroup;
  isEditing = false;
  private codigoActual: string | null = null;

  tDocFeOptions = [
    { value: '01', label: 'Factura electronica' },
    { value: '02', label: 'Nota debito' },
    { value: '03', label: 'Nota credito' },
    { value: '04', label: 'Tique electronico' },
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private documentoService: DocumentoService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadIfEditing();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      codigo: ['', [Validators.required]],
      descripcion: ['', [Validators.required]],
      serie: [0],
      numero: [0],
      visible: [false],
      auto: [false],
      compra: [false],
      venta: [false],
      docu: [false],
      notaC: [false],
      notaD: [false],
      guia: [0],
      observaciones1: [''],
      observaciones2: [''],
      nFactElectronica: [0],
      tDocFE: ['', [Validators.required]]
    });
  }

  private loadIfEditing(): void {
    const codigo = this.route.snapshot.paramMap.get('codigo');
    if (!codigo) {
      return;
    }

    this.isEditing = true;
    this.codigoActual = codigo;
    this.form.get('codigo')?.disable();

    this.documentoService.getDocumentoByCodigo(codigo).subscribe({
      next: (data: DocumentoDto | null) => {
        if (!data) {
          Swal.fire({
            title: 'No encontrado',
            text: 'No se encontro el documento seleccionado.',
            icon: 'error'
          });
          this.goBack();
          return;
        }

        this.form.patchValue({
          codigo: data.CA04_CodDocu,
          descripcion: data.CA04_NomDocu,
          serie: data.CA04_Serie,
          numero: data.CA04_Numero,
          visible: data.CA04_Visible === 1,
          auto: data.CA04_Auto === 1,
          compra: data.CA04_Compra === 1,
          venta: data.CA04_Venta === 1,
          docu: data.CA04_Docu === 1,
          notaC: data.CA04_NotaC === 1,
          notaD: data.CA04_NotaD === 1,
          guia: Number(data.CA04_Guia || 0),
          observaciones1: data.CA04_Observacion1,
          observaciones2: data.CA04_Observacion2,
          nFactElectronica: data.CA04_NFactElectronica,
          tDocFE: data.CA404_TDocFE
        });
      },
      error: (error) => {
        console.error('Error al cargar documento:', error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el documento seleccionado.',
          icon: 'error'
        });
        this.goBack();
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire({
        title: 'Validacion',
        text: 'Por favor complete los campos requeridos.',
        icon: 'warning'
      });
      return;
    }

    const raw = this.form.getRawValue();
    const payload = this.documentoService.buildPayload(raw, this.isEditing ? 2 : 1);
    const codigoReferencia = this.codigoActual ?? payload.codigo;

    const operation = this.isEditing
      ? this.documentoService.editarDocumento(codigoReferencia, payload)
      : this.documentoService.crearDocumento(payload);

    operation.subscribe({
      next: (response: DocumentoResponse) => {
        const message =
          response?.respuesta ||
          (this.isEditing ? 'Documento actualizado correctamente.' : 'Documento creado correctamente.');
        Swal.fire({
          title: 'Exito',
          text: message,
          icon: 'success'
        }).then(() => this.goBack());
      },
      error: (error) => {
        console.error('Error al guardar documento:', error);
        const errorMsg = error?.error?.respuesta || 'Error al guardar el documento.';
        Swal.fire({
          title: 'Error',
          text: errorMsg,
          icon: 'error'
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/administracion/configuracion/documento']);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
}
