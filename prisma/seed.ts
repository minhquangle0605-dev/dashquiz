import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...\n');

  // ── 1. Seed Roles ────────────────────────────────
  const roles = await Promise.all(
    [
      { name: 'student', description: 'Học sinh — làm bài kiểm tra, xem kết quả' },
      { name: 'parent', description: 'Phụ huynh — theo dõi kết quả học tập con em' },
      { name: 'teacher', description: 'Giáo viên — tạo câu hỏi, bài kiểm tra, phân tích' },
      { name: 'admin', description: 'Quản trị viên — quản lý toàn bộ hệ thống' },
    ].map((r) =>
      prisma.role.upsert({
        where: { name: r.name },
        update: {},
        create: r,
      }),
    ),
  );
  console.log(`✓ ${roles.length} roles seeded`);

  const adminRole = roles.find((r) => r.name === 'admin')!;

  // ── 2. Seed Admin Account (login: admin.web / 123456) ──
  const passwordHash = await bcrypt.hash('123456', 12);
  const adminEmail = 'admin.web@webquiz.local';
  // Upsert theo username — đảm bảo chạy seed lại luôn cập nhật đúng admin.web / 123456
  // (upsert theo email cũ sẽ không khớp nếu DB chỉ có user admin@school.edu.vn).
  const admin = await prisma.user.upsert({
    where: { username: 'admin.web' },
    update: {
      email: adminEmail,
      passwordHash,
      roleId: adminRole.id,
      fullName: 'System Administrator',
      status: 'ACTIVE',
    },
    create: {
      roleId: adminRole.id,
      username: 'admin.web',
      email: adminEmail,
      passwordHash,
      fullName: 'System Administrator',
      status: 'ACTIVE',
    },
  });
  console.log(`✓ Admin account seeded: ${admin.username} (${admin.email})`);

  // ── 3. Seed Subjects (Toán, Lý, Hóa — theo proposal) ──
  const subjectsData = [
    { name: 'Toán', code: 'MATH', description: 'Toán học phổ thông — Đại số, Hình học, Giải tích' },
    { name: 'Vật lý', code: 'PHY', description: 'Vật lý phổ thông — Cơ học, Điện, Quang, Nhiệt' },
    { name: 'Hóa học', code: 'CHEM', description: 'Hóa học phổ thông — Vô cơ, Hữu cơ' },
  ];

  const subjects = await Promise.all(
    subjectsData.map((s) =>
      prisma.subject.upsert({
        where: { code: s.code },
        update: {},
        create: { ...s, status: 1 },
      }),
    ),
  );
  console.log(`✓ ${subjects.length} subjects seeded`);

  // ── 4. Seed Academic Year & Semesters ────────────
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
      name: 'Học kỳ 1',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-01-15'),
      academicYearId: academicYear.id,
    },
    {
      name: 'Học kỳ 2',
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

  // ── 5. Seed Chapters & Topics ────────────────────
  const chaptersConfig: Record<string, { name: string; topics: string[] }[]> = {
    MATH: [
      {
        name: 'Hàm số và đồ thị',
        topics: ['Hàm số bậc nhất', 'Hàm số bậc hai', 'Đồ thị hàm số', 'Biến thiên hàm số', 'Giá trị lớn nhất - nhỏ nhất'],
      },
      {
        name: 'Phương trình và bất phương trình',
        topics: ['Phương trình bậc hai', 'Hệ phương trình', 'Bất phương trình', 'Phương trình chứa ẩn ở mẫu'],
      },
      {
        name: 'Lượng giác',
        topics: ['Góc lượng giác', 'Hàm số lượng giác', 'Phương trình lượng giác'],
      },
    ],
    PHY: [
      {
        name: 'Động học',
        topics: ['Chuyển động thẳng đều', 'Chuyển động thẳng biến đổi đều', 'Rơi tự do', 'Chuyển động tròn đều'],
      },
      {
        name: 'Động lực học',
        topics: ['Ba định luật Newton', 'Lực ma sát', 'Lực hướng tâm', 'Bài toán hệ vật'],
      },
    ],
    CHEM: [
      {
        name: 'Cấu tạo nguyên tử',
        topics: ['Thành phần nguyên tử', 'Cấu hình electron', 'Bảng tuần hoàn'],
      },
      {
        name: 'Liên kết hóa học',
        topics: ['Liên kết ion', 'Liên kết cộng hóa trị', 'Tinh thể', 'Hóa trị và số oxi hóa'],
      },
      {
        name: 'Phản ứng hóa học',
        topics: ['Phản ứng oxi hóa khử', 'Tốc độ phản ứng', 'Cân bằng hóa học'],
      },
    ],
  };

  let totalChapters = 0;
  let totalTopics = 0;
  const topicIds: number[] = [];

  for (const subject of subjects) {
    const chapters = chaptersConfig[subject.code] || [];
    for (let ci = 0; ci < chapters.length; ci++) {
      const chap = chapters[ci];
      const chapter = await prisma.chapter.create({
        data: {
          subjectId: subject.id,
          name: chap.name,
          orderIndex: ci + 1,
        },
      });
      totalChapters++;

      for (const topicName of chap.topics) {
        const topic = await prisma.topic.create({
          data: {
            chapterId: chapter.id,
            name: topicName,
          },
        });
        topicIds.push(topic.id);
        totalTopics++;
      }
    }
  }
  console.log(`✓ ${totalChapters} chapters seeded`);
  console.log(`✓ ${totalTopics} topics seeded`);

  // ── 6. Seed Topic Relations (Knowledge Graph) ────
  // MATH: 0-11, PHY: 12-19, CHEM: 20-29
  const relationsData = [
    // Toán: Hàm số bậc nhất → Hàm số bậc hai → Đồ thị hàm số
    { fromIdx: 0, toIdx: 1, type: 'prerequisite' },
    { fromIdx: 1, toIdx: 2, type: 'prerequisite' },
    { fromIdx: 0, toIdx: 3, type: 'related' },
    // Toán: Phương trình bậc hai → Hệ phương trình → Bất phương trình
    { fromIdx: 5, toIdx: 6, type: 'prerequisite' },
    { fromIdx: 6, toIdx: 7, type: 'prerequisite' },
    // Vật lý: Chuyển động thẳng đều → CĐTBDĐ → Rơi tự do
    { fromIdx: 12, toIdx: 13, type: 'prerequisite' },
    { fromIdx: 13, toIdx: 14, type: 'related' },
    // Hóa: Thành phần nguyên tử → Cấu hình electron → Bảng tuần hoàn
    { fromIdx: 20, toIdx: 21, type: 'prerequisite' },
    { fromIdx: 21, toIdx: 22, type: 'prerequisite' },
    // Hóa: Phản ứng oxi hóa khử → Tốc độ phản ứng → Cân bằng hóa học
    { fromIdx: 27, toIdx: 28, type: 'prerequisite' },
    { fromIdx: 28, toIdx: 29, type: 'related' },
  ];

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

  // ── 7. Seed System Configs ───────────────────────
  const configs = [
    { configKey: 'school_name', configValue: 'Trường THPT WebQuiz Demo', description: 'Tên trường hiển thị trên hệ thống' },
    { configKey: 'school_logo', configValue: '/images/logo.png', description: 'Đường dẫn logo trường' },
    { configKey: 'admin_email', configValue: adminEmail, description: 'Email hệ thống gắn với tài khoản admin' },
    { configKey: 'max_upload_size_mb', configValue: '10', description: 'Kích thước tải lên tối đa (MB)' },
    { configKey: 'session_timeout_min', configValue: '30', description: 'Thời gian hết phiên (phút)' },
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
