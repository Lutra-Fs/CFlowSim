/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}
