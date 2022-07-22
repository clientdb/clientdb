module.exports = {
  preset: "ts-jest",
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
