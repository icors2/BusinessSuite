module.exports = {
  displayName: 'cmms',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    '^database$': '<rootDir>/../shared/database/src/index.ts',
    '^audit$': '<rootDir>/../shared/audit/src/index.ts',
    '^event-bus$': '<rootDir>/../shared/event-bus/src/index.ts',
    '^mes$': '<rootDir>/../mes/src/index.ts',
    '^config$': '<rootDir>/../shared/config/src/index.ts',
  },
  coverageDirectory: '../../coverage/libs/cmms',
};
