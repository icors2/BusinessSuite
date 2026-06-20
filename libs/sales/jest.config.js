module.exports = {
  displayName: 'sales',
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
    '^finance$': '<rootDir>/../finance/src/index.ts',
    '^cpq$': '<rootDir>/../cpq/src/index.ts',
  },
  coverageDirectory: '../../coverage/libs/sales',
};
