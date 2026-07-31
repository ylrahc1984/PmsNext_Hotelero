import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timer } from 'rxjs';
import { retry } from 'rxjs/operators';

import { FISCAL_CONFIG } from 'src/app/core/config/fiscal.config';
import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { QzPrintService } from 'src/app/core/services/qz-print.service';
import {
  DocumentoDetalleEncabezadoApi,
  DocumentoDetalleFormaPagoApi,
  DocumentoDetalleItem,
  DocumentoDetalleItemApi,
  DocumentoDetalleResponse,
  DocumentoEncabezado,
  DocumentoPago
} from 'src/app/finanzas/pages-factura/documento-detalle/documento-detalle.interface';
import { DocumentoDetalleService } from 'src/app/finanzas/services/documento-detalle.service';
import { environment } from 'src/environments/environment';

import {
  DocumentoPosImpuesto,
  DocumentoPosPrintData,
  DocumentoPosResumen,
  PosDocumentPrintBuilder
} from './pos-document-print.builder';

export interface DocumentoPosReference {
  tipoDocu: string;
  serieDocu: string;
  numDocu: string;
}

interface RestauranteImpresionImpuestoApi {
  ppV02_Orden?: number;
  ppV02_CodImpu?: string;
  ppV02_Descripcion?: string;
  ppV02_PorImpu?: number;
  ppV02_BaseImponible?: number;
  ppV02_Monto?: number;
}

interface RestauranteImpresionEmpresaApi {
  nombre?: string;
  razonSocial?: string;
  direccion?: string;
  ruc?: string;
  telefono?: string;
  email?: string;
  web?: string;
}

interface RestauranteImpresionResponse {
  encabezado?: Partial<DocumentoDetalleEncabezadoApi> | null;
  detalles?: Partial<DocumentoDetalleItemApi>[];
  impuestos?: RestauranteImpresionImpuestoApi[];
  formasPago?: Partial<DocumentoDetalleFormaPagoApi>[];
  empresa?: RestauranteImpresionEmpresaApi | null;
}

@Injectable({
  providedIn: 'root'
})
export class PosDocumentPrintService {
  private readonly http = inject(HttpClient);
  private readonly detalleService = inject(DocumentoDetalleService);
  private readonly printBuilder = inject(PosDocumentPrintBuilder);
  private readonly qzPrintService = inject(QzPrintService);
  private readonly empresaContext = inject(EmpresaContextService);
  private readonly restaurantPrintUrl = `${(environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '')}/imprimir-restaurante`;

  async printByReference(
    reference: DocumentoPosReference,
    operador: string,
    printerName = 'TIQUETE'
  ): Promise<void> {
    const normalizedReference = this.normalizeReference(reference);
    const normalizedOperator = (operador || '').trim();

    if (!normalizedOperator) {
      throw new Error('No se pudo identificar el operador para consultar el documento facturado.');
    }

    const response = await firstValueFrom(
      this.detalleService
        .getDetalle(
          normalizedReference.tipoDocu,
          normalizedReference.serieDocu,
          normalizedReference.numDocu,
          normalizedOperator
        )
        .pipe(
          retry({
            count: 2,
            delay: (_error, retryCount) => timer(retryCount * 500)
          })
        )
    );

    const commands = this.printBuilder.build(this.mapPrintData(response, normalizedReference));
    await this.qzPrintService.printRaw(commands, printerName);
  }

  async printRestaurantByReference(
    reference: DocumentoPosReference,
    printerName = 'TIQUETE'
  ): Promise<void> {
    const normalizedReference = this.normalizeReference(reference);
    const params = new HttpParams()
      .set('tipoDocu', normalizedReference.tipoDocu)
      .set('serie', normalizedReference.serieDocu)
      .set('numDocu', normalizedReference.numDocu);
    const response = await firstValueFrom(
      this.http
        .get<RestauranteImpresionResponse>(this.restaurantPrintUrl, { params })
        .pipe(
          retry({
            count: 2,
            delay: (_error, retryCount) => timer(retryCount * 500)
          })
        )
    );
    const commands = this.printBuilder.build(this.mapRestaurantPrintData(response, normalizedReference));
    await this.qzPrintService.printRaw(commands, printerName);
  }

  private normalizeReference(reference: DocumentoPosReference): DocumentoPosReference {
    const normalized = {
      tipoDocu: (reference?.tipoDocu || '').trim(),
      serieDocu: (reference?.serieDocu || '000').trim() || '000',
      numDocu: (reference?.numDocu || '').trim()
    };

    if (!normalized.tipoDocu || !normalized.numDocu) {
      throw new Error('La respuesta de facturación no contiene una referencia de documento válida.');
    }

    return normalized;
  }

  private mapPrintData(
    response: DocumentoDetalleResponse | null | undefined,
    reference: DocumentoPosReference
  ): DocumentoPosPrintData {
    if (!response?.encabezado) {
      throw new Error('El documento fue generado, pero su detalle todavía no está disponible para imprimir.');
    }

    const encabezado = this.mapEncabezado(response.encabezado, reference);
    const detalle = (response.detalle || []).map((item) => this.mapDetalle(item));
    const pagos = (response.formasPago || []).map((item) => this.mapPago(item));
    const resumen = this.buildResumen(encabezado, detalle);
    const empresa = this.empresaContext.empresa();

    return {
      empresaNombre: (empresa?.MA04_Nombre ?? empresa?.MA04_RazonSocial ?? '').toString().trim(),
      empresaRuc: (empresa?.MA04_Ruc ?? '').toString().trim(),
      encabezado,
      detalle,
      pagos,
      resumen
    };
  }

  private mapRestaurantPrintData(
    response: RestauranteImpresionResponse | null | undefined,
    reference: DocumentoPosReference
  ): DocumentoPosPrintData {
    if (!response?.encabezado) {
      throw new Error('El documento fue generado, pero el detalle de impresión del restaurante todavía no está disponible.');
    }

    const encabezado = this.mapEncabezado(response.encabezado, reference);
    const detalle = (response.detalles || []).map((item) => this.mapDetalle(item));
    const impuestos = (response.impuestos || []).map((item) => this.mapRestaurantTax(item));
    const pagos = (response.formasPago || []).map((item) => this.mapPago(item));
    const resumen = this.buildResumen(encabezado, detalle);
    const fallbackCompany = this.empresaContext.empresa();
    const company = response.empresa;

    return {
      empresaNombre: (company?.nombre || company?.razonSocial || fallbackCompany?.MA04_Nombre || fallbackCompany?.MA04_RazonSocial || '').trim(),
      empresaRuc: (company?.ruc || fallbackCompany?.MA04_Ruc || '').trim(),
      empresaRazonSocial: (company?.razonSocial || fallbackCompany?.MA04_RazonSocial || '').trim(),
      empresaDireccion: (company?.direccion || fallbackCompany?.MA04_Direccion || '').trim(),
      empresaTelefono: (company?.telefono || fallbackCompany?.MA04_Telefono1 || '').trim(),
      empresaEmail: (company?.email || fallbackCompany?.MA04_Email || '').trim(),
      empresaWeb: (company?.web || '').trim(),
      encabezado,
      detalle,
      impuestos,
      pagos,
      resumen
    };
  }

  private mapEncabezado(
    raw: Partial<DocumentoDetalleEncabezadoApi>,
    reference: DocumentoPosReference
  ): DocumentoEncabezado {
    return {
      tipDocu: raw.ppV00_TipoDocu || reference.tipoDocu,
      serie: raw.ppV00_Serie || reference.serieDocu,
      numero: raw.ppV00_NumDocu || reference.numDocu,
      numeroConsecutivo: raw.ppV15_NumeroConsecutivo || '',
      clave: raw.ppV15_Clave || '',
      fechaDocu: this.formatDate(raw.ppV00_FechaDocu),
      condicionVenta: raw.ppV15_Condicion_Venta || '',
      codCliente: raw.ppV00_CodCliente || '',
      rucCliente: raw.ppV00_RucCliente || '',
      nomCliente: raw.ppV00_NomCliente || '',
      moneda: raw.ppV00_Moneda || '',
      tCambio: this.toOptionalNumber(raw.ppV00_TCambio),
      pntVenta: raw.ppV00_PntVenta || '',
      numMesa: raw.ppV00_NumMesa || '',
      numPax: this.toOptionalNumber(raw.ppV00_NumPax),
      codVendedor: raw.ppV15_Vendedor || raw.ppV00_CodMozo || '',
      codReserva: raw.ppV00_CodReserva || '',
      habitacion: raw.ppV00_Habitacion || '',
      master: raw.ppV00_Master || '',
      subtotal: this.toOptionalNumber(raw.ppV00_SubTotal),
      descuento: this.toOptionalNumber(raw.ppV00_Descuento),
      impuesto: this.toOptionalNumber(raw.ppV00_Impuesto),
      totalDocu: this.toOptionalNumber(raw.ppV00_TotalDocu),
      totalPago: this.toOptionalNumber(raw.ppV00_TotalPago),
      estadoDocu: raw.ppV00_EstDocu || '',
      estadoElectronico: raw.ppV15_Estado_Comprobante || ''
    };
  }

  private mapDetalle(raw: Partial<DocumentoDetalleItemApi>): DocumentoDetalleItem {
    const item: DocumentoDetalleItem = {
      orden: this.toNumber(raw.ppV01_Orden),
      fechaConsumo: this.formatDate(raw.ppV01_FecConsumo),
      codProdu: raw.ppV01_CodProdu || '',
      areaProdu: raw.ppV01_Area || '',
      descripcion: raw.ppV01_Descripcion || '',
      cantidad: this.toNumber(raw.ppV01_Cantidad),
      uMedida: raw.ppV01_UMedida || '',
      pUndLst: this.toNumber(raw.ppV01_PUndLst),
      uniSinImp: this.toNumber(raw.ppV01_UniSinImp),
      porDescu: this.toNumber(raw.ppV01_PorDescu),
      porImp: this.toNumber(raw.ppV01_PorImp),
      porExonera: this.toNumber(raw.ppV01_PorExonera),
      mtoImpVarios: this.toNumber(raw.ppV01_MtoImpVarios),
      almacen: raw.ppV01_Almacen || '',
      area: raw.ppV01_Area || '',
      tipComanda: raw.ppV01_TipComanda || '',
      comanda: raw.ppV01_Comanda || '',
      pntVenta: raw.ppV01_PntVenta || '',
      mozo: raw.ppV01_Mozo || '',
      numHabita: raw.ppV01_NumHabita || '',
      subtotal: this.toOptionalNumber(raw.ppV01_PrecioSinImp),
      descuento: this.toOptionalNumber(raw.ppV01_MtoDescu),
      neto: this.toOptionalNumber(raw.ppV01_TotalNeto),
      total: this.toOptionalNumber(raw.ppV01_Precio),
      impuesto: this.toOptionalNumber(raw.ppV01_Impuestos)
    };

    const subtotal = this.coalesceNumber(item.subtotal, this.calcularLineaSubtotal(item));
    const descuento = this.resolveLineaDescuento(item, subtotal);

    return {
      ...item,
      subtotal: this.round(subtotal),
      descuento: this.round(descuento),
      neto: this.round(this.coalesceNumber(item.neto, subtotal - descuento))
    };
  }

  private mapPago(raw: Partial<DocumentoDetalleFormaPagoApi>): DocumentoPago {
    return {
      orden: this.toNumber(raw.ppV03_Orden),
      frmPago: raw.ppV03_FrmPago || '',
      tipo: raw.ppV03_Tipo || '',
      moneda: raw.ppV03_Moneda || '',
      monto: this.toNumber(raw.ppV03_Monto),
      tCambio: this.toNumber(raw.ppV03_TCambio),
      referencia: raw.ppV03_NumTarjeta || '',
      numTarjeta: raw.ppV03_NumTarjeta || '',
      vencimiento: this.formatDate(raw.ppV03_Vencimiento)
    };
  }

  private mapRestaurantTax(raw: RestauranteImpresionImpuestoApi): DocumentoPosImpuesto {
    return {
      codigo: raw.ppV02_CodImpu || '',
      descripcion: raw.ppV02_Descripcion || '',
      porcentaje: this.toNumber(raw.ppV02_PorImpu),
      baseImponible: this.toNumber(raw.ppV02_BaseImponible),
      monto: this.toNumber(raw.ppV02_Monto)
    };
  }

  private buildResumen(
    encabezado: DocumentoEncabezado,
    detalle: DocumentoDetalleItem[]
  ): DocumentoPosResumen {
    const calculated = detalle.reduce<DocumentoPosResumen>(
      (acc, item) => {
        const subtotal = this.coalesceNumber(item.subtotal, this.calcularLineaSubtotal(item));
        const descuento = this.resolveLineaDescuento(item, subtotal);
        const base = subtotal - descuento;
        const impuesto = this.resolveLineaImpuesto(item, base);
        const total = this.coalesceNumber(item.total, base + impuesto + this.toNumber(item.mtoImpVarios));

        acc.subtotal += subtotal;
        acc.descuento += descuento;
        acc.impuesto += impuesto;
        acc.total += total;
        return acc;
      },
      { subtotal: 0, descuento: 0, impuesto: 0, total: 0 }
    );

    return {
      subtotal: this.round(this.coalesceNumber(encabezado.subtotal, calculated.subtotal)),
      descuento: this.round(this.coalesceNumber(encabezado.descuento, calculated.descuento)),
      impuesto: this.round(this.coalesceNumber(encabezado.impuesto, calculated.impuesto)),
      total: this.round(this.coalesceNumber(encabezado.totalDocu, calculated.total))
    };
  }

  private calcularLineaSubtotal(item: DocumentoDetalleItem): number {
    const subtotalBruto = this.toNumber(item.cantidad) * this.toNumber(item.pUndLst);
    if (!FISCAL_CONFIG.pricesIncludeTax) {
      return subtotalBruto;
    }

    const taxRate = this.toNumber(item.porImp) || 13;
    return subtotalBruto / (1 + taxRate / 100);
  }

  private resolveLineaDescuento(item: DocumentoDetalleItem, subtotal: number): number {
    return Number.isFinite(item.descuento)
      ? (item.descuento as number)
      : subtotal * (this.toNumber(item.porDescu) / 100);
  }

  private resolveLineaImpuesto(item: DocumentoDetalleItem, base: number): number {
    if (Number.isFinite(item.impuesto)) {
      return item.impuesto as number;
    }

    const taxRate = this.toNumber(item.porImp) || 13;
    return base * (taxRate / 100);
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private coalesceNumber(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) ? (value as number) : fallback;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatDate(value: string | undefined): string {
    const trimmed = (value || '').toString().trim();
    if (!trimmed) return '';

    const raw = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed.split(' ')[0];
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : trimmed;
  }
}
