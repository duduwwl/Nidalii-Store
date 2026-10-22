# Nidalii Store

Loja virtual da Nidalii Store: catálogo, carrinho, checkout com entrega ou retirada, Pix, crédito e débito pelo Mercado Pago, frete pelo Melhor Envio e painel administrativo.

Identidade visual: `DESIGN.md`. Implantação e integrações: `DEPLOY.md`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4, com tokens próprios em `src/app/globals.css`
- PostgreSQL + Prisma 6
- Validação com Zod; senhas com Argon2id; sessões em cookie httpOnly
- Fotos processadas com Sharp (WebP, sem metadados)
- Testes: Vitest (unitários e integração) e Playwright (ponta a ponta)

## Rodar no computador

Requisitos: Node 20 ou superior e PostgreSQL.

```bash
npm install
cp .env.example .env          # preencha DATABASE_URL e NEXT_PUBLIC_SITE_URL=http://localhost:3000
npx prisma migrate deploy     # cria as tabelas
npm run db:seed               # configurações iniciais (horários e Instagram)
ADMIN_PASSWORD='uma-senha-forte-de-12+' npm run admin:create -- voce@email.com "Seu nome"
npm run dev                   # http://localhost:3000  ·  painel em /admin
```

Sem as chaves do Mercado Pago e do Melhor Envio, o site funciona, mas não cobra nem calcula frete: ele avisa a cliente em vez de simular.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` · `npm run typecheck` | ESLint e TypeScript |
| `npm test` | Testes unitários |
| `npm run test:integration` | Pedidos, estoque e pagamento contra o banco de testes |
| `npm run test:e2e` | Navegador: catálogo, compra, painel, responsividade |
| `npm run db:migrate` | Aplica migrações em produção |
| `npm run admin:create` | Cria ou promove uma administradora |

### Testes

Os testes de integração e de ponta a ponta usam um banco separado, `nidalii_test`, e o arquivo `.env.test` (não versionado). Os dados fictícios ("Peça de teste") só entram nesse banco; o script recusa qualquer banco cujo nome não termine em `_test`.

```bash
createdb nidalii_test
npx dotenv -e .env.test -- npx prisma migrate deploy
npx dotenv -e .env.test -- npx tsx scripts/test-fixtures.ts
npx dotenv -e .env.test -- npm run build
npm run test:integration && npm run test:e2e
```

`.env.test` precisa de `DATABASE_URL` (terminando em `_test`), `NEXT_PUBLIC_SITE_URL=http://localhost:3100`, `ORDER_LINK_SECRET`, `CRON_SECRET`, `STORAGE_DIR`, `TEST_ADMIN_EMAIL` e `TEST_ADMIN_PASSWORD`.

## Estrutura

```text
prisma/schema.prisma        banco completo (produtos, variantes, estoque, pedidos, pagamentos, frete…)
src/app/(store)/            páginas da loja
src/app/admin/              painel (login em /admin/entrar; tudo protegido no servidor)
src/app/api/webhooks/       notificações do Mercado Pago
src/app/api/cron/reservas   libera reservas de pedidos não pagos
src/server/                 regras de negócio: catálogo, carrinho, pedidos, estoque, frete, pagamentos, e-mail
src/components/             componentes da loja e do painel
tests/                      unit, integration, e2e
```

## Regras importantes

- Preço, desconto, estoque e frete são sempre recalculados no servidor. O navegador só envia ids.
- O estoque é reservado de forma atômica ao criar o pedido e baixado só quando o provedor confirma o pagamento.
- O pedido só vira "pago" pelo webhook assinado ou por consulta direta ao Mercado Pago; acessar a página de sucesso não confirma nada.
- O mesmo checkout reenviado nunca cria pedido duplicado (chave de idempotência).
- Dados do cartão nunca passam pelo servidor da loja (formulário seguro do Mercado Pago).
