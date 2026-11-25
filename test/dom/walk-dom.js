var wows = require('vows');
var assert = require('assert');
var DOMImplementation = require('xmldom').DOMImplementation;
var walkDOM = require('xmldom/dom').walkDOM;

/**
 * Build a small DOM tree for testing:
 *
 *   root (Element)
 *     childA (Element)
 *       grandchildA1 (Element)
 *       grandchildA2 (Element)
 *     childB (Element)
 *       grandchildB1 (Element)
 */
function buildTree() {
	var doc = new DOMImplementation().createDocument(null, 'root', null);
	var root = doc.documentElement;

	var childA = doc.createElement('childA');
	root.appendChild(childA);
	var grandchildA1 = doc.createElement('grandchildA1');
	childA.appendChild(grandchildA1);
	var grandchildA2 = doc.createElement('grandchildA2');
	childA.appendChild(grandchildA2);
	var childB = doc.createElement('childB');
	root.appendChild(childB);
	var grandchildB1 = doc.createElement('grandchildB1');
	childB.appendChild(grandchildB1);

	return { doc: doc, root: root, childA: childA, childB: childB };
}

wows.describe('walkDOM').addBatch({
	'pre-order entry: calls enter on parent before children': function() {
		var tree = buildTree();
		var visited = [];
		walkDOM(tree.root, null, {
			enter: function(node) {
				visited.push(node.nodeName);
				// Descend into root so childA/childB are visited, but skip grandchildren
				if (node === tree.root) return 'ctx';
				return null;
			}
		});
		// root entered first; childA and childB entered; grandchildren skipped
		assert.deepEqual(visited, ['root', 'childA', 'childB']);
	},
	'pre-order entry: visits all nodes in depth-first pre-order when enter returns a truthy context': function() {
		var tree = buildTree();
		var visited = [];
		walkDOM(tree.root, 'ctx', {
			enter: function(node) {
				visited.push(node.nodeName);
				return 'ctx';
			}
		});
		assert.deepEqual(visited, ['root', 'childA', 'grandchildA1', 'grandchildA2', 'childB', 'grandchildB1']);
	},
	'post-order exit: calls exit on a node after all its children have been exited': function() {
		var tree = buildTree();
		var log = [];
		walkDOM(tree.root, 'ctx', {
			enter: function(node) {
				log.push('enter:' + node.nodeName);
				return 'ctx';
			},
			exit: function(node) {
				log.push('exit:' + node.nodeName);
			}
		});
		assert.deepEqual(log, [
			'enter:root',
			'enter:childA',
			'enter:grandchildA1',
			'exit:grandchildA1',
			'enter:grandchildA2',
			'exit:grandchildA2',
			'exit:childA',
			'enter:childB',
			'enter:grandchildB1',
			'exit:grandchildB1',
			'exit:childB',
			'exit:root'
		]);
	},
	'post-order exit: passes the context returned by enter to exit': function() {
		var doc = new DOMImplementation().createDocument(null, 'root', null);
		var root = doc.documentElement;
		root.appendChild(doc.createElement('child'));

		var exitContexts = [];
		walkDOM(root, 0, {
			enter: function(node, ctx) {
				return ctx + 1;
			},
			exit: function(node, ctx) {
				exitContexts.push({ name: node.nodeName, ctx: ctx });
			}
		});
		// root enter gets ctx=0, returns 1; child enter gets ctx=1, returns 2
		// child exit gets ctx=2; root exit gets ctx=1
		assert.deepEqual(exitContexts, [
			{ name: 'child', ctx: 2 },
			{ name: 'root', ctx: 1 }
		]);
	},
	'context propagation: each child receives the return value of its parent enter': function() {
		var tree = buildTree();
		var receivedCtx = {};
		walkDOM(tree.root, 0, {
			enter: function(node, ctx) {
				receivedCtx[node.nodeName] = ctx;
				return ctx + 1;
			}
		});
		assert.deepEqual(receivedCtx, {
			root: 0,
			childA: 1,
			grandchildA1: 2,
			grandchildA2: 2,
			childB: 1,
			grandchildB1: 2
		});
	},
	'STOP sentinel: returning walkDOM.STOP from enter aborts the entire traversal immediately': function() {
		var tree = buildTree();
		var visited = [];
		var result = walkDOM(tree.root, null, {
			enter: function(node) {
				visited.push(node.nodeName);
				if (node.nodeName === 'childA') {
					return walkDOM.STOP;
				}
				return 'ctx';
			},
			exit: function(node) {
				visited.push('exit:' + node.nodeName);
			}
		});
		// root and childA entered; traversal stops at childA: no children of childA,
		// no siblings (childB), no exit calls
		assert.deepEqual(visited, ['root', 'childA']);
		assert.strictEqual(result, walkDOM.STOP);
	},
	'skip children: returning null from enter skips children but continues with siblings': function() {
		var tree = buildTree();
		var visited = [];
		walkDOM(tree.root, null, {
			enter: function(node) {
				visited.push(node.nodeName);
				if (node.nodeName === 'childA') {
					return null; // skip grandchildA1, grandchildA2
				}
				return 'ctx';
			}
		});
		assert.deepEqual(visited, ['root', 'childA', 'childB', 'grandchildB1']);
	},
	'skip children: returning undefined from enter skips children but continues with siblings': function() {
		var tree = buildTree();
		var visited = [];
		walkDOM(tree.root, null, {
			enter: function(node) {
				visited.push(node.nodeName);
				if (node.nodeName === 'childA') {
					return undefined; // skip grandchildA1, grandchildA2
				}
				return 'ctx';
			}
		});
		assert.deepEqual(visited, ['root', 'childA', 'childB', 'grandchildB1']);
	},
	'skip children: exit is still called for a node whose children are skipped': function() {
		var tree = buildTree();
		var exited = [];
		walkDOM(tree.root, null, {
			enter: function(node) {
				return node === tree.root ? 'ctx' : null;
			},
			exit: function(node, ctx) {
				exited.push(node.nodeName + ':' + ctx);
			}
		});
		assert.deepEqual(exited, ['childA:null', 'childB:null', 'root:ctx']);
	},
	'enter modifies the child list: walker visits a child added by enter before returning': function() {
		var doc = new DOMImplementation().createDocument(null, 'root', null);
		var root = doc.documentElement;
		root.appendChild(doc.createElement('original'));

		var visited = [];
		walkDOM(root, null, {
			enter: function(node) {
				visited.push(node.nodeName);
				if (node.nodeName === 'root') {
					// Add a new child before returning, the walker should see it
					root.appendChild(doc.createElement('added'));
				}
				return 'ctx';
			}
		});
		assert.deepEqual(visited, ['root', 'original', 'added']);
	}
}).run();
