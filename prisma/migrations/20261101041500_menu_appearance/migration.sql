CREATE TABLE "menu_appearance" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "brandName" VARCHAR(60) NOT NULL DEFAULT 'roast & co.',
    "tagline" VARCHAR(100) NOT NULL DEFAULT 'COFFEE · DESSERT · MOMENTS',
    "eyebrow" VARCHAR(80) NOT NULL DEFAULT 'HER FİNCANDA MUTLULUK',
    "headline" VARCHAR(140) NOT NULL DEFAULT 'Kendine güzel bir mola ver.',
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "accent" VARCHAR(7) NOT NULL DEFAULT '#b96e43',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "googleReviewUrl" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "menu_appearance_pkey" PRIMARY KEY ("id")
);
