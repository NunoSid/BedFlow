import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.utils';

const prisma = new PrismaClient();

async function main() {
  const password = hashPassword('BedFlow123');
  
  // Users
  await prisma.user.upsert({
    where: { username: 'admin1' },
    update: { passwordHash: password },
    create: { 
        id: 'admin-fallback-id', // ID FIXO PARA MODO DE EMERGÊNCIA
        username: 'admin1', 
        fullName: 'Administrador', 
        role: 'ADMIN', 
        passwordHash: password 
    }
  });

  await prisma.user.upsert({
    where: { username: 'enf1' },
    update: { passwordHash: password },
    create: { username: 'enf1', fullName: 'Enf. Mariana', role: 'NURSE', passwordHash: password }
  });

  await prisma.user.upsert({
    where: { username: 'coord1' },
    update: { passwordHash: password },
    create: { username: 'coord1', fullName: 'Enf. Coordenador', role: 'COORDINATOR', passwordHash: password }
  });

  await prisma.setting.upsert({
    where: { key: 'hospitalName' },
    update: {},
    create: { key: 'hospitalName', value: 'Hospital Demo' },
  });

  // Limpar DB
  await prisma.auditLog.deleteMany();
  await prisma.clinicalNote.deleteMany();
  await prisma.bedClinicalState.deleteMany();
  await prisma.admission.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.room.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.utente.deleteMany();

  // --- UNIDADE: FLOOR 1 ---
  const floor1 = await prisma.floor.create({ data: { name: 'Floor 1', type: 'FLOOR' } });
  const f1r1 = await createRoom(floor1.id, 'Room 1');
  const f1r2 = await createRoom(floor1.id, 'Room 2');
  await createBed(floor1.id, f1r1.id, 'F1-R1-B1');
  await createBed(floor1.id, f1r1.id, 'F1-R1-B2');
  await createBed(floor1.id, f1r2.id, 'F1-R2-B1');

  // --- UNIDADE: SERVICE A ---
  const serviceA = await prisma.floor.create({ data: { name: 'Service A', type: 'SERVICE' } });
  const s1 = await createRoom(serviceA.id, 'Room A');
  await createBed(serviceA.id, s1.id, 'SVC-A-1');


  // --- DADOS DE TESTE (OCUPAÇÃO) ---
  
  // Utente 1 (Cama 1.1.1)
  const u1 = await prisma.utente.create({
      data: { 
          name: 'António Silva', 
          birthDate: new Date('1955-05-20'), // ~68 anos
          processNumber: '55501' 
      }
  });
  await admitPatient(u1.id, 'F1-R1-B1', 'Dr. Smith', 'General Surgery', new Date(), new Date(Date.now() + 86400000 * 2), 68, 'M');

  // Utente 2 (Cama 3.1.1)
  const u2 = await prisma.utente.create({
      data: { 
          name: 'Maria Joaquina', 
          birthDate: new Date('1980-12-10'), // ~43 anos
          processNumber: '99902' 
      }
  });
  await admitPatient(u2.id, 'SVC-A-1', 'Dr. Costa', 'Cholecystectomy', new Date(Date.now() - 86400000), new Date(Date.now() + 86400000), 44, 'F');

  console.log('Seed Realista Concluído!');
}

// Helpers
async function createBed(floorId: string, roomId: string, code: string) {
    const bed = await prisma.bed.create({
        data: {
            floorId,
            roomId,
            code,
            sortOrder: parseSortOrder(code),
            isLocked: false
        }
    });
    await prisma.bedClinicalState.create({ data: { bedId: bed.id } });
}

async function createRoom(floorId: string, name: string) {
    return prisma.room.create({ data: { floorId, name } });
}

async function admitPatient(utenteId: string, bedCode: string, surgeon: string, surgery: string, entry: Date, exit: Date, age?: number, sex?: string) {
    const bed = await prisma.bed.findUnique({ where: { code: bedCode } });
    if (!bed) return;
    await prisma.admission.create({
        data: {
            bedId: bed.id,
            utenteId,
            surgeon,
            surgery,
            ageYears: age ?? null,
            sex: sex ?? null,
            entryDate: entry,
            dischargeDate: exit,
            isActive: true
        }
    });
}

function parseSortOrder(code: string) {
    const fallback = Math.floor(Date.now() / 1000);
    if (code.includes('QP')) {
        const floor = code.split('.')[0] || '0';
        const floorNum = Number.parseInt(floor, 10) || 0;
        return clampSortOrder(floorNum * 10000 + 9999, fallback);
    }
    const digits = code.match(/\d+/g);
    if (!digits || digits.length === 0) return fallback;
    const padded = digits.map((d) => d.padStart(2, '0')).join('');
    const parsed = Number.parseInt(padded, 10);
    return clampSortOrder(Number.isNaN(parsed) ? fallback : parsed, fallback);
}

function clampSortOrder(value: number, fallback: number) {
    const maxInt = 2147483647;
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return value > maxInt ? fallback : value;
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
