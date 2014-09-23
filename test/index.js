/* globals describe, beforeEach, afterEach, before, it */

'use strict';

describe('#telerivet-webhook', function() {
	var chai = require('chai');
	var nigah = require('nigah');
	var expect = chai.expect;
	var watcher;

	// test configuration
	var conf = require(__dirname + '/config.json');

	var telerivet = require('telerivet');
	var tr = new telerivet.API(conf.api_key, conf.api_url);
	var project;

	// extend telerivet with webhook and message notifications
	var webhook = require(__dirname + '/../src')({
		webhookSecret: conf.webhook_secret
	});

	function msg(number, message) {
		return {
			to_number: number,
			content: message || 'message'
		};
	}

	// fetch project from server
	before(function(done) {
		tr.getProjectById(conf.project_id, function(err, proj) {
			project = proj;
			done(err);
		});
	});

	// watch for events on the event emitter
	beforeEach(function() {
		watcher = nigah(webhook);
	});

	afterEach(function() {
		watcher.restore();
	});

	// need to think of a way of automating these two tests
	describe('#incoming message', function() {
		it.skip('should emit an event');
		it.skip('should support auto reply');
	});

	describe('#message status notification', function() {
		var ASSERTIONS = [
			{
				events: ['failed'],
				number: '+15005550011'
			},
			{
				events: ['sent', 'delivered'],
				number: '+15005550012'
			},
			{
				events: ['sent', 'not_delivered'],
				number: '+15005550013'
			},
			{
				events: ['failed_queued', 'sent'],
				number: '+15005550014'
			},
			{
				events: ['sent'],
				number: '+15005550015'
			}
		];

		ASSERTIONS.forEach(function(assertion) {
			it('should emit events: ' + assertion.events, function(done) {
				var lastEvent = assertion.events[assertion.events.length - 1];
				var expectedEvents = assertion.events.reduce(function(events, event) {
					events[event] = 1;
					return events;
				}, {});

				webhook.on(lastEvent, function(message) {
					expect(message).to.have.property('id').that.is.a('string');
					expect(message).to.have.property('message_type', 'sms');
					watcher.assertCount(expectedEvents, true);
					done();
				});

				project.sendMessage(msg(assertion.number), function(err) {
					expect(err).to.not.exist; // jshint ignore:line
				});
			});
		});
	});
});