declare module 'qz-tray' {
  export interface QzWebsocketApi {
    isActive(): boolean;
    connect(): Promise<unknown>;
    disconnect(): Promise<unknown>;
  }

  export interface QzConfigsApi {
    create(printerName: string, options?: Record<string, unknown>): unknown;
  }

  export interface QzPrintersApi {
    find(printerName?: string): Promise<string | string[]>;
  }

  export interface QzSecurityApi {
    setCertificatePromise(
      promiseHandler: (resolve: (certificate: string) => void, reject: (error: unknown) => void) => void,
      options?: { rejectOnFailure?: boolean }
    ): void;
    setSignatureAlgorithm(algorithm: 'SHA1' | 'SHA256' | 'SHA512'): void;
    setSignaturePromise(
      promiseFactory: (
        dataToSign: string
      ) => (resolve: (signature: string) => void, reject: (error: unknown) => void) => void
    ): void;
  }

  export interface QzTrayApi {
    websocket: QzWebsocketApi;
    configs: QzConfigsApi;
    printers: QzPrintersApi;
    security: QzSecurityApi;
    print(config: unknown, data: string[]): Promise<unknown>;
  }

  const qz: QzTrayApi;
  export default qz;
}
