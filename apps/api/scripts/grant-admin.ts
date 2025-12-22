import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function grantAdminToUser() {
  try {
    // Find user by username "n_a_"
    const user = await prisma.user.findFirst({
      where: {
        username: 'n_a_'
      }
    });

    if (!user) {
      console.error('❌ User "n_a_" not found');
      return;
    }

    console.log(`Found user: ${user.username} (ID: ${user.id}, Current role: ${user.role})`);

    if (user.role === 'ADMIN') {
      console.log('✅ User already has ADMIN role');
      return;
    }

    // Update user role to ADMIN
    const updatedUser = await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        role: 'ADMIN'
      }
    });

    console.log(`✅ Successfully granted ADMIN role to user "${updatedUser.username}"`);
    console.log(`   New role: ${updatedUser.role}`);
  } catch (error) {
    console.error('❌ Error granting admin role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

grantAdminToUser();