'use strict'

const { DOMParser } = require('../dom-parser')

/**
 * Create a DOMParser instance with error tracking for testing.
 *
 * @param {Object} [opts]
 * @param {Object} [opts.errorHandler] Custom error handler with warning/error/fatalError methods
 * @param {Object} [opts.locator] Custom locator
 * @returns {{ errors: Object, parser: DOMParser }}
 */
function getTestParser(opts) {
	const errors = {}
	opts = opts || {}
	const errorHandler = opts.errorHandler || {}

	function makeHandler(level) {
		if (errorHandler[level]) {
			return errorHandler[level]
		}
		return function (msg) {
			if (!errors[level]) {
				errors[level] = []
			}
			errors[level].push(msg)
		}
	}

	const parser = new DOMParser({
		locator: opts.locator || {},
		errorHandler: {
			warning: makeHandler('warning'),
			error: makeHandler('error'),
			fatalError: makeHandler('fatalError'),
		},
	})

	return { errors, parser }
}

module.exports = { getTestParser }
