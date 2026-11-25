'use strict'

const { DOMImplementation } = require('../../dom')
const { DOMParser } = require('../../')

// dom.js does not export DOMException in this version,
// the thrown DOMExceptions are identified by their message
const INVALID_CHARACTER_ERR = /Invalid character/

describe('Document.prototype.createCDATASection', () => {
	let doc
	beforeEach(() => {
		doc = new DOMImplementation().createDocument(null, 'xml')
	})

	describe('throws InvalidCharacterError', () => {
		it('when data is exactly "]]>"', () => {
			expect(() => doc.createCDATASection(']]>')).toThrow(INVALID_CHARACTER_ERR)
		})

		it('when data starts with safe content then contains "]]>"', () => {
			expect(() => doc.createCDATASection('safe]]>data')).toThrow(
				INVALID_CHARACTER_ERR
			)
		})

		it('when data contains multiple "]]>" occurrences', () => {
			expect(() => doc.createCDATASection('before]]>after]]>after')).toThrow(
				INVALID_CHARACTER_ERR
			)
		})
	})

	describe('does not throw', () => {
		it('when data is safe', () => {
			expect(() => doc.createCDATASection('safe')).not.toThrow()
		})

		it('when data is empty string', () => {
			expect(() => doc.createCDATASection('')).not.toThrow()
		})
	})

	describe('parse path', () => {
		it('parsing XML containing a CDATA section does not throw', () => {
			expect(() =>
				new DOMParser().parseFromString(
					'<root><![CDATA[some data]]></root>',
					'text/xml'
				)
			).not.toThrow()
		})
	})
})
