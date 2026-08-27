import { BrowserContext, Page, TestInfo } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export interface CapturedApiCall {
  timestamp: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    payload: any;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
  };
}

/**
 * Generates a VIN with randomized characters.
 */
export function generateRandomVin(baseVin: string = 'WA1E2BFY9M21083'): string {
  const chars = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ';
  const randomChar1 = chars.charAt(Math.floor(Math.random() * chars.length));
  const randomChar2 = chars.charAt(Math.floor(Math.random() * chars.length));
  return `${baseVin}${randomChar1}${randomChar2}`;
}

/**
 * Generates a unique timestamped email address.
 */
export function generateRandomEmail(prefix: string = 'test'): string {
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}_${timestamp}@emails.com`;
}

/**
 * Helper to parse multipart form-data or JSON string into clean readable JSON object.
 */
function parseRequestBody(rawPostData: string | null): any {
  if (!rawPostData) return null;
  try {
    return JSON.parse(rawPostData);
  } catch {
    const matches = [...rawPostData.matchAll(/name="([^"]+)"\r?\n\r?\n([^\r\n-]+)/g)];
    if (matches.length > 0) {
      const parsed: Record<string, string> = {};
      matches.forEach((m) => {
        parsed[m[1]] = m[2].trim();
      });
      return parsed;
    }
    return rawPostData;
  }
}

/**
 * Listens for specific API calls (e.g. 'api-cwa/site_settings') across the entire test flow.
 * Captures the FULL un-truncated response body and formatted request payload in clean pretty-printed JSON.
 */
export function listenForApi(
  page: Page,
  urlPattern: string | RegExp,
  options: { log?: boolean; attachToReport?: boolean; saveToDisk?: boolean; testInfo?: TestInfo; filename?: string } = {
    log: true,
    attachToReport: true,
    saveToDisk: true,
  }
): { getCapturedCalls: () => CapturedApiCall[] } {
  const capturedCalls: CapturedApiCall[] = [];

  page.on('response', async (response) => {
    const request = response.request();
    const url = response.url();

    const isMatch = typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url);

    if (isMatch) {
      const requestPayload = parseRequestBody(request.postData());

      let responseBody: any = null;
      try {
        responseBody = await response.json();
      } catch {
        const rawText = await response.text().catch(() => '');
        try {
          responseBody = JSON.parse(rawText);
        } catch {
          responseBody = rawText;
        }
      }

      const entry: CapturedApiCall = {
        timestamp: new Date().toISOString(),
        request: {
          url,
          method: request.method(),
          headers: request.headers(),
          payload: requestPayload,
        },
        response: {
          status: response.status(),
          statusText: response.statusText(),
          headers: response.headers(),
          body: responseBody,
        },
      };

      capturedCalls.push(entry);

      if (options.log) {
        console.log('\n' + '═'.repeat(70));
        console.log(`📡 [FULL API CAPTURED] ${request.method()} ${url} [Status: ${response.status()}]`);
        console.log('═'.repeat(70));
        console.log('➡️ REQUEST PAYLOAD:');
        console.log(JSON.stringify(requestPayload, null, 2));
        console.log('\n⬅️ COMPLETE RESPONSE BODY (FULL JSON):');
        console.log(JSON.stringify(responseBody, null, 2));
        console.log('═'.repeat(70) + '\n');
      }

      const formattedJson = JSON.stringify(entry, null, 2);

      if (options.saveToDisk !== false) {
        try {
          const dir = path.resolve(process.cwd(), 'test-results', 'api-captures');
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          const cleanName = options.filename || 'site-settings-full-response.json';
          fs.writeFileSync(path.join(dir, cleanName), formattedJson, 'utf-8');
        } catch (e) {
          console.error('[API CAPTURE] Could not write to disk:', e);
        }
      }

      if (options.attachToReport && options.testInfo) {
        await options.testInfo
          .attach(options.filename || 'site-settings-full-response.json', {
            body: formattedJson,
            contentType: 'application/json',
          })
          .catch(() => {});
      }
    }
  });

  return {
    getCapturedCalls: () => capturedCalls,
  };
}

/**
 * Captures all cookies from the current page/context.
 */
export async function captureCookies(
  pageOrContext: Page | BrowserContext,
  options: { log?: boolean; attachToReport?: boolean; testInfo?: TestInfo } = { log: true }
) {
  const context = 'context' in pageOrContext ? pageOrContext.context() : pageOrContext;
  const cookies = await context.cookies();

  if (options.log) {
    console.log(`\n🍪 [COOKIES CAPTURED] Total: ${cookies.length}`);
    cookies.forEach((c) => {
      console.log(`   • ${c.name} = ${c.value} (Domain: ${c.domain})`);
    });
  }

  if (options.attachToReport && options.testInfo) {
    await options.testInfo.attach('captured-cookies.json', {
      body: JSON.stringify(cookies, null, 2),
      contentType: 'application/json',
    });
  }

  return cookies;
}

/**
 * Retrieves a single cookie value by name.
 */
export async function getCookieByName(
  pageOrContext: Page | BrowserContext,
  name: string
): Promise<string | undefined> {
  const context = 'context' in pageOrContext ? pageOrContext.context() : pageOrContext;
  const cookies = await context.cookies();
  const cookie = cookies.find((c) => c.name === name);
  return cookie?.value;
}
