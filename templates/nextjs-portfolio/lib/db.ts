// Mock DB client to satisfy build requirements
// In a real app, this would perform database connections

export const db = {
    user: {
        findMany: async () => [],
        findUnique: async () => null,
        create: async (data: any) => data,
    },
    post: {
        findMany: async () => [],
        findUnique: async () => null,
        create: async (data: any) => data,
    }
};
