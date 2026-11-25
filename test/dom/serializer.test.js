'use strict'

const { DOMParser, XMLSerializer } = require('../../')

const MIME_TYPE = {
	XML_TEXT: 'text/xml',
}

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
