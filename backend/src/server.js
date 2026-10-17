import "dotenv/config";
import app from "./app.js";
import prisma from "./config/prisma.js";

const PORT = Number(process.env.PORT || 5000);

// AUTOMATIC OVERDUE LOAN CHECK
// Mark unreturned loans as OVERDUE after their due date has passed.
let overdueCheckRunning = false;

async function refreshOverdueStatuses() {
  if (overdueCheckRunning) return;
  overdueCheckRunning = true;

  try {
    const result = await prisma.loan.updateMany({
      where: {
        status: "ACTIVE",
        dueAt: { lt: new Date() }
      },
      data: { status: "OVERDUE" }
    });

    if (result.count > 0) {
      console.log(`Marked ${result.count} loan(s) as OVERDUE.`);
    }
  } catch (error) {
    console.error("Automatic overdue check failed:", error.message);
  } finally {
    overdueCheckRunning = false;
  }
}

// Check once at startup, then every 60 seconds.
void refreshOverdueStatuses();
const overdueTimer = setInterval(refreshOverdueStatuses, 60 * 1000);


const server = app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});

async function shutdown() {
  console.log("Shutting down server...");
  clearInterval(overdueTimer);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
