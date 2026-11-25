var wows = require('vows');
var assert = require('assert');
var DOMParser = require('xmldom').DOMParser;
var DOMImplementation = require('xmldom').DOMImplementation;

var ELEMENT_NODE = 1;
var DOCUMENT_TYPE_NODE = 10;
var HIERARCHY_REQUEST_ERR = 3;
var NOT_FOUND_ERR = 8;

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
function countNodes(nodeList, nodeType){
	var count = 0;
	for(var i = 0; i < nodeList.length; i++){
		if(nodeList.item(i).nodeType === nodeType){
			count++;
		}
	}
	return count;
}
function parseWithErrors(source){
	var errors = [];
	function collect(msg){
		errors.push(msg);
	}
	var doc = new DOMParser({
		locator: {},
		errorHandler: {warning: collect, error: collect, fatalError: collect}
	}).parseFromString(source, 'text/xml');
	return {doc: doc, errors: errors};
}
function hasHierarchyError(errors){
	for(var i = 0; i < errors.length; i++){
		if(/Hierarchy request error/.test(errors[i])){
			return true;
		}
	}
	return false;
}

wows.describe('Document pre-insertion validity').addBatch({
	'insertBefore should insert the first element and set documentElement': function(){
		var doc = new DOMImplementation().createDocument(null, '');
		assert.equal(doc.childNodes.length, 0);
		assert.strictEqual(doc.documentElement, null);
		var root = doc.createElement('root');
		doc.insertBefore(root);
		assert.strictEqual(doc.documentElement, root);
		assert.equal(doc.childNodes.length, 1);
		assert.strictEqual(doc.childNodes.item(0), root);
	},
	'insertBefore should prevent inserting a second element': function(){
		var doc = new DOMImplementation().createDocument(null, '');
		var root = doc.createElement('root');
		var second = doc.createElement('second');
		doc.insertBefore(root);
		assertDOMException(function(){ doc.insertBefore(second); }, HIERARCHY_REQUEST_ERR);
		assert.strictEqual(doc.documentElement, root);
		assert.equal(doc.childNodes.length, 1);
		assert.strictEqual(second.parentNode, null);
	},
	'appendChild should prevent appending a second element': function(){
		var doc = new DOMImplementation().createDocument(null, 'root');
		var second = doc.createElement('second');
		assertDOMException(function(){ doc.appendChild(second); }, HIERARCHY_REQUEST_ERR);
		assert.equal(doc.documentElement.tagName, 'root');
		assert.equal(doc.childNodes.length, 1);
		assert.equal(doc.toString(), '<root/>');
	},
	'insertBefore should prevent inserting an element before a doctype': function(){
		var impl = new DOMImplementation();
		var doctype = impl.createDocumentType('DT');
		var doc = impl.createDocument(null, '', doctype);
		assert.equal(doc.childNodes.length, 1);
		var root = doc.createElement('root');
		assertDOMException(function(){ doc.insertBefore(root, doctype); }, HIERARCHY_REQUEST_ERR);
		assert.strictEqual(doc.documentElement, null);
		assert.equal(doc.childNodes.length, 1);
		assert.strictEqual(root.parentNode, null);
	},
	'insertBefore should prevent inserting a second doctype': function(){
		var impl = new DOMImplementation();
		var doctype = impl.createDocumentType('DT');
		var doctype2 = impl.createDocumentType('DT2');
		var doc = impl.createDocument(null, '', doctype);
		assert.equal(doc.childNodes.length, 1);
		assertDOMException(function(){ doc.insertBefore(doctype2); }, HIERARCHY_REQUEST_ERR);
		assert.equal(doc.childNodes.length, 1);
	},
	'insertBefore should prevent inserting a doctype after an element': function(){
		var impl = new DOMImplementation();
		var doc = impl.createDocument(null, '');
		var root = doc.createElement('root');
		doc.insertBefore(root);
		var doctype = impl.createDocumentType('DT');
		assert.equal(doc.childNodes.length, 1);
		assertDOMException(function(){ doc.insertBefore(doctype); }, HIERARCHY_REQUEST_ERR);
		assert.equal(doc.childNodes.length, 1);
	},
	'insertBefore should prevent inserting before a child which is not a child of parent': function(){
		var doc = new DOMImplementation().createDocument(null, '');
		var root = doc.createElement('root');
		var withoutParent = doc.createElement('second');
		assertDOMException(function(){ doc.insertBefore(root, withoutParent); }, NOT_FOUND_ERR);
		assert.strictEqual(doc.documentElement, null);
		assert.equal(doc.childNodes.length, 0);
		assert.strictEqual(root.parentNode, null);
	},
	'appendChild should prevent adding a second element through a fragment': function(){
		var doc = new DOMImplementation().createDocument(null, 'root');
		var fragment = doc.createDocumentFragment();
		fragment.appendChild(doc.createElement('second'));
		assertDOMException(function(){ doc.appendChild(fragment); }, HIERARCHY_REQUEST_ERR);
		assert.equal(countNodes(doc.childNodes, ELEMENT_NODE), 1);
		assert.equal(doc.toString(), '<root/>');

		var empty = new DOMImplementation().createDocument(null, '');
		var twoElements = empty.createDocumentFragment();
		twoElements.appendChild(empty.createElement('a'));
		twoElements.appendChild(empty.createElement('b'));
		assertDOMException(function(){ empty.appendChild(twoElements); }, HIERARCHY_REQUEST_ERR);
		assert.equal(countNodes(empty.childNodes, ELEMENT_NODE), 1);
	},
	'insertBefore should still allow comments, processing instructions and CDATA around the root element': function(){
		var doc = new DOMImplementation().createDocument(null, 'root');
		doc.insertBefore(doc.createComment('c'), doc.documentElement);
		doc.appendChild(doc.createProcessingInstruction('pi', 'data'));
		var root = doc.documentElement;
		var fragment = doc.createDocumentFragment();
		fragment.appendChild(doc.createCDATASection('cdata'));
		root.insertBefore(doc.createCDATASection('first'), null);
		root.appendChild(fragment);
		assert.equal(doc.childNodes.length, 3);
		assert.equal(doc.toString(), '<!--c--><root><![CDATA[first]]><![CDATA[cdata]]></root><?pi data?>');
	}
}).addBatch({
	'replaceChild should remove the only element and add the new one': function(){
		var doc = new DOMImplementation().createDocument('', 'xml');
		var initialFirstChild = doc.firstChild;
		var replacement = doc.createElement('replaced');

		doc.replaceChild(replacement, doc.firstChild);

		assert.equal(doc.childNodes.length, 1);
		assert.strictEqual(initialFirstChild.parentNode, null);
		assert.strictEqual(doc.documentElement, replacement);
		assert.equal(doc.toString(), '<replaced/>');
	},
	'replaceChild should prevent replacing a non element child with a second element': function(){
		var doc = new DOMImplementation().createDocument('', 'xml');
		var comment = doc.createComment('just a comment');
		doc.appendChild(comment);
		var second = doc.createElement('second');

		assertDOMException(function(){ doc.replaceChild(second, comment); }, HIERARCHY_REQUEST_ERR);

		assert.equal(countNodes(doc.childNodes, ELEMENT_NODE), 1);
		assert.strictEqual(comment.parentNode, doc);
		assert.strictEqual(second.parentNode, null);
		assert.equal(doc.documentElement.tagName, 'xml');
	},
	'replaceChild should prevent replacing a child after the element with a doctype': function(){
		var impl = new DOMImplementation();
		var doc = impl.createDocument('', 'xml');
		var comment = doc.createComment('just a comment');
		doc.appendChild(comment);

		assertDOMException(function(){ doc.replaceChild(impl.createDocumentType('DT'), comment); }, HIERARCHY_REQUEST_ERR);

		assert.equal(countNodes(doc.childNodes, DOCUMENT_TYPE_NODE), 0);
		assert.strictEqual(comment.parentNode, doc);
	},
	'removeChild should remove all connections to node': function(){
		var doc = new DOMImplementation().createDocument('', 'xml');
		doc.insertBefore(doc.createComment('just a comment'), doc.firstChild);
		assert.equal(doc.childNodes.length, 2);
		var initialElement = doc.firstChild;

		doc.removeChild(initialElement);

		assert.strictEqual(initialElement.parentNode, null);
		assert.strictEqual(initialElement.nextSibling, null);
		assert.equal(doc.childNodes.length, 1);
	},
	'removeChild of the root element should allow adding a new root element': function(){
		var doc = new DOMImplementation().createDocument('', 'xml');
		var initialElement = doc.documentElement;

		doc.removeChild(initialElement);
		assert.equal(doc.childNodes.length, 0);
		assert.strictEqual(doc.documentElement, null);

		var replacement = doc.createElement('replacement');
		doc.appendChild(replacement);
		assert.equal(doc.childNodes.length, 1);
		assert.strictEqual(doc.documentElement, replacement);
		assertDOMException(function(){ doc.appendChild(initialElement); }, HIERARCHY_REQUEST_ERR);
		assert.equal(doc.toString(), '<replacement/>');
	}
}).addBatch({
	'parseFromString should report an error for a second top level element': function(){
		var result = parseWithErrors('<doc/><doc/>');
		assert.ok(hasHierarchyError(result.errors), JSON.stringify(result.errors));
		assert.equal(countNodes(result.doc.childNodes, ELEMENT_NODE), 1);
		assert.equal(result.doc.documentElement.tagName, 'doc');
		assert.equal(result.doc.toString().split('<doc/>').length, 2, result.doc.toString());
	},
	'parseFromString should report an error for a second top level element on the next line': function(){
		var result = parseWithErrors('<doc/>\n<doc>');
		assert.ok(hasHierarchyError(result.errors), JSON.stringify(result.errors));
		assert.equal(countNodes(result.doc.childNodes, ELEMENT_NODE), 1);
		assert.equal(result.doc.documentElement.tagName, 'doc');
	},
	'parseFromString should report an error for sibling top level elements with content': function(){
		var result = parseWithErrors('<root a="1"><child/></root><evil a="2"><child/></evil>');
		assert.ok(hasHierarchyError(result.errors), JSON.stringify(result.errors));
		assert.equal(countNodes(result.doc.childNodes, ELEMENT_NODE), 1);
		assert.equal(result.doc.documentElement.tagName, 'root');
		assert.equal(result.doc.getElementsByTagName('evil').length, 0);
	},
	'parseFromString should report an error for a doctype after the root element': function(){
		var result = parseWithErrors('<doc/><!DOCTYPE doc>');
		assert.ok(hasHierarchyError(result.errors), JSON.stringify(result.errors));
		assert.equal(countNodes(result.doc.childNodes, DOCUMENT_TYPE_NODE), 0);
		assert.equal(countNodes(result.doc.childNodes, ELEMENT_NODE), 1);
	},
	'parseFromString should report an error for a second doctype': function(){
		var result = parseWithErrors('<!DOCTYPE doc><!DOCTYPE doc><doc/>');
		assert.ok(hasHierarchyError(result.errors), JSON.stringify(result.errors));
		assert.equal(countNodes(result.doc.childNodes, DOCUMENT_TYPE_NODE), 1);
	},
	'parseFromString should accept a well-formed document': function(){
		var source = '<?xml version="1.0"?><!DOCTYPE doc><!-- c --><doc><![CDATA[x]]></doc><!-- d -->';
		var result = parseWithErrors(source);
		assert.deepEqual(result.errors, []);
		assert.equal(countNodes(result.doc.childNodes, ELEMENT_NODE), 1);
		assert.equal(countNodes(result.doc.childNodes, DOCUMENT_TYPE_NODE), 1);
		assert.equal(result.doc.documentElement.tagName, 'doc');
	},
	'sibling elements inside the root element': function(){
		var actual = new DOMParser().parseFromString('<xml><book></book><title>Harry Potter</title></xml>', 'text/xml').toString();
		assert.equal(actual, '<xml><book/><title>Harry Potter</title></xml>');
	}
}).run();
