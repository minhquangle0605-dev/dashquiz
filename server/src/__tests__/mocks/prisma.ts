import { PrismaClient } from '@prisma/client';

type DeepPartial<T> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] };

type MockPrismaClient = {
  [K in keyof PrismaClient]: K extends `$${string}`
    ? jest.Mock
    : {
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        findMany: jest.Mock;
        create: jest.Mock;
        createMany: jest.Mock;
        update: jest.Mock;
        updateMany: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
        count: jest.Mock;
        aggregate: jest.Mock;
        upsert: jest.Mock;
      };
};

function createModelMock() {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
  };
}

export const prismaMock: MockPrismaClient = {
  user: createModelMock(),
  role: createModelMock(),
  parentStudent: createModelMock(),
  passwordResetToken: createModelMock(),
  academicYear: createModelMock(),
  semester: createModelMock(),
  class: createModelMock(),
  classStudent: createModelMock(),
  subject: createModelMock(),
  chapter: createModelMock(),
  topic: createModelMock(),
  topicRelation: createModelMock(),
  question: createModelMock(),
  questionOption: createModelMock(),
  questionTag: createModelMock(),
  exam: createModelMock(),
  examQuestion: createModelMock(),
  examSchedule: createModelMock(),
  examAssignment: createModelMock(),
  examAttempt: createModelMock(),
  attemptAnswer: createModelMock(),
  aiPracticeSession: createModelMock(),
  aiGeneratedQuestion: createModelMock(),
  notification: createModelMock(),
  activityLog: createModelMock(),
  systemConfig: createModelMock(),
  backup: createModelMock(),
  webPushSubscription: createModelMock(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn((fn: Function) => {
    if (typeof fn === 'function') return fn(prismaMock);
    return Promise.all(fn);
  }),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $on: jest.fn(),
} as unknown as MockPrismaClient;

jest.mock('../../config/database', () => ({
  prisma: prismaMock,
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
  getDatabaseStatus: jest.fn().mockResolvedValue({ connected: true, message: 'OK' }),
}));
