import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { BrandLogoUploader } from "@/components/settings/brand-logo-uploader";
import { getBrandLogoUrl } from "@/lib/brand";
import { isAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [logoUrl, adminAccess] = await Promise.all([
    getBrandLogoUrl(),
    isAdmin(),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Workspace, currency and role configuration."
      />

      <Card>
        <CardHeader>
          <CardTitle>Brand identity</CardTitle>
          <CardDescription>
            Upload your logo to replace the default G-Homz mark in the sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandLogoUploader initialUrl={logoUrl} editable={adminAccess} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Brand identity & defaults</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row label="Brand" value="G-Homz" />
            <Row label="Currency" value="EGP — Egyptian Pound" />
            <Row label="Locale" value="English (en-EG)" />
            <Separator />
            <Row label="Default sponge waste" value="5%" />
            <Row label="Default fiber cost / kg" value="EGP 250" />
            <Row label="Default vaseline / kg" value="EGP 50" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles & access</CardTitle>
            <CardDescription>
              Authentication scaffolded — wire up an auth provider to enforce
              these roles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RoleRow role="Admin" desc="Full access — settings, pricing, users" />
            <RoleRow role="Manager" desc="Edit BOMs, log production, view costs" />
            <RoleRow role="Production" desc="Log runs, consume inventory" />
            <RoleRow role="Viewer" desc="Read-only dashboards" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Localization</CardTitle>
          <CardDescription>
            Arabic support — toggleable per user once next-intl is added.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="secondary">English (default)</Badge>
          <Badge variant="outline">العربية — coming soon</Badge>
          <Badge variant="outline">QR / barcode labels — coming soon</Badge>
          <Badge variant="outline">PDF & Excel exports — coming soon</Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function RoleRow({ role, desc }: { role: string; desc: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
      <div>
        <div className="text-sm font-medium">{role}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Badge variant="secondary">enabled</Badge>
    </div>
  );
}
