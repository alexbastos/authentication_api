import type { CustomRole } from '../entities/permission.entity.js';

export interface ICustomRoleRepository {
  create(role: CustomRole): Promise<CustomRole>;
  findById(id: string): Promise<CustomRole | null>;
  findByNameAndOrg(name: string, organizationId: string | null): Promise<CustomRole | null>;
  list(organizationId?: string | null): Promise<CustomRole[]>;
  update(role: CustomRole): Promise<CustomRole>;
  delete(id: string): Promise<void>;
  findByUserId(userId: string, organizationId?: string | null): Promise<CustomRole[]>;
  assignToUser(userId: string, roleId: string, organizationId?: string | null): Promise<void>;
  removeFromUser(userId: string, roleId: string): Promise<void>;
  getUserPermissionCodes(userId: string, organizationId?: string | null): Promise<string[]>;
}
