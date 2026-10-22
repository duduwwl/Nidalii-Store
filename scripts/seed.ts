/**
 * Configuração inicial com o que a loja já confirmou.
 * Não cria produtos, preços, endereço nem políticas: isso entra pelo painel.
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      storeName: "Nidalii Store",
      instagramUrl: "https://www.instagram.com/nidaliistore/",
      // Horários informados pela loja. Confirme em Painel › Frete e retirada.
      openingHours: [
        { days: "Segunda a sexta", open: "09:00", close: "18:00" },
        { days: "Sábado", open: "08:30", close: "12:00" },
      ],
      maxInstallments: 1,
      installmentsWithoutInterest: 1,
      pixExpirationMinutes: 30,
    },
  });
  console.log("Configurações iniciais criadas (ou já existiam).");
}

main().finally(() => db.$disconnect());
