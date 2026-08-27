/**
 * Base URL configured for the application under test (defaults to https://members.developtestsite.com)
 */
export const BASE_URL = process.env.BASE_URL || 'https://members.developtestsite.com';

/**
 * Centralized Application Routes and URL Builders
 */
export const URLS = {
  BASE: BASE_URL,
  PREVIEW: (vin: string) =>
    `${BASE_URL}/members/vin-check/preview?type=vhr&utm_details=&vin=${encodeURIComponent(vin)}&wpPage=homepage&landing=normal`,
  CHECKOUT: `${BASE_URL}/members/checkout`,
  DASHBOARD: (vin?: string) =>
    vin ? `${BASE_URL}/members/dashboard?vin=${encodeURIComponent(vin)}` : `${BASE_URL}/members/dashboard`,
  MY_REPORTS: `${BASE_URL}/members/my-reports`,
  SIGNUP: `${BASE_URL}/members/signup`,
  API_SITE_SETTINGS: 'api-cwa/site_settings',
};

/**
 * Helper to build an absolute URL from a relative path
 */
export function buildUrl(relativePath: string): string {
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${BASE_URL}${cleanPath}`;
}
