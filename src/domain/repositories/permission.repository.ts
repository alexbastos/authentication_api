import type { Permission } from '../entities/permission.entity.js';

export interface IPermissionRepository {
  findAll(): Promise<Permission[]>;
  findByCode(code: string): Promise<Permission | null>;
  findByCodes(codes: string[]): Promise<Permission[]>;
  findByCategory(category: string): Promise<Permission[]>;
}
