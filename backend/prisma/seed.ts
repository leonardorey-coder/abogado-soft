// ============================================================================
// Prisma Seed — Datos iniciales para desarrollo
// Ejecutar con: npm run prisma:seed (desde backend/)
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Usuario admin (abogado) ────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@abogadosoft.mx' },
    update: {},
    create: {
      email: 'admin@abogadosoft.mx',
      name: 'Lic. Carlos Mendoza',
      role: 'admin',
      officeName: 'Despacho Mendoza & Asociados',
      department: 'Derecho Civil',
      position: 'Socio Director',
      isActive: true,
    },
  });

  // ─── Usuario asistente ──────────────────────────────────────────────────
  const assistant = await prisma.user.upsert({
    where: { email: 'asistente@abogadosoft.mx' },
    update: {},
    create: {
      email: 'asistente@abogadosoft.mx',
      name: 'María López',
      role: 'asistente',
      officeName: 'Despacho Mendoza & Asociados',
      department: 'Derecho Civil',
      position: 'Auxiliar Jurídico',
      isActive: true,
    },
  });

  // ─── Settings para ambos usuarios ────────────────────────────────────────
  for (const user of [admin, assistant]) {
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
  }

  // ─── Grupo de trabajo ──────────────────────────────────────────────────
  const group = await prisma.group.create({
    data: {
      name: 'Equipo Derecho Civil',
      description: 'Grupo de trabajo para casos de derecho civil',
      ownerId: admin.id,
      inviteCode: 'CIVIL2024AB',
      members: {
        create: [
          { userId: admin.id, role: 'admin' },
          { userId: assistant.id, role: 'editor' },
        ],
      },
    },
  });

  // ─── Expediente de ejemplo ─────────────────────────────────────────────
  const case1 = await prisma.case.create({
    data: {
      caseNumber: 'EXP-2024-001',
      title: 'Demanda Civil — Pérez vs. García',
      client: 'Juan Pérez',
      court: 'Juzgado 3° de lo Civil',
      caseType: 'Civil / Contractual',
      status: 'en_proceso',
      description: 'Demanda por incumplimiento de contrato de arrendamiento.',
      startDate: new Date('2024-03-15'),
      responsibleId: admin.id,
    },
  });

  // ─── Documentos de ejemplo ─────────────────────────────────────────────
  const doc1 = await prisma.document.create({
    data: {
      name: 'Contrato de Arrendamiento - Pérez.docx',
      type: 'docx',
      size: BigInt(245760),
      ownerId: admin.id,
      groupId: group.id,
      caseId: case1.id,
      fileStatus: 'ACTIVO',
      description: 'Contrato original de arrendamiento objeto de la demanda.',
      tags: ['contrato', 'arrendamiento', 'pérez'],
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  });

  const doc2 = await prisma.document.create({
    data: {
      name: 'Dictamen Pericial.pdf',
      type: 'pdf',
      size: BigInt(1048576),
      ownerId: admin.id,
      fileStatus: 'PENDIENTE',
      collaborationStatus: 'PENDIENTE_REVISION',
      description: 'Dictamen pericial sobre daños al inmueble.',
      tags: ['dictamen', 'pericial'],
      mimeType: 'application/pdf',
    },
  });

  const doc3 = await prisma.document.create({
    data: {
      name: 'Inventario de Pruebas.xlsx',
      type: 'xlsx',
      size: BigInt(51200),
      ownerId: admin.id,
      caseId: case1.id,
      fileStatus: 'ACTIVO',
      tags: ['inventario', 'pruebas'],
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });

  // ─── Asignar documento ─────────────────────────────────────────────────
  await prisma.documentAssignment.create({
    data: {
      documentId: doc2.id,
      assignedTo: assistant.id,
      assignedBy: admin.id,
      status: 'pendiente',
      notes: 'Revisar dictamen y verificar datos del perito.',
      dueDate: new Date('2024-04-15'),
    },
  });

  // ─── Permisos de documento ─────────────────────────────────────────────
  await prisma.documentPermission.create({
    data: {
      documentId: doc1.id,
      userId: assistant.id,
      permissionLevel: 'write',
      grantedBy: admin.id,
    },
  });

  // ─── Convenio de ejemplo ───────────────────────────────────────────────
  const convenio = await prisma.convenio.create({
    data: {
      numero: 'CONV-2024-001',
      institucion: 'Universidad Autónoma de Nuevo León',
      departamento: 'Facultad de Derecho',
      descripcion: 'Convenio de prácticas profesionales para estudiantes de derecho.',
      fechaInicio: new Date('2024-01-15'),
      fechaFin: new Date('2024-12-31'),
      responsableId: admin.id,
      estado: 'activo',
    },
  });

  // Vincular documento al convenio
  await prisma.convenioDocument.create({
    data: {
      convenioId: convenio.id,
      documentId: doc1.id,
      addedBy: admin.id,
    },
  });

  // ─── Actividad de ejemplo ──────────────────────────────────────────────
  await prisma.activityLog.createMany({
    data: [
      {
        userId: admin.id,
        activity: 'USER_REGISTERED',
        entityType: 'user',
        entityId: admin.id,
        entityName: admin.name,
        description: 'Usuario admin registrado.',
      },
      {
        userId: admin.id,
        activity: 'DOCUMENT_CREATED',
        entityType: 'document',
        entityId: doc1.id,
        entityName: doc1.name,
        description: `Documento creado: ${doc1.name}`,
      },
      {
        userId: admin.id,
        activity: 'DOCUMENT_ASSIGNED',
        entityType: 'document',
        entityId: doc2.id,
        entityName: doc2.name,
        description: `Documento asignado a ${assistant.name}`,
      },
    ],
  });

  // ─── Comentario de ejemplo ─────────────────────────────────────────────
  await prisma.documentComment.create({
    data: {
      documentId: doc1.id,
      userId: admin.id,
      content: 'Revisar la cláusula 5 sobre pagos atrasados.',
      pageNumber: 3,
    },
  });

  console.log('✅ Seed completado.');
  console.log(`   - 2 usuarios (admin + asistente)`);
  console.log(`   - 1 grupo de trabajo`);
  console.log(`   - 1 expediente`);
  console.log(`   - 3 documentos`);
  console.log(`   - 1 convenio`);
  console.log(`   - 1 asignación, 1 permiso, 3 logs, 1 comentario`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
