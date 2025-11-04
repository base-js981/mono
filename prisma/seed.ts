import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Default Tenant
  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      slug: 'default',
      name: 'Default Tenant',
      isActive: true,
      settings: {},
    },
  });

  console.log('✅ Default tenant created');

  // Create Permissions
  const permissions = [
    // User permissions
    { name: 'user.create', description: 'Create users', resource: 'user', action: 'create' },
    { name: 'user.read', description: 'Read users', resource: 'user', action: 'read' },
    { name: 'user.update', description: 'Update users', resource: 'user', action: 'update' },
    { name: 'user.delete', description: 'Delete users', resource: 'user', action: 'delete' },
    
    // File permissions
    { name: 'file.upload', description: 'Upload files', resource: 'file', action: 'upload' },
    { name: 'file.read', description: 'Read file metadata', resource: 'file', action: 'read' },
    { name: 'file.download', description: 'Download files', resource: 'file', action: 'download' },
    { name: 'file.delete', description: 'Delete files', resource: 'file', action: 'delete' },
    
    // Category permissions
    { name: 'category.create', description: 'Create categories', resource: 'category', action: 'create' },
    { name: 'category.read', description: 'Read categories', resource: 'category', action: 'read' },
    { name: 'category.update', description: 'Update categories', resource: 'category', action: 'update' },
    { name: 'category.delete', description: 'Delete categories', resource: 'category', action: 'delete' },
    
    // Admin permissions
    { name: 'admin.access', description: 'Access admin panel', resource: 'admin', action: 'access' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  console.log('✅ Permissions created');

  // Create Roles
  const roles = [
    {
      name: 'ADMIN',
      description: 'Administrator with full access',
      permissions: [
        'user.create',
        'user.read',
        'user.update',
        'user.delete',
        'admin.access',
        'file.upload',
        'file.read',
        'file.download',
        'file.delete',
        'category.create',
        'category.read',
        'category.update',
        'category.delete',
      ],
    },
    {
      name: 'TENANT_ADMIN',
      description: 'Tenant-scoped admin who manages users within their tenant',
      permissions: [
        'user.create',
        'user.read',
        'user.update',
        'user.delete',
        'file.read',
        'file.download',
        'category.read',
      ],
    },
    {
      name: 'USER',
      description: 'Regular user with limited access',
      permissions: [
        'user.read',
        'file.upload',
        'file.read',
        'file.download',
        'file.delete',
        'category.read',
      ],
    },
  ];

  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      update: {},
      create: {
        name: roleData.name,
        description: roleData.description,
      },
    });

    // Attach permissions to role
    for (const permName of roleData.permissions) {
      const permission = await prisma.permission.findUnique({
        where: { name: permName },
      });

      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  console.log('✅ Roles created');

  // Create ABAC Policies
  const policies = [
    {
      name: 'Admin Full Access',
      description: 'Admin can access everything',
      effect: 'allow',
      rules: [
        {
          attribute: 'subject.role',
          operator: 'in',
          value: ['ADMIN'],
          order: 0,
        },
      ],
    },
    {
      name: 'Self Update Profile',
      description: 'User can update own profile',
      effect: 'allow',
      rules: [
        {
          attribute: 'subject.id',
          operator: 'equals',
          value: { $ref: 'resource.id' },
          order: 0,
        },
        {
          attribute: 'action',
          operator: 'in',
          value: ['PUT', 'PATCH'],
          order: 1,
        },
      ],
    },
    {
      name: 'Owner Edit Access',
      description: 'Owner can edit/delete own resources',
      effect: 'allow',
      rules: [
        {
          attribute: 'subject.id',
          operator: 'equals',
          value: { $ref: 'resource.ownerId' },
          order: 0,
        },
        {
          attribute: 'action',
          operator: 'in',
          value: ['UPDATE', 'DELETE'],
          order: 1,
        },
      ],
    },
    {
      name: 'Same Department Access',
      description: 'Users can access resources in same department',
      effect: 'allow',
      rules: [
        {
          attribute: 'subject.department',
          operator: 'equals',
          value: { $ref: 'resource.department' },
          order: 0,
        },
      ],
    },
    {
      name: 'Tenant Admin Manage Users',
      description: 'TENANT_ADMIN can CRUD users in the same tenant',
      effect: 'allow',
      rules: [
        {
          attribute: 'subject.roles',
          operator: 'in',
          value: ['TENANT_ADMIN'],
          order: 0,
        },
        {
          attribute: 'resource.type',
          operator: 'equals',
          value: 'user',
          order: 1,
        },
        {
          attribute: 'action',
          operator: 'in',
          value: ['create', 'read', 'update', 'delete'],
          order: 2,
        },
        {
          attribute: 'subject.tenantId',
          operator: 'equals',
          value: { $ref: 'resource.tenantId' },
          order: 3,
        },
      ],
    },
    {
      name: 'Deny Cross-Tenant User Management',
      description: 'Disallow managing users across tenants',
      effect: 'deny',
      rules: [
        {
          attribute: 'resource.type',
          operator: 'equals',
          value: 'user',
          order: 0,
        },
        {
          attribute: 'subject.tenantId',
          operator: 'not_equals',
          value: { $ref: 'resource.tenantId' },
          order: 1,
        },
        {
          attribute: 'action',
          operator: 'in',
          value: ['create', 'read', 'update', 'delete'],
          order: 2,
        },
      ],
    },
  ];

  for (const policyData of policies) {
    const existingPolicy = await prisma.policy.findFirst({
      where: {
        name: policyData.name,
        tenantId: null,
      },
    });

    if (existingPolicy) {
      await prisma.policy.update({
        where: { id: existingPolicy.id },
        data: {
          description: policyData.description,
          effect: policyData.effect,
          enabled: true,
        },
      });
      console.log(`✅ Policy updated: ${policyData.name}`);
    } else {
      const policy = await prisma.policy.create({
        data: {
          name: policyData.name,
          description: policyData.description,
          effect: policyData.effect,
          enabled: true,
          tenantId: null,
          rules: {
            create: policyData.rules,
          },
        },
      });
      console.log(`✅ Policy created: ${policy.name}`);
    }
  }

  console.log('🎉 Seeding completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
