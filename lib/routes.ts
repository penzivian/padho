import type { ProfileRole } from "@/types/database";

export function homePathForRole(role: ProfileRole) {
  return `/${role}`;
}
