import * as React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ProductCostBreakdown } from "@/lib/costing";
import { formatLE } from "@/lib/costing";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 18,
  },
  brand: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#3a2a18" },
  brandHint: { fontSize: 9, color: "#9ca3af", marginTop: 4 },
  docTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "right" },
  docMeta: { fontSize: 9, color: "#6b7280", textAlign: "right", marginTop: 6 },

  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    color: "#3a2a18",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  rowLabel: { color: "#6b7280" },
  rowValue: { fontFamily: "Helvetica-Bold" },

  table: { marginTop: 6 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f3f0e8",
    padding: 6,
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  th: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#3a2a18" },
  td: { fontSize: 9 },
  col1: { width: "55%" },
  col2: { width: "20%", textAlign: "right" },
  col3: { width: "25%", textAlign: "right" },

  totalsBox: {
    marginTop: 18,
    padding: 14,
    backgroundColor: "#f9f6f1",
    borderRadius: 6,
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#d6c4a6",
  },
  grandLabel: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  grandValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: "#3a2a18",
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
});

export interface InvoicePdfInput {
  product: {
    name: string;
    sku: string;
    widthCm: number;
    depthCm: number;
    heightCm: number;
    description?: string | null;
  };
  breakdown: ProductCostBreakdown;
  lines: {
    sponges: { name: string; description: string; cost: number }[];
    fabrics: { name: string; description: string; cost: number }[];
    bulk: { name: string; description: string; cost: number }[];
    manufacturing: { name: string; description: string; cost: number }[];
  };
}

export function InvoiceDocument({ product, breakdown, lines }: InvoicePdfInput) {
  const allLines = [
    ...lines.sponges,
    ...lines.fabrics,
    ...lines.bulk,
    ...lines.manufacturing,
  ];
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>G-Homz</Text>
            <Text style={styles.brandHint}>
              Premium compressed-sponge furniture · Cairo, EG
            </Text>
          </View>
          <View>
            <Text style={styles.docTitle}>Cost statement</Text>
            <Text style={styles.docMeta}>SKU {product.sku}</Text>
            <Text style={styles.docMeta}>{today}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Name</Text>
            <Text style={styles.rowValue}>{product.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Dimensions</Text>
            <Text style={styles.rowValue}>
              {product.widthCm} × {product.depthCm} × {product.heightCm} cm
            </Text>
          </View>
          {product.description && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Description</Text>
              <Text style={[styles.rowValue, { maxWidth: 320, textAlign: "right" }]}>
                {product.description}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill of materials</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.col1]}>Item</Text>
            <Text style={[styles.th, styles.col2]}>Detail</Text>
            <Text style={[styles.th, styles.col3]}>Cost</Text>
          </View>
          {allLines.map((l, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, styles.col1]}>{l.name}</Text>
              <Text style={[styles.td, styles.col2, { color: "#6b7280" }]}>
                {l.description}
              </Text>
              <Text style={[styles.td, styles.col3]}>{formatLE(l.cost)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          <Total label="Sponge" value={breakdown.spongeCost} />
          <Total label="Fabric" value={breakdown.fabricCost} />
          <Total label="Fiber" value={breakdown.fiberCost} />
          <Total label="Packaging" value={breakdown.packagingCost} />
          <Total label="Manufacturing" value={breakdown.manufacturingCost} />
          <View style={styles.grandTotal}>
            <Text style={styles.grandLabel}>Total unit cost</Text>
            <Text style={styles.grandValue}>
              {formatLE(breakdown.totalCost)}
            </Text>
          </View>
        </View>

        <View style={[styles.section, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          <Total label="Retail price" value={breakdown.retailPrice} />
          <Total
            label={`Retail profit (${breakdown.retailMarginPct.toFixed(1)}%)`}
            value={breakdown.retailProfit}
          />
          <Total label="Wholesale price" value={breakdown.wholesalePrice} />
          <Total
            label={`Wholesale profit (${breakdown.wholesaleMarginPct.toFixed(1)}%)`}
            value={breakdown.wholesaleProfit}
          />
        </View>

        <Text style={styles.footer} fixed>
          G-Homz · Internal cost statement · Confidential · Generated by the
          G-Homz ERP
        </Text>
      </Page>
    </Document>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.totalLine}>
      <Text style={{ color: "#6b7280" }}>{label}</Text>
      <Text>{formatLE(value)}</Text>
    </View>
  );
}

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...input} />);
}
