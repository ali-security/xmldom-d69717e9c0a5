'use strict'

const { DOMParser, XMLSerializer } = require('../../')
const { DOMImplementation } = require('../../dom')

const MIME_TYPE = {
	XML_TEXT: 'text/xml',
}

// dom.js does not export DOMException in this version,
// the thrown DOMExceptions are identified by their message
const INVALID_STATE_ERR = /Invalid state/

describe('XML Serializer', () => {
	describe('properly escapes attribute values', () => {
		it('should escape special characters in namespace attributes', () => {
			const input = `<xml xmlns='<&"' xmlns:attr='"&<'><test attr:test=""/></xml>`
			const doc = new DOMParser().parseFromString(input, MIME_TYPE.XML_TEXT)

			// in this case the explicit attribute nodes are serialized
			expect(new XMLSerializer().serializeToString(doc)).toBe(
				'<xml xmlns="&lt;&amp;&quot;" xmlns:attr="&quot;&amp;&lt;"><test attr:test=""/></xml>'
			)

			// in this case the namespace attributes are "inherited" from the parent,
			// which is not serialized
			expect(
				new XMLSerializer().serializeToString(doc.documentElement.firstChild)
			).toBe(
				'<test xmlns:attr="&quot;&amp;&lt;" attr:test="" xmlns="&lt;&amp;&quot;"/>'
			)
		})
	})
})

describe('XMLSerializer CDATASection serialization', () => {
	let doc
	beforeEach(() => {
		doc = new DOMImplementation().createDocument(null, 'root', null)
	})

	it('serializes a safe CDATASection unchanged', () => {
		doc.documentElement.appendChild(doc.createCDATASection('safe data'))
		expect(new XMLSerializer().serializeToString(doc.documentElement)).toBe(
			'<root><![CDATA[safe data]]></root>'
		)
	})

	it('splits a CDATASection whose data contains "]]>"', () => {
		const cdata = doc.createCDATASection('safe')
		cdata.data = 'foo]]>bar'
		doc.documentElement.appendChild(cdata)
		expect(new XMLSerializer().serializeToString(doc.documentElement)).toBe(
			'<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>'
		)
	})

	it('splits multiple "]]>" occurrences', () => {
		const cdata = doc.createCDATASection('safe')
		cdata.data = 'a]]>b]]>c'
		doc.documentElement.appendChild(cdata)
		expect(new XMLSerializer().serializeToString(doc.documentElement)).toBe(
			'<root><![CDATA[a]]]]><![CDATA[>b]]]]><![CDATA[>c]]></root>'
		)
	})

	it('split output round-trips through DOMParser to equivalent content', () => {
		const cdata = doc.createCDATASection('safe')
		cdata.data = 'foo]]>bar'
		doc.documentElement.appendChild(cdata)
		const serialized = new XMLSerializer().serializeToString(
			doc.documentElement
		)
		const reparsed = new DOMParser().parseFromString(
			serialized,
			MIME_TYPE.XML_TEXT
		)
		expect(reparsed.documentElement.textContent).toBe('foo]]>bar')
	})

	describe('mutation vectors', () => {
		// Serializes, then re-parses, and returns true if an <injected> element appears in the tree.
		function isInjected(root) {
			const xml = new XMLSerializer().serializeToString(root)
			const reparsed = new DOMParser().parseFromString(xml, MIME_TYPE.XML_TEXT)
			return reparsed.getElementsByTagName('injected').length > 0
		}

		it('appendData introduces "]]>" safely', () => {
			const cdata = doc.createCDATASection('safe')
			doc.documentElement.appendChild(cdata)
			cdata.appendData(']]><injected/>')
			expect(isInjected(doc.documentElement)).toBe(false)
		})

		it('replaceData introduces "]]>" safely', () => {
			const cdata = doc.createCDATASection('safe data')
			doc.documentElement.appendChild(cdata)
			cdata.replaceData(4, 5, ']]><injected/>')
			expect(isInjected(doc.documentElement)).toBe(false)
		})

		it('.data assignment introduces "]]>" safely', () => {
			const cdata = doc.createCDATASection('safe')
			doc.documentElement.appendChild(cdata)
			cdata.data = 'evil]]><injected/>'
			expect(isInjected(doc.documentElement)).toBe(false)
		})

		it('.textContent assignment introduces "]]>" safely', () => {
			const cdata = doc.createCDATASection('safe')
			doc.documentElement.appendChild(cdata)
			cdata.textContent = 'evil]]><injected/>'
			expect(isInjected(doc.documentElement)).toBe(false)
		})
	})
})

describe('XMLSerializer serializeToString requireWellFormed option', () => {
	let doc
	beforeEach(() => {
		doc = new DOMImplementation().createDocument(null, 'root', null)
	})

	it('CDATA with "]]>" still splits when no options are passed (regression)', () => {
		const cdata = doc.createCDATASection('safe')
		cdata.data = 'foo]]>bar'
		doc.documentElement.appendChild(cdata)
		expect(new XMLSerializer().serializeToString(doc.documentElement)).toBe(
			'<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>'
		)
	})

	it('CDATA with "]]>" still splits when options is null (regression)', () => {
		const cdata = doc.createCDATASection('safe')
		cdata.data = 'foo]]>bar'
		doc.documentElement.appendChild(cdata)
		expect(
			new XMLSerializer().serializeToString(
				doc.documentElement,
				false,
				null,
				null
			)
		).toBe('<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>')
	})

	it('requireWellFormed: true on CDATA with "]]>" throws', () => {
		const cdata = doc.createCDATASection('safe')
		cdata.data = 'foo]]>bar'
		doc.documentElement.appendChild(cdata)
		expect(() =>
			new XMLSerializer().serializeToString(doc, false, null, {
				requireWellFormed: true,
			})
		).toThrow(INVALID_STATE_ERR)
	})

	it('node.toString with requireWellFormed: true on CDATA with "]]>" throws', () => {
		const cdata = doc.createCDATASection('safe')
		cdata.data = 'foo]]>bar'
		doc.documentElement.appendChild(cdata)
		expect(() =>
			doc.toString(false, null, { requireWellFormed: true })
		).toThrow(INVALID_STATE_ERR)
	})
})

describe('XMLSerializer Comment serialization with requireWellFormed', () => {
	let doc
	beforeEach(() => {
		doc = new DOMImplementation().createDocument(null, 'root', null)
	})

	it('default: comment with "-->" in data emits verbatim - no throw', () => {
		doc.documentElement.appendChild(doc.createComment('hello-->world'))
		expect(new XMLSerializer().serializeToString(doc)).toBe(
			'<root><!--hello-->world--></root>'
		)
	})

	it('default: comment with "--" in data emits verbatim - no throw', () => {
		doc.documentElement.appendChild(doc.createComment('hello--world'))
		expect(new XMLSerializer().serializeToString(doc)).toBe(
			'<root><!--hello--world--></root>'
		)
	})

	it('requireWellFormed: true on comment with invalid XML Char (\\x00) throws InvalidStateError', () => {
		doc.documentElement.appendChild(
			doc.createComment('hello' + String.fromCharCode(0) + 'world')
		)
		expect(() =>
			new XMLSerializer().serializeToString(doc, { requireWellFormed: true })
		).toThrow(INVALID_STATE_ERR)
	})

	it('requireWellFormed: true on comment with "-->" throws InvalidStateError', () => {
		doc.documentElement.appendChild(doc.createComment('hello-->world'))
		expect(() =>
			new XMLSerializer().serializeToString(doc, { requireWellFormed: true })
		).toThrow(INVALID_STATE_ERR)
	})

	it('requireWellFormed: true on comment with "--" (no "-->") throws InvalidStateError', () => {
		doc.documentElement.appendChild(doc.createComment('hello--world'))
		expect(() =>
			new XMLSerializer().serializeToString(doc, { requireWellFormed: true })
		).toThrow(INVALID_STATE_ERR)
	})

	it('requireWellFormed: true on comment whose data ends with "-" throws InvalidStateError', () => {
		doc.documentElement.appendChild(doc.createComment('hello-'))
		expect(() =>
			new XMLSerializer().serializeToString(doc, { requireWellFormed: true })
		).toThrow(INVALID_STATE_ERR)
	})

	it('requireWellFormed: true on comment with clean data does not throw', () => {
		doc.documentElement.appendChild(doc.createComment('clean comment'))
		expect(() =>
			new XMLSerializer().serializeToString(doc, { requireWellFormed: true })
		).not.toThrow()
	})

	it('mutation vector: appendData("-->") then requireWellFormed: true throws InvalidStateError', () => {
		const comment = doc.createComment('clean')
		doc.documentElement.appendChild(comment)
		comment.appendData('-->')
		expect(() =>
			new XMLSerializer().serializeToString(doc, { requireWellFormed: true })
		).toThrow(INVALID_STATE_ERR)
	})
})

describe('XMLSerializer DocumentType serialization with requireWellFormed', () => {
	it('default: DocumentType with invalid publicId serializes verbatim - no throw', () => {
		const doctype = new DOMImplementation().createDocumentType(
			'name',
			'"invalid<char"',
			''
		)
		const dtDoc = new DOMImplementation().createDocument(null, 'root', doctype)
		expect(() => new XMLSerializer().serializeToString(dtDoc)).not.toThrow()
	})

	it('requireWellFormed: true on DocumentType with invalid publicId throws', () => {
		const doctype = new DOMImplementation().createDocumentType(
			'name',
			'"invalid<char"',
			''
		)
		const dtDoc = new DOMImplementation().createDocument(null, 'root', doctype)
		expect(() =>
			new XMLSerializer().serializeToString(dtDoc, false, null, {
				requireWellFormed: true,
			})
		).toThrow(INVALID_STATE_ERR)
	})

	it('requireWellFormed: true on DocumentType with invalid systemId throws', () => {
		const doctype = new DOMImplementation().createDocumentType(
			'name',
			'',
			'no-quotes-around-this'
		)
		const dtDoc = new DOMImplementation().createDocument(null, 'root', doctype)
		expect(() =>
			new XMLSerializer().serializeToString(dtDoc, false, null, {
				requireWellFormed: true,
			})
		).toThrow(INVALID_STATE_ERR)
	})

	it('requireWellFormed: true on DocumentType with "]>" in internalSubset throws', () => {
		const doctype = new DOMImplementation().createDocumentType('name', '', '')
		const dtDoc = new DOMImplementation().createDocument(null, 'root', doctype)
		doctype.internalSubset = ']><injected/>'
		expect(() =>
			new XMLSerializer().serializeToString(dtDoc, false, null, {
				requireWellFormed: true,
			})
		).toThrow(INVALID_STATE_ERR)
	})

	it('requireWellFormed: true on DocumentType with valid fields does not throw', () => {
		const doctype = new DOMImplementation().createDocumentType(
			'html',
			'"-//W3C//DTD HTML 4.01//EN"',
			'"http://www.w3.org/TR/html4/strict.dtd"'
		)
		const dtDoc = new DOMImplementation().createDocument(null, 'root', doctype)
		expect(() =>
			new XMLSerializer().serializeToString(dtDoc, false, null, {
				requireWellFormed: true,
			})
		).not.toThrow()
	})

	it('direct property write: setting invalid publicId then requireWellFormed: true throws', () => {
		const doctype = new DOMImplementation().createDocumentType(
			'name',
			'"-//W3C//DTD//EN"',
			''
		)
		const dtDoc = new DOMImplementation().createDocument(null, 'root', doctype)
		doctype.publicId = '"invalid<char"'
		expect(() =>
			new XMLSerializer().serializeToString(dtDoc, false, null, {
				requireWellFormed: true,
			})
		).toThrow(INVALID_STATE_ERR)
	})

	it('default: DocumentType with invalid name serializes verbatim - no throw', () => {
		const doctype = new DOMImplementation().createDocumentType('html', '', '')
		doctype.name =
			'html><script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script'
		const dtDoc = new DOMImplementation().createDocument(null, 'root', doctype)
		let out
		expect(
			() => (out = new XMLSerializer().serializeToString(dtDoc))
		).not.toThrow()
		expect(out).toContain('<!DOCTYPE html><script')
	})

	it('requireWellFormed: true on DocumentType with ">" in name throws', () => {
		const doctype = new DOMImplementation().createDocumentType('html', '', '')
		doctype.name =
			'html><script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script'
		const dtDoc = new DOMImplementation().createDocument(null, 'root', doctype)
		expect(() =>
			new XMLSerializer().serializeToString(dtDoc, false, null, {
				requireWellFormed: true,
			})
		).toThrow(INVALID_STATE_ERR)
	})

	it('requireWellFormed: true on DocumentType with whitespace in name throws', () => {
		const doctype = new DOMImplementation().createDocumentType('html', '', '')
		doctype.name = 'ht ml'
		const dtDoc = new DOMImplementation().createDocument(null, 'root', doctype)
		expect(() =>
			new XMLSerializer().serializeToString(dtDoc, false, null, {
				requireWellFormed: true,
			})
		).toThrow(INVALID_STATE_ERR)
	})
})

describe('deep tree (stack overflow guard)', () => {
	it('serializeToString on a 5,100-depth tree succeeds without throwing RangeError (GHSA-2v35-w6hq-6mfw)', () => {
		const deepDoc = new DOMImplementation().createDocument(null, 'root')
		let current = deepDoc.documentElement
		for (let i = 0; i < 5100; i++) {
			const child = deepDoc.createElement('n')
			current.appendChild(child)
			current = child
		}
		expect(() => new XMLSerializer().serializeToString(deepDoc.documentElement)).not.toThrow()
	})

	it('parseFromString and serializeToString round-trip a 5,100-depth document (GHSA-2v35-w6hq-6mfw)', () => {
		const xml = '<root>' + '<n>'.repeat(5100) + 'leaf' + '</n>'.repeat(5100) + '</root>'
		const doc = new DOMParser().parseFromString(xml, MIME_TYPE.XML_TEXT)
		expect(new XMLSerializer().serializeToString(doc)).toBe(xml)
	})
})
