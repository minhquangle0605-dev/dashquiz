// Prisma client singleton — will be configured when Prisma is set up
// For now, export a placeholder

export const getDatabaseStatus = (): { connected: boolean; message: string } => {
  return {
    connected: false,
    message: 'Prisma not yet configured. Will be set up in Phase 1.',
  };
};
