export const ROLES = ["owner", "admin", "developer", "editor", "user"] as const;

export type Role = (typeof ROLES)[number];

const roleSet = {
  owner: new Set<Role>(["owner", "developer"]),
  admin: new Set<Role>(["owner", "admin", "developer"]),
  publisher: new Set<Role>(["owner", "admin", "developer", "editor"]),
} as const;

const normalizeRole = (role?: string | null) => role?.trim().toLowerCase() as Role | undefined;

const hasRole = (role: string | null | undefined, allowed: Set<Role>) => {
  const normalized = normalizeRole(role);
  return !!normalized && allowed.has(normalized);
};

export const isOwnerRole = (role?: string | null) => hasRole(role, roleSet.owner);
export const isAdminRole = (role?: string | null) => hasRole(role, roleSet.admin);
export const isPublisherRole = (role?: string | null) => hasRole(role, roleSet.publisher);
