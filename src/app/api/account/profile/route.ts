import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { HttpError, withApi } from "@/lib/rbac";

const input = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(80, "Name is too long (max 80 characters)"),
});

/**
 * PATCH /api/account/profile — update the signed-in user's display name.
 *
 * Note: the JWT session stores the name as a snapshot at sign-in time, so
 * the sidebar / topbar avatar tooltip won't reflect the new name until the
 * user signs out and back in. We surface that hint in the client toast.
 */
export const PATCH = withApi(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401);

  const parsed = input.safeParse(await req.json());
  if (!parsed.success) {
    throw new HttpError(422, JSON.stringify(parsed.error.issues));
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name.trim() },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(updated);
});

/**
 * GET — handy for the settings page to read the current name straight from
 * the DB rather than relying on a possibly-stale JWT.
 */
export const GET = withApi(async () => {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw new HttpError(404);
  return NextResponse.json(user);
});
