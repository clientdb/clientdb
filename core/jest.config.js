module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testMatch: ["**/(*.)+(spec|test).ts?(x)"],
  transform: {
    "^.+\\.[tj]s$": "ts-jest",
  },
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
};
