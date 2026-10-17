import "dotenv/config";
import app from "./app.js";
import prisma from "./config/prisma.js";

const PORT = Number(process.env.PORT || 5000);

const server = app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});

async function shutdown() {
  console.log("Shutting down server...");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
