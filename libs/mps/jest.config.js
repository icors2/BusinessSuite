module.exports = {
  displayName: 'mps',
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
    '^wms$': '<rootDir>/../wms/src/index.ts',
    '^sales$': '<rootDir>/../sales/src/index.ts',
  },
  coverageDirectory: '../../coverage/libs/mps',
};
