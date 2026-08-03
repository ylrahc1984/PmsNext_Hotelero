import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, timer } from 'rxjs';
import { map, retry } from 'rxjs/operators';

import { EmpresaContextService } from 'src/app/core/services/empresa-context.service';
import { QzPrintService } from 'src/app/core/services/qz-print.service';
import { environment } from 'src/environments/environment';
import { RoomChargeLookupResponse, RoomStayManagementService } from '../services/room-stay-management.service';
import {
  RoomChargePosDocumentType,
  RoomChargePosPrintBuilder
} from './room-charge-pos-print.builder';

@Injectable({
  providedIn: 'root'
})
export class RoomChargePosPrintService {
  private readonly roomStayService = inject(RoomStayManagementService);
  private readonly http = inject(HttpClient);
  private readonly printBuilder = inject(RoomChargePosPrintBuilder);
  private readonly qzPrintService = inject(QzPrintService);
  private readonly empresaContext = inject(EmpresaContextService);

  async printByOperation(
    tipoOperacion: string,
    numeroOperacion: string,
    printerName = 'TIQUETE',
    documentType: RoomChargePosDocumentType = 'ORIGINAL',
    puntoVentaNombre = ''
  ): Promise<void> {
    const tipCrgHab = (tipoOperacion || '').trim();
    const numCrgHab = (numeroOperacion || '').trim();

    if (!tipCrgHab || !numCrgHab) {
      throw new Error('El cargo no contiene el tipo y numero de operacion necesarios para imprimir.');
    }

    const detailRequest = this.isIncludedCharge(tipCrgHab)
      ? this.getIncludedChargeDetail(tipCrgHab, numCrgHab)
      : this.roomStayService.getRoomChargeDetailByNumber(numCrgHab);
    const response = await firstValueFrom(detailRequest.pipe(
      retry({
        count: 2,
        delay: (_error, retryCount) => timer(retryCount * 500)
      })
    ));

    const encabezado = response?.encabezado;
    const detalles = (response?.detalles || []).filter(
      (item) => Boolean((item.nomConsumo || item.codConsumo || '').trim())
        && Number(item.cantidad) > 0
    );

    if (!encabezado?.numCrgHab) {
      throw new Error('El encabezado del cargo no esta disponible para imprimir.');
    }
    if (
      encabezado.tipCrgHab
      && encabezado.tipCrgHab.trim().toUpperCase() !== tipCrgHab.toUpperCase()
    ) {
      throw new Error('El detalle consultado no corresponde al tipo de cargo seleccionado.');
    }
    if (!detalles.length) {
      throw new Error('El cargo no contiene lineas validas para imprimir.');
    }

    const empresa = this.empresaContext.empresa();
    const commands = this.printBuilder.build({
      empresa: {
        nombre: (empresa?.MA04_Nombre || empresa?.MA04_RazonSocial || 'HOTEL').trim(),
        ruc: empresa?.MA04_Ruc,
        direccion: empresa?.MA04_Direccion,
        telefono: empresa?.MA04_Telefono1
      },
      encabezado,
      detalles,
      puntoVentaNombre: puntoVentaNombre.trim() || encabezado.pntVenta,
      tipoDocumento: documentType,
      fechaImpresion: new Date()
    });

    await this.qzPrintService.printRaw(commands, printerName);
  }

  private getIncludedChargeDetail(tipCrgInc: string, numCrgInc: string): Observable<RoomChargeLookupResponse> {
    const baseUrl = (environment.apiUrl || 'http://localhost:5000/api').toString().replace(/\/+$/, '');
    const url = `${baseUrl}/cargo-incluido/${encodeURIComponent(tipCrgInc)}/${encodeURIComponent(numCrgInc)}`;
    return this.http.get<Record<string, unknown>>(url).pipe(map((response) => {
      const header = response?.['encabezado'] as Record<string, unknown> | null | undefined;
      const details = Array.isArray(response?.['detalle']) ? response['detalle'] as Array<Record<string, unknown>> : [];
      return {
        encabezado: {
          tipCrgHab: this.text(header, 'PFD03_TipCrgInc', 'pfD03_TipCrgInc') || tipCrgInc,
          numCrgHab: this.text(header, 'PFD03_NumCrgInc', 'pfD03_NumCrgInc') || numCrgInc,
          codReserva: this.text(header, 'PFD03_CodReserva', 'pfD03_CodReserva'),
          numHab: this.text(header, 'PFD03_NumHab', 'pfD03_NumHab'),
          pntVenta: this.text(header, 'PFD03_PntVenta', 'pfD03_PntVenta'),
          fecha: this.text(header, 'PFD03_Fecha', 'pfD03_Fecha'),
          hora: this.text(header, 'PFD03_Hora', 'pfD03_Hora'),
          numDocu: this.text(header, 'PFD03_NumDocu', 'pfD03_NumDocu'),
          nombrePax: this.text(header, 'PFD03_NombrePax', 'pfD03_NombrePax'),
          mtoTot: this.number(header, 'PFD03_MtoTot', 'pfD03_MtoTot'),
          moneda: this.text(header, 'PFD03_Moneda', 'pfD03_Moneda'),
          cierre: this.text(header, 'PFD03_Cierre', 'pfD03_Cierre') || '0',
          numCierre: this.text(header, 'PFD03_NumCierre', 'pfD03_NumCierre') || '0',
          estado: '0',
          operador: this.text(header, 'PFD03_Operador', 'pfD03_Operador')
        },
        detalles: details.map((item, index) => ({
          tipCrgHab: tipCrgInc,
          numCrgHab: numCrgInc,
          codRsv: this.text(header, 'PFD03_CodReserva', 'pfD03_CodReserva'),
          numHab: this.text(header, 'PFD03_NumHab', 'pfD03_NumHab'),
          pntVenta: this.text(header, 'PFD03_PntVenta', 'pfD03_PntVenta'),
          fecha: this.text(header, 'PFD03_Fecha', 'pfD03_Fecha'),
          hora: this.text(header, 'PFD03_Hora', 'pfD03_Hora'),
          grupo: '',
          categoria: '',
          codConsumo: this.text(item, 'PFD04_CodConsumo', 'pfD04_CodConsumo'),
          nomConsumo: this.text(item, 'PFD04_NomConsumo', 'pfD04_NomConsumo'),
          cantidad: this.number(item, 'PFD04_Cantidad', 'pfD04_Cantidad'),
          precio: this.number(item, 'PFD04_Precio', 'pfD04_Precio'),
          total: this.number(item, 'PFD04_Total', 'pfD04_Total'),
          moneda: this.text(item, 'PFD04_Moneda', 'pfD04_Moneda'),
          tipNPedido: '',
          numNPedido: '',
          codMozo: this.text(item, 'PFD04_CodMozo', 'pfD04_CodMozo'),
          incluido: 'S',
          exonerado: 'N',
          orden: index + 1,
          estado: '0',
          comentario: this.text(item, 'PFD04_Comentario', 'pfD04_Comentario'),
          porDescuento: 0,
          descuento: 0,
          precioLista: this.number(item, 'PFD04_Precio', 'pfD04_Precio'),
          operador: this.text(item, 'PFD04_Operador', 'pfD04_Operador')
        }))
      };
    }));
  }

  private isIncludedCharge(operationType: string): boolean {
    return operationType.trim().toUpperCase().startsWith('CI');
  }

  private text(record: Record<string, unknown> | null | undefined, ...keys: string[]): string {
    if (!record) return '';
    const value = keys.map((key) => record[key]).find((item) => item !== undefined && item !== null);
    return String(value ?? '').trim();
  }

  private number(record: Record<string, unknown> | null | undefined, ...keys: string[]): number {
    const value = this.text(record, ...keys);
    return Number(value) || 0;
  }
}
