var SERVER_PORT , VERSION ;
const WS_SUBPROTOCOL = 'picogw' ;

var WebSocketServer = require('websocket').server;
var express = require('express') ;
const bodyParser = require('body-parser');
var fs = require('fs');
var mime = require('mime') ;

var clientInterface ;
var log = console.log ;

exports.init = function(ci,cmd_opts){	
	clientInterface = ci ;
	log = clientInterface.log ;
	VERSION = cmd_opts.VERSION ;

	SERVER_PORT = cmd_opts.get('port') || 8080 ;

	var http = express() ;
	http.use(bodyParser.urlencoded({ extended: true }));
	http.use(bodyParser.json());
	http.use (function (e, req, res, next){
	    res.jsonp(e) ;	//Catch json error
	});

	var server = http.listen(SERVER_PORT,function() {
		log('Web server is waiting on port '+SERVER_PORT+'.') ;
	}) ;

	// REST API call
	http.all(`/${VERSION}/*`, function(req, res, next){
		// for( var e in req ){if( typeof req[e] == 'string') log(e+':'+req[e]);}
		// var caller_ip = req.ip ;
		var path = req.path ; //.substring(`/${VERSION}/`.length).trim() ;
		var args = req.body ;
		// Overwrite args in body with GET parameters
		if( req.originalUrl.indexOf('?') >= 0 ){
			req.originalUrl.slice(req.originalUrl.indexOf('?')+1).split('&').forEach(eq=>{
				var terms = eq.split('=') ;
				if( terms.length == 1 ) args.value = terms[0] ;
				else					args[terms[0]] = decodeURIComponent(terms[1]) ;
			}) ;
		}
		clientInterface.callproc(req.method,path,args).then(re=>{
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

	/*// PubSub, unsubscribe test
	var c=0 ;
	function fun(re){
		log('Published:'+JSON.stringify(re));
		if( ++c == 3 )	clientInterface.unsubscribe('echonet/AirConditioner_1/OperatingState',fun) ;
	}
	clientInterface.subscribe('echonet/AirConditioner_1/OperatingState',fun) ;
	*/
} ;
