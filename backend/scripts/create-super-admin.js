import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/config/prisma.js";

async function main() {
  const fullName = process.env.SUPER_ADMIN_NAME?.trim();
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!fullName || !email || !password) {
    throw new Error("Name, email, and password are required.");
  }

  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }

  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    throw new Error(
      "This email already exists. No account was changed."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      isSuperAdmin: true
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      isSuperAdmin: true,
      status: true
    }
  });

  console.log("Super Admin created successfully:");
  console.log(JSON.stringify(user, null, 2));
}

try {
  await main();
} catch (error) {
  console.error("Could not create Super Admin:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
