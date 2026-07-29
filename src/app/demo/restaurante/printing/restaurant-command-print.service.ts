import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { QzPrintService } from 'src/app/core/services/qz-print.service';
import { RestaurantePedidoItem } from '../interfaces/restaurante-pedido-item.interface';
import {
  NotaPedidoRestauranteDocumento,
  NotaPedidoRestauranteProceso110Params,
  NotaPedidoRestauranteProceso110Response,
  NotaPedidoRestauranteService
} from '../services/nota-pedido-restaurante.service';
import {
  RestaurantCommandDestination,
  RestaurantCommandDocumentType,
  RestaurantCommandPrintBuilder
} from './restaurant-command-print.builder';

export interface RestaurantCommandPrintContext {
  documento        : NotaPedidoRestauranteDocumento;
  pntVta           : string;
  codArea          : string;
  numMesa          : string;
  fecha            : string;
  hora             ?: string;
  exonerado        : number | string;
  salon            : string;
  mesero           : string;
  personas         ?: number;
}

export interface RestaurantCommandDispatchRequest extends RestaurantCommandPrintContext {
  nuevosItems      : RestaurantePedidoItem[];
}

export interface RestaurantCommandReprintRequest extends RestaurantCommandPrintContext {
  gruposActuales   : string[];
}

export interface RestaurantCommandPrintFailure {
  destino  : RestaurantCommandDestination;
  impresora: string;
  mensaje  : string;
}

export interface RestaurantCommandDispatchResult {
  endpointConsultado : boolean;
  impresos            : RestaurantCommandDestination[];
  sinDetalle          : RestaurantCommandDestination[];
  impresorasFaltantes : RestaurantCommandPrintFailure[];
  erroresImpresion    : RestaurantCommandPrintFailure[];
  errorConsulta       : string;
}

@Injectable({
  providedIn: 'root'
})
export class RestaurantCommandPrintService {
  private readonly notaPedidoService = inject(NotaPedidoRestauranteService);
  private readonly qzPrintService = inject(QzPrintService);
  private readonly builder = inject(RestaurantCommandPrintBuilder);

  async dispatchPending(request: RestaurantCommandDispatchRequest): Promise<RestaurantCommandDispatchResult> {
    const requiredDestinations = this.requiredDestinations(request.nuevosItems);
    return this.dispatch(
      request,
      requiredDestinations,
      () => firstValueFrom(
        this.notaPedidoService.obtenerComandaPendiente(this.endpointParams(request))
      ),
      'ORIGINAL',
      '110'
    );
  }

  async reprint(request: RestaurantCommandReprintRequest): Promise<RestaurantCommandDispatchResult> {
    const requiredDestinations = this.requiredDestinationsFromGroups(request.gruposActuales);
    return this.dispatch(
      request,
      requiredDestinations,
      () => firstValueFrom(
        this.notaPedidoService.obtenerComandaReimpresion(this.endpointParams(request))
      ),
      'REIMPRESION',
      '111'
    );
  }

  private async dispatch(
    request: RestaurantCommandPrintContext,
    requiredDestinations: RestaurantCommandDestination[],
    fetchDetails: () => Promise<NotaPedidoRestauranteProceso110Response>,
    documentType: RestaurantCommandDocumentType,
    processNumber: '110' | '111'
  ): Promise<RestaurantCommandDispatchResult> {
    const result = this.emptyResult();
    const printerByDestination: Record<RestaurantCommandDestination, string> = {
      COCINA: 'COCINA',
      BAR: 'BAR'
    };

    if (!requiredDestinations.length) {
      return result;
    }

    let availablePrinters: string[];
    try {
      availablePrinters = await this.qzPrintService.getAvailablePrinters();
    } catch (error) {
      const message = this.errorMessage(error, 'No se pudo consultar QZ Tray.');
      result.impresorasFaltantes = requiredDestinations.map((destino) => ({
        destino,
        impresora: printerByDestination[destino],
        mensaje: message
      }));
      return result;
    }

    result.impresorasFaltantes = requiredDestinations
      .filter((destino) => !this.printerExists(availablePrinters, printerByDestination[destino]))
      .map((destino) => ({
        destino,
        impresora: printerByDestination[destino],
        mensaje: `No existe una cola activa llamada "${printerByDestination[destino]}".`
      }));

    if (result.impresorasFaltantes.length) {
      return result;
    }

    let response: NotaPedidoRestauranteProceso110Response;
    try {
      response = await fetchDetails();
      result.endpointConsultado = true;
    } catch (error) {
      result.errorConsulta = this.errorMessage(
        error,
        documentType === 'REIMPRESION'
          ? 'No se pudo consultar el detalle para reimprimir la comanda.'
          : 'No se pudo consultar el detalle pendiente de la comanda.'
      );
      return result;
    }

    if ((response?.respuesta || '').trim().toUpperCase() !== 'OK') {
      result.errorConsulta =
        response?.respuesta || `El proceso ${processNumber} no devolvió una respuesta válida.`;
      return result;
    }

    await this.printDestination(
      'COCINA',
      Array.isArray(response.alimentos) ? response.alimentos : [],
      printerByDestination.COCINA,
      request,
      result,
      documentType
    );
    await this.printDestination(
      'BAR',
      Array.isArray(response.bebidas) ? response.bebidas : [],
      printerByDestination.BAR,
      request,
      result,
      documentType
    );

    return result;
  }

  private async printDestination(
    destino: RestaurantCommandDestination,
    detalles: NotaPedidoRestauranteProceso110Response['alimentos'],
    printerName: string,
    request: RestaurantCommandPrintContext,
    result: RestaurantCommandDispatchResult,
    documentType: RestaurantCommandDocumentType
  ): Promise<void> {
    const validDetails = detalles.filter(
      (item) => Boolean(item?.ppV08_NomProducto?.trim()) && Number(item.ppV08_Cantidad) > 0
    );

    if (!validDetails.length) {
      result.sinDetalle.push(destino);
      return;
    }

    try {
      const commands = this.builder.build({
        destino,
        tipoDocumento: documentType,
        documento: request.documento,
        puntoVenta: request.pntVta,
        salon: request.salon || request.codArea,
        mesa: request.numMesa,
        mesero: request.mesero,
        personas: request.personas,
        fechaPedido: request.fecha,
        horaPedido: request.hora,
        detalles: validDetails,
        fechaImpresion: new Date()
      });
      await this.qzPrintService.printRaw(commands, printerName);
      result.impresos.push(destino);
    } catch (error) {
      result.erroresImpresion.push({
        destino,
        impresora: printerName,
        mensaje: this.errorMessage(error, `No se pudo imprimir la comanda de ${destino}.`)
      });
    }
  }

  private requiredDestinations(items: RestaurantePedidoItem[]): RestaurantCommandDestination[] {
    return this.requiredDestinationsFromGroups(items.map((item) => item.grupo));
  }

  private requiredDestinationsFromGroups(groups: string[]): RestaurantCommandDestination[] {
    const destinations = new Set<RestaurantCommandDestination>();
    groups.forEach((value) => {
      const group = this.normalizeGroup(value);
      destinations.add(group.includes('BEBID') ? 'BAR' : 'COCINA');
    });
    return Array.from(destinations);
  }

  private endpointParams(
    request: RestaurantCommandPrintContext
  ): NotaPedidoRestauranteProceso110Params {
    return {
      tipNp: request.documento.TIPO,
      serieNp: request.documento.SERIE,
      numNp: request.documento.NUMERODOC,
      pntVta: request.pntVta,
      codArea: request.codArea,
      numMesa: request.numMesa,
      fecha: request.fecha,
      exonerado: request.exonerado
    };
  }

  private normalizeGroup(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private printerExists(availablePrinters: string[], printerName: string): boolean {
    const normalizedTarget = printerName.toLocaleLowerCase();
    return availablePrinters.some(
      (availablePrinter) => availablePrinter.trim().toLocaleLowerCase() === normalizedTarget
    );
  }

  private emptyResult(): RestaurantCommandDispatchResult {
    return {
      endpointConsultado: false,
      impresos: [],
      sinDetalle: [],
      impresorasFaltantes: [],
      erroresImpresion: [],
      errorConsulta: ''
    };
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
    return fallback;
  }
}
