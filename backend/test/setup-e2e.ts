jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(() => ({ name: 'test-app' })),
  cert: jest.fn((value: unknown) => value),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(async () => ({
      uid: 'test-user',
      email: 'test@example.com',
    })),
  })),
}));

process.env.REQUIRE_AUTH ??= 'false';
process.env.NODE_ENV ??= 'test';
