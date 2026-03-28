import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient, OrganizationRole, TaskStatus, TaskPriority, ProjectStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaNeon } from '@prisma/adapter-neon';


const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.comment.deleteMany();
  await prisma.taskAssignee.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('Password123!', 10);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
  // ── Users ────────────────────────────────────────
  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      password: hashedPassword,
      firstName: 'Alice',
      lastName: 'Johnson',
      isEmailVerified: true,
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      password: hashedPassword,
      firstName: 'Bob',
      lastName: 'Smith',
      isEmailVerified: true,
    },
  });

  const carol = await prisma.user.create({
    data: {
      email: 'carol@example.com',
      password: hashedPassword,
      firstName: 'Carol',
      lastName: 'Williams',
      isEmailVerified: true,
    },
  });

  console.log('✅ Users created');

  // ── Organization ─────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      description: 'Building great products',
    },
  });

  // ── Organization Members ──────────────────────────
  await prisma.organizationMember.createMany({
    data: [
      { userId: alice.id, organizationId: org.id, role: OrganizationRole.OWNER },
      { userId: bob.id, organizationId: org.id, role: OrganizationRole.ADMIN },
      { userId: carol.id, organizationId: org.id, role: OrganizationRole.MEMBER },
    ],
  });

  console.log('✅ Organization + Members created');

  // ── Project ───────────────────────────────────────
  const project = await prisma.project.create({
    data: {
      name: 'Website Redesign',
      description: 'Redesign the company website',
      status: ProjectStatus.ACTIVE,
      organizationId: org.id,
      createdById: alice.id,
    },
  });

  // ── Tags ──────────────────────────────────────────
  const featureTag = await prisma.tag.create({
    data: { name: 'feature', color: '#6366f1' },
  });
  const bugTag = await prisma.tag.create({
    data: { name: 'bug', color: '#ef4444' },
  });

  // ── Tasks ─────────────────────────────────────────
  const task1 = await prisma.task.create({
    data: {
      title: 'Design new homepage mockup',
      description: 'Create Figma designs for the new homepage',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      projectId: project.id,
      createdById: alice.id,
      assignees: {
        create: [{ userId: bob.id }],
      },
      tags: {
        create: [{ tagId: featureTag.id }],
      },
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: 'Fix mobile navigation bug',
      description: 'The hamburger menu does not close on mobile',
      status: TaskStatus.TODO,
      priority: TaskPriority.URGENT,
      projectId: project.id,
      createdById: alice.id,
      assignees: {
        create: [{ userId: carol.id }],
      },
      tags: {
        create: [{ tagId: bugTag.id }],
      },
    },
  });

  // ── Comments ──────────────────────────────────────
  await prisma.comment.createMany({
    data: [
      {
        content: 'Working on this now, should be done by EOD.',
        taskId: task1.id,
        authorId: bob.id,
      },
      {
        content: 'Let me know if you need any feedback on the designs.',
        taskId: task1.id,
        authorId: alice.id,
      },
      {
        content: 'Reproduced on iOS Safari and Chrome Android.',
        taskId: task2.id,
        authorId: carol.id,
      },
    ],
  });

  console.log('✅ Projects, Tasks, Comments seeded');
  console.log('\n🎉 Database seeded successfully!');
  console.log('\nTest credentials:');
  console.log('  alice@example.com / Password123! (OWNER)');
  console.log('  bob@example.com   / Password123! (ADMIN)');
  console.log('  carol@example.com / Password123! (MEMBER)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });