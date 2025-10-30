import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Permissions
  const permissions = [
    // User permissions
    { name: 'user.create', description: 'Create users', resource: 'user', action: 'create' },
    { name: 'user.read', description: 'Read users', resource: 'user', action: 'read' },
    { name: 'user.update', description: 'Update users', resource: 'user', action: 'update' },
    { name: 'user.delete', description: 'Delete users', resource: 'user', action: 'delete' },
    
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
      permissions: ['user.create', 'user.read', 'user.update', 'user.delete', 'admin.access'],
    },
    {
      name: 'USER',
      description: 'Regular user with limited access',
      permissions: ['user.read'],
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
  ];

  for (const policyData of policies) {
    const policy = await prisma.policy.upsert({
      where: { name: policyData.name },
      update: {
        description: policyData.description,
        effect: policyData.effect,
        enabled: true,
      },
      create: {
        name: policyData.name,
        description: policyData.description,
        effect: policyData.effect,
        enabled: true,
        rules: {
          create: policyData.rules,
        },
      },
    });

    console.log(`✅ Policy created: ${policy.name}`);
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
