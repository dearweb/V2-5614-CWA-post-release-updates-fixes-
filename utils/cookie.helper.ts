import { BrowserContext, Page, TestInfo } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { BASE_URL } from '../config/urls';

/**
 * Global IP Pool for Regional IP testing (currency, localization, geo-pricing)
 */
export const IP_POOL = {
  KOREA: '79.110.55.34',       // South Korea (KR) - KRW (₩)
  US: '162.251.62.82',          // United States (US) - USD ($)
  UK: '172.99.190.215',         // United Kingdom (GB) - GBP (£)
  GERMANY: '85.214.132.117',    // Germany (DE) - EUR (€)
  CANADA: '192.206.151.131',    // Canada (CA) - CAD ($)
} as const;

export type IpPoolRegion = keyof typeof IP_POOL;

export interface CookieItem {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

export interface CaptureCookieOptions {
  log?: boolean;
  attachToReport?: boolean;
  saveToDisk?: boolean;
  testInfo?: TestInfo;
  filename?: string;
}

export interface InjectCookiePayload {
  name: string;
  value: string;
  domain?: string;
  url?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Separate Cookie Helper for capturing, inspecting, injecting, and modifying cookies.
 */
export class CookieHelper {
  private readonly context: BrowserContext;

  constructor(pageOrContext: Page | BrowserContext) {
    this.context = 'context' in pageOrContext ? pageOrContext.context() : pageOrContext;
  }

  /**
   * Captures ALL cookies currently stored in the browser context.
   * Logs clean summary, optionally saves to disk and attaches to Playwright test report.
   */
  async captureAllCookies(options: CaptureCookieOptions = { log: true, attachToReport: true, saveToDisk: true }): Promise<CookieItem[]> {
    const cookies = (await this.context.cookies()) as CookieItem[];

    if (options.log !== false) {
      console.log('\n' + '═'.repeat(70));
      console.log(`🍪 [COOKIE HELPER - ALL COOKIES CAPTURED] Total: ${cookies.length}`);
      console.log('═'.repeat(70));
      if (cookies.length === 0) {
        console.log('   (No cookies found in context)');
      } else {
        cookies.forEach((c, idx) => {
          console.log(`   [${idx + 1}] ${c.name} = "${c.value}"`);
          console.log(`       Domain: ${c.domain} | Path: ${c.path} | Secure: ${c.secure} | HttpOnly: ${c.httpOnly} | SameSite: ${c.sameSite}`);
        });
      }
      console.log('═'.repeat(70) + '\n');
    }

    const formattedJson = JSON.stringify(cookies, null, 2);

    // Save to disk
    if (options.saveToDisk !== false) {
      try {
        const dir = path.resolve(process.cwd(), 'test-results', 'cookies');
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const filename = options.filename || `cookies-${Date.now()}.json`;
        fs.writeFileSync(path.join(dir, filename), formattedJson, 'utf-8');
      } catch (err) {
        console.error('[COOKIE HELPER] Could not write cookies to disk:', err);
      }
    }

    // Attach to HTML report
    if (options.attachToReport !== false && options.testInfo) {
      await options.testInfo
        .attach(options.filename || 'captured-all-cookies.json', {
          body: formattedJson,
          contentType: 'application/json',
        })
        .catch(() => {});
    }

    return cookies;
  }

  /**
   * Retrieves a single cookie value by name.
   */
  async getCookie(name: string): Promise<CookieItem | undefined> {
    const cookies = (await this.context.cookies()) as CookieItem[];
    return cookies.find((c) => c.name === name);
  }

  /**
   * Injects or modifies cookies in the browser context.
   * If a cookie with the same name and domain exists, it will be updated/overwritten.
   */
  async injectOrModifyCookies(cookies: InjectCookiePayload[]): Promise<void> {
    const defaultDomain = new URL(BASE_URL).hostname;

    const formattedCookies = cookies.map((c) => ({
      path: '/',
      domain: c.domain || (!c.url ? defaultDomain : undefined),
      ...c,
    }));

    await this.context.addCookies(formattedCookies);

    console.log(`💉 [COOKIE HELPER] Injected/Modified ${cookies.length} cookie(s):`);
    cookies.forEach((c) => {
      console.log(`   • ${c.name} = "${c.value}" (Domain: ${c.domain || defaultDomain})`);
    });
  }

  /**
   * Clears all or specific cookies from the browser context.
   */
  async clearCookies(nameFilter?: string): Promise<void> {
    if (nameFilter) {
      await this.context.clearCookies({ name: nameFilter });
      console.log(`🧹 [COOKIE HELPER] Cleared cookie: ${nameFilter}`);
    } else {
      await this.context.clearCookies();
      console.log(`🧹 [COOKIE HELPER] Cleared all cookies from context`);
    }
  }
}

/**
 * Dedicated Class for Injecting and Modifying ONLY the CWA Client IP Cookie ('cwa_ip').
 */
export class CookieIpInjector {
  private readonly context: BrowserContext;
  private readonly domain: string;

  constructor(pageOrContext: Page | BrowserContext, customDomain?: string) {
    this.context = 'context' in pageOrContext ? pageOrContext.context() : pageOrContext;
    this.domain = customDomain || new URL(BASE_URL).hostname;
  }

  /**
   * Retrieves ONLY the 'cwa_ip' cookie object from the browser context.
   */
  async getCwaIpCookie(): Promise<CookieItem | undefined> {
    const cookies = (await this.context.cookies()) as CookieItem[];
    return cookies.find((c) => c.name === 'cwa_ip');
  }

  /**
   * Retrieves ONLY the string value of the 'cwa_ip' cookie (e.g. '172.71.210.61').
   */
  async getCwaIpValue(): Promise<string | undefined> {
    const cookie = await this.getCwaIpCookie();
    return cookie?.value;
  }

  /**
   * Injects or modifies ONLY the 'cwa_ip' cookie with a specified IP address.
   * @param ipAddress - IP address string (e.g. '79.110.55.34' for Korea)
   */
  async setCwaIpCookie(ipAddress: string): Promise<CookieItem | undefined> {
    await this.context.addCookies([
      {
        name: 'cwa_ip',
        value: ipAddress,
        domain: this.domain,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    console.log('\n' + '─'.repeat(70));
    console.log(`💉 [CWA IP INJECTOR] Injected 'cwa_ip': "${ipAddress}" (Domain: ${this.domain})`);
    console.log('─'.repeat(70) + '\n');

    return this.getCwaIpCookie();
  }

  /**
   * Modifies ONLY the 'cwa_ip' cookie and verifies that the new value is stored.
   */
  async modifyAndVerifyIp(newIp: string): Promise<{ success: boolean; currentIp?: string; cookie?: CookieItem }> {
    const updatedCookie = await this.setCwaIpCookie(newIp);
    const success = updatedCookie?.value === newIp;

    if (!success) {
      throw new Error(
        `[COOKIE IP INJECTOR] Failed to verify 'cwa_ip'. Expected "${newIp}", got "${updatedCookie?.value}"`
      );
    }

    return {
      success: true,
      currentIp: updatedCookie?.value,
      cookie: updatedCookie,
    };
  }
}

