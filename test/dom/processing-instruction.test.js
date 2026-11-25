'use strict'

const { DOMParser } = require('../../')

const MIME_TYPE = {
	XML_TEXT: 'text/xml',
}

describe('ProcessingInstruction', () => {
	test('createProcessingInstruction accepts any target or data without throwing', () => {
		const doc = new DOMParser().parseFromString('<xml></xml>', MIME_TYPE.XML_TEXT)
		expect(() =>
			doc.createProcessingInstruction('ns:bad', 'data')
		).not.toThrow()
		expect(() => doc.createProcessingInstruction('xml', '?>')).not.toThrow()
		expect(() =>
			doc.createProcessingInstruction('foo', 'inject?>evil')
		).not.toThrow()
	})
})
