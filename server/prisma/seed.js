const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const settings = [
    { label: "multi_user_mode", value: "false" },
    { label: "limit_user_messages", value: "false" },
    { label: "message_limit", value: "25" },
    { label: "logo_filename", value: "anything-llm.png" },
  ];

  for (let setting of settings) {
    const existing = await prisma.system_settings.findUnique({
      where: { label: setting.label },
    });

    // Only create the setting if it doesn't already exist
    if (!existing) {
      await prisma.system_settings.create({
        data: setting,
      });
    }
  }
}

async function testConnection() {
  try {
    const settings = await prisma.system_settings.findFirst();
    console.log('System Settings:', settings);
  } catch (error) {
    console.error('Error connecting to the database:', error);
  } finally {
    await prisma.$disconnect();
  }
}


main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });  

testConnection();
