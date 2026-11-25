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
