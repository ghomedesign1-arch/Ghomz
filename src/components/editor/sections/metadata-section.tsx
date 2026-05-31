"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGrid } from "@/components/forms/field";
import type { EditableProduct } from "../types";

const CATEGORIES = [
  { value: "SOFA_2_SEAT",  label: "2-Seat Sofa" },
  { value: "SOFA_3_SEAT",  label: "3-Seat Sofa" },
  { value: "L_SHAPE_SOFA", label: "L-Shape Sofa" },
  { value: "MODULAR_SOFA", label: "Modular Sofa" },
  { value: "CHAIR",        label: "Chair" },
  { value: "OUTDOOR",      label: "Outdoor" },
  { value: "KIDS_BED",     label: "Kids Bed" },
  { value: "OTTOMAN",      label: "Ottoman" },
  { value: "BEAN_SEAT",    label: "Bean Seat" },
  { value: "OTHER",        label: "Other" },
];

interface Props {
  product: EditableProduct;
  onChange: React.Dispatch<React.SetStateAction<EditableProduct>>;
}

export function MetadataSection({ product, onChange }: Props) {
  function set<K extends keyof EditableProduct>(
    key: K,
    value: EditableProduct[K],
  ) {
    onChange((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product metadata</CardTitle>
        <CardDescription>
          Identity, dimensions and pricing for this SKU
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGrid cols={product.parentId ? 3 : 2}>
          <Field label="SKU">
            <Input
              value={product.sku}
              onChange={(e) => set("sku", e.target.value)}
              className="uppercase tracking-wider"
            />
          </Field>
          <Field label="Name" hint={product.parentId ? "Family / product name" : undefined}>
            <Input
              value={product.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          {product.parentId && (
            <Field label="Variant name" hint='e.g. "Classic", "Premium"'>
              <Input
                value={product.variantName ?? ""}
                onChange={(e) => set("variantName", e.target.value || null)}
                placeholder="Classic"
              />
            </Field>
          )}
        </FieldGrid>

        <Field label="Category">
          <Select
            value={product.category}
            onValueChange={(v) => set("category", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Description">
          <Input
            value={product.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <FieldGrid cols={3}>
          <Field label="Width (cm)">
            <Input
              type="number"
              min={1}
              step="0.1"
              value={product.widthCm}
              onChange={(e) => set("widthCm", Number(e.target.value))}
            />
          </Field>
          <Field label="Depth (cm)">
            <Input
              type="number"
              min={1}
              step="0.1"
              value={product.depthCm}
              onChange={(e) => set("depthCm", Number(e.target.value))}
            />
          </Field>
          <Field label="Height (cm)">
            <Input
              type="number"
              min={1}
              step="0.1"
              value={product.heightCm}
              onChange={(e) => set("heightCm", Number(e.target.value))}
            />
          </Field>
        </FieldGrid>

        <FieldGrid cols={2}>
          <Field label="Retail price (LE)">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={product.retailPrice}
              onChange={(e) => set("retailPrice", Number(e.target.value))}
            />
          </Field>
          <Field label="Wholesale price (LE)">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={product.wholesalePrice}
              onChange={(e) => set("wholesalePrice", Number(e.target.value))}
            />
          </Field>
        </FieldGrid>
      </CardContent>
    </Card>
  );
}
