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
