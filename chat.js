var http = require('http');
var fs = require('fs');
var io = require('socket.io');

var port = process.env.PORT || 3000;
// assuming io is the Socket.IO server object
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

var clients = [];
var server = http.createServer(function(request, response){
	response.writeHead(200, {
		'Content-Type': 'text/html'
	});
	
	var rs = fs.createReadStream(__dirname + '/template.html');
	rs.pipe(response);
});

var socket = io.listen(server);



socket.on('connection', function(client) {
	var username, sendData;
		
	client.on('disconnect', function() {
		if(username) {
		sendData = username + ' Left';
		client.broadcast.emit('message', { data: sendData });
		}
	});
	client.on('emitData', function(msg) {
		if(!username) {
			username = msg.data;
			sendData = 'Welcome, ' + username + '!';
			client.emit('message', { data: sendData });
			sendData = username + ' connected';
			client.broadcast.emit('message', { data: sendData });
			//client.emit('clientData', {data: ('Welcome, ' + username + '!')});
			return;
		}
		sendData = username + ' said: ' + msg.data;
		client.broadcast.emit('message', { data: sendData }); //To broadcast other clients
		client.emit('message', { data: sendData }); //local client
		//socket.broadcast.emit(username + ' said: ' + msg.data);
	});
});

server.listen(port);