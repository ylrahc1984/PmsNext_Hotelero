import { Injectable } from '@angular/core';
import qz from 'qz-tray';

import { QZ_LOCAL_CERTIFICATE, QZ_LOCAL_PRIVATE_KEY } from './qz-local-certificate';

@Injectable({
  providedIn: 'root'
})
export class QzPrintService {
  private readonly defaultPrinterName = 'TIQUETE';
  private connectingPromise: Promise<void> | null = null;
  private privateKeyPromise: Promise<CryptoKey> | null = null;
  private securityConfigured = false;

  async connect(): Promise<void> {
    if (qz.websocket.isActive()) {
      return;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.configureSecurity();

    this.connectingPromise = qz.websocket
      .connect()
      .then(() => undefined)
      .catch((error: unknown) => {
        throw new Error(this.resolveConnectionError(error));
      })
      .finally(() => {
        this.connectingPromise = null;
      });

    return this.connectingPromise;
  }

  async disconnect(): Promise<void> {
    if (!qz.websocket.isActive()) {
      return;
    }

    try {
      await qz.websocket.disconnect();
    } catch (error) {
      throw new Error(this.resolvePrintError(error, 'No se pudo desconectar QZ Tray.'));
    }
  }

  async printRaw(commands: string[], printerName = this.defaultPrinterName): Promise<void> {
    const normalizedPrinter = (printerName ?? '').toString().trim() || this.defaultPrinterName;

    if (!commands.length) {
      throw new Error('No hay comandos ESC/POS para imprimir.');
    }

    try {
      await this.connect();
      await this.ensurePrinterAvailable(normalizedPrinter);
      const config = qz.configs.create(normalizedPrinter);
      await qz.print(config, commands);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(this.resolvePrintError(error, 'No se pudo imprimir el voucher POS.'));
    }
  }

  private async ensurePrinterAvailable(printerName: string): Promise<void> {
    try {
      await qz.printers.find(printerName);
    } catch {
      throw new Error(`No se encontró la impresora POS "${printerName}". Verifique que esté instalada y visible para QZ Tray.`);
    }
  }

  private configureSecurity(): void {
    if (this.securityConfigured) {
      return;
    }

    qz.security.setCertificatePromise((resolve) => {
      resolve(QZ_LOCAL_CERTIFICATE);
    }, { rejectOnFailure: true });
    qz.security.setSignatureAlgorithm('SHA512');
    qz.security.setSignaturePromise((dataToSign: string) => {
      return (resolve, reject) => {
        this.signQzPayload(dataToSign).then(resolve).catch(reject);
      };
    });
    this.securityConfigured = true;
  }

  private async signQzPayload(dataToSign: string): Promise<string> {
    if (!window.crypto?.subtle) {
      throw new Error('El navegador no permite firma criptográfica local. Use HTTPS o localhost para conectar con QZ Tray.');
    }

    const privateKey = await this.getPrivateKey();
    const signature = await window.crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      privateKey,
      new TextEncoder().encode(dataToSign)
    );

    return this.arrayBufferToBase64(signature);
  }

  private getPrivateKey(): Promise<CryptoKey> {
    if (!this.privateKeyPromise) {
      this.privateKeyPromise = window.crypto.subtle.importKey(
        'pkcs8',
        this.pemToArrayBuffer(QZ_LOCAL_PRIVATE_KEY),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
        false,
        ['sign']
      );
    }

    return this.privateKeyPromise;
  }

  private pemToArrayBuffer(pem: string): ArrayBuffer {
    const base64 = pem
      .replace(/-----BEGIN [^-]+-----/g, '')
      .replace(/-----END [^-]+-----/g, '')
      .replace(/\s/g, '');
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes.buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return window.btoa(binary);
  }

  private resolveConnectionError(error: unknown): string {
    const message = this.extractErrorMessage(error).toLowerCase();
    if (message.includes('websocket') || message.includes('connect') || message.includes('refused') || message.includes('failed')) {
      return 'No se pudo conectar con QZ Tray. Verifique que QZ Tray esté instalado, abierto y autorizado en este equipo.';
    }
    return this.resolvePrintError(error, 'QZ Tray no está disponible en este equipo.');
  }

  private resolvePrintError(error: unknown, fallback: string): string {
    const message = this.extractErrorMessage(error);
    return message || fallback;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return '';
  }
}
