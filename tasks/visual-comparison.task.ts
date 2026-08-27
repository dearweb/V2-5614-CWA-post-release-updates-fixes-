import { Page, expect, TestInfo } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export interface ThemeComparisonResult {
  detectedTheme: 'member_area_v2' | 'member_area_v1';
  isV2: boolean;
  screenshotPath: string;
  details: string;
}

export class VisualComparisonTask {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Captures screenshot on /members/my-reports and evaluates visual/structural markers
   * to determine whether member_area_v2 or member_area_v1 is currently active.
   */
  async verifyMyReportsTheme(testInfo?: TestInfo): Promise<ThemeComparisonResult> {
    const page = this.page;

    // 1. Ensure we are on My Reports page and content is loaded
    await page.waitForURL(/\/members\/my-reports/i, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // 2. Capture high-resolution screenshot
    const screenshotsDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const screenshotPath = path.join(screenshotsDir, `my-reports-${Date.now()}.png`);
    const screenshotBuffer = await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    // 3. Attach screenshot to Playwright HTML Report
    if (testInfo) {
      await testInfo.attach('my-reports-visual-snapshot.png', {
        body: screenshotBuffer,
        contentType: 'image/png',
      });
    }

    // 4. Analyze DOM & Layout Theme Signature
    // member_area_v2 features: modern Tailwind/Flex card structures, v2 root attributes, or v2 header components
    const themeAnalysis = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const hasV2Class = document.querySelector('.member_area_v2, [data-theme*="v2"], .theme-v2, #member-area-v2') !== null;
      const hasV2Layout = document.querySelector('header, nav, main')?.className.includes('v2') || false;
      const isModernCards = document.querySelectorAll('.grid, .flex, [class*="rounded-"], [class*="shadow"]').length > 10;
      const hasV1LegacyTable = document.querySelector('table.table-striped, table.legacy-table') !== null;

      return {
        hasV2Class,
        hasV2Layout,
        isModernCards,
        hasV1LegacyTable,
        pageTitle: document.title,
      };
    });

    // Determine Theme
    const isV2 = (themeAnalysis.hasV2Class || themeAnalysis.hasV2Layout || themeAnalysis.isModernCards) && !themeAnalysis.hasV1LegacyTable;
    const detectedTheme = isV2 ? 'member_area_v2' : 'member_area_v1';

    console.log('\n' + '═'.repeat(70));
    console.log(`🎨 [VISUAL THEME COMPARISON] /members/my-reports`);
    console.log('═'.repeat(70));
    console.log(`   📸 Screenshot Saved: ${screenshotPath}`);
    if (isV2) {
      console.log(`   ✅ Visual Result: member_area_theme: "member_area_v2" (Active & Matches Current Actual)`);
    } else {
      console.log(`   ⚠️ Visual Result: member_area_theme: "member_area_v1" (Different / Legacy Theme Active)`);
    }
    console.log('═'.repeat(70) + '\n');

    const result: ThemeComparisonResult = {
      detectedTheme,
      isV2,
      screenshotPath,
      details: isV2
        ? 'Theme matches member_area_v2 actual visual specifications.'
        : 'Visual layout differs from v2; detected member_area_v1 layout.',
    };

    // Attach theme result JSON to HTML report
    if (testInfo) {
      await testInfo.attach('theme-comparison-result.json', {
        body: JSON.stringify(result, null, 2),
        contentType: 'application/json',
      });
    }

    return result;
  }
}
