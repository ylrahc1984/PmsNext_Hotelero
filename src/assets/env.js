(function configureEnvironment(targetWindow) {
  const configuredApiUrl = 'http://localhost:5000/api';

  function resolveApiUrl(value) {
    try {
      const url = new URL(value, targetWindow.location.origin);
      const apiUsesLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
      const browserUsesLoopback = ['localhost', '127.0.0.1', '::1'].includes(targetWindow.location.hostname);

      if (apiUsesLoopback && !browserUsesLoopback) {
        url.hostname = targetWindow.location.hostname;
      }

      return url.toString().replace(/\/+$/, '');
    } catch {
      return value;
    }
  }

  const apiUrl = resolveApiUrl(configuredApiUrl);
  targetWindow.__env = {
    apiUrl,
    baseUrl: apiUrl,
    disabledToastTypes: ['error']
  };
})(window);
