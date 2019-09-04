module.exports = {
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	extends: [
		'airbnb-base',
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
	],
	rules: {
		'no-tabs': 0,
		'indent': ['warn', 'tab'],
		'object-curly-spacing': ['warn', 'never'],
		'no-unused-expressions': [2, {'allowTernary': true}],
		'no-param-reassign': ['error', {'props': false}],
		'prefer-destructuring': 0,
	},
}
