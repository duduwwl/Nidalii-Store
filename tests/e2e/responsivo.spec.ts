import { expect, test } from "@playwright/test";

const PAGES = ["/", "/produtos", "/produtos/peca-de-teste-1", "/colecoes", "/colecoes/colecao-teste", "/carrinho", "/entrar", "/contato", "/entregas", "/favoritos"];
const WIDTHS = [320, 360, 375, 390, 414, 430, 768, 820, 1024, 1280, 1366, 1440, 1920];

for (const width of WIDTHS) {
  test(`sem rolagem horizontal em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} em ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test("celular: menu abre, navega e fecha", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Produtos" }).first().click();
  await expect(page).toHaveURL(/\/produtos/);
  await expect(menu).toBeHidden();
});

test("celular: filtros em gaveta", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/produtos");
  await page.getByRole("button", { name: /^Filtrar/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtrar" });
  await drawer.getByLabel("Blusas").check();
  await expect(page).toHaveURL(/categoria=blusas/);
  await drawer.getByRole("button", { name: /Ver \d+ produto/ }).click();
  await expect(drawer).toBeHidden();
});

test("todas as imagens têm texto alternativo e cada página tem um h1", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("h1"), path).toHaveCount(1);
    const missing = await page.locator("img:not([alt])").count();
    expect(missing, `${path}: imagens sem alt`).toBe(0);
  }
});
