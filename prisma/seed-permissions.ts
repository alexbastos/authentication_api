import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PERMISSIONS = [
  // User Management
  { code: 'user:read', category: 'User', description: 'View user profiles' },
  { code: 'user:create', category: 'User', description: 'Create new users' },
  { code: 'user:update', category: 'User', description: 'Update user profiles' },
  { code: 'user:delete', category: 'User', description: 'Delete users' },
  
  // Organization Management
  { code: 'org:read', category: 'Organization', description: 'View organization details' },
  { code: 'org:update', category: 'Organization', description: 'Update organization details' },
  { code: 'org:delete', category: 'Organization', description: 'Delete organization' },
  
  // Member Management
  { code: 'member:read', category: 'Member', description: 'View organization members' },
  { code: 'member:invite', category: 'Member', description: 'Invite new members' },
  { code: 'member:remove', category: 'Member', description: 'Remove members' },
  { code: 'member:role', category: 'Member', description: 'Change member roles' },
  
  // Role & Permission Management
  { code: 'role:read', category: 'RBAC', description: 'View custom roles' },
  { code: 'role:create', category: 'RBAC', description: 'Create custom roles' },
  { code: 'role:update', category: 'RBAC', description: 'Update custom roles' },
  { code: 'role:delete', category: 'RBAC', description: 'Delete custom roles' },
  { code: 'role:assign', category: 'RBAC', description: 'Assign roles to users' },
  
  // Webhooks
  { code: 'webhook:read', category: 'Webhook', description: 'View webhook endpoints' },
  { code: 'webhook:create', category: 'Webhook', description: 'Create webhook endpoints' },
  { code: 'webhook:update', category: 'Webhook', description: 'Update webhook endpoints' },
  { code: 'webhook:delete', category: 'Webhook', description: 'Delete webhook endpoints' },
  
  // OAuth Clients
  { code: 'client:read', category: 'OAuth', description: 'View OAuth clients' },
  { code: 'client:create', category: 'OAuth', description: 'Register OAuth clients' },
  { code: 'client:update', category: 'OAuth', description: 'Update OAuth clients' },
  { code: 'client:delete', category: 'OAuth', description: 'Delete OAuth clients' },
];

async function main() {
  console.log('Seeding granular permissions...');

  for (const p of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description, category: p.category },
      create: { code: p.code, description: p.description, category: p.category },
    });
  }

  // Ensure system roles exist
  const adminRole = await prisma.customRole.upsert({
    where: { name_organizationId: { name: 'SYSTEM_ADMIN', organizationId: '' } },
    update: {},
    create: {
      name: 'SYSTEM_ADMIN',
      description: 'System Administrator with full access',
      isSystem: true,
    },
  });

  const allPermissions = await prisma.permission.findMany();
  
  // Assign all permissions to SYSTEM_ADMIN
  for (const p of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id },
    });
  }

  console.log('Permissions seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
