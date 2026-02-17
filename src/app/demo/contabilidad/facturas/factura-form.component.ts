// angular import
import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';

interface FacturaItem {
  descripcion: string;
  cantidad: number;
  precio: number;
}

@Component({
  selector: 'app-factura-form',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './factura-form.component.html',
  styleUrls: ['./factura-form.component.scss']
})
export class FacturaFormComponent {
  factura = {
    numero: 'AUT-{{yymmdd}}-001',
    cliente: '',
    fecha: new Date().toISOString().substring(0, 10),
    moneda: 'USD',
    formaPago: 'Contado',
    notas: ''
  };

  monedas = ['USD', 'EUR', 'DOP'];
  formasPago = ['Contado', 'Credito', 'Transferencia', 'Tarjeta'];

  items: FacturaItem[] = [
    { descripcion: 'Servicio de hospedaje', cantidad: 1, precio: 100 }
  ];

  descuento = 0;
  impuestoPorcentaje = 18;

  constructor(private router: Router, private location: Location) {}

  addItem() {
    this.items.push({ descripcion: '', cantidad: 1, precio: 0 });
  }

  removeItem(index: number) {
    this.items.splice(index, 1);
  }

  totalLinea(item: FacturaItem) {
    const cantidad = Number(item.cantidad) || 0;
    const precio = Number(item.precio) || 0;
    return cantidad * precio;
  }

  subtotal() {
    return this.items.reduce((sum, item) => sum + this.totalLinea(item), 0);
  }

  neto() {
    const subtotal = this.subtotal();
    const descuento = Number(this.descuento) || 0;
    return Math.max(subtotal - descuento, 0);
  }

  impuestoMonto() {
    const tasa = (Number(this.impuestoPorcentaje) || 0) / 100;
    return this.neto() * tasa;
  }

  totalFactura() {
    return this.neto() + this.impuestoMonto();
  }

  guardarFactura() {
    console.log('Factura guardada', {
      ...this.factura,
      items: this.items,
      subtotal: this.subtotal(),
      descuento: this.descuento,
      neto: this.neto(),
      impuestoPorcentaje: this.impuestoPorcentaje,
      impuesto: this.impuestoMonto(),
      total: this.totalFactura()
    });
  }

  limpiar() {
    this.factura = {
      numero: 'AUT-{{yymmdd}}-001',
      cliente: '',
      fecha: new Date().toISOString().substring(0, 10),
      moneda: this.factura.moneda,
      formaPago: 'Contado',
      notas: ''
    };
    this.items = [{ descripcion: '', cantidad: 1, precio: 0 }];
    this.descuento = 0;
    this.impuestoPorcentaje = 18;
  }

  cancelar() {
    this.router.navigate(['/finanzas/facturas']).catch(() => this.location.back());
  }
}
