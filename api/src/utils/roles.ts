export const ROLES = ["owner", "admin", "developer", "editor", "user"] as const;

export type Role = (typeof ROLES)[number];

const roleSet = {
  owner: new Set<Role>(["owner", "developer"]),
  admin: new Set<Role>(["owner", "admin", "developer"]), // admin não inclui editor
  publisher: new Set<Role>(["owner", "admin", "developer", "editor"]), // editor pode publicar
} as const;

const hasRole = (role: string | null | undefined, allowed: Set<Role>) =>
  !!role && allowed.has(role as Role);

export const isOwnerRole = (role?: string | null) => hasRole(role, roleSet.owner);
export const isAdminRole = (role?: string | null) => hasRole(role, roleSet.admin);
export const isPublisherRole = (role?: string | null) => hasRole(role, roleSet.publisher);
