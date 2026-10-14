import { arrayBufferToBase64Url, base64UrlToUint8Array } from './push-web.utils';

describe('push web utilities', () => {
  it('convierte claves de suscripción a Base64URL sin padding', () => {
    const bytes = new Uint8Array([251, 255]);

    expect(arrayBufferToBase64Url(bytes.buffer)).toBe('-_8');
  });

  it('convierte una clave pública VAPID Base64URL a bytes', () => {
    expect(Array.from(base64UrlToUint8Array('-_8'))).toEqual([251, 255]);
  });

  it('rechaza claves vacías', () => {
    expect(() => base64UrlToUint8Array('')).toThrowError('La clave pública VAPID no está disponible.');
    expect(() => arrayBufferToBase64Url(null)).toThrowError('La clave de suscripción Push no está disponible.');
  });
});
