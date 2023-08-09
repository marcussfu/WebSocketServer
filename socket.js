const express = require('express');
const app = express();

if (process.argv.length < 3) {
	console.log(
		'Usage: \n' +
		'node websocket-relay.js <secret> [<stream-port> <websocket-port>]'
	);
	process.exit();
}

let STREAM_SECRET = process.argv[2],
	STREAM_PORT = process.argv[3] || 8081,
	WEBSOCKET_PORT = process.argv[4] || 8082,
    RECORD_STREAM = false;

const server = require('http').Server(app).listen(WEBSOCKET_PORT, () => {console.log('open server!')});
const io = require('socket.io')(server);
const ws = require('socket.io-client')('http://127.0.0.1:'+WEBSOCKET_PORT);

io.connectionCount = 0;
io.on('connection', socket => {
    console.log('success connect!');
    io.connectionCount++;

    socket.on('getMessageLess', message => {
        socket.broadcast.emit('getMessageLessClient', message);
        // console.log('XXXXXXX  ', message);
    })

    socket.on('close', message => {
        io.connectionCount--;
        console.log(
			'Disconnected socket.io ('+io.connectionCount+' total)'
		);
    })
});

// HTTP Server to accept incomming MPEG-TS Stream from ffmpeg
let streamServer = require('http').createServer( function(request, response) {
	var params = request.url.substr(1).split('/');

	if (params[0] !== STREAM_SECRET) {
		console.log(
			'Failed Stream Connection: '+ request.socket.remoteAddress + ':' +
			request.socket.remotePort + ' - wrong secret.'
		);
		response.end();
	}

	response.connection.setTimeout(0);
	console.log(
		'Stream Connected: ' + 
		request.socket.remoteAddress + ':' +
		request.socket.remotePort
	);
	request.on('data', function(data){
        // socketServer.broadcast(data);
        ws.emit('getMessageLess', data);
		if (request.socket.recording) {
			request.socket.recording.write(data);
		}
	});
	request.on('end',function(){
		console.log('close');
		if (request.socket.recording) {
			request.socket.recording.close();
		}
	});

	// Record the stream to a local file?
	if (RECORD_STREAM) {
		var path = 'recordings/' + Date.now() + '.ts';
		request.socket.recording = fs.createWriteStream(path);
	}
})

streamServer.listen(STREAM_PORT);

console.log('Listening for incomming MPEG-TS Stream on http://127.0.0.1:'+STREAM_PORT+'/<secret>');
console.log('Awaiting WebSocket connections on ws://127.0.0.1:'+WEBSOCKET_PORT+'/');