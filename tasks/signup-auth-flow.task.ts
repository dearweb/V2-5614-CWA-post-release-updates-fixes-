import { Page, expect } from '@playwright/test';
import { URLS, BASE_URL } from '../config/urls';
import { generateRandomEmail } from '../utils/helpers';

export interface SignupCredentials {
  email?: string;
  password?: string;
  isSlowNetwork?: boolean;
}

/**
 * Task for handling user Signup Authentication Flow.
 * Ported and enhanced from PROD STABILITY MONITOR with React hydration protection,
 * adaptive confirm password, and dashboard redirect.
 */
export class SignupAuthFlowTask {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Executes the full Signup flow: fills email, password, confirm password (if present),
   * accepts terms (if present), submits, and waits for dashboard redirect.
   */
  async performSignup(credentials: SignupCredentials = {}) {
    const page = this.page;
    const timeout = credentials.isSlowNetwork ? 120000 : 60000;
    const signupUrl = URLS.SIGNUP || `${BASE_URL}/members/signup`;
    const emailToUse = credentials.email || generateRandomEmail('cwa_user');
    const passwordToUse = credentials.password || 'Test@123456';

    console.log('\n' + '═'.repeat(70));
    console.log(`📝 [SIGNUP AUTH FLOW TASK] Navigating to: ${signupUrl}`);
    console.log(`   • Email:    ${emailToUse}`);
    console.log(`   • Password: ••••••••`);
    console.log('═'.repeat(70));

    // 1. Navigate to Signup URL
    await page.goto(signupUrl, { waitUntil: 'domcontentloaded', timeout });

    // 2. Resilient Email Input (with React Hydration Protection)
    const emailInput = page.getByPlaceholder(/enter your email|email/i)
      .or(page.getByRole('textbox', { name: /email/i }))
      .or(page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]'))
      .first();

    await emailInput.waitFor({ state: 'visible', timeout });
    await emailInput.click();
    await emailInput.fill(emailToUse);
    await emailInput.dispatchEvent('input').catch(() => {});
    await emailInput.dispatchEvent('change').catch(() => {});

    // Guard against SPA/React hydration clearing the initial field on mount
    await page.waitForTimeout(300);
    const currentEmailVal = await emailInput.inputValue().catch(() => '');
    if (currentEmailVal !== emailToUse) {
      console.log('   ⚠️ React hydration reset detected. Re-filling Email...');
      await emailInput.click();
      await emailInput.fill(emailToUse);
      await emailInput.dispatchEvent('input').catch(() => {});
    }

    // 3. Self-Healing Password Input
    const passwordInput = page.getByPlaceholder(/enter your password|password/i)
      .or(page.getByRole('textbox', { name: /^password$/i }))
      .or(page.locator('input[type="password"]:not([placeholder*="confirm" i]):not([name*="confirm" i])'))
      .first();

    await passwordInput.waitFor({ state: 'visible', timeout });
    await passwordInput.click();
    await passwordInput.fill(passwordToUse);
    await passwordInput.dispatchEvent('input').catch(() => {});
    await passwordInput.dispatchEvent('change').catch(() => {});

    // 4. Adaptive Confirm Password (Conditional - only fills if present in DOM)
    const confirmPasswordLocators = [
      page.getByPlaceholder(/confirm your password|confirm password/i),
      page.getByRole('textbox', { name: /confirm/i }),
      page.locator('input[placeholder*="confirm" i]'),
      page.locator('input[name*="confirm" i]'),
      page.locator('input[id*="confirm" i]'),
    ];

    for (const loc of confirmPasswordLocators) {
      try {
        const visibleConfirm = loc.first();
        if (await visibleConfirm.isVisible({ timeout: 2000 })) {
          console.log('   ℹ️ Found Confirm Password field, filling...');
          await visibleConfirm.click();
          await visibleConfirm.fill(passwordToUse);
          await visibleConfirm.dispatchEvent('input').catch(() => {});
          await visibleConfirm.dispatchEvent('change').catch(() => {});
          break;
        }
      } catch {
        // Confirm password is optional depending on site configuration
      }
    }

    // 5. Adaptive Terms & Conditions Checkbox (Conditional)
    try {
      const termsCheckbox = page.locator('input[type="checkbox"]').first();
      if (await termsCheckbox.isVisible({ timeout: 2000 })) {
        const isChecked = await termsCheckbox.isChecked().catch(() => false);
        if (!isChecked) {
          console.log('   ℹ️ Checking Terms and Conditions checkbox...');
          await termsCheckbox.check({ force: true }).catch(() => termsCheckbox.click({ force: true }));
        }
      }
    } catch {
      // Terms checkbox optional
    }

    // 6. Submit Signup Form
    const submitBtn = page.getByRole('button', { name: /Create Account|Sign Up|Create Free Account/i })
      .or(page.locator('button:has-text("Create Account")'))
      .or(page.locator('button[type="submit"]'))
      .first();

    await submitBtn.waitFor({ state: 'visible', timeout: 15000 });
    await submitBtn.click({ force: true });
    console.log('   🚀 Clicked Submit Signup button.');

    // 7. Wait for redirect to Dashboard
    console.log('   ⏳ Waiting for redirection to dashboard...');
    await page.waitForURL(/\/members\/dashboard|\/dashboard/i, { timeout });
    console.log(`✅ [SIGNUP AUTH FLOW TASK] Signup successful! Current URL: ${page.url()}`);
    console.log('═'.repeat(70) + '\n');

    return {
      email: emailToUse,
      password: passwordToUse,
      dashboardUrl: page.url(),
    };
  }
}
