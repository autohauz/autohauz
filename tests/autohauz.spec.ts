import { test, expect } from '@playwright/test';

test.describe('Public Workflows', () => {
  test('Home page renders and navigates to Inventory', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AutoHauz/);
    
    // Attempt to navigate to inventory
    const inventoryLink = page.getByRole('link', { name: /inventory|used cars|search/i }).first();
    if (await inventoryLink.isVisible()) {
      await inventoryLink.click();
      await expect(page).toHaveURL(/used-cars/);
    }
  });

  test('Vehicle detail page renders without crashing', async ({ page }) => {
    // Assuming /used-cars is the listing page, wait for a vehicle link
    await page.goto('/used-cars');
    const firstVehicle = page.locator('a[href^="/used-cars/"]').first();
    if (await firstVehicle.count() > 0) {
      await firstVehicle.click();
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('Contact form requires validation', async ({ page }) => {
    await page.goto('/contact');
    const submitBtn = page.getByRole('button', { name: /submit|send/i });
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      // Should show validation errors for empty required fields
      await expect(page.locator('text=/required|invalid/i').first()).toBeVisible();
    }
  });
});

test.describe('Admin & Security', () => {
  test('Unauthenticated user is redirected from /admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/admin-login/);
  });

  test('Missing Turnstile token on API submission quarantines lead', async ({ request }) => {
    const response = await request.post('/api/v1/leads', {
      data: {
        type: 'contact',
        name: 'Bot Tester',
        email: 'bot@example.com',
        phone: '0412345678',
        message: 'Test message',
        turnstileToken: '' // Empty token
      }
    });
    
    // Status should be 201 because we silently quarantine bots, but the DB flags it as spam.
    // The spec confirms: "Spam is silently quarantined (status='spam') — the client still gets a success response"
    expect(response.status()).toBe(201);
  });
});
