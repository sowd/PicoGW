// if 'serverport' entry is added to localstorage.json,
// The number is loaded to this variable.
var SERVER_PORT = 8080 ;

const WS_SUBPROTOCOL = 'picogw' ;

var VERSION ;

var WebSocketServer = require('websocket').server;
var express = require('express') ;
var fs = require('fs');
var mime = require('mime') ;

var clientInterface ;
var log = console.log ;

exports.init = function(ci,_VERSION){	
	clientInterface = ci ;
	log = clientInterface.log ;
	VERSION = _VERSION ;

	SERVER_PORT = clientInterface.localStorage.getItem('serverport',SERVER_PORT) ;

	setupWebServer() ;

	/*// PubSub, unsubscribe test
	var c=0 ;
	function fun(re){
		log('Published:'+JSON.stringify(re));
		if( ++c == 3 )	clientInterface.unsubscribe('echonet/AirConditioner_1/OperatingState',fun) ;
	}
	clientInterface.subscribe('echonet/AirConditioner_1/OperatingState',fun) ;
	*/
} ;

function setupWebServer(){
	var http = express() ;

	var server = http.listen(SERVER_PORT,function() {
		log('Web server is waiting on port '+SERVER_PORT+'.') ;
	}) ;

	// REST API call
	http.all(`/${VERSION}/*`, function(req, res, next){
		// for( var e in req ){if( typeof req[e] == 'string') log(e+':'+req[e]);}
		// var caller_ip = req.ip ;
		var path = req.path.substring(`/${VERSION}/`.length).trim() ;
		var arg = '' ;
		if( req.originalUrl.indexOf('?') >= 0 ) arg = req.originalUrl.slice(req.originalUrl.indexOf('?')+1) ;
		clientInterface.callproc(req.method,path,arg).then(re=>{
			res.jsonp(re) ;
		}).catch(e=>{
		    res.jsonp(e);
		}) ;
	});

	// Static contents call
	http.get("*",(req,res,next) => {
		var path = req.path ;
		if( path.charAt(path.length-1)=='/')	path += 'index.html' ;

		fs.readFile(clientInterface.getpath()+'htdocs'+path,(err,data)=>{
			if(err){
				res.status(404).send('No such resource');
				return ;
			}
			res.set('Content-Type', mime.lookup(path) /*'text/html; charset=UTF-8'*/);
			res.status(200);
			res.send(data) ;
		}) ;
	})


	wsServer = new WebSocketServer({
	    httpServer: server,
	    autoAcceptConnections: false
	});

	function originIsAllowed(origin) {
	  // put logic here to detect whether the specified origin is allowed.
	  return true;
	}

	wsServer.on('request', function(request) {
	    if (!originIsAllowed(request.origin)) {
	      // Make sure we only accept requests from an allowed origin
	      request.reject();
	      log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
	      return;
	    }

	    var connection ;
	    try {
	    	connection = request.accept(WS_SUBPROTOCOL, request.origin);
	    } catch(e){
	    	console.error(e) ;
	    	return ;
	    }

	    log((new Date()) + ' Connection accepted.');
	    connection.on('message', function(message) {
	        if (message.type === 'utf8') {
	            log('Received Message: ' + message.utf8Data);
	            connection.sendUTF(message.utf8Data);
	        }
	        else if (message.type === 'binary') {
	            log('Received Binary Message of ' + message.binaryData.length + ' bytes');
	            connection.sendBytes(message.binaryData);
	        }
	    });
	    connection.on('close', function(reasonCode, description) {
	        log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
	    });
	});
}
