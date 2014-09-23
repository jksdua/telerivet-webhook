Telerivet Webhook
=================

Node.js webhook for the Telerivet SMS gateway service


Installation
------------

```bash
$ npm install telerivet-webhook
```


Usage
-----

### Get a webhook instance

```js
var WEBHOOK_SECRET = '...';

// returns an express app instance
var webhook = require('telerivet-webhook')({
	webhookSecret: WEBHOOK_SECRET
});
```

### Listen for events

*Note:* All events are prefixed with `telerivet::` to avoid collisions with internal events.

Additional to the API, *status* of the message is also emitted as an event. So, messages will also emit *sent*, *delivered*, *failed* etc.

```js
var EVENT_INCOMING_MESSAGE = 'telerivet::incoming_message';
var EVENT_MESSAGE_STATUS = 'telerivet::send_status';
var EVENT_MESSAGE_SENT = 'telerivet::sent';

// parameters and event names are exactly the same as the documentation at https://telerivet.com/api/webhook
webhook.on(EVENT_INCOMING_MESSAGE, function(message) {
	console.log(message.id);
	console.log(message.type);
});

webhook.on(EVENT_MESSAGE_STATUS, function(message) {
	console.log(message.status);
});

webhook.on(EVENT_MESSAGE_SENT, function(message) {
	console.log(message.id);
	console.log(message.type);
});
```

### Run the app

`webhook` is an express app so you can either run the app directly or mount it in another express app or http server.

```js
// option 1 - run the app
webhook.listen(3000);

// option 2 - mount the app
var app = express();
app.use('/telerivet/webhook', webhook);
app.listen(3000);
```

### Sending auto replies

Optionally, you can set `autoReply` in the options hash to send  autoreplies.

*Note:* You need to manually set the `status_secret` and `status_url` properties on the messages. Use the below code as a template. It is really important that you set `status_secret` in order to verify incoming requests.

```js
var WEBHOOK_SECRET = '...';
var STATUS_URL = '...'; // public facing webhook url

// returns an express app instance
var webhook = require('telerivet-webhook')({
	webhookSecret: WEBHOOK_SECRET,
	autoReply: function(req, res) {
		// mock mongo query
		db.messages.find({}, function(err, messages) {
			res.json({
				messages: messages.map(function(message) {
					return {
						status_secret: WEBHOOK_SECRET,
						status_url: STATUS_URL,
						to_number: message.to,
						content: message.content
					};
				});
			});
		});
	}
});
```

The above example works quite well but it would be difficult to track the message for which the Telerivet server sends the status notification. The below example shows how to handle this situation by using a custom webhook secret verifier.

```js
var EVENT_MESSAGE_DELIVERED = 'telerivet::delivered';
var EVENT_INCOMING_MESSAGE = 'telerivet::incoming_message';
var WEBHOOK_SECRET = '...'; // as setup in the telerivet dashboard
var STATUS_URL = '...'; // public facing webhook url

// returns an express app instance
var webhook = require('telerivet-webhook')({
	// passed as express middleware
		// handles both incoming messages and status notifications
	webhookSecret: function(req, res, next) {
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
		if (WEBHOOK_SECRET === secret) {
			next();
		} else {
			// send Forbidden
			res.status(403).end();
		}
	},
	autoReply: function(req, res) {
		// mock
		db.messages.find({}, function(err, messages) {
			res.json({
				messages: messages.map(function(message) {
					return {
						// append the message id to the secret
							// it is very important that we use the webhook secret as well as the message id here. if we only use the message id, an attacker simply needs to know a valid database identifier which may be weak (incremental - mysql, time based - mongo etc)
						status_secret: WEBHOOK_SECRET + ':' + message._id,
						status_url: STATUS_URL,
						to_number: message.to,
						content: message.content
					};
				});
			});
		});
	}
});

// you can now get to the internal message id
webhook.on(EVENT_MESSAGE_DELIVERED, function(message) {
	console.log(message.__id); // internal id
	console.log(message.id); // telerivet id
});
```


Testing
-------

A test account has been created on the production Telerivet service. This can be used for testing this library.

Tests can be run with the following commands:

```bash
# clone the repo
$ git clone git@github.com:jksdua/telerivet-webhook.git
$ cd telerivet-webhook

# install dependencies
$ npm install

# run tests
$ npm test
```

### Sample test output

```bash
root@localhost:~/jksdua/telerivet-webhook# npm test

> telerivet-webhook@0.0.1 test /root/jksdua/telerivet-webhook
> mocha --bail --timeout 10000 --reporter spec

Timeout disabled for incoming message tests


  #telerivet-webhook
    #general
      > should throw an error if webhook secret is missing
      > should throw an error if auto reply is not a function
    #incoming message
      #events
Please send a simulated incoming message from https://telerivet.com/p/fccbbed0/services. Click on "Test Services"
Received simulated message. Proceeding with test
        > should emit an event (10661ms)
      #auto reply
Please send a simulated incoming message from https://telerivet.com/p/fccbbed0/services. Click on "Test Services"
Received simulated message. Auto reply will be sent to a test number. Waiting for sent message notification
        > should send the reply (4959ms)
    #message status notification
      > should emit events - telerivet::failed (8170ms)
      > should emit events - telerivet::sent,telerivet::delivered (8021ms)
      > should emit events - telerivet::sent,telerivet::not_delivered (8015ms)
      > should emit events - telerivet::failed_queued,telerivet::sent (8018ms)


  8 passing (49s)
```

*Note:* Credentials for the service are located in `test/config.json` file. Login and modify the webhook service to point to your public facing server.


Changelog
---------

### v0.0.1 (23 Sep 2014)
- Initial commit