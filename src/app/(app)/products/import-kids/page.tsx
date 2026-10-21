import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Shopify kids-bed product import — disabled.
 *
 * Products are now managed exclusively inside the ERP catalogue; nothing
 * reads product definitions from Shopify any more. Shopify ORDERS still
 * flow in as usual via /shopify-orders — only the one-time product import
 * tool is gated off here. To re-enable, restore the KidsImport default
 * export in this file.
 */
export default function DisabledKidsImportPage() {
  notFound();
}
