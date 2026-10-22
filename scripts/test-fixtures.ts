/**
 * Dados FICTÍCIOS para testes automatizados e revisão visual local.
 * Só roda em banco cujo nome termina em "_test". Nunca use na loja real.
 *   dotenv -e .env.test -- tsx scripts/test-fixtures.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import sharp from "sharp";

const url = process.env.DATABASE_URL ?? "";
if (!/\/[a-z0-9_]+_test(\?|$)/i.test(url)) {
  console.error("Recusado: este script só roda em banco de testes (nome terminado em _test).");
  process.exit(1);
}

const db = new PrismaClient();
const STORAGE = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage-test", "uploads");

// Fundos neutros diferentes por "peça" para a grade não parecer repetida
const TONES = ["#d9d4cc", "#c9cfc6", "#d6cbc8", "#cfd3da", "#e2ddd3", "#c8c2b8"];

async function testImage(name: string, tone: string, label: string, w = 1200, h = 1600) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${tone}"/>
    <rect x="${w * 0.3}" y="${h * 0.18}" width="${w * 0.4}" height="${h * 0.62}" rx="8" fill="#0a0a0a" opacity="0.08"/>
    <text x="50%" y="${h * 0.9}" text-anchor="middle" font-family="Helvetica, Arial" font-size="${w * 0.04}" fill="#55524e">FOTO DE TESTE · ${label}</text>
  </svg>`;
  const dir = path.join(STORAGE, "testes");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer());
  return { url: `/uploads/testes/${name}`, width: w, height: h };
}

async function main() {
  // limpa tudo (ordem respeita as chaves estrangeiras)
  await db.$transaction([
    db.paymentEvent.deleteMany(), db.payment.deleteMany(), db.couponRedemption.deleteMany(), db.shipment.deleteMany(),
    db.orderStatusEvent.deleteMany(), db.orderItem.deleteMany(), db.order.deleteMany(), db.shippingQuote.deleteMany(),
    db.cartItem.deleteMany(), db.cart.deleteMany(), db.wishlistItem.deleteMany(), db.wishlist.deleteMany(),
    db.inventoryMovement.deleteMany(), db.collectionProduct.deleteMany(), db.productImage.deleteMany(), db.productVariant.deleteMany(),
    db.product.deleteMany(), db.collection.deleteMany(), db.category.deleteMany(), db.coupon.deleteMany(), db.banner.deleteMany(),
    db.address.deleteMany(), db.customer.deleteMany(), db.session.deleteMany(), db.authToken.deleteMany(), db.admin.deleteMany(),
    db.auditLog.deleteMany(), db.user.deleteMany(), db.emailLog.deleteMany(), db.rateLimit.deleteMany(), db.siteSettings.deleteMany(),
  ]);

  await db.siteSettings.create({
    data: {
      id: "singleton",
      instagramUrl: "https://www.instagram.com/nidaliistore/",
      openingHours: [{ days: "Segunda a sexta", open: "09:00", close: "18:00" }, { days: "Sábado", open: "08:30", close: "12:00" }],
      pickupEnabled: true,
      storeStreet: "Rua de Teste", storeNumber: "100", storeNeighborhood: "Centro de Teste", storeCity: "Cidade Teste", storeState: "MG", storeCep: "00000000",
      pickupInstructions: "Endereço fictício usado só nos testes.",
      maxInstallments: 6, installmentsWithoutInterest: 3,
      sizeGuide: "## Medidas (teste)\n| Tamanho | Busto | Cintura |\n|---|---|---|\n| P | 84 | 66 |\n| M | 88 | 70 |\n| G | 94 | 76 |",
    },
  });

  const cats = await Promise.all(
    ["Vestidos", "Blusas", "Conjuntos"].map((name, i) => db.category.create({ data: { name, slug: name.toLowerCase(), position: i } })),
  );
  const col = await db.collection.create({ data: { name: "Coleção teste", slug: "colecao-teste", isFeatured: true, description: "Coleção fictícia para testes." } });

  const now = Date.now();
  for (let i = 0; i < 9; i++) {
    const tone = TONES[i % TONES.length];
    const slug = `peca-de-teste-${i + 1}`;
    const price = 9990 + i * 2000;
    const product = await db.product.create({
      data: {
        name: `Peça de teste ${i + 1}`, slug, status: "ACTIVE", categoryId: cats[i % 3].id,
        description: "Descrição fictícia usada apenas nos testes automatizados.",
        composition: "Composição de teste", priceCents: price, compareAtCents: i === 2 ? price + 4000 : null,
        isFeatured: i < 4, featuredPosition: i, publishedAt: new Date(now - i * 3600e3),
        weightGrams: 400, lengthCm: 30, widthCm: 25, heightCm: 5,
      },
    });
    const a = await testImage(`${slug}-1.webp`, tone, `${i + 1}A`);
    const b = await testImage(`${slug}-2.webp`, TONES[(i + 2) % TONES.length], `${i + 1}B`);
    await db.productImage.createMany({
      data: [
        { productId: product.id, url: a.url, width: a.width, height: a.height, alt: `Peça de teste ${i + 1}, frente`, position: 0 },
        { productId: product.id, url: b.url, width: b.width, height: b.height, alt: `Peça de teste ${i + 1}, detalhe`, position: 1 },
      ],
    });
    if (i < 4) {
      const e = await testImage(`${slug}-look.webp`, TONES[(i + 4) % TONES.length], `LOOK ${i + 1}`);
      await db.productImage.create({ data: { productId: product.id, url: e.url, width: e.width, height: e.height, alt: `Look de teste ${i + 1}`, position: 2, kind: "editorial" } });
    }
    const colors = i % 2 === 0 ? [["Preto", "#151515"], ["Areia", "#d8cbb5"]] : [["Verde", "#55624f"]];
    for (const [cName, hex] of colors) {
      for (const size of ["P", "M", "G"]) {
        // peça 9 esgotada; tamanho G da peça 1 esgotado
        const stock = i === 8 ? 0 : i === 0 && size === "G" ? 0 : 5;
        await db.productVariant.create({ data: { productId: product.id, sku: `${slug}-${cName}-${size}`.toUpperCase(), colorName: cName, colorHex: hex, size, stock } });
      }
    }
    if (i < 5) await db.collectionProduct.create({ data: { collectionId: col.id, productId: product.id, position: i } });
  }

  await db.coupon.create({ data: { code: "TESTE10", type: "PERCENT", value: 10, description: "Cupom de teste" } });

  // Um pedido pago de retirada, para as telas do painel terem o que mostrar
  const v = await db.productVariant.findFirstOrThrow({ where: { product: { slug: "peca-de-teste-2" } }, include: { product: true } });
  const buyer = await db.customer.create({ data: { email: "compradora@exemplo.test", fullName: "Compradora de Teste", cpf: "52998224725", phone: "11987654321" } });
  await db.order.create({
    data: {
      idempotencyKey: `fixture-${Date.now()}`, customerId: buyer.id, status: "PAID", fulfillment: "PICKUP", paidAt: new Date(),
      subtotalCents: v.product.priceCents!, totalCents: v.product.priceCents!,
      items: { create: [{ variantId: v.id, productName: v.product.name, sku: v.sku, colorName: v.colorName, size: v.size, unitCents: v.product.priceCents!, quantity: 1, totalCents: v.product.priceCents! }] },
      statusHistory: { create: [{ status: "AWAITING_PAYMENT" }, { status: "PAID", note: "Pedido de teste" }] },
    },
  });

  const email = process.env.TEST_ADMIN_EMAIL ?? "admin@nidalii.test";
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!password) throw new Error("Defina TEST_ADMIN_PASSWORD no .env.test");
  await db.user.create({
    data: { email, role: "ADMIN", passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }), admin: { create: { displayName: "Admin de teste" } } },
  });
  console.log("Dados de teste prontos.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
