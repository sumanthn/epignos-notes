export type SystemRole = "superadmin" | null;

export function isSuperAdminUser(
  user: { systemRole: SystemRole },
): boolean {
  return user.systemRole === "superadmin";
}
