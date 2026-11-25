'use strict'

const { DOMImplementation } = require('../../dom')

const DEEP_TREE_DEPTH = 10100

function buildDeepTree() {
	const doc = new DOMImplementation().createDocument(null, 'root')
	let current = doc.documentElement
	for (let i = 0; i < DEEP_TREE_DEPTH; i++) {
		const child = doc.createElement('n')
		current.appendChild(child)
		current = child
	}
	return { doc, leaf: current }
}

describe('Node.prototype', () => {
	describe('cloneNode', () => {
		it('cloneNode(true) on a 10,100-depth tree succeeds without throwing RangeError (GHSA-2v35-w6hq-6mfw)', () => {
			const { doc } = buildDeepTree()
			expect(() => doc.documentElement.cloneNode(true)).not.toThrow()
		})
	})

	describe('textContent', () => {
		it('textContent on a 10,100-depth element tree succeeds without throwing RangeError (GHSA-2v35-w6hq-6mfw)', () => {
			const { doc, leaf } = buildDeepTree()
			leaf.appendChild(doc.createTextNode('leaf'))
			expect(doc.documentElement.textContent).toBe('leaf')
		})
	})

	describe('importNode', () => {
		it('importNode(node, true) on a 10,100-depth tree succeeds without throwing RangeError (GHSA-2v35-w6hq-6mfw)', () => {
			const { doc } = buildDeepTree()
			const destDoc = new DOMImplementation().createDocument(null, 'dest')
			expect(() => destDoc.importNode(doc.documentElement, true)).not.toThrow()
		})
	})

	describe('normalize', () => {
		it('normalize on a 10,100-depth tree succeeds without throwing RangeError (GHSA-2v35-w6hq-6mfw)', () => {
			const { doc, leaf } = buildDeepTree()
			leaf.appendChild(doc.createTextNode('a'))
			leaf.appendChild(doc.createTextNode('b'))
			expect(() => doc.documentElement.normalize()).not.toThrow()
			expect(leaf.childNodes).toHaveLength(1)
			expect(leaf.firstChild.data).toBe('ab')
		})
	})
})
