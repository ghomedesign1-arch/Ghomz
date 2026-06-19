import { z } from "zod";

export const spongeInput = z.object({
  name: z.string().min(1),
  density: z.number().int().positive(),
  hardness: z.enum(["SUPER_SOFT", "SOFT", "MEDIUM", "HARD", "MEMORY_FOAM"]),
  color: z.string().min(1),
  widthCm: z.number().positive(),
  depthCm: z.number().positive(),
  heightCm: z.number().positive(),
  pricePerDensity: z.number().positive(),
  stockBlocks: z.number().int().nonnegative().default(0),
  wastePct: z.number().min(0).max(50).default(5),
  supplierId: z.string().optional(),
  manufactureDate: z
    .union([z.string().datetime(), z.string().length(0), z.null()])
    .optional(),
  notes: z.string().optional(),
  /** Cutting plan: which products come from this block, and how many per
   *  block. Optional — omit to leave the existing plan unchanged. */
  yields: z
    .array(
      z.object({
        productId: z.string().min(1),
        unitsPerBlock: z.number().int().positive(),
      }),
    )
    .optional(),
});

export const fabricInput = z.object({
  name: z.string().min(1),
  collection: z.string().optional(),
  color: z.string().optional(),
  texture: z.string().optional(),
  costPerMeter: z.number().positive(),
  stockMeters: z.number().nonnegative().default(0),
  reorderLevel: z.number().nonnegative().default(0),
  supplierId: z.string().optional(),
});

export const bulkInput = z.object({
  name: z.string().min(1),
  kind: z.enum(["FIBER", "PACKAGING", "EXTRA"]),
  costPerKg: z.number().positive(),
  stockKg: z.number().nonnegative().default(0),
  reorderLevel: z.number().nonnegative().default(0),
});

export const pocketCoilInput = z.object({
  name: z.string().min(1),
  costPerUnit: z.number().positive(),
  stockUnits: z.number().int().nonnegative().default(0),
  reorderLevel: z.number().int().nonnegative().default(0),
  supplierId: z.string().optional(),
  notes: z.string().optional(),
});

export const supplierInput = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const productionRunInput = z.object({
  productId:    z.string().min(1),
  quantity:     z.number().int().positive(),
  notes:        z.string().optional(),
  clientName:   z.string().optional(),
  clientPhone:  z.string().optional(),
  clientAddress:z.string().optional(),
  deposit:      z.number().min(0).optional(),
  startDate:    z.string().datetime({ offset: true }).optional(),
  deliveryDate: z.string().datetime({ offset: true }).optional(),
  priority:     z.enum(["NORMAL", "HIGH", "URGENT"]).optional(),
  status:       z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  // Selling price from dialog (retail / wholesale / custom)
  unitCost:     z.number().min(0).optional(),
  totalCost:    z.number().min(0).optional(),
  discount:     z.number().min(0).optional(),
});

const manufacturingKinds = [
  "LABOR",
  "SEWING",
  "COMPRESSION",
  "PACKAGING_LABOR",
  "TRANSPORT",
  "FIXED_FEE",
  "OTHER",
] as const;

export const bomInput = z
  .object({
    sponges: z.array(
      z.object({
        spongeId: z.string().min(1),
        // Cut dimensions are optional now — set on the sponge's cutting plan
        // instead. Allow 0 here so BOMs can skip them entirely.
        cutWidthCm: z.number().nonnegative().default(0),
        cutDepthCm: z.number().nonnegative().default(0),
        cutHeightCm: z.number().nonnegative().default(0),
        cuts: z.number().int().positive(),
        unitsPerBlockOverride: z
          .number()
          .int()
          .positive()
          .nullable()
          .optional(),
        notes: z.string().optional(),
      }),
    ),
    fabrics: z.array(
      z.object({
        fabricId: z.string().min(1),
        meters: z.number().positive(),
      }),
    ),
    bulkMaterials: z.array(
      z.object({
        bulkMaterialId: z.string().min(1),
        grams: z.number().positive(),
      }),
    ),
    pocketCoils: z
      .array(
        z.object({
          pocketCoilId: z.string().min(1),
          quantity: z.number().int().positive(),
        }),
      )
      .optional()
      .default([]),
    manufacturing: z.array(
      z.object({
        kind: z.enum(manufacturingKinds),
        label: z.string().min(1),
        amount: z.number().nonnegative(),
      }),
    ),
    /** Sub-products this product is composed of (a "set" / bundle). */
    compositions: z
      .array(
        z.object({
          childProductId: z.string().min(1),
          quantity: z.number().positive(),
          notes: z.string().optional(),
        }),
      )
      .optional()
      .default([]),
  })
  .superRefine((data, ctx) => {
    // Fabric and bulk usage is keyed (productId, resourceId) — duplicates would
    // violate the unique index in Prisma. Block them at the API boundary so the
    // user gets a clean validation message instead of a 500.
    const seenFabrics = new Set<string>();
    for (const f of data.fabrics) {
      if (seenFabrics.has(f.fabricId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each fabric can only appear once per product",
          path: ["fabrics"],
        });
      }
      seenFabrics.add(f.fabricId);
    }
    const seenBulk = new Set<string>();
    for (const b of data.bulkMaterials) {
      if (seenBulk.has(b.bulkMaterialId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each bulk material can only appear once per product",
          path: ["bulkMaterials"],
        });
      }
      seenBulk.add(b.bulkMaterialId);
    }
    const seenCoils = new Set<string>();
    for (const pc of data.pocketCoils ?? []) {
      if (seenCoils.has(pc.pocketCoilId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each pocket coil can only appear once per product",
          path: ["pocketCoils"],
        });
      }
      seenCoils.add(pc.pocketCoilId);
    }
    const seenCuts = new Set<string>();
    for (const s of data.sponges) {
      const key = [
        s.spongeId,
        s.cutWidthCm,
        s.cutDepthCm,
        s.cutHeightCm,
      ].join("·");
      if (seenCuts.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Duplicate sponge cut — same block + same dimensions can only appear once",
          path: ["sponges"],
        });
      }
      seenCuts.add(key);
    }
    const seenChildren = new Set<string>();
    for (const c of data.compositions ?? []) {
      if (seenChildren.has(c.childProductId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Each sub-product can only appear once in the composition",
          path: ["compositions"],
        });
      }
      seenChildren.add(c.childProductId);
    }
  });

export const spongeYieldsInput = z.object({
  yields: z
    .array(
      z.object({
        productId: z.string().min(1),
        unitsPerBlock: z.number().int().positive(),
        notes: z.string().optional(),
      }),
    )
    .superRefine((arr, ctx) => {
      const seen = new Set<string>();
      for (const y of arr) {
        if (seen.has(y.productId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Each product can only appear once in the cutting plan",
          });
        }
        seen.add(y.productId);
      }
    }),
});

export const purchaseInput = z.object({
  supplierId: z.string().min(1).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  /** ISO-8601 date the purchase took place. Optional on create (defaults to now). */
  purchaseDate: z
    .union([z.string().datetime(), z.string().length(0), z.null()])
    .optional(),
  items: z
    .array(
      z.object({
        kind: z.enum(["SPONGE", "FABRIC", "BULK", "MARKETING", "OTHER"]),
        itemName: z.string().min(1, "Item name is required"),
        itemDescription: z.string().optional(),
        quantity: z.number().positive(),
        unitCost: z.number().nonnegative(),
      }),
    )
    .min(1, "At least one item is required"),
});

export const productInput = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.enum([
    "SOFA_2_SEAT",
    "SOFA_3_SEAT",
    "L_SHAPE_SOFA",
    "MODULAR_SOFA",
    "CHAIR",
    "OUTDOOR",
    "KIDS_BED",
    "OTTOMAN",
    "BEAN_SEAT",
    "OTHER",
  ]),
  description: z.string().optional(),
  widthCm: z.number().positive(),
  depthCm: z.number().positive(),
  heightCm: z.number().positive(),
  retailPrice: z.number().nonnegative().default(0),
  wholesalePrice: z.number().nonnegative().default(0),
  stockQty: z.number().int().nonnegative().default(0),
  parentId: z.string().optional().nullable(),
  variantName: z.string().optional().nullable(),
});

export const productPatchInput = productInput.partial();

export const costEstimateInput = z.object({
  sponges: z
    .array(
      z.object({
        block: z.object({
          widthCm: z.number().positive(),
          depthCm: z.number().positive(),
          heightCm: z.number().positive(),
          density: z.number().positive(),
          pricePerDensity: z.number().positive(),
          wastePct: z.number().min(0).max(50).optional(),
        }),
        cuts: z.array(
          z.object({
            cutWidthCm: z.number().positive(),
            cutDepthCm: z.number().positive(),
            cutHeightCm: z.number().positive(),
            cuts: z.number().int().positive(),
          }),
        ),
      }),
    )
    .default([]),
  fabrics: z
    .array(
      z.object({
        meters: z.number().positive(),
        costPerMeter: z.number().positive(),
      }),
    )
    .default([]),
  fibers: z
    .array(z.object({ grams: z.number().positive(), costPerKg: z.number().positive() }))
    .default([]),
  packaging: z
    .array(z.object({ grams: z.number().positive(), costPerKg: z.number().positive() }))
    .default([]),
  extras: z
    .array(z.object({ grams: z.number().positive(), costPerKg: z.number().positive() }))
    .default([])
    .optional(),
  manufacturing: z
    .array(z.object({ label: z.string(), amount: z.number().nonnegative() }))
    .default([]),
  retailPrice: z.number().nonnegative().optional(),
  wholesalePrice: z.number().nonnegative().optional(),
});
