var wows = require('vows');
var assert = require('assert');
var DOMParser = require('xmldom').DOMParser;
var XMLSerializer = require('xmldom').XMLSerializer;
var parser = new DOMParser();
// Create a Test Suite
wows.describe('XML Node Parse').addBatch({
    'noAttribute': function () { 
    	var dom = new DOMParser().parseFromString('<xml ></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml />','text/xml');
    	var dom = new DOMParser().parseFromString('<xml/>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml/>','text/xml');
	},
    'simpleAttribute': function () { 
    	var dom = new DOMParser().parseFromString('<xml a="1" b="2"></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml a="1" b="2" ></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml a="1" b=\'\'></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml a="1" b=\'\' ></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml a="1" b="2/">','text/xml');
    	var dom = new DOMParser().parseFromString('<xml a="1" b="2" />','text/xml');
    	var dom = new DOMParser().parseFromString('<xml  a="1" b=\'\'/>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml  a="1" b=\'\' />','text/xml');
	},
    'nsAttribute': function () { 
    	var dom = new DOMParser().parseFromString('<xml xmlns="1" xmlns:a="2" a:test="3"></xml>','text/xml');
    	var dom = new DOMParser().parseFromString('<xml xmlns="1" xmlns:a="2" a:test="3" ></xml>','text/xml');
     	var dom = new DOMParser().parseFromString('<xml xmlns="1" xmlns:a="2" a:test="3/">','text/xml');
    	var dom = new DOMParser().parseFromString('<xml xmlns="1" xmlns:a="2" a:test="3" />','text/xml');
	}
}).run();

/**
 * The XML `ETag` production is `'</' Name S? '>'`: only optional whitespace may follow the `Name`.
 * A valid `Name` followed by whitespace and non-whitespace residue (e.g. `</a\nbogus>` or
 * `</a bogus>`) is not well-formed, but historically it was silently accepted. It is now reported
 * as a recoverable `error` (in both XML and HTML) while parsing recovers to byte-identical DOM.
 *
 * @see https://www.w3.org/TR/2008/REC-xml-20081126/#NT-ETag
 */
function trackingParser() {
	var errors = {};
	function makeHandler(level) {
		return function (msg) {
			(errors[level] = errors[level] || []).push(msg);
		};
	}
	var parser = new DOMParser({
		locator: {},
		errorHandler: {
			warning: makeHandler('warning'),
			error: makeHandler('error'),
			fatalError: makeHandler('fatalError')
		}
	});
	return { errors: errors, parser: parser };
}
function hasTrailingContentError(errors) {
	var reported = errors.error || [];
	for (var i = 0; i < reported.length; i++) {
		if (/followed by whitespace and trailing content/.test(reported[i])) {
			return true;
		}
	}
	return false;
}
function assertResidueReported(ws) {
	var source = '<a></a' + ws + 'junk>';

	var cleanXml = new DOMParser().parseFromString('<a></a>', 'text/xml').toString();
	var xml = trackingParser();
	assert.equal(xml.parser.parseFromString(source, 'text/xml').toString(), cleanXml);
	assert.ok(hasTrailingContentError(xml.errors), 'xml: residue in ' + JSON.stringify(source) + ' not reported: ' + JSON.stringify(xml.errors));
	assert.equal(xml.errors.fatalError, undefined);

	var cleanHtml = new DOMParser().parseFromString('<a></a>', 'text/html').toString();
	var html = trackingParser();
	assert.equal(html.parser.parseFromString(source, 'text/html').toString(), cleanHtml);
	assert.ok(hasTrailingContentError(html.errors), 'html: residue in ' + JSON.stringify(source) + ' not reported: ' + JSON.stringify(html.errors));
}
wows.describe('end tag with trailing residue after the name').addBatch({
	'reports a recoverable error for a space residue and recovers to byte-identical DOM': function () {
		assertResidueReported(' ');
	},
	'reports a recoverable error for a tab residue and recovers to byte-identical DOM': function () {
		assertResidueReported('\t');
	},
	'reports a recoverable error for a line feed residue and recovers to byte-identical DOM': function () {
		assertResidueReported('\n');
	},
	'reports a recoverable error for a carriage return residue and recovers to byte-identical DOM': function () {
		assertResidueReported('\r');
	},
	'reports residue after several whitespace characters in a nested end tag': function () {
		var xml = trackingParser();
		xml.parser.parseFromString('<root><a></a \r\n\tjunk more></root>', 'text/xml');
		assert.ok(hasTrailingContentError(xml.errors), JSON.stringify(xml.errors));
	},
	'an errorHandler escalating error rejects </a\\njunk> (parse-before-trust gate)': function () {
		var gate = new DOMParser({
			errorHandler: {
				error: function (msg) {
					throw new Error(msg);
				}
			}
		});
		assert.equal(gate.parseFromString('<a></a>', 'text/xml').toString(), '<a/>');
		assert.throws(function () {
			gate.parseFromString('<a></a\njunk>', 'text/xml');
		}, /followed by whitespace and trailing content/);
	},
	'does not report a clean end tag with only trailing whitespace': function () {
		var crlf = trackingParser();
		assert.equal(crlf.parser.parseFromString('<a></a\r\n>', 'text/xml').toString(), '<a/>');
		assert.equal(crlf.errors.error, undefined);
		var space = trackingParser();
		assert.equal(space.parser.parseFromString('<a></a >', 'text/xml').toString(), '<a/>');
		assert.equal(space.errors.error, undefined);
	}
}).run();