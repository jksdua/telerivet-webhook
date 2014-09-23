/* globals describe, beforeEach, afterEach, before, after, it */

'use strict';

describe('#telerivet-webhook', function() {
	var EVENT_INCOMING_MESSAGE = 'telerivet::incoming_message';
	var SRC = require(__dirname + '/../src');

	var chai = require('chai');
	var uuid = require('uuid');
	var nigah = require('nigah');
	var prompt = require('prompt');
	var expect = chai.expect;

	// test configuration
	var conf = require(__dirname + '/config.json');

	var telerivet = require('telerivet');
	var tr = new telerivet.API(conf.api_key, conf.api_url);
	var project;

	function msg(number, message) {
		var id = uuid.v4();

		return {
			__id: id,
			status_url: conf.status_url,
			status_secret: conf.webhook_secret + ':' + id,
			to_number: number,
			content: message || Date.now(),
			message_type: 'sms'
		};
	}

	function webhookSecretFn(req, res, next) {
		var secret = req.body.secret || '';
		var event = req.body.event;

		// message status notification
		if (EVENT_INCOMING_MESSAGE !== event) {
			var split = secret.split(':');
			secret = split[0];
			// add the server identifier on the message for convenience
			req.body.__id = split[1];
		}

		// assert secret is correct
		if (conf.webhook_secret === secret) {
			next();
		} else {
			// send Forbidden
			res.status(403).end();
		}
	}

	// fetch project from server
	before(function(done) {
		tr.getProjectById(conf.project_id, function(err, proj) {
			project = proj;
			done(err);
		});
	});

	describe('#general', function() {
		it('should throw an error if webhook secret is missing', function() {
			expect(function() {
				SRC();
			}).to.throw(/secret/i);
		});

		it('should throw an error if auto reply is not a function', function() {
			expect(function() {
				SRC({
					webhookSecret: conf.webhook_secret,
					autoReply: {}
				});
			}).to.throw(/autoreply/i);
		});
	});

	// need to think of a way of automating these two tests
		// currently we need to manually use the "Simulate Incoming Message" feature in the dashboard
	describe('#incoming message', function() {
		this.timeout(Infinity);
		console.info('Timeout disabled for incoming message tests');

		describe('#events', function() {
			var server;
			// extend telerivet with webhook and message notifications
			var webhook = SRC({
				// exact same as the readme example
				webhookSecret: conf.webhook_secret
			});

			before(function(done) {
				server = webhook.listen(conf.port, conf.host, done);
			});

			after(function(done) {
				server.close(done);
			});

			it('should emit an event', function(done) {
				console.info('Please send a simulated incoming message');

				webhook.on(EVENT_INCOMING_MESSAGE, function(message) {
					console.info('Received simulated message. Proceeding with test');
					expect(message).to.have.property('id').that.is.a('string');
					done();
				});
			});
		});

		describe('#auto reply', function() {
			var server;
			var mockMessage = msg('+15005550015', uuid.v4());
			var webhook = SRC({
				webhookSecret: webhookSecretFn,
				// sends a reply to a fake number that returns sent
				autoReply: function(req, res) {
					res.json({
						messages: [mockMessage]
					});
				}
			});

			before(function(done) {
				server = webhook.listen(conf.port, conf.host, done);
			});

			after(function(done) {
				server.close(done);
			});

			it('should send the reply', function(done) {
				console.info('Please send a simulated incoming message');

				webhook.on(EVENT_INCOMING_MESSAGE, function() {
					console.info('Received simulated message. Auto reply will be sent to a test number. Waiting for sent message notification');
				});

				webhook.on('telerivet::sent', function(message) {
					expect(message).to.have.property('__id', mockMessage.__id);
					done();
				});
			});
		});
	});

	describe('#message status notification', function() {
		var ASSERTIONS = [
			{
				events: ['telerivet::failed'],
				number: '+15005550011'
			},
			{
				events: ['telerivet::sent', 'telerivet::delivered'],
				number: '+15005550012'
			},
			{
				events: ['telerivet::sent', 'telerivet::not_delivered'],
				number: '+15005550013'
			},
			{
				events: ['telerivet::failed_queued', 'telerivet::sent'],
				number: '+15005550014'
			},
			{
				events: ['telerivet::failed_queued', 'telerivet::sent'],
				number: '+15005550015'
			}
		];

		var server, watcher;
		// extend telerivet with webhook and message notifications
		var webhook = SRC({
			// exact same as the readme example
			webhookSecret: webhookSecretFn
		});

		before(function(done) {
			server = webhook.listen(conf.port, conf.host, done);
		});

		after(function(done) {
			server.close(done);
		});

		// watch for events on the event emitter
		beforeEach(function() {
			watcher = nigah(webhook);
		});

		afterEach(function() {
			watcher.restore();
		});

		ASSERTIONS.forEach(function(assertion) {
			it('should emit events - ' + assertion.events, function(done) {
				var lastEvent = assertion.events[assertion.events.length - 1];
				var expectedEvents = assertion.events.reduce(function(events, event) {
					events[event] = 1;
					events['telerivet::send_status'] += 1;
					return events;
				}, { 'telerivet::send_status': 0 });
				var mockMessage = msg(assertion.number);

				webhook.on(lastEvent, function(message) {
					expect(message).to.have.property('id').that.is.a('string');
					expect(message).to.have.property('message_type', 'sms');
					expect(message).to.have.property('__id', mockMessage.__id);
					watcher.assertCount(expectedEvents, true);
					done();
				});

				project.sendMessage(mockMessage, function(err) {
					expect(err).to.not.exist; // jshint ignore:line
				});
			});
		});
	});
});