var wows = require('vows');
var assert = require('assert');
var DOMParser = require('xmldom').DOMParser;
var DOMImplementation = require('xmldom').DOMImplementation;
var XMLSerializer = require('xmldom').XMLSerializer;

var INVALID_STATE_ERR = 11;

wows.describe('XML Serializer').addBatch({
  'text node containing "]]>"': function() {
    var doc = new DOMParser().parseFromString('<test/>', 'text/xml');
    doc.documentElement.appendChild(doc.createTextNode('hello ]]> there'));
    console.assert(doc.documentElement.firstChild.toString() == 'hello ]]> there',doc.documentElement.firstChild.toString());
  },
  // SEAL-EXCLUDED: stale expectation: text/html parsing in 0.1.31 adds xmlns="http://www.w3.org/1999/xhtml" to the root, which this expected string predates
  // '<script> element with no children': function() {
  //   var doc = new DOMParser({xmlns:{xmlns:'http://www.w3.org/1999/xhtml'}}).parseFromString('<html2><script></script></html2>', 'text/html');
  //   //console.log(doc.documentElement.firstChild.toString(true))
  //   console.assert(doc.documentElement.firstChild.toString() == '<script></script>');
  // },
}).run();

function createRootDoc() {
  return new DOMImplementation().createDocument(null, 'root', null);
}
// Serializes, then re-parses, and returns true if an <injected> element appears in the tree.
function isInjected(root) {
  var xml = new XMLSerializer().serializeToString(root);
  var reparsed = new DOMParser().parseFromString(xml, 'text/xml');
  return reparsed.getElementsByTagName('injected').length > 0;
}
function assertDOMException(fn, code) {
  var error = null;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  assert.ok(error instanceof Error, 'expected a DOMException with code ' + code);
  assert.equal(error.code, code, String(error));
  return error;
}

wows.describe('XMLSerializer CDATASection serialization').addBatch({
  'serializes a safe CDATASection unchanged': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createCDATASection('safe data'));
    assert.equal(new XMLSerializer().serializeToString(doc.documentElement), '<root><![CDATA[safe data]]></root>');
  },
  'splits a CDATASection whose data contains "]]>"': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    cdata.data = 'foo]]>bar';
    doc.documentElement.appendChild(cdata);
    assert.equal(new XMLSerializer().serializeToString(doc.documentElement), '<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>');
  },
  'splits multiple "]]>" occurrences': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    cdata.data = 'a]]>b]]>c';
    doc.documentElement.appendChild(cdata);
    assert.equal(new XMLSerializer().serializeToString(doc.documentElement), '<root><![CDATA[a]]]]><![CDATA[>b]]]]><![CDATA[>c]]></root>');
  },
  'split output round-trips through DOMParser to equivalent content': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    cdata.data = 'foo]]>bar';
    doc.documentElement.appendChild(cdata);
    var serialized = new XMLSerializer().serializeToString(doc.documentElement);
    var reparsed = new DOMParser().parseFromString(serialized, 'text/xml');
    assert.equal(reparsed.documentElement.textContent, 'foo]]>bar');
  },
  'mutation vector: appendData introduces "]]>" safely': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    doc.documentElement.appendChild(cdata);
    cdata.appendData(']]><injected/>');
    assert.strictEqual(isInjected(doc.documentElement), false);
  },
  'mutation vector: replaceData introduces "]]>" safely': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe data');
    doc.documentElement.appendChild(cdata);
    cdata.replaceData(4, 5, ']]><injected/>');
    assert.strictEqual(isInjected(doc.documentElement), false);
  },
  'mutation vector: .data assignment introduces "]]>" safely': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    doc.documentElement.appendChild(cdata);
    cdata.data = 'evil]]><injected/>';
    assert.strictEqual(isInjected(doc.documentElement), false);
  },
  'mutation vector: .textContent assignment introduces "]]>" safely': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    doc.documentElement.appendChild(cdata);
    cdata.textContent = 'evil]]><injected/>';
    assert.strictEqual(isInjected(doc.documentElement), false);
  },
  'mutation vector: serializing the whole document is safe': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    doc.documentElement.appendChild(cdata);
    cdata.data = 'evil]]><injected/>';
    assert.strictEqual(isInjected(doc), false);
    assert.equal(doc.toString(), '<root><![CDATA[evil]]]]><![CDATA[><injected/>]]></root>');
  },
  'mutation vector: NodeList.toString is safe': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    doc.documentElement.appendChild(cdata);
    cdata.data = 'evil]]><injected/>';
    assert.equal(doc.documentElement.childNodes.toString(), '<![CDATA[evil]]]]><![CDATA[><injected/>]]>');
  },
}).run();

wows.describe('XMLSerializer serializeToString requireWellFormed option').addBatch({
  'CDATA with "]]>" still splits when no options are passed (regression)': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    cdata.data = 'foo]]>bar';
    doc.documentElement.appendChild(cdata);
    assert.equal(new XMLSerializer().serializeToString(doc.documentElement), '<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>');
  },
  'CDATA with "]]>" still splits when options is null (regression)': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    cdata.data = 'foo]]>bar';
    doc.documentElement.appendChild(cdata);
    assert.equal(new XMLSerializer().serializeToString(doc.documentElement, false, null, null), '<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>');
  },
  'CDATA with "]]>" still splits when requireWellFormed is false': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    cdata.data = 'foo]]>bar';
    doc.documentElement.appendChild(cdata);
    assert.equal(new XMLSerializer().serializeToString(doc.documentElement, false, null, {requireWellFormed: false}), '<root><![CDATA[foo]]]]><![CDATA[>bar]]></root>');
  },
  'requireWellFormed: true on a safe CDATA serializes unchanged': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createCDATASection('safe data'));
    assert.equal(new XMLSerializer().serializeToString(doc, false, null, {requireWellFormed: true}), '<root><![CDATA[safe data]]></root>');
  },
  'requireWellFormed: true on CDATA with "]]>" throws': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    cdata.data = 'foo]]>bar';
    doc.documentElement.appendChild(cdata);
    assertDOMException(function() {
      new XMLSerializer().serializeToString(doc, false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'node.toString with requireWellFormed: true on CDATA with "]]>" throws': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    cdata.data = 'foo]]>bar';
    doc.documentElement.appendChild(cdata);
    assertDOMException(function() {
      doc.toString(false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'NodeList.toString with requireWellFormed: true on CDATA with "]]>" throws': function() {
    var doc = createRootDoc();
    var cdata = doc.createCDATASection('safe');
    cdata.data = 'foo]]>bar';
    doc.documentElement.appendChild(cdata);
    assertDOMException(function() {
      doc.documentElement.childNodes.toString(false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
}).run();

// Serializes `root` with requireWellFormed: true and asserts it throws InvalidStateError.
function assertCommentRejected(root) {
  assertDOMException(function() {
    new XMLSerializer().serializeToString(root, {requireWellFormed: true});
  }, INVALID_STATE_ERR);
}
var COMMENT_INJECTION = '--><injected attr="1"/><!--';

wows.describe('XMLSerializer Comment serialization with requireWellFormed').addBatch({
  'default: comment with "-->" in data emits verbatim - no throw': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment('hello-->world'));
    assert.equal(new XMLSerializer().serializeToString(doc), '<root><!--hello-->world--></root>');
  },
  'default: comment with "--" in data emits verbatim - no throw': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment('hello--world'));
    assert.equal(new XMLSerializer().serializeToString(doc), '<root><!--hello--world--></root>');
  },
  'requireWellFormed: true on comment with invalid XML Char (\\x00) throws InvalidStateError': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment('hello' + String.fromCharCode(0) + 'world'));
    assertCommentRejected(doc);
  },
  'requireWellFormed: true on comment with "-->" throws InvalidStateError': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment('hello-->world'));
    assertCommentRejected(doc);
  },
  'requireWellFormed: true on comment with "--" (no "-->") throws InvalidStateError': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment('hello--world'));
    assertCommentRejected(doc);
  },
  'requireWellFormed: true on comment whose data ends with "-" throws InvalidStateError': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment('hello-'));
    assertCommentRejected(doc);
  },
  'requireWellFormed: true on comment with clean data does not throw': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment('clean comment'));
    assert.equal(new XMLSerializer().serializeToString(doc, {requireWellFormed: true}), '<root><!--clean comment--></root>');
  },
  'mutation vector: appendData("-->") then requireWellFormed: true throws InvalidStateError': function() {
    var doc = createRootDoc();
    var comment = doc.createComment('clean');
    doc.documentElement.appendChild(comment);
    comment.appendData('-->');
    assertCommentRejected(doc);
  },
  'PoC: createComment with a comment-breakout payload throws instead of injecting a node': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment(COMMENT_INJECTION));
    assertCommentRejected(doc);
    assertCommentRejected(doc.documentElement);
  },
  'mutation vector: insertData introduces "-->"': function() {
    var doc = createRootDoc();
    var comment = doc.createComment('safe data');
    doc.documentElement.appendChild(comment);
    comment.insertData(4, COMMENT_INJECTION);
    assertCommentRejected(doc);
  },
  'mutation vector: replaceData introduces "-->"': function() {
    var doc = createRootDoc();
    var comment = doc.createComment('safe data');
    doc.documentElement.appendChild(comment);
    comment.replaceData(4, 5, COMMENT_INJECTION);
    assertCommentRejected(doc);
  },
  'mutation vector: .data assignment introduces "-->"': function() {
    var doc = createRootDoc();
    var comment = doc.createComment('safe');
    doc.documentElement.appendChild(comment);
    comment.data = COMMENT_INJECTION;
    assertCommentRejected(doc);
  },
  'mutation vector: .textContent assignment introduces "-->"': function() {
    var doc = createRootDoc();
    var comment = doc.createComment('safe');
    doc.documentElement.appendChild(comment);
    comment.textContent = COMMENT_INJECTION;
    assertCommentRejected(doc);
  },
  'comment nested in an element or a DocumentFragment is checked': function() {
    var doc = createRootDoc();
    var child = doc.createElement('child');
    child.appendChild(doc.createComment(COMMENT_INJECTION));
    doc.documentElement.appendChild(child);
    assertCommentRejected(doc);
    var fragment = doc.createDocumentFragment();
    fragment.appendChild(doc.createComment(COMMENT_INJECTION));
    assertCommentRejected(fragment);
  },
  'options passed as fourth argument: requireWellFormed: true throws': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment(COMMENT_INJECTION));
    assertDOMException(function() {
      new XMLSerializer().serializeToString(doc, false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'node.toString with requireWellFormed: true on a comment with "-->" throws': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment(COMMENT_INJECTION));
    assertDOMException(function() {
      doc.toString(false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'NodeList.toString with requireWellFormed: true on a comment with "-->" throws': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment(COMMENT_INJECTION));
    assertDOMException(function() {
      doc.documentElement.childNodes.toString(false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'requireWellFormed: false or an options-only call keeps the default XML output': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment('hello-->world'));
    assert.equal(new XMLSerializer().serializeToString(doc, {requireWellFormed: false}), '<root><!--hello-->world--></root>');
    assert.equal(new XMLSerializer().serializeToString(doc, false, null, {requireWellFormed: false}), '<root><!--hello-->world--></root>');
  },
  'requireWellFormed: true accepts a well-paired surrogate (character above #xFFFF)': function() {
    var doc = createRootDoc();
    var data = 'smile ' + String.fromCharCode(0xD83D, 0xDE00) + ' end';
    doc.documentElement.appendChild(doc.createComment(data));
    assert.equal(new XMLSerializer().serializeToString(doc, {requireWellFormed: true}), '<root><!--' + data + '--></root>');
  },
  'requireWellFormed: true on comment with a lone surrogate throws InvalidStateError': function() {
    var doc = createRootDoc();
    doc.documentElement.appendChild(doc.createComment('high ' + String.fromCharCode(0xD83D) + ' only'));
    assertCommentRejected(doc);
    var doc2 = createRootDoc();
    doc2.documentElement.appendChild(doc2.createComment('low ' + String.fromCharCode(0xDE00) + ' only'));
    assertCommentRejected(doc2);
  },
  'requireWellFormed: true serializes a parsed document with a clean comment unchanged': function() {
    var doc = new DOMParser().parseFromString('<root><!-- a comment --><a/></root>', 'text/xml');
    assert.equal(new XMLSerializer().serializeToString(doc, {requireWellFormed: true}), '<root><!-- a comment --><a/></root>');
  },
}).run();

// Builds a document with a DocumentType created from the given fields and a <root/> element.
function createDoctypeDoc(name, publicId, systemId) {
  var doctype = new DOMImplementation().createDocumentType(name, publicId, systemId);
  return new DOMImplementation().createDocument(null, 'root', doctype);
}
// Serializes `root` with requireWellFormed: true and asserts it throws InvalidStateError.
function assertDoctypeRejected(root) {
  assertDOMException(function() {
    new XMLSerializer().serializeToString(root, {requireWellFormed: true});
  }, INVALID_STATE_ERR);
}
// Each payload closes the DOCTYPE declaration early and adds an <injected/> sibling element.
var DOCTYPE_NAME_INJECTION = 'root><injected/';
var DOCTYPE_PUBID_INJECTION = '"x"><injected/';
var DOCTYPE_SYSID_INJECTION = '"x"><injected/';
var DOCTYPE_SUBSET_INJECTION = ']><injected/><!--';

wows.describe('XMLSerializer DocumentType serialization with requireWellFormed').addBatch({
  'default: DocumentType with invalid publicId serializes verbatim - no throw': function() {
    var doc = createDoctypeDoc('name', '"invalid<char"', '');
    assert.equal(new XMLSerializer().serializeToString(doc), '<!DOCTYPE name PUBLIC "invalid<char"><root/>');
  },
  'default: injection payloads in every DocumentType field are emitted verbatim (the attack surface)': function() {
    assert.equal(new XMLSerializer().serializeToString(createDoctypeDoc(DOCTYPE_NAME_INJECTION, '', '')), '<!DOCTYPE root><injected/><root/>');
    assert.equal(new XMLSerializer().serializeToString(createDoctypeDoc('root', DOCTYPE_PUBID_INJECTION, '')), '<!DOCTYPE root PUBLIC "x"><injected/><root/>');
    assert.equal(new XMLSerializer().serializeToString(createDoctypeDoc('root', '', DOCTYPE_SYSID_INJECTION)), '<!DOCTYPE root SYSTEM "x"><injected/><root/>');
    var doc = createDoctypeDoc('root', '', '');
    doc.doctype.internalSubset = DOCTYPE_SUBSET_INJECTION;
    assert.equal(new XMLSerializer().serializeToString(doc), '<!DOCTYPE root []><injected/><!--]><root/>');
  },
  'requireWellFormed: true on DocumentType with invalid publicId throws InvalidStateError': function() {
    var doc = createDoctypeDoc('name', '"invalid<char"', '');
    assertDOMException(function() {
      new XMLSerializer().serializeToString(doc, false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'requireWellFormed: true on DocumentType with invalid systemId throws InvalidStateError': function() {
    var doc = createDoctypeDoc('name', '', 'no-quotes-around-this');
    assertDOMException(function() {
      new XMLSerializer().serializeToString(doc, false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'requireWellFormed: true on DocumentType with "]>" in internalSubset throws InvalidStateError': function() {
    var doc = createDoctypeDoc('name', '', '');
    doc.doctype.internalSubset = ']><injected/>';
    assertDOMException(function() {
      new XMLSerializer().serializeToString(doc, false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'requireWellFormed: true on DocumentType with valid fields does not throw': function() {
    var doc = createDoctypeDoc('html', '"-//W3C//DTD HTML 4.01//EN"', '"http://www.w3.org/TR/html4/strict.dtd"');
    assert.equal(
      new XMLSerializer().serializeToString(doc, false, null, {requireWellFormed: true}),
      '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd"><root/>'
    );
  },
  'direct property write: setting invalid publicId then requireWellFormed: true throws InvalidStateError': function() {
    var doc = createDoctypeDoc('name', '"-//W3C//DTD//EN"', '');
    doc.doctype.publicId = '"invalid<char"';
    assertDOMException(function() {
      new XMLSerializer().serializeToString(doc, false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'default: DocumentType with invalid name serializes verbatim - no throw': function() {
    var doc = createDoctypeDoc('html', '', '');
    doc.doctype.name = 'html><script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script';
    var out = new XMLSerializer().serializeToString(doc);
    assert.ok(out.indexOf('<!DOCTYPE html><script') !== -1, out);
  },
  'requireWellFormed: true on DocumentType with ">" in name throws InvalidStateError': function() {
    var doc = createDoctypeDoc('html', '', '');
    doc.doctype.name = 'html><script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script';
    assertDOMException(function() {
      new XMLSerializer().serializeToString(doc, false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'requireWellFormed: true on DocumentType with whitespace in name throws InvalidStateError': function() {
    var doc = createDoctypeDoc('html', '', '');
    doc.doctype.name = 'ht ml';
    assertDOMException(function() {
      new XMLSerializer().serializeToString(doc, false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'PoC: name breakout passed to createDocumentType throws instead of injecting an element': function() {
    assertDoctypeRejected(createDoctypeDoc(DOCTYPE_NAME_INJECTION, '', ''));
  },
  'PoC: publicId quoting breakout throws instead of injecting an element or a fake system id': function() {
    assertDoctypeRejected(createDoctypeDoc('root', DOCTYPE_PUBID_INJECTION, ''));
    assertDoctypeRejected(createDoctypeDoc('root', '"pub" "http://evil.example/x.dtd"', ''));
    assertDoctypeRejected(createDoctypeDoc('root', "'it's'", ''));
  },
  'PoC: systemId ">" breakout throws instead of injecting an element': function() {
    assertDoctypeRejected(createDoctypeDoc('root', '', DOCTYPE_SYSID_INJECTION));
    assertDoctypeRejected(createDoctypeDoc('root', '', 'x><injected/'));
    assertDoctypeRejected(createDoctypeDoc('root', '"pub"', DOCTYPE_SYSID_INJECTION));
  },
  'PoC: internalSubset breakout throws, also when whitespace separates "]" and ">"': function() {
    var doc = createDoctypeDoc('root', '', '');
    doc.doctype.internalSubset = DOCTYPE_SUBSET_INJECTION;
    assertDoctypeRejected(doc);
    doc.doctype.internalSubset = '] ><injected/><!--';
    assertDoctypeRejected(doc);
    doc.doctype.internalSubset = ']\n\t><injected/><!--';
    assertDoctypeRejected(doc);
  },
  'line terminator after a valid literal does not bypass the publicId, systemId and name checks': function() {
    var LS = String.fromCharCode(0x2028);
    assertDoctypeRejected(createDoctypeDoc('html', '"valid pubid"\n"><!ENTITY xxe SYSTEM "file:///etc/passwd">', ''));
    assertDoctypeRejected(createDoctypeDoc('html', '"valid pubid"\r"><injected/', ''));
    assertDoctypeRejected(createDoctypeDoc('html', '"valid pubid"' + LS + '"><injected/', ''));
    assertDoctypeRejected(createDoctypeDoc('html', '', '"valid"\n><injected/'));
    assertDoctypeRejected(createDoctypeDoc('html', '', '"valid"' + LS + '><injected/'));
    assertDoctypeRejected(createDoctypeDoc('html\n><injected/', '', ''));
  },
  'every serialization entry point applies the DocumentType checks': function() {
    var doc = createDoctypeDoc(DOCTYPE_NAME_INJECTION, '', '');
    assertDOMException(function() {
      doc.toString(false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
    assertDOMException(function() {
      doc.childNodes.toString(false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
    assertDOMException(function() {
      doc.doctype.toString(false, null, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
    assertDOMException(function() {
      new XMLSerializer().serializeToString(doc.doctype, {requireWellFormed: true});
    }, INVALID_STATE_ERR);
  },
  'requireWellFormed: true accepts valid names, literals and internal subsets': function() {
    var serializer = new XMLSerializer();
    var options = {requireWellFormed: true};
    assert.equal(serializer.serializeToString(createDoctypeDoc('root', '', ''), options), '<!DOCTYPE root><root/>');
    assert.equal(serializer.serializeToString(createDoctypeDoc('a:b-c.d_1', '', ''), options), '<!DOCTYPE a:b-c.d_1><root/>');
    var astralName = 'x' + String.fromCharCode(0xD840, 0xDC00);
    assert.equal(serializer.serializeToString(createDoctypeDoc(astralName, '', ''), options), '<!DOCTYPE ' + astralName + '><root/>');
    assert.equal(serializer.serializeToString(createDoctypeDoc('root', "'-//X//it is//EN'", ''), options), "<!DOCTYPE root PUBLIC '-//X//it is//EN'><root/>");
    assert.equal(serializer.serializeToString(createDoctypeDoc('root', '"it\'s"', ''), options), '<!DOCTYPE root PUBLIC "it\'s"><root/>');
    assert.equal(serializer.serializeToString(createDoctypeDoc('root', '', '"a \'b\' <c>"'), options), '<!DOCTYPE root SYSTEM "a \'b\' <c>"><root/>');
    assert.equal(serializer.serializeToString(createDoctypeDoc('root', '', "'a \"b\"'"), options), "<!DOCTYPE root SYSTEM 'a \"b\"'><root/>");
    assert.equal(serializer.serializeToString(createDoctypeDoc('root', '', '.'), options), '<!DOCTYPE root><root/>');
    var doc = createDoctypeDoc('root', '', '');
    doc.doctype.internalSubset = '<!ENTITY a "b">';
    assert.equal(serializer.serializeToString(doc, options), '<!DOCTYPE root [<!ENTITY a "b">]><root/>');
  },
  'requireWellFormed: true rejects an empty name or a name with a lone surrogate': function() {
    assertDoctypeRejected(createDoctypeDoc('', '', ''));
    assertDoctypeRejected(createDoctypeDoc('x' + String.fromCharCode(0xD840), '', ''));
    assertDoctypeRejected(createDoctypeDoc('1abc', '', ''));
  },
  'requireWellFormed: true serializes a parsed document with a DOCTYPE unchanged': function() {
    var serializer = new XMLSerializer();
    var xml = '<!DOCTYPE root PUBLIC "-//X//DTD Y 1.0//EN" "http://example.com/y.dtd"><root/>';
    var doc = new DOMParser().parseFromString(xml, 'text/xml');
    assert.equal(serializer.serializeToString(doc, {requireWellFormed: true}), xml);
    doc = new DOMParser().parseFromString('<!DOCTYPE root><root/>', 'text/xml');
    assert.equal(serializer.serializeToString(doc, {requireWellFormed: true}), '<!DOCTYPE root><root/>');
  },
}).run();
