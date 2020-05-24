module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
        emca: 2020,
        sourceType: "module"
    },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
    ],
    rules: {
        "max-len": ["error", { "code": 120 }],
        "indent": ["error", 4],
        "quotes": ["error", "double"],
        "semi": ["error", "always"],
        "no-unused-vars": 1,
    }
};
