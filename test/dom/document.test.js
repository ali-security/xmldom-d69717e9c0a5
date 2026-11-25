'use strict'

const { DOMImplementation } = require('../../dom')

// dom.js does not export DOMException in this version,
// the thrown DOMExceptions are identified by their message
const HIERARCHY_REQUEST_ERR = /Hierarchy request error/
const NOT_FOUND_ERR = /Not found/

describe('Document.prototype', () => {
	describe('insertBefore', () => {
		it('should insert the first element and set `documentElement`', () => {
			const doc = new DOMImplementation().createDocument(null, '')
			expect(doc.childNodes).toHaveLength(0)
			expect(doc.documentElement).toBeNull()
			const root = doc.createElement('root')
			doc.insertBefore(root)
			expect(doc.documentElement).toBe(root)
			expect(doc.childNodes).toHaveLength(1)
			expect(doc.childNodes.item(0)).toBe(root)
		})
		it('should prevent inserting a second element', () => {
			const doc = new DOMImplementation().createDocument(null, '')
			const root = doc.createElement('root')
			const second = doc.createElement('second')
			doc.insertBefore(root)
			expect(() => doc.insertBefore(second)).toThrow(HIERARCHY_REQUEST_ERR)
			expect(doc.documentElement).toBe(root)
			expect(doc.childNodes).toHaveLength(1)
		})
		it('should prevent inserting an element before a doctype', () => {
			const impl = new DOMImplementation()
			const doctype = impl.createDocumentType('DT')
			const doc = impl.createDocument(null, '', doctype)
			expect(doc.childNodes).toHaveLength(1)
			const root = doc.createElement('root')
			expect(() => doc.insertBefore(root, doctype)).toThrow(HIERARCHY_REQUEST_ERR)
			expect(doc.documentElement).toBeNull()
			expect(doc.childNodes).toHaveLength(1)
			expect(root.parentNode).toBeNull()
		})
		it('should prevent inserting a second doctype', () => {
			const impl = new DOMImplementation()
			const doctype = impl.createDocumentType('DT')
			const doctype2 = impl.createDocumentType('DT2')
			const doc = impl.createDocument(null, '', doctype)
			expect(doc.childNodes).toHaveLength(1)
			expect(() => doc.insertBefore(doctype2)).toThrow(HIERARCHY_REQUEST_ERR)
			expect(doc.childNodes).toHaveLength(1)
		})
		it('should prevent inserting a doctype after an element', () => {
			const impl = new DOMImplementation()
			const doc = impl.createDocument(null, '')
			const root = doc.createElement('root')
			doc.insertBefore(root)
			const doctype = impl.createDocumentType('DT')
			expect(doc.childNodes).toHaveLength(1)

			expect(() => doc.insertBefore(doctype)).toThrow(HIERARCHY_REQUEST_ERR)

			expect(doc.childNodes).toHaveLength(1)
		})
		it('should prevent inserting before an child which is not a child of parent', () => {
			const doc = new DOMImplementation().createDocument(null, '')
			const root = doc.createElement('root')
			const withoutParent = doc.createElement('second')

			expect(() => doc.insertBefore(root, withoutParent)).toThrow(NOT_FOUND_ERR)

			expect(doc.documentElement).toBeNull()
			expect(doc.childNodes).toHaveLength(0)
			expect(root.parentNode).toBeNull()
		})
	})
	describe('replaceChild', () => {
		it('should remove the only element and add the new one', () => {
			const doc = new DOMImplementation().createDocument('', 'xml')
			const initialFirstChild = doc.firstChild
			const replacement = doc.createElement('replaced')

			doc.replaceChild(replacement, doc.firstChild)

			expect(doc.childNodes).toHaveLength(1)
			expect(initialFirstChild.parentNode).toBeNull()
			expect(doc.documentElement.name).toBe(replacement.name)
		})
	})
	describe('removeChild', () => {
		it('should remove all connections to node', () => {
			const doc = new DOMImplementation().createDocument('', 'xml')
			doc.insertBefore(doc.createComment('just a comment'), doc.firstChild)
			expect(doc.childNodes).toHaveLength(2)
			const initialElement = doc.firstChild

			doc.removeChild(initialElement)

			// expect(doc.documentElement).toBeNull();
			expect(initialElement.parentNode).toBeNull()
			expect(initialElement.nextSibling).toBeNull()
			// expect(initialElement.previousSibling).toBeNull();
			expect(doc.childNodes).toHaveLength(1)
		})
	})
})

describe('DOMParser', () => {
	it('should report an error and keep a single root for multiple top level elements', () => {
		const { getTestParser } = require('../get-test-parser')
		const { errors, parser } = getTestParser()

		const doc = parser.parseFromString('<doc/>\n<doc>', 'text/xml')

		expect(errors.error).toHaveLength(1)
		expect(errors.error[0]).toMatch(
			'element parse error: Error: Hierarchy request error: Only one element can be added and only after doctype'
		)
		expect(doc.documentElement.tagName).toBe('doc')
		expect(Array.prototype.filter.call(doc.childNodes, (node) => node.nodeType === 1)).toHaveLength(1)
	})
	it('sibling elements inside the root element', () => {
		const { DOMParser } = require('../../dom-parser')
		const actual = new DOMParser()
			.parseFromString(`<xml><book></book><title>Harry Potter</title></xml>`, 'text/xml')
			.toString()
		expect(actual).toBe(`<xml><book/><title>Harry Potter</title></xml>`)
	})
})
