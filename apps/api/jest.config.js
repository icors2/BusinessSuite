module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    '^config$': '<rootDir>/../../libs/shared/config/src/index.ts',
    '^database$': '<rootDir>/../../libs/shared/database/src/index.ts',
    '^event-bus$': '<rootDir>/../../libs/shared/event-bus/src/index.ts',
    '^audit$': '<rootDir>/../../libs/shared/audit/src/index.ts',
    '^health$': '<rootDir>/../../libs/shared/health/src/index.ts',
    '^auth$': '<rootDir>/../../libs/shared/auth/src/index.ts',
  },
  coverageDirectory: '../../coverage/apps/api',
};
