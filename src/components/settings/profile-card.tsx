"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { apiPatch } from "@/lib/api-client";

interface ProfileCardProps {
  initialName: string;
  email: string;
  role: string;
}

/**
 * Settings card that lets the signed-in user rename themselves.
 *
 * Note: NextAuth's JWT snapshots the name at sign-in time, so the new name
 * won't appear in the sidebar avatar until the user signs out and back in
 * (or `router.refresh()` re-runs the server components that already pull
 * from the DB, like the topbar greeting). We surface this in the toast.
 */
export function ProfileCard({ initialName, email, role }: ProfileCardProps) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName);
  const [submitting, setSubmitting] = React.useState(false);

  const trimmed = name.trim();
  const dirty = trimmed !== initialName;
  const tooShort = trimmed.length === 0;
  const canSubmit = dirty && !tooShort && !submitting;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await apiPatch("/api/account/profile", { name: trimmed });
      toast.success(
        "Name updated. Sign out and back in to refresh the sidebar.",
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update name",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="h-4 w-4" /> Your profile
        </CardTitle>
        <CardDescription>
          How you appear inside G-Homz. Other users keep their own profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="max-w-md space-y-4">
          <Field label="Display name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmed Hassan"
              maxLength={80}
              autoComplete="name"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" hint="Sign-in identifier — change request to ADMIN">
              <Input value={email} readOnly disabled />
            </Field>
            <Field label="Role" hint="Set by an ADMIN">
              <Input value={role} readOnly disabled />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? "Saving…" : "Save name"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
