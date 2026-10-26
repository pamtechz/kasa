/// Only KASA can receive native push registration; other links leave the app.
bool isKasaPage(Uri page, Uri portal) =>
    page.scheme == 'https' &&
    page.host == portal.host &&
    (page.port == portal.port || page.hasPort == portal.hasPort) &&
    page.userInfo.isEmpty;

String? safeInternalPath(String? raw) {
  if (raw == null || !raw.startsWith('/') ||
      raw.startsWith('//') || raw.contains('\\') ||
      raw.contains('..') || raw.contains('?redirect=') ||
      raw.length > 500) { return null; }
  return raw;
}
