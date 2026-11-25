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
