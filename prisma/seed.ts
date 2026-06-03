import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...\n');

  // ── 1. Seed Admin Account (login: admin.web / 123456) ──
  // Admin is the bootstrap account — created via upsert so re-running seed is safe.
  const passwordHash = await bcrypt.hash('123456', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin.web' },
    update: {
      passwordHash,
      role: 'ADMIN',
      fullName: 'System Administrator',
      status: 'ACTIVE',
    },
    create: {
      role: 'ADMIN',
      username: 'admin.web',
      passwordHash,
      fullName: 'System Administrator',
      status: 'ACTIVE',
    },
  });
  console.log(`✓ Admin account seeded: ${admin.username}`);

  const student = await prisma.user.upsert({
    where: { username: 'student.demo' },
    update: { passwordHash, role: 'STUDENT', fullName: 'Demo Student', status: 'ACTIVE' },
    create: { role: 'STUDENT', username: 'student.demo', passwordHash, fullName: 'Demo Student', status: 'ACTIVE' },
  });
  console.log(`✓ Student account seeded: ${student.username}`);

  const existingStudentProfile = await prisma.studentProfile.findUnique({
    where: { userId: student.id },
  });
  if (existingStudentProfile) {
    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: { studentCode: 'HS-DEMO', fullName: 'Demo Student' },
    });
  } else {
    await prisma.studentProfile.create({
      data: { studentCode: 'HS-DEMO', userId: student.id, fullName: 'Demo Student' },
    });
  }

  const parent = await prisma.user.upsert({
    where: { username: 'parent.demo' },
    update: { passwordHash, role: 'PARENT', fullName: 'Demo Parent', status: 'ACTIVE' },
    create: { role: 'PARENT', username: 'parent.demo', passwordHash, fullName: 'Demo Parent', status: 'ACTIVE' },
  });
  const existingParentProfile = await prisma.parentProfile.findUnique({
    where: { userId: parent.id },
  });
  if (existingParentProfile) {
    await prisma.parentProfile.update({
      where: { userId: parent.id },
      data: { parentCode: 'PH-DEMO', fullName: 'Demo Parent' },
    });
  } else {
    await prisma.parentProfile.create({
      data: { parentCode: 'PH-DEMO', userId: parent.id, fullName: 'Demo Parent' },
    });
  }
  await prisma.studentProfile.update({
    where: { studentCode: 'HS-DEMO' },
    data: { parentCode: 'PH-DEMO' },
  });
  console.log(`✓ Parent account seeded: ${parent.username}`);

  const teacher = await prisma.user.upsert({
    where: { username: 'teacher.demo' },
    update: { passwordHash, role: 'TEACHER', fullName: 'Demo Teacher', status: 'ACTIVE' },
    create: { role: 'TEACHER', username: 'teacher.demo', passwordHash, fullName: 'Demo Teacher', status: 'ACTIVE' },
  });
  console.log(`✓ Teacher account seeded: ${teacher.username}`);

  // ── 2. Seed Subjects (Mathematics, Physics, Chemistry) ──
  const subjectsData = [
    { name: 'Mathematics', code: 'MATH', description: 'High school mathematics - Algebra, Geometry, Calculus' },
    { name: 'Physics', code: 'PHY', description: 'High school physics - Mechanics, Electricity, Optics, Thermodynamics' },
    { name: 'Chemistry', code: 'CHEM', description: 'High school chemistry - Inorganic, Organic' },
  ];

  const subjects = await Promise.all(
    subjectsData.map((s) =>
      prisma.subject.upsert({
        where: { code: s.code },
        update: { name: s.name, description: s.description, status: 1 },
        create: { ...s, status: 1 },
      }),
    ),
  );
  console.log(`✓ ${subjects.length} subjects seeded`);

  // ── 3. Seed Academic Year & Semesters ────────────
  const academicYear = await prisma.academicYear.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: '2025-2026',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-06-30'),
      isCurrent: true,
    },
  });
  console.log(`✓ Academic year seeded: ${academicYear.name}`);

  const semestersData = [
    {
      name: 'Semester 1',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-01-15'),
      academicYearId: academicYear.id,
    },
    {
      name: 'Semester 2',
      startDate: new Date('2026-01-16'),
      endDate: new Date('2026-06-30'),
      academicYearId: academicYear.id,
    },
  ];

  const semesters = await Promise.all(
    semestersData.map((s, i) =>
      prisma.semester.upsert({
        where: { id: i + 1 },
        update: {},
        create: s,
      }),
    ),
  );
  console.log(`✓ ${semesters.length} semesters seeded`);

  // ── 4. Seed Chapters & Topics ────────────────────
  const chaptersConfig: Record<
    string,
    { gradeLevel: 10 | 11 | 12; chapters: string[] }[]
  > = {
    MATH: [
      {
        gradeLevel: 10,
        chapters: [
          'Propositions and Sets',
          'Inequalities and Systems of Linear Inequalities in Two Variables',
          'Functions and Graphs',
          'Quadratic Functions',
          'Trigonometric Relations in Triangles',
          'Vectors',
          'Dot Product of Two Vectors',
          'Coordinate Geometry in the Plane',
          'Combinatorics',
          'Probability',
          'Statistics',
          'Vectors in the Plane',
          'Oxy Coordinate System',
          'Lines',
          'Circles',
          'The Three Basic Conic Sections',
        ],
      },
      {
        gradeLevel: 11,
        chapters: [
          'Trigonometric Functions',
          'Trigonometric Equations',
          'Sequences',
          'Arithmetic Sequences',
          'Geometric Sequences',
          'Limits of Sequences',
          'Limits of Functions',
          'Continuous Functions',
          'Exponential Functions',
          'Logarithmic Functions',
          'Exponential and Logarithmic Equations and Inequalities',
          'Parallel Relations',
          'Lines and Planes',
          'Perpendicular Relations',
          'Angles in Space',
          'Distances in Space',
          'Pyramids',
          'Prisms',
          'Events',
          'Classical Probability',
          'Probability Rules',
        ],
      },
      {
        gradeLevel: 12,
        chapters: [
          'Applications of Derivatives',
          'Rational Functions',
          'Advanced Exponential and Logarithmic Functions',
          'Antiderivatives',
          'Integrals',
          'Applications of Integrals',
          'Complex Numbers',
          'Three-Dimensional Coordinate System',
          'Equations of Planes',
          'Equations of Lines',
          'Spheres',
          'Distances and Angles in Oxyz Space',
          'Random Variables',
          'Probability Distributions',
          'Basic Expected Value',
        ],
      },
    ],
    CHEM: [
      {
        gradeLevel: 10,
        chapters: [
          'Atomic Structure',
          'Periodic Table and Periodic Law',
          'Chemical Bonding',
          'Oxidation-Reduction Reactions',
          'Reaction Rate and Chemical Equilibrium',
          'Halogens',
          'Oxygen and Sulfur Group Elements',
        ],
      },
      {
        gradeLevel: 11,
        chapters: [
          'Electrolytic Dissociation',
          'Nitrogen and Phosphorus',
          'Carbon and Silicon',
          'Introduction to Organic Chemistry',
          'Saturated Hydrocarbons (Alkanes)',
          'Unsaturated Hydrocarbons',
          'Aromatic Hydrocarbons',
          'Halogen Derivatives - Alcohols - Phenols',
          'Aldehydes - Ketones - Carboxylic Acids',
        ],
      },
      {
        gradeLevel: 12,
        chapters: [
          'Esters and Lipids',
          'Carbohydrates',
          'Amines, Amino Acids, and Proteins',
          'Polymers and Polymer Materials',
          'General Principles of Metals',
          'Alkali Metals, Alkaline Earth Metals, and Aluminum',
          'Iron, Chromium, Copper, and Some Important Compounds',
          'Distinguishing Certain Inorganic Substances',
          'General Principles of Organic Chemistry',
        ],
      },
    ],
    PHY: [
      {
        gradeLevel: 10,
        chapters: [
          'Kinematics',
          'Dynamics',
          'Equilibrium and Motion of Rigid Bodies',
          'Conservation Laws',
          'Circular Motion',
          'Deformation of Solids',
          'Fluids',
          'Thermodynamics',
        ],
      },
      {
        gradeLevel: 11,
        chapters: [
          'Oscillations',
          'Waves',
          'Electric Field',
          'Electric Current and Electric Circuits',
          'Magnetic Field',
          'Electromagnetic Induction',
          'Optics',
        ],
      },
      {
        gradeLevel: 12,
        chapters: [
          'Mechanical Oscillations',
          'Mechanical Waves and Sound Waves',
          'Alternating Current',
          'Electromagnetic Oscillations and Electromagnetic Waves',
          'Light Waves',
          'Quantum Physics of Light',
          'Atomic Nucleus Physics',
        ],
      },
    ],
  };

  let totalChapters = 0;
  let totalTopics = 0;
  const topicIds: number[] = [];

  for (const subject of subjects) {
    const gradeGroups = chaptersConfig[subject.code] || [];
    for (const group of gradeGroups) {
      for (let ci = 0; ci < group.chapters.length; ci++) {
        const chapterName = group.chapters[ci];
        const existingChapter = await prisma.chapter.findFirst({
          where: {
            subjectId: subject.id,
            gradeLevel: group.gradeLevel,
            name: chapterName,
          },
        });
        const chapter = existingChapter
          ? await prisma.chapter.update({
              where: { id: existingChapter.id },
              data: { orderIndex: ci + 1 },
            })
          : await prisma.chapter.create({
              data: {
                subjectId: subject.id,
                gradeLevel: group.gradeLevel,
                name: chapterName,
                orderIndex: ci + 1,
              },
            });
        totalChapters++;

        const existingTopic = await prisma.topic.findFirst({
          where: {
            chapterId: chapter.id,
            name: 'General',
          },
        });
        const topic = existingTopic
          ? existingTopic
          : await prisma.topic.create({
              data: {
                chapterId: chapter.id,
                name: 'General',
              },
            });
        topicIds.push(topic.id);
        totalTopics++;
      }
    }
  }
  console.log(`✓ ${totalChapters} chapters seeded`);
  console.log(`✓ ${totalTopics} topics seeded`);

  // ── 5. Seed Topic Relations (Knowledge Graph) ────
  // The PDF provides chapter lists only, not prerequisite relationships.
  let removedLegacyChapters = 0;
  for (const subject of subjects) {
    const legacyChapters = await prisma.chapter.findMany({
      where: {
        subjectId: subject.id,
        topics: { none: { name: 'General' } },
      },
      include: { _count: { select: { questions: true } } },
    });

    for (const chapter of legacyChapters) {
      if (chapter._count.questions > 0) continue;
      await prisma.chapter.delete({ where: { id: chapter.id } });
      removedLegacyChapters++;
    }
  }
  console.log(`✓ ${removedLegacyChapters} legacy empty chapters removed`);

  const relationsData: Array<{ fromIdx: number; toIdx: number; type: string }> = [/*
    // Math: Linear Functions → Quadratic Functions → Function Graphs
    { fromIdx: 0, toIdx: 1, type: 'prerequisite' },
    { fromIdx: 1, toIdx: 2, type: 'prerequisite' },
    { fromIdx: 0, toIdx: 3, type: 'related' },
    // Math: Quadratic Equations → Systems of Equations → Inequalities
    { fromIdx: 5, toIdx: 6, type: 'prerequisite' },
    { fromIdx: 6, toIdx: 7, type: 'prerequisite' },
    // Physics: Uniform Linear Motion → Uniformly Accelerated Linear Motion → Free Fall
    { fromIdx: 12, toIdx: 13, type: 'prerequisite' },
    { fromIdx: 13, toIdx: 14, type: 'related' },
    // Chemistry: Atomic Composition → Electron Configuration → Periodic Table
    { fromIdx: 20, toIdx: 21, type: 'prerequisite' },
    { fromIdx: 21, toIdx: 22, type: 'prerequisite' },
    // Chemistry: Redox Reactions → Reaction Rate → Chemical Equilibrium
    { fromIdx: 27, toIdx: 28, type: 'prerequisite' },
    { fromIdx: 28, toIdx: 29, type: 'related' },
  */];

  let relCount = 0;
  for (const rel of relationsData) {
    if (topicIds[rel.fromIdx] && topicIds[rel.toIdx]) {
      await prisma.topicRelation.create({
        data: {
          fromTopicId: topicIds[rel.fromIdx],
          toTopicId: topicIds[rel.toIdx],
          relationType: rel.type,
        },
      });
      relCount++;
    }
  }
  console.log(`✓ ${relCount} topic relations seeded (Knowledge Graph)`);

  // ── 5b. Seed managed-subject timetable slots ─────
  // Encodes the Math/Physics/Chemistry slots from the timetable plan (Appendix §10).
  // Only classes that already exist (created by teachers) get seeded; display-only
  // subjects are left for the Excel import. Period times are minute-of-day (VN).
  const PERIOD_TIMES: Record<number, { start: number; end: number }> = {
    1: { start: 7 * 60, end: 7 * 60 + 45 }, // 07:00–07:45
    2: { start: 7 * 60 + 50, end: 8 * 60 + 35 }, // 07:50–08:35
    3: { start: 8 * 60 + 40, end: 9 * 60 + 25 }, // 08:40–09:25
    4: { start: 9 * 60 + 45, end: 10 * 60 + 30 }, // 09:45–10:30
    5: { start: 10 * 60 + 30, end: 11 * 60 + 15 }, // 10:30–11:15
  };
  const DAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const;
  type DayKey = keyof typeof DAY;

  // [day, period] pairs per class per managed subject code.
  const timetablePlan: Record<string, Record<'MATH' | 'PHY' | 'CHEM', [DayKey, number][]>> = {
    '10A1': { MATH: [['Mon', 2], ['Tue', 2], ['Thu', 1], ['Fri', 3]], PHY: [['Mon', 5], ['Thu', 2]], CHEM: [['Tue', 1], ['Thu', 3]] },
    '10A2': { MATH: [['Mon', 3], ['Tue', 3], ['Thu', 1], ['Sat', 3]], PHY: [['Tue', 1], ['Thu', 4]], CHEM: [['Mon', 5], ['Thu', 2]] },
    '10A3': { MATH: [['Mon', 3], ['Tue', 1], ['Thu', 2], ['Sat', 1]], PHY: [['Tue', 3], ['Fri', 1]], CHEM: [['Tue', 2], ['Thu', 1]] },
    '11A1': { MATH: [['Mon', 2], ['Tue', 2], ['Thu', 1], ['Fri', 3]], PHY: [['Mon', 5], ['Thu', 2]], CHEM: [['Tue', 1], ['Thu', 3]] },
    '11A2': { MATH: [['Mon', 3], ['Tue', 2], ['Thu', 2], ['Sat', 1]], PHY: [['Tue', 1], ['Thu', 3]], CHEM: [['Mon', 5], ['Thu', 1]] },
    '11A3': { MATH: [['Mon', 4], ['Tue', 1], ['Thu', 1], ['Fri', 3]], PHY: [['Tue', 2], ['Thu', 4]], CHEM: [['Tue', 3], ['Thu', 2]] },
    '12A1': { MATH: [['Mon', 2], ['Tue', 1], ['Wed', 2], ['Thu', 3], ['Fri', 2]], PHY: [['Mon', 5], ['Thu', 1]], CHEM: [['Tue', 2], ['Thu', 2]] },
    '12A2': { MATH: [['Mon', 3], ['Tue', 2], ['Wed', 1], ['Thu', 4], ['Fri', 2]], PHY: [['Tue', 1], ['Thu', 2]], CHEM: [['Mon', 5], ['Thu', 1]] },
    '12A3': { MATH: [['Mon', 3], ['Tue', 1], ['Wed', 2], ['Thu', 4], ['Fri', 2]], PHY: [['Tue', 2], ['Thu', 3]], CHEM: [['Tue', 3], ['Thu', 2]] },
  };

  const subjectByCode = new Map(subjects.map((s) => [s.code, s]));
  let timetableSlots = 0;
  let skippedClasses = 0;

  for (const [className, perSubject] of Object.entries(timetablePlan)) {
    const cls = await prisma.class.findFirst({ where: { name: className } });
    if (!cls) {
      skippedClasses++;
      continue;
    }

    for (const code of ['MATH', 'PHY', 'CHEM'] as const) {
      const subject = subjectByCode.get(code);
      if (!subject) continue;
      for (const [dayKey, period] of perSubject[code]) {
        const dayOfWeek = DAY[dayKey];
        const times = PERIOD_TIMES[period];
        if (!times) continue;

        const existing = await prisma.classTimetableSlot.findFirst({
          where: { classId: cls.id, dayOfWeek, periodIndex: period },
        });
        const slotData = {
          subjectId: subject.id,
          displayName: subject.name,
          kind: 'MANAGED_SUBJECT' as const,
          status: 'ACTIVE' as const,
          startMinute: times.start,
          endMinute: times.end,
          semesterId: cls.semesterId,
        };

        if (existing) {
          await prisma.classTimetableSlot.update({ where: { id: existing.id }, data: slotData });
        } else {
          await prisma.classTimetableSlot.create({
            data: {
              classId: cls.id,
              dayOfWeek,
              periodIndex: period,
              createdBy: admin.id,
              ...slotData,
            },
          });
        }
        timetableSlots++;
      }
    }
  }
  console.log(
    `✓ ${timetableSlots} managed timetable slots seeded` +
      (skippedClasses > 0 ? ` (${skippedClasses} class name(s) not found, skipped)` : ''),
  );

  // ── 6. Seed System Configs ───────────────────────
  const configs = [
    { configKey: 'school_name', configValue: 'WebQuiz Demo High School', description: 'School name displayed in the system' },
    { configKey: 'school_logo', configValue: '/images/logo.png', description: 'Path to school logo' },
    { configKey: 'max_upload_size_mb', configValue: '10', description: 'Maximum upload size (MB)' },
    { configKey: 'session_timeout_min', configValue: '30', description: 'Session timeout (minutes)' },
  ];

  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { configKey: cfg.configKey },
      update: {},
      create: cfg,
    });
  }
  console.log(`✓ ${configs.length} system configs seeded`);

  console.log('\n✅ Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
