import { expect, test, type Page } from "@playwright/test";

const email = process.env.TEST_ADMIN_EMAIL!;
const password = process.env.TEST_ADMIN_PASSWORD!;

// Um login só para o arquivo inteiro: o painel limita tentativas de login por IP
test.describe.configure({ mode: "serial" });
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
});

test.afterAll(async () => page.close());

test("painel: senha errada não entra", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/admin/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});

test("painel: cadastrar produto, criar variantes, lançar estoque e publicar", async () => {
  await page.goto("/admin");
  await page.getByRole("link", { name: "Produtos" }).first().click();
  await page.getByRole("link", { name: "Novo produto" }).click();
  await page.getByLabel("Nome do produto").fill("Produto criado no teste");
  await page.getByLabel("Preço (R$)").fill("149,90");
  await page.getByRole("button", { name: "Criar e continuar" }).click();
  await expect(page.getByText("Produto criado como rascunho.")).toBeVisible();

  await page.getByLabel("Cores, uma por linha").fill("Azul|#203050");
  await page.getByRole("textbox", { name: "Tamanhos" }).fill("P M");
  await page.getByLabel("Estoque inicial de cada").fill("4");
  await page.getByRole("button", { name: "Criar combinações" }).click();
  await expect(page.getByText("2 variantes criadas.")).toBeVisible();
  await expect(page.getByText("4 disponíveis").first()).toBeVisible();

  // publicar sem foto: o sistema mantém como rascunho e explica
  await page.getByLabel("Situação").selectOption("ACTIVE");
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByText(/Salvo como rascunho\. Para publicar, envie pelo menos uma foto/)).toBeVisible();
});

test("painel: pedido aparece e muda de situação", async () => {
  await page.goto("/admin/pedidos?aba=6");
  const first = page.getByRole("link", { name: /^\d+$/ }).first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.getByRole("heading", { name: /Pedido \d+/ })).toBeVisible();
  await expect(page.getByText("Próximo passo")).toBeVisible();
});

test("painel: criar cupom", async () => {
  await page.goto("/admin/cupons");
  await page.getByRole("button", { name: "Novo cupom" }).click();
  await page.getByLabel("Código").first().fill(`E2E${Date.now().toString().slice(-5)}`);
  await page.getByLabel("Desconto (%)").first().fill("15");
  await page.getByRole("button", { name: "Criar cupom" }).click();
  await expect(page.getByText("Cupom salvo.")).toBeVisible();
});
