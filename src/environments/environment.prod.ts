import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  apiUrl: 'https://api.pmsnextdevcloud.com/api',
  baseUrl: 'https://api.pmsnextdevcloud.com/api',
  googleMapsApiKey: 'AIzaSyA-o3tTaSdRzt7JBBjRwBzYGNpUEtGyfF8'
};
