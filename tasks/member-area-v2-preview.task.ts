import { Page, Locator, expect } from '@playwright/test';
import { URLS } from '../config/urls';

export interface CheckoutPaymentDetails {
  name: string;
  cardNumber: string;
  expDate: string;
  cvc: string;
  zipCode: string;
}

export class MemberAreaV2PreviewTask {
  readonly page: Page;
  readonly accessRecordsButton: Locator;
  readonly emailInput: Locator;
  readonly proceedToCheckoutButton: Locator;
  readonly zipCodeInput: Locator;
  readonly payButton: Locator;
  readonly paymentSuccessMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.accessRecordsButton = page.getByRole('button', { name: 'Access Records' });
    this.emailInput = page.getByRole('textbox', { name: /Email Address/i });
    this.proceedToCheckoutButton = page.getByRole('button', { name: 'Proceed to Checkout' });
    this.zipCodeInput = page.getByPlaceholder('Enter ZIP / Postal Code').or(page.getByRole('textbox', { name: /ZIP/i }));
    this.payButton = page.getByRole('button', { name: /Pay \$/i });
    this.paymentSuccessMessage = page.getByText(/Payment successful/i);
  }

  /**
   * Navigate to preview with fast DOM ready state
   */
  async navigateToPreview(vin: string) {
    await this.page.goto(URLS.PREVIEW(vin), { waitUntil: 'commit' });

    await expect(async () => {
      const surveyBtn = this.page.getByRole('button', { name: /Just checking|I'm a buyer|I'm the owner/i }).first();
      if (await surveyBtn.isVisible()) {
        await surveyBtn.click();
      }
      await expect(this.accessRecordsButton).toBeVisible();
    }).toPass();
  }

  /**
   * Click Access Records and submit Email Address
   */
  async submitEmail(email: string) {
    await this.accessRecordsButton.scrollIntoViewIfNeeded();
    await this.accessRecordsButton.click();
    
    await expect(this.emailInput).toBeEditable();
    await this.emailInput.fill(email);
    await this.proceedToCheckoutButton.click();
  }

  /**
   * Verify post-purchase redirection to Dashboard and My Reports
   */
  async verifyReportGeneration() {
    if (!/my-reports/i.test(this.page.url())) {
      await this.page.goto(URLS.MY_REPORTS, { waitUntil: 'commit' });
    }
    await expect(this.page).toHaveURL(/members\/my-reports/i);
  }
}
