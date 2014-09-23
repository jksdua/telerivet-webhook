'use strict';

var CLIENT_VERSION = '1.1.0';
var EVENT_INCOMING_MESSAGE = 'incoming_message';

var assert = require('assert');
var express = require('express');

/*
 * body-parser is a piece of express middleware that 
 *   reads a form's input and stores it as a javascript
 *   object accessible through `req.body` 
 *
 * 'body-parser' must be installed (via `npm install --save body-parser`)
 * For more info see: https://github.com/expressjs/body-parser
 */
var bodyParser = require('body-parser');

function isFunction(fn) {
	return ('function' === typeof fn);
}

module.exports = function(opt) {
	var webhookSecret = opt.webhookSecret;
	var autoReply = opt.autoReply;

	assert(webhookSecret, 'Missing webhook secret');

	if (autoReply) {
		assert(isFunction(autoReply), 'autoReply must be a function');
	}

	// create our app
	var app = express();
	app.locals.CLIENT_VERSION = CLIENT_VERSION;

	// instruct the app to use the `bodyParser()` middleware for all routes
	app.use(bodyParser.urlencoded({ extended: true }));

	// custom webhook secret verifying function
	var webhookStringMatch = !isFunction(webhookSecret);
	if (!webhookStringMatch) {
		app.use(opt.webhookSecret);
	}

	// This route receives the posted form.
	// As explained above, usage of 'body-parser' means
	// that `req.body` will be filled in with the form elements
	app.post('/', function(req, res){
		var event = req.body.event;

		if (webhookStringMatch) {
			var secret = req.body.secret;

			if (secret !== webhookSecret) {
				res.status(403).end();
				return;
			}
		}

		// emit the event
		try {
			app.emit(event, req.body);
		} catch(e) {
			console.error(e);
		}

		res.type('json');

		// only trigger auto reply for incoming messages
			// it doesnt trigger for message notifications
		if (EVENT_INCOMING_MESSAGE === event && autoReply) {
			autoReply(req, res);
		} else {
			res.status(200).end();
		}
	});

	return app;
};