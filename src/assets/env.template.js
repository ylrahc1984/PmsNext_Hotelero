(function configureEnvironment(targetWindow) {
  const configuredApiUrl = "${API_URL}";

  function resolveApiUrl(value) {
    try {
      const url = new URL(value, targetWindow.location.origin);
      const apiUsesLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
      const browserUsesLoopback = ['localhost', '127.0.0.1', '::1'].includes(targetWindow.location.hostname);

      // Cuando el frontend se abre desde otra PC, "localhost" apunta a esa PC.
      // Conservamos el puerto/ruta configurados y usamos el host que sirvio el frontend.
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
