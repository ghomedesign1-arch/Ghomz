import type { UserRole } from "@prisma/client";
import { auth } from "@/auth";

export const WRITE_ROLES: UserRole[] = ["ADMIN", "MANAGER", "PRODUCTION"];
export const ADMIN_ROLES: UserRole[] = ["ADMIN", "MANAGER"];

/**
 * Returns the active session role, or null when unauthenticated.
 * Useful in server components to conditionally render write actions.
 */
export async function currentRole(): Promise<UserRole | null> {
  const session = await auth();
  return ((session?.user as { role?: UserRole })?.role ?? null) as UserRole | null;
}

export async function canWrite(): Promise<boolean> {
  const role = await currentRole();
  return role !== null && WRITE_ROLES.includes(role);
}

export async function isAdmin(): Promise<boolean> {
  const role = await currentRole();
  return role !== null && ADMIN_ROLES.includes(role);
}

/**
 * Thrown by guard helpers; the API route catcher turns these into JSON
 * responses with the right status code.
 */
export class HttpError extends Error {
  constructor(public status: number, message?: string) {
    super(message ?? defaultMessage(status));
  }
}

function defaultMessage(status: number) {
  switch (status) {
    case 401: return "Authentication required";
    case 403: return "You do not have permission to perform this action";
    case 422: return "Invalid payload";
    default: return "Request failed";
  }
}

/**
 * Enforce that the caller is signed in and has one of `roles`.
 * Throws HttpError; wrap your route body with `withApi` to handle that.
 */
export async function requireRole(...roles: UserRole[]) {
  const session = await auth();
  if (!session) throw new HttpError(401);
  const role = (session.user as { role?: UserRole })?.role;
  if (!role || !roles.includes(role)) throw new HttpError(403);
  return { session, role };
}

/**
 * Wraps an async API handler and translates HttpError into a JSON response.
 * Lets route bodies use `await requireRole(...)` without bespoke try/catch.
 */
export function withApi<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      // Friendly translation for Prisma's known errors so the UI shows a
      // useful message instead of a generic "Internal error".
      const prismaErr = err as
        | { code?: string; meta?: { target?: string[]; modelName?: string } }
        | undefined;
      if (prismaErr?.code === "P2002") {
        const fields = prismaErr.meta?.target?.join(", ") ?? "value";
        return Response.json(
          {
            error: `That ${fields} is already in use. Pick a different one.`,
          },
          { status: 409 },
        );
      }
      if (prismaErr?.code === "P2025") {
        return Response.json(
          { error: "Record not found." },
          { status: 404 },
        );
      }
      if (prismaErr?.code === "P2003") {
        return Response.json(
          {
            error:
              "This record is referenced by another item — remove those references first.",
          },
          { status: 409 },
        );
      }
      console.error(err);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}
