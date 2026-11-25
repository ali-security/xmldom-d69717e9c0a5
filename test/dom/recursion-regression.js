var wows = require('vows');
var assert = require('assert');
var DOMParser = require('xmldom').DOMParser;
var DOMImplementation = require('xmldom').DOMImplementation;
var XMLSerializer = require('xmldom').XMLSerializer;

// Must exceed the depth at which a recursive tree walk overflows the default call stack,
// so that re-introducing any recursive tree walk causes these tests to fail.
// The first vow checks that a minimal recursive function overflows within this depth;
// every tree walk uses at least one stack frame per level of the tree.
var DEEP_TREE_DEPTH = 100000;

function repeat(str, count) {
	return new Array(count + 1).join(str);
}

// '<root><n><n>...leaf...</n></n></root>' with DEEP_TREE_DEPTH nested <n> elements
function deepXml() {
	return '<root>' + repeat('<n>', DEEP_TREE_DEPTH) + 'leaf' + repeat('</n>', DEEP_TREE_DEPTH) + '</root>';
}

// builds the tree of deepXml() through the DOM API, returns the document and the deepest element
function buildDeepTree() {
	var doc = new DOMImplementation().createDocument(null, 'root', null);
	var current = doc.documentElement;
	for (var i = 0; i < DEEP_TREE_DEPTH; i++) {
		var child = doc.createElementNS(null, 'n');
		current.appendChild(child);
		current = child;
	}
	current.appendChild(doc.createTextNode('leaf'));
	return { doc: doc, leaf: current };
}

wows.describe('deep tree stack overflow guard (GHSA-2v35-w6hq-6mfw)').addBatch({
	'recursive function overflows within DEEP_TREE_DEPTH frames': function() {
		function throwsAtLevel(lvl) {
			var nextLvl = (lvl || 0) + 1;
			try {
				return throwsAtLevel(nextLvl);
			} catch (e) {
				return nextLvl;
			}
		}
		var level = throwsAtLevel();
		assert.ok(level <= DEEP_TREE_DEPTH, 'recursion overflowed only at level ' + level);
	},
	'DOMParser.parseFromString (normalize) on a deeply nested document': function() {
		var doc = new DOMParser().parseFromString(deepXml(), 'text/xml');
		assert.equal(doc.documentElement.tagName, 'root');
		assert.equal(doc.documentElement.textContent, 'leaf');
	},
	'parse and serialize a deeply nested document round-trips': function() {
		var xml = deepXml();
		var doc = new DOMParser().parseFromString(xml, 'text/xml');
		assert.equal(new XMLSerializer().serializeToString(doc), xml);
	},
	'normalize merges adjacent text nodes at the bottom of a deep tree': function() {
		var tree = buildDeepTree();
		tree.leaf.appendChild(tree.doc.createTextNode('-a'));
		tree.leaf.appendChild(tree.doc.createTextNode('-b'));
		tree.doc.normalize();
		assert.equal(tree.leaf.childNodes.length, 1);
		assert.equal(tree.leaf.firstChild.data, 'leaf-a-b');
	},
	'getElementsByTagName': function() {
		var tree = buildDeepTree();
		var list = tree.doc.documentElement.getElementsByTagName('n');
		assert.equal(list.length, DEEP_TREE_DEPTH);
		assert.strictEqual(list.item(DEEP_TREE_DEPTH - 1), tree.leaf);
	},
	'getElementsByTagNameNS': function() {
		var tree = buildDeepTree();
		assert.equal(tree.doc.getElementsByTagNameNS('*', 'n').length, DEEP_TREE_DEPTH);
	},
	'getElementById': function() {
		var tree = buildDeepTree();
		tree.leaf.setAttribute('id', 'deepest');
		assert.strictEqual(tree.doc.getElementById('deepest'), tree.leaf);
		assert.strictEqual(tree.doc.getElementById('missing'), null);
	},
	'textContent': function() {
		var tree = buildDeepTree();
		assert.equal(tree.doc.documentElement.textContent, 'leaf');
	},
	'XMLSerializer.serializeToString': function() {
		var tree = buildDeepTree();
		assert.equal(new XMLSerializer().serializeToString(tree.doc), deepXml());
	},
	'Node.toString and NodeList.toString': function() {
		var tree = buildDeepTree();
		assert.equal(tree.doc.documentElement.toString(), deepXml());
		assert.equal(tree.doc.childNodes.toString(), deepXml());
	},
	'cloneNode(true)': function() {
		var tree = buildDeepTree();
		var clone = tree.doc.documentElement.cloneNode(true);
		assert.notStrictEqual(clone, tree.doc.documentElement);
		assert.equal(clone.toString(), deepXml());
	},
	'Document cloneNode(true)': function() {
		var tree = buildDeepTree();
		var clone = tree.doc.cloneNode(true);
		assert.equal(clone.documentElement.tagName, 'root');
		assert.equal(clone.toString(), deepXml());
	},
	'importNode(node, true)': function() {
		var tree = buildDeepTree();
		var destDoc = new DOMImplementation().createDocument(null, 'dest', null);
		var imported = destDoc.importNode(tree.doc.documentElement, true);
		assert.strictEqual(imported.ownerDocument, destDoc);
		assert.strictEqual(imported.parentNode, null);
		assert.equal(imported.toString(), deepXml());
	}
}).run();

wows.describe('iterative serializer keeps the output of the recursive one').addBatch({
	'children of an HTML script element are written raw': function() {
		var htmlns = 'http://www.w3.org/1999/xhtml';
		var doc = new DOMImplementation().createDocument(htmlns, 'html', null);
		var script = doc.createElementNS(htmlns, 'script');
		doc.documentElement.appendChild(script);
		script.appendChild(doc.createTextNode('a < b'));
		script.appendChild(doc.createElementNS(htmlns, 'b'));
		assert.equal(
			new XMLSerializer().serializeToString(doc),
			'<html xmlns="http://www.w3.org/1999/xhtml"><script>a < b<b></b></script></html>'
		);
	},
	'nodeFilter can replace a node by a string or drop it': function() {
		var doc = new DOMParser().parseFromString('<r><a x="1">t<!--c--></a><b/></r>', 'text/xml');
		var xml = new XMLSerializer().serializeToString(doc, false, function(node) {
			if (node.nodeType === 8) {
				return null;
			}
			if (node.nodeName === 'b') {
				return '<B/>';
			}
			return node;
		});
		assert.equal(xml, '<r><a x="1">t</a><B/></r>');
	},
	'nested elements, attributes and text keep their order': function() {
		var xml = '<r a="1"><x>1<y b="2">2</y>3</x><z/>4</r>';
		var doc = new DOMParser().parseFromString(xml, 'text/xml');
		assert.equal(new XMLSerializer().serializeToString(doc), xml);
	}
}).run();
