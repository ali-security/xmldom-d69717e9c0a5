var wows = require('vows');
var assert = require('assert');
var DOMParser = require('xmldom').DOMParser;
var DOMImplementation = require('xmldom').DOMImplementation;

var CDATA_SECTION_NODE = 4;
var INVALID_CHARACTER_ERR = 5;

function assertDOMException(fn, code){
	var error = null;
	try{
		fn();
	}catch(e){
		error = e;
	}
	assert.ok(error instanceof Error, 'expected a DOMException with code ' + code);
	assert.equal(error.code, code, String(error));
	return error;
}
function createDoc(){
	return new DOMImplementation().createDocument(null, 'xml');
}

wows.describe('Document.prototype.createCDATASection').addBatch({
	'throws InvalidCharacterError when data is exactly "]]>"': function(){
		var doc = createDoc();
		assertDOMException(function(){
			doc.createCDATASection(']]>');
		}, INVALID_CHARACTER_ERR);
	},
	'throws InvalidCharacterError when data starts with safe content then contains "]]>"': function(){
		var doc = createDoc();
		assertDOMException(function(){
			doc.createCDATASection('safe]]>data');
		}, INVALID_CHARACTER_ERR);
	},
	'throws InvalidCharacterError when data contains multiple "]]>" occurrences': function(){
		var doc = createDoc();
		assertDOMException(function(){
			doc.createCDATASection('before]]>after]]>after');
		}, INVALID_CHARACTER_ERR);
	},
	'does not throw when data is safe': function(){
		var doc = createDoc();
		var cdata = doc.createCDATASection('safe');
		assert.equal(cdata.nodeType, CDATA_SECTION_NODE);
		assert.equal(cdata.data, 'safe');
		assert.strictEqual(cdata.ownerDocument, doc);
	},
	'does not throw when data is empty string': function(){
		var doc = createDoc();
		var cdata = doc.createCDATASection('');
		assert.equal(cdata.data, '');
	},
	'does not throw when data contains "]]" or ">" separately': function(){
		var doc = createDoc();
		assert.equal(doc.createCDATASection('a]]b>c').data, 'a]]b>c');
		assert.equal(doc.createCDATASection(']] >').data, ']] >');
	},
	'parsing XML containing a CDATA section does not throw': function(){
		var doc = new DOMParser().parseFromString('<root><![CDATA[some data]]></root>', 'text/xml');
		var cdata = doc.documentElement.firstChild;
		assert.equal(cdata.nodeType, CDATA_SECTION_NODE);
		assert.equal(cdata.data, 'some data');
	}
}).run();
