CREATE TABLE "business_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "phone" VARCHAR(40) NOT NULL DEFAULT '',
    "email" VARCHAR(254),
    "address" VARCHAR(500),
    "description" VARCHAR(250) NOT NULL DEFAULT 'Kahve, tatlı ve güzel anlar.',
    "instagram" VARCHAR(1000),
    "whatsapp" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);
