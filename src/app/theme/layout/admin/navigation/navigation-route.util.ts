import { NavigationItem } from './navigation';

export function normalizeNavigationUrl(url: string): string {
  const normalized = (url || '').split('?')[0].split('#')[0].replace(/\/+$/, '');
  return normalized || '/';
}

export function navigationPathMatches(pattern: string, url: string, exact = false): boolean {
  const normalizedPattern = normalizeNavigationUrl(pattern);
  const normalizedUrl = normalizeNavigationUrl(url);
  return normalizedPattern === normalizedUrl || (!exact && normalizedUrl.startsWith(`${normalizedPattern}/`));
}

export function navigationItemMatchesUrl(item: NavigationItem, url: string): boolean {
  if (item.activeUrls?.some((pattern) => navigationPathMatches(pattern, url))) {
    return true;
  }

  if (item.url && navigationPathMatches(item.url, url, item.exactMatch === true)) {
    return true;
  }

  return item.children?.some((child) => navigationItemMatchesUrl(child, url)) ?? false;
}
