/**
 * Cria (ou promove) a primeira conta administradora.
 *   ADMIN_PASSWORD='senha-forte-com-12+' npm run admin:create -- email@loja.com "Nome"
 * A senha vem de variável de ambiente para não ficar no histórico do terminal nem no código.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const db = new PrismaClient();

async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Informe o e-mail: npm run admin:create -- email@loja.com \"Nome\"");
  if (!password || password.length < 12) throw new Error("Defina ADMIN_PASSWORD com pelo menos 12 caracteres.");
  const displayName = nameParts.join(" ") || "Administração";
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const user = await db.user.upsert({
    where: { email: email.toLowerCase() },
    update: { role: "ADMIN", passwordHash },
    create: { email: email.toLowerCase(), role: "ADMIN", passwordHash },
  });
  await db.admin.upsert({ where: { userId: user.id }, update: { displayName }, create: { userId: user.id, displayName } });
  console.log(`Administradora pronta: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
