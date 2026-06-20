module.exports = {
  displayName: 'health',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  moduleNameMapper: {
    '^config$': '<rootDir>/../config/src/index.ts',
    '^database$': '<rootDir>/../database/src/index.ts',
  },
  coverageDirectory: '../../../coverage/libs/shared/health',
};
