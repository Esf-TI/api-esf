const prisma = require('../lib/prismaClient');

async function main() {
  // Verificar nucleos com fotoCapa
  const nucleos = await prisma.nucleo.findMany({
    where: { fotoCapa: { not: null } },
    select: { id: true, Nome: true, fotoCapa: true, foto1: true, foto2: true, foto3: true, logoUrl: true },
    take: 5,
  });
  
  console.log('=== NUCLEO fotoCapa ===');
  for (const n of nucleos) {
    console.log('ID:', n.id, '| Nome:', n.Nome);
    console.log('  fotoCapa:', n.fotoCapa);
    if (n.foto1) console.log('  foto1:', n.foto1);
    if (n.foto2) console.log('  foto2:', n.foto2);
    if (n.foto3) console.log('  foto3:', n.foto3);
    if (n.logoUrl) console.log('  logoUrl:', n.logoUrl);
    console.log('');
  }
  
  // Verificar projetos
  const projetos = await prisma.projeto.findMany({
    where: { fotoCapa: { not: null } },
    select: { id: true, Nome: true, fotoCapa: true },
    take: 5,
  });
  
  console.log('=== PROJETO fotoCapa ===');
  for (const p of projetos) {
    console.log('ID:', p.id, '| Nome:', p.Nome);
    console.log('  fotoCapa:', p.fotoCapa);
    console.log('');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
