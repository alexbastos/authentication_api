// ─── Enterprise Business Rules ────────────────────────────────────────────
// Pure domain entities — no external dependencies

export interface PermissionProps {
  id: string;
  code: string;
  description: string | null;
  category: string;
}

export class Permission {
  readonly id: string;
  readonly code: string;
  readonly description: string | null;
  readonly category: string;

  constructor(props: PermissionProps) {
    this.id = props.id;
    this.code = props.code;
    this.description = props.description;
    this.category = props.category;
  }

  toJSON(): PermissionProps {
    return {
      id: this.id,
      code: this.code,
      description: this.description,
      category: this.category,
    };
  }
}

// ─── Custom Role ──────────────────────────────────────────────────────────

export interface CustomRoleProps {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  isSystem: boolean;
  createdAt: Date;
  permissions: Permission[];
}

export class CustomRole {
  readonly id: string;
  private _name: string;
  private _description: string | null;
  readonly organizationId: string | null;
  readonly isSystem: boolean;
  readonly createdAt: Date;
  private _permissions: Permission[];

  constructor(props: CustomRoleProps) {
    this.id = props.id;
    this._name = props.name;
    this._description = props.description;
    this.organizationId = props.organizationId;
    this.isSystem = props.isSystem;
    this.createdAt = props.createdAt;
    this._permissions = props.permissions;
  }

  get name(): string { return this._name; }
  get description(): string | null { return this._description; }
  get permissions(): ReadonlyArray<Permission> { return this._permissions; }

  get permissionCodes(): string[] {
    return this._permissions.map((p) => p.code);
  }

  hasPermission(code: string): boolean {
    return this._permissions.some((p) => p.code === code);
  }

  update(data: { name?: string; description?: string | null }): void {
    if (this.isSystem) {
      throw new Error('Cannot modify system roles');
    }
    if (data.name !== undefined) this._name = data.name;
    if (data.description !== undefined) this._description = data.description;
  }

  setPermissions(permissions: Permission[]): void {
    if (this.isSystem) {
      throw new Error('Cannot modify system role permissions');
    }
    this._permissions = permissions;
  }

  toJSON(): CustomRoleProps {
    return {
      id: this.id,
      name: this._name,
      description: this._description,
      organizationId: this.organizationId,
      isSystem: this.isSystem,
      createdAt: this.createdAt,
      permissions: this._permissions,
    };
  }
}
