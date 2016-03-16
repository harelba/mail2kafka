/**
 * Main application file
 */

'use strict';

import express from 'express';
import mongoose from 'mongoose';
import config from './config/environment';
import http from 'http';

var logger = require('winston');
var kafka = require('kafka-node');
var mailin = require('mailin');
var uuid = require('node-uuid');

// Connect to MongoDB
mongoose.connect(config.mongo.uri, config.mongo.options);
mongoose.connection.on('error', function(err) {
  console.error('MongoDB connection error: ' + err);
  process.exit(-1);
});

// Populate databases with sample data
if (config.seedDB) { require('./config/seed'); }

// Setup server
var app = express();
var server = http.createServer(app);
var socketio = require('socket.io')(server, {
  serveClient: config.env !== 'production',
  path: '/socket.io-client'
});
require('./config/socketio')(socketio);
require('./config/express')(app);
require('./routes')(app);

// Start server
function startServer() {
  server.listen(config.port, config.ip, function() {
    console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
  });
 
  var zkOptions = { sessionTimeout : 30000, spinDelay : 1000, retries : 0 };
  var noAckBatchOptions =  { noAckBatchSize: null, noAckBatchAge: null };
  var kafkaClient = new kafka.Client("localhost:2181","mail2kafka_"+uuid.v4(),zkOptions,noAckBatchOptions);
  var kafkaProducer = new kafka.HighLevelProducer(kafkaClient, { requireAcks : 1 , ackTimeoutMs : 200 , partitionerType : 0 });

  kafkaProducer.on('ready',function () {
	  logger.log('info','Kafka producer ready');
  });

  mailin.start({
	          port : 2526,
	          disableWebhook : true,
	          requireAuthentication : false
  });

  mailin.on('message',function (connection,data,content) {
	logger.log('info',"Got a new email from %s",connection);
	var m = { emailDetails : { connection : connection, data : data } };

	var sm = JSON.stringify(m);
	logger.log('info','going to send message: ' + sm);
	var payloads = [ { topic : 'test_2' , messages : sm } ];
	kafkaProducer.send(payloads,function (err,data) {
		logger.info('Sent email to kafka ' + data);
	});
  });
}

setImmediate(startServer);

// Expose app
exports = module.exports = app;
