import packageInfo from '../../package.json';
/*
export const environment = {
  appVersion: packageInfo.version,
  production: true,
  apiUrl: 'https://api.pmsnextdevcloud.com/api',
  baseUrl: 'https://api.pmsnextdevcloud.com/api',
  googleMapsApiKey: 'AIzaSyA-o3tTaSdRzt7JBBjRwBzYGNpUEtGyfF8'
};
*/

declare global {
  interface Window {
    __env: any;
  }
}

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  apiUrl: window.__env?.apiUrl || '',
  baseUrl: window.__env?.baseUrl || '',
  disabledToastTypes: Array.isArray(window.__env?.disabledToastTypes) ? window.__env.disabledToastTypes : ['error'],
  googleMapsApiKey: 'AIzaSyA-o3tTaSdRzt7JBBjRwBzYGNpUEtGyfF8'
};