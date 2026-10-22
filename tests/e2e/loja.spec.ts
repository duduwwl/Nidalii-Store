import { expect, test } from "@playwright/test";

// Requer os dados de teste: npm run fixtures:test (banco nidalii_test)

test("catálogo: filtros combinados ficam na URL e mudam o resultado", async ({ page }) => {
  await page.goto("/produtos");
  await expect(page.getByRole("heading", { level: 1, name: "Produtos" })).toBeVisible();
  await expect(page.getByText("9 produtos", { exact: true })).toBeVisible();
  await page.getByRole("complementary", { name: "Filtros" }).getByLabel("Vestidos").check();
  await expect(page).toHaveURL(/categoria=vestidos/);
  await expect(page.getByText("3 produtos", { exact: true })).toBeVisible();
  await page.getByRole("complementary", { name: "Filtros" }).getByRole("button", { name: "G", exact: true }).click();
  await expect(page).toHaveURL(/tamanho=G/);
  await page.getByLabel("Ordenar").selectOption("maior-preco");
  await expect(page).toHaveURL(/ordem=maior-preco/);
  // compartilhar a busca: abrir a mesma URL dá o mesmo resultado
  const url = page.url();
  await page.goto(url);
  await expect(page.getByRole("complementary", { name: "Filtros" }).getByLabel("Vestidos")).toBeChecked();
});

test("busca rápida encontra produtos", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByRole("searchbox").fill("teste 4");
  await expect(page.getByRole("dialog", { name: "Buscar produtos" }).getByRole("link", { name: /Peça de teste 4/ })).toBeVisible();
});

test("produto: exige tamanho, bloqueia variante esgotada e adiciona à sacola", async ({ page }) => {
  await page.goto("/produtos/peca-de-teste-1");
  await page.getByRole("button", { name: "Areia" }).click();
  await expect(page.getByRole("button", { name: "Tamanho G, esgotado" })).toBeDisabled();
  await page.getByRole("button", { name: "Adicionar à sacola" }).first().click();
  await expect(page.getByRole("alert").filter({ hasText: "Escolha um tamanho" })).toBeVisible();
  await page.getByRole("button", { name: "Tamanho M" }).click();
  await page.getByRole("button", { name: "Adicionar à sacola" }).first().click();
  const drawer = page.getByRole("dialog", { name: /Sacola/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Peça de teste 1")).toBeVisible();
  await expect(page.getByRole("button", { name: /Sacola, 1 item/ })).toBeVisible();
});

test("produto esgotado não pode ser comprado", async ({ page }) => {
  await page.goto("/produtos/peca-de-teste-9");
  await expect(page.getByRole("button", { name: "Esgotado" }).first()).toBeDisabled();
});

test("favoritos de visitante ficam salvos no aparelho", async ({ page }) => {
  await page.goto("/produtos");
  await page.getByRole("button", { name: "Favoritar Peça de teste 2" }).click();
  await page.goto("/favoritos");
  await expect(page.getByRole("link", { name: "Peça de teste 2" }).first()).toBeVisible();
});

test("compra completa com retirada na loja até a tela de pagamento", async ({ page }) => {
  await page.goto("/produtos/peca-de-teste-2");
  await page.getByRole("button", { name: "Tamanho P" }).click();
  await page.getByRole("button", { name: "Adicionar à sacola" }).first().click();
  await expect(page.getByRole("dialog", { name: /Sacola/ })).toBeVisible();
  await page.goto("/carrinho");

  // cupom inválido e válido
  await page.getByLabel("Cupom").fill("NAOEXISTE");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("Cupom não encontrado.")).toBeVisible();
  await page.getByLabel("Cupom").fill("teste10");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("TESTE10")).toBeVisible();
  await expect(page.getByText("Desconto")).toBeVisible();

  await page.getByRole("link", { name: "Finalizar compra" }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  // validação dos dados
  await page.getByRole("button", { name: "Continuar para entrega" }).click();
  await expect(page.getByText("Informe nome e sobrenome.")).toBeVisible();
  await page.getByLabel("Nome completo").fill("Cliente de Teste");
  await page.getByLabel("E-mail").fill("cliente@exemplo.test");
  await page.getByLabel("Celular com DDD").fill("11987654321");
  await page.getByLabel("CPF").fill("11111111111");
  await page.getByRole("button", { name: "Continuar para entrega" }).click();
  await expect(page.getByText("CPF inválido. Confira os números.")).toBeVisible();
  await page.getByLabel("CPF").fill("52998224725");
  await page.getByRole("button", { name: "Continuar para entrega" }).click();

  await page.getByText("Retirar na loja").click();
  await expect(page.getByRole("main").getByText("Rua de Teste, 100")).toBeVisible();
  await page.getByRole("button", { name: "Revisar pedido" }).click();
  await page.getByRole("button", { name: /Ir para o pagamento/ }).click();
  await expect(page.getByText("Aceite os termos para continuar.")).toBeVisible();
  await page.getByLabel(/Li e aceito os termos de uso/).check();
  await page.getByRole("button", { name: /Ir para o pagamento/ }).click();

  await expect(page).toHaveURL(/\/checkout\/pagamento\?pedido=/);
  await expect(page.getByRole("heading", { name: "Pagamento" })).toBeVisible();
  // sem credenciais do Mercado Pago, a loja avisa em vez de simular pagamento
  await expect(page.getByText("O pagamento online ainda não foi ativado pela loja.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Sacola, 0 itens/ })).toBeVisible();

  // a página de sucesso não confirma pedido sem pagamento aprovado
  await page.goto(page.url().replace("/checkout/pagamento", "/checkout/sucesso"));
  await expect(page).toHaveURL(/\/checkout\/pendente/);
});

test("link de pedido adulterado não abre o pedido", async ({ page }) => {
  const res = await page.goto("/checkout/sucesso?pedido=abc&t=falso");
  expect(res?.status()).toBe(404);
});

test("webhook sem assinatura válida é recusado", async ({ request }) => {
  const res = await request.post("/api/webhooks/mercadopago?data.id=1&type=payment", { data: { id: 1, type: "payment", data: { id: "1" } } });
  expect(res.status()).toBe(401);
});

test("área do cliente exige login e o painel exige conta da equipe", async ({ page }) => {
  await page.goto("/minha-conta");
  await expect(page).toHaveURL(/\/entrar\?voltar=/);
  await page.goto("/admin/produtos");
  await expect(page).toHaveURL(/\/admin\/entrar/);
});
