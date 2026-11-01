import "dotenv/config";
import { prisma } from "../lib/prisma.js";

try {
  const rows = await prisma.$queryRaw<
    Array<{ database: string; server_version: string }>
  >`
    SELECT
      current_database() AS database,
      current_setting('server_version') AS server_version
  `;

  const result = rows[0];

  if (!result) {
    throw new Error("PostgreSQL bağlantı testi sonuç döndürmedi.");
  }

  console.log("PostgreSQL bağlantısı başarılı.");
  console.log(`Veritabanı: ${result.database}`);
  console.log(`PostgreSQL sürümü: ${result.server_version}`);
} catch (error) {
  console.error("PostgreSQL bağlantı testi başarısız:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
