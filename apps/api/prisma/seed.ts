/**
 * prisma/seed.ts
 *
 * Seed inicial: workspace demo + 3 usuarios (owner, admin, agent, viewer)
 *
 * Ejecutar:
 *   npx ts-node prisma/seed.ts
 *   # o con el script en package.json:
 *   npm run db:seed
 *
 * Nota: Agrega `password_hash String?` al modelo User en schema.prisma
 * antes de correr este seed.
 */

import { PrismaClient, WorkspaceUserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function hash(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // ─── Workspace ─────────────────────────────────────────────────────────────

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      country_code: 'CR',
      timezone: 'America/Costa_Rica',
      locale: 'es',
      status: 'ACTIVE',
      plan: 'STARTER',
    },
  });
  console.log(`✅ Workspace: ${workspace.name} (${workspace.slug})`);

  // ─── Usuarios ──────────────────────────────────────────────────────────────

  const usersData = [
    {
      email: 'owner@demo.com',
      name: 'Ana Owner',
      password: 'Owner1234!',
      role: WorkspaceUserRole.OWNER,
      is_owner: true,
    },
    {
      email: 'admin@demo.com',
      name: 'Carlos Admin',
      password: 'Admin1234!',
      role: WorkspaceUserRole.ADMIN,
      is_owner: false,
    },
    {
      email: 'agent@demo.com',
      name: 'Luis Agent',
      password: 'Agent1234!',
      role: WorkspaceUserRole.AGENT,
      is_owner: false,
    },
    {
      email: 'viewer@demo.com',
      name: 'María Viewer',
      password: 'Viewer1234!',
      role: WorkspaceUserRole.VIEWER,
      is_owner: false,
    },
  ];

  for (const u of usersData) {
    const password_hash = await hash(u.password);

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: {
        email: u.email,
        name: u.name,
        status: UserStatus.ACTIVE,
        // Si password_hash no está en el schema aún, agrégalo primero:
        // password_hash,
        ...(password_hash ? { password_hash } as any : {}),
      },
    });

    await prisma.workspaceUser.upsert({
      where: {
        workspace_id_user_id: {
          workspace_id: workspace.id,
          user_id: user.id,
        },
      },
      update: { role: u.role, is_owner: u.is_owner },
      create: {
        workspace_id: workspace.id,
        user_id: user.id,
        role: u.role,
        is_owner: u.is_owner,
      },
    });

    console.log(
      `  👤 ${u.name.padEnd(18)} | ${u.role.padEnd(7)} | ${u.email}`,
    );
  }

  // ─── Channel demo ─────────────────────────────────────────────────────────

  const channel = await prisma.channel.upsert({
    where: { id: 'seed-channel-email' },
    update: {},
    create: {
      id: 'seed-channel-email',
      workspace_id: workspace.id,
      type: 'EMAIL',
      name: 'Correo Principal',
      status: 'ACTIVE',
      config_json: JSON.stringify({ address: 'soporte@demo.com' }),
    },
  });
  console.log(`\n✅ Channel: ${channel.name} (${channel.type})`);

  // ─── Contacto demo ────────────────────────────────────────────────────────

  const contact = await prisma.contact.upsert({
    where: { id: 'seed-contact-1' },
    update: {},
    create: {
      id: 'seed-contact-1',
      workspace_id: workspace.id,
      type: 'CUSTOMER',
      full_name: 'Cliente Demo S.A.',
      company_name: 'Demo Corp',
      email: 'cliente@demo.com',
      phone: '+50688887777',
      tags_json: JSON.stringify(['vip', 'demo']),
    },
  });
  console.log(`✅ Contacto: ${contact.full_name}`);

  // ─── Agent Template ──────────────────────────────────────────────────────
  const agentTemplate = await prisma.agentTemplate.upsert({
    where: { slug: 'soporte-pyme' },
    update: {},
    create: {
      slug: 'soporte-pyme',
      name: 'Soporte PyME',
      description:
        'Agente de atención al cliente para pequeñas empresas. Responde preguntas frecuentes, gestiona pedidos y escala a un humano cuando es necesario.',
      provider: 'FLOWISE',
      channel_scope: 'ALL',
      config_json: {
        temperature: 0.3,
      },
      is_published: true,
      sort_order: 1,
    },
  });
  console.log(`✅ AgentTemplate: ${agentTemplate.name} (${agentTemplate.slug})`);

  console.log('\n🎉 Seed completado exitosamente.\n');
  console.log('Workspace slug: demo-workspace');
  console.log('Note: Default demo passwords are NOT logged for security.');
  console.log('Contact the database admin to reset user passwords.');
}

main()
  .catch((e) => {
    console.error('❌ Seed falló:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
