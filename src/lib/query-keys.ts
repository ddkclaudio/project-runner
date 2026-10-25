export const queryKeys = {
  recommendations: {
    byProject: (projectId: string) => ['recommendations', projectId] as const,
  },
};
