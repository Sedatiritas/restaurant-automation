import "dotenv/config";
import argon2 from "argon2";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { prisma } from "../lib/prisma.js";

async function askLine(question: string): Promise<string> {
  const readline = createInterface({ input: stdin, output: stdout });

  try {
    return (await readline.question(question)).trim();
  } finally {
    readline.close();
  }
}

async function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Parolayı gizli girmek için komutu doğrudan bir PowerShell terminalinde çalıştırın.");
  }

  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };

    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("İşlem kullanıcı tarafından iptal edildi."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        if (character >= " ") {
          value += character;
        }
      }
    };

    stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const existingAdminCount = await prisma.user.count({
    where: { role: "ADMIN" }
  });

  if (existingAdminCount > 0) {
    console.log("Sistemde zaten bir yönetici hesabı var. Yeni ilk yönetici oluşturulmadı.");
    return;
  }

  console.log("\nİlk yönetici hesabı oluşturuluyor.\n");

  const username = (await askLine("Yönetici kullanıcı adı: ")).toLowerCase();
  const password = await askHidden("Parola (en az 12 karakter): ");
  const passwordConfirmation = await askHidden("Parolayı tekrar girin: ");

  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    throw new Error("Kullanıcı adı 3-32 karakter olmalı; yalnızca harf, rakam, nokta, tire ve alt çizgi kullanılabilir.");
  }

  if (password.length < 12 || password.length > 128) {
    throw new Error("Parola 12 ile 128 karakter arasında olmalı.");
  }

  if (password !== passwordConfirmation) {
    throw new Error("Parolalar eşleşmiyor.");
  }

  const existingUser = await prisma.user.findUnique({ where: { username } });

  if (existingUser) {
    throw new Error("Bu kullanıcı adı zaten kullanımda.");
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id
  });

  const admin = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: "ADMIN"
    },
    select: {
      id: true,
      username: true,
      role: true
    }
  });

  console.log("\nİlk yönetici hesabı başarıyla oluşturuldu.");
  console.log(`Kullanıcı adı: ${admin.username}`);
  console.log(`Rol: ${admin.role}`);
  console.log("Artık /login sayfasından Yönetici rolüyle giriş yapabilirsiniz.");
}

try {
  await main();
} catch (error) {
  console.error("\nYönetici hesabı oluşturulamadı:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
