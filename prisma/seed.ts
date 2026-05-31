import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding G-Homz database…");

  await prisma.bulkConsumption.deleteMany();
  await prisma.fabricConsumption.deleteMany();
  await prisma.spongeConsumption.deleteMany();
  await prisma.productionLog.deleteMany();
  await prisma.manufacturingCost.deleteMany();
  await prisma.productBulkMaterial.deleteMany();
  await prisma.productFabric.deleteMany();
  await prisma.productSponge.deleteMany();
  await prisma.product.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.bulkMaterial.deleteMany();
  await prisma.fabric.deleteMany();
  await prisma.sponge.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("changeme123", 10);
  const managerHash = await bcrypt.hash("changeme123", 10);
  await prisma.user.createMany({
    data: [
      {
        email: "founder@g-homz.com",
        name: "Ahmed Hassan",
        role: "ADMIN",
        passwordHash: adminHash,
      },
      {
        email: "ops@g-homz.com",
        name: "Mariam Saleh",
        role: "MANAGER",
        passwordHash: managerHash,
      },
    ],
  });

  // ─── Suppliers ────────────────────────────────────────────────────────
  const cairoFoam = await prisma.supplier.create({
    data: {
      name: "Cairo Foam Industries",
      contact: "Mostafa Adel",
      phone: "+20 100 000 1111",
      email: "sales@cairofoam.eg",
    },
  });
  const textileHouse = await prisma.supplier.create({
    data: {
      name: "Nile Textile House",
      contact: "Salma Nabil",
      phone: "+20 100 000 2222",
      email: "orders@niletextile.eg",
    },
  });

  // ─── Sponge blocks ────────────────────────────────────────────────────
  const yellow26Soft = await prisma.sponge.create({
    data: {
      name: "Yellow 26 Soft",
      density: 26,
      hardness: "SOFT",
      color: "Yellow",
      widthCm: 240,
      depthCm: 200,
      heightCm: 120,
      pricePerDensity: 220,
      unitCost: (240 * 200 * 120 * 26 * 220) / 1_000_000,
      stockBlocks: 18,
      wastePct: 6,
      supplierId: cairoFoam.id,
      notes: "Used for L-shape sofas and oversized chairs.",
    },
  });

  const blue32Medium = await prisma.sponge.create({
    data: {
      name: "Blue 32 Medium",
      density: 32,
      hardness: "MEDIUM",
      color: "Blue",
      widthCm: 240,
      depthCm: 200,
      heightCm: 100,
      pricePerDensity: 235,
      unitCost: (240 * 200 * 100 * 32 * 235) / 1_000_000,
      stockBlocks: 12,
      wastePct: 5,
      supplierId: cairoFoam.id,
      notes: "Sturdier base sponge — used in seat cushions and bed bases.",
    },
  });

  await prisma.sponge.create({
    data: {
      name: "Grey 40 Hard",
      density: 40,
      hardness: "HARD",
      color: "Grey",
      widthCm: 200,
      depthCm: 180,
      heightCm: 80,
      pricePerDensity: 260,
      unitCost: (200 * 180 * 80 * 40 * 260) / 1_000_000,
      stockBlocks: 8,
      wastePct: 4,
      supplierId: cairoFoam.id,
      notes: "Premium high-density foam, ottoman and structural uses.",
    },
  });

  // ─── Fabrics ──────────────────────────────────────────────────────────
  const twixReef = await prisma.fabric.create({
    data: {
      name: "Twix Reef",
      collection: "Twix",
      color: "Sand",
      texture: "Velvet",
      costPerMeter: 210,
      stockMeters: 480,
      reorderLevel: 80,
      supplierId: textileHouse.id,
    },
  });

  await prisma.fabric.create({
    data: {
      name: "Spaniol",
      collection: "Spaniol",
      color: "Charcoal",
      texture: "Boucle",
      costPerMeter: 245,
      stockMeters: 320,
      reorderLevel: 60,
      supplierId: textileHouse.id,
    },
  });

  await prisma.fabric.create({
    data: {
      name: "Australian",
      collection: "Australian",
      color: "Cream",
      texture: "Linen",
      costPerMeter: 195,
      stockMeters: 540,
      reorderLevel: 80,
      supplierId: textileHouse.id,
    },
  });

  // ─── Bulk materials ───────────────────────────────────────────────────
  const fiber = await prisma.bulkMaterial.create({
    data: {
      name: "Polyester fiber",
      kind: "FIBER",
      costPerKg: 250,
      stockKg: 120,
      reorderLevel: 20,
    },
  });

  const vaseline = await prisma.bulkMaterial.create({
    data: {
      name: "Vaseline (compression wrap)",
      kind: "PACKAGING",
      costPerKg: 50,
      stockKg: 80,
      reorderLevel: 15,
    },
  });

  // ─── Products ─────────────────────────────────────────────────────────
  const lShape = await prisma.product.create({
    data: {
      sku: "GH-LSF-001",
      name: "Fluff L Shape Sofa",
      category: "L_SHAPE_SOFA",
      description:
        "Compressed sponge L-shape sofa with modular back cushions and removable covers.",
      widthCm: 240,
      depthCm: 160,
      heightCm: 70,
      retailPrice: 18500,
      wholesalePrice: 14500,
      stockQty: 6,
      sponges: {
        create: [
          {
            spongeId: yellow26Soft.id,
            cutWidthCm: 240,
            cutDepthCm: 80,
            cutHeightCm: 60,
            cuts: 1,
            notes: "Main seat block.",
          },
          {
            spongeId: blue32Medium.id,
            cutWidthCm: 160,
            cutDepthCm: 80,
            cutHeightCm: 30,
            cuts: 1,
            notes: "Back support.",
          },
        ],
      },
      fabrics: {
        create: [{ fabricId: twixReef.id, meters: 12 }],
      },
      bulkMaterials: {
        create: [
          { bulkMaterialId: fiber.id, grams: 1850 },
          { bulkMaterialId: vaseline.id, grams: 1500 },
        ],
      },
      manufacturing: {
        create: [
          { kind: "LABOR", label: "Labor", amount: 300 },
          { kind: "SEWING", label: "Sewing", amount: 120 },
          { kind: "COMPRESSION", label: "Compression", amount: 60 },
          { kind: "PACKAGING_LABOR", label: "Packaging labor", amount: 40 },
          { kind: "TRANSPORT", label: "Transportation", amount: 80 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      sku: "GH-CHR-001",
      name: "Fluff Chair",
      category: "CHAIR",
      description: "Single-seater compressed sponge chair.",
      widthCm: 90,
      depthCm: 90,
      heightCm: 70,
      retailPrice: 5400,
      wholesalePrice: 4100,
      stockQty: 14,
      sponges: {
        create: [
          {
            spongeId: yellow26Soft.id,
            cutWidthCm: 80,
            cutDepthCm: 80,
            cutHeightCm: 60,
            cuts: 1,
          },
        ],
      },
      fabrics: {
        create: [{ fabricId: twixReef.id, meters: 4 }],
      },
      bulkMaterials: {
        create: [
          { bulkMaterialId: fiber.id, grams: 650 },
          { bulkMaterialId: vaseline.id, grams: 500 },
        ],
      },
      manufacturing: {
        create: [
          { kind: "LABOR", label: "Labor", amount: 140 },
          { kind: "SEWING", label: "Sewing", amount: 60 },
          { kind: "PACKAGING_LABOR", label: "Packaging labor", amount: 25 },
          { kind: "TRANSPORT", label: "Transportation", amount: 30 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      sku: "GH-OTT-001",
      name: "Fluff Ottoman",
      category: "OTTOMAN",
      description: "Modular ottoman that pairs with the L-shape sofa.",
      widthCm: 80,
      depthCm: 80,
      heightCm: 40,
      retailPrice: 2800,
      wholesalePrice: 2100,
      stockQty: 9,
      sponges: {
        create: [
          {
            spongeId: blue32Medium.id,
            cutWidthCm: 80,
            cutDepthCm: 80,
            cutHeightCm: 35,
            cuts: 1,
          },
        ],
      },
      fabrics: {
        create: [{ fabricId: twixReef.id, meters: 2.5 }],
      },
      bulkMaterials: {
        create: [
          { bulkMaterialId: fiber.id, grams: 350 },
          { bulkMaterialId: vaseline.id, grams: 300 },
        ],
      },
      manufacturing: {
        create: [
          { kind: "LABOR", label: "Labor", amount: 80 },
          { kind: "SEWING", label: "Sewing", amount: 40 },
          { kind: "TRANSPORT", label: "Transportation", amount: 20 },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      sku: "GH-BED-001",
      name: "Cloud Kids Bed",
      category: "KIDS_BED",
      description: "Soft-edged kids bed made from compressed sponge.",
      widthCm: 200,
      depthCm: 100,
      heightCm: 35,
      retailPrice: 9600,
      wholesalePrice: 7400,
      stockQty: 3,
      sponges: {
        create: [
          {
            spongeId: blue32Medium.id,
            cutWidthCm: 200,
            cutDepthCm: 100,
            cutHeightCm: 30,
            cuts: 1,
          },
        ],
      },
      fabrics: {
        create: [{ fabricId: twixReef.id, meters: 7 }],
      },
      bulkMaterials: {
        create: [
          { bulkMaterialId: fiber.id, grams: 1200 },
          { bulkMaterialId: vaseline.id, grams: 900 },
        ],
      },
      manufacturing: {
        create: [
          { kind: "LABOR", label: "Labor", amount: 220 },
          { kind: "SEWING", label: "Sewing", amount: 80 },
          { kind: "PACKAGING_LABOR", label: "Packaging labor", amount: 35 },
          { kind: "TRANSPORT", label: "Transportation", amount: 60 },
        ],
      },
    },
  });

  // ─── Demo production logs (last 6 months) ─────────────────────────────
  const products = await prisma.product.findMany();
  const now = new Date();
  for (let month = 5; month >= 0; month--) {
    const day = new Date(now.getFullYear(), now.getMonth() - month, 12);
    for (const product of products) {
      const qty = Math.floor(Math.random() * 5) + 1;
      const unitCost = product.retailPrice * 0.55;
      await prisma.productionLog.create({
        data: {
          productId: product.id,
          quantity: qty,
          status: "COMPLETED",
          startedAt: day,
          finishedAt: day,
          unitCost,
          totalCost: unitCost * qty,
        },
      });
    }
  }

  console.log("✅ Seed complete — Fluff family ready to manufacture.");
  console.log(`   • Sponge example cost: ${lShape.name} sponge block …`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
