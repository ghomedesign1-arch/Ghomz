import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { HttpError, withApi } from "@/lib/rbac";

const input = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(200),
});

/**
 * POST /api/account/password — let the signed-in user change their own
 * password. Verifies the current password, then writes a fresh bcrypt hash.
 * Never reveals whether the user / email exists — keeps the same 401 for any
 * unauthenticated case.
 */
export const POST = withApi(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401);

  const parsed = input.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  });
  if (!user || !user.passwordHash) {
    // Either the session is stale or the account has no password set (e.g.
    // OAuth-only). Either way, treat as 401 — no information leak.
    throw new HttpError(401, "Could not verify current password");
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new HttpError(401, "Current password is incorrect");

  // 12 rounds: same cost factor most NextAuth + bcryptjs templates use.
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
});
