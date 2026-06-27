import assert from 'node:assert/strict'
import { matchesCategoryFilter } from '../lib/variants'

const cases = [
  {
    name: 'matches canonical category key to display label',
    product: { categoryKey: 'electronics', category: 'Electronics' },
    selectedCategory: 'Electronics',
    expected: true,
  },
  {
    name: 'matches display label to canonical key',
    product: { categoryKey: 'fashion', category: 'Fashion' },
    selectedCategory: 'fashion',
    expected: true,
  },
  {
    name: 'does not match different categories',
    product: { categoryKey: 'fashion', category: 'Fashion' },
    selectedCategory: 'Electronics',
    expected: false,
  },
]

for (const testCase of cases) {
  assert.equal(matchesCategoryFilter(testCase.product as any, testCase.selectedCategory), testCase.expected, testCase.name)
}

console.log('category filter tests passed')
