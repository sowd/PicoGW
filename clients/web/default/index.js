const WS_SUBPROTOCOL = 'picogw' ;

var WebSocketServer = require('websocket').server;
var express = require('express') ;
const bodyParser = require('body-parser');
var mime = require('mime') ;
var fs = require('fs');

var clientInterface , globals;

var log = (msg) => { console.log('client> '+msg); };

exports.init = function(_clientInterface,_globals){
	clientInterface = _clientInterface ;
	globals = _globals ;

	log = clientInterface.log ;

	var SERVER_PORT = globals.cmd_opts.get('port') || 8080 ;

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
	globals.VERSIONS.forEach(VERSION=>{
		http.all(`/${VERSION}/*`, function(req, res, next){
			// for( var e in req ){if( typeof req[e] == 'string') log(e+':'+req[e]);}
			// var caller_ip = req.ip ;
			var args = req.body ;
			// Overwrite args in body with GET parameters
			if( req.originalUrl.indexOf('?') >= 0 ){
				req.originalUrl.slice(req.originalUrl.indexOf('?')+1).split('&').forEach(eq=>{
					var terms = eq.split('=') ;
					if( terms.length == 1 ) args.value = terms[0] ;
					else					args[terms[0]] = decodeURIComponent(terms[1]) ;
				}) ;
			}
			clientInterface.callproc({method:req.method,path:req.path,args:args})
				.then( re=>{res.jsonp(re);} ).catch( re=>{res.jsonp(re);} /*console.error*/ ) ;

		}) ;
	}) ;

	// Static contents call
	http.get("*",(req,res,next) => {
		var path = req.path ;
		if( path.charAt(path.length-1)=='/')	path += 'index.html' ;

		fs.readFile(__filename.split('/').slice(0,-1).join('/')+'/htdocs'+path,(err,data)=>{
			if(err){
				res.status(404).send('No such resource');
				return ;
			}
			if(path==='/index.html'){
				data = data.toString().split('__%%RSA_PUB_KEY%%__').join('"'+globals.getPubKey()+'"') ;
			}
			res.set('Content-Type', mime.lookup(path) /*'text/html; charset=UTF-8'*/);
			res.status(200);

			res.send(data) ;
		}) ;
	})

	var wsServer = new WebSocketServer({
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

	    //log((new Date()) + ' Connection accepted.');
	    let subscribe_funcs = {} ;
	    connection.on('message', function(message) {
	        if (message.type === 'utf8') {
				//log('Received Message: ' + message.utf8Data);
				let req ;
	        	try {
	        		req = JSON.parse(message.utf8Data) ;
	        		if( req.method.toUpperCase() == 'SUB' ){
	        			let cbfunc = function(re){
							connection.sendUTF(JSON.stringify(re)) ;
						} ;
						if( subscribe_funcs[req.path] == undefined ){
							clientInterface.subscribe(req.path,cbfunc) ;
							subscribe_funcs[req.path] = cbfunc ;
						}
						connection.sendUTF(JSON.stringify({success:true,tid:req.tid}));
	        		} else if( req.method.toUpperCase() == 'UNSUB' ){
	        			if( subscribe_funcs[req.path] != undefined ){
							clientInterface.unsubscribe(req.path,subscribe_funcs[req.path]) ;
							delete subscribe_funcs[req.path] ;
						}
						connection.sendUTF(JSON.stringify({success:true,tid:req.tid}));
	        		} else {
	        			clientInterface.callproc(req).then(re=>{
							re.tid = req.tid ;
							connection.sendUTF(JSON.stringify(re)+"\n") ;
						}).catch(e=>{
							e.tid = req.tid ;
							connection.sendUTF(JSON.stringify(e)+"\n") ;
						}) ;
	        		}
		        } catch(e){
		        	log('Error in receiving websocket message') ;
		        	log(JSON.stringify(e)) ;
		        }
	        }
	        else if (message.type === 'binary') {
	            log('Received Binary Message of ' + message.binaryData.length + ' bytes. Ignore.');
	            //connection.sendBytes(message.binaryData);
	        }
	    });
	    connection.on('close', function(reasonCode, description) {
	        //log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
	        for( let path in subscribe_funcs ){
		        clientInterface.unsubscribe(path,subscribe_funcs[path]) ;
		    }
		    subscribe_funcs = {} ;
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