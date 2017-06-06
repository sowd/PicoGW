// PicoGW = Minimalist's Home Gateway
const WS_SUBPROTOCOL = 'picogw' ;

var WebSocketServer = require('websocket').server;
var express = require('express') ;
const bodyParser = require('body-parser');
var fs = require('fs');
var mime = require('mime') ;

const VERSIONS = [/*'v1',*/'v2'] ;
var VERSION_CTRLS = {} ;	// Stores controller objects
var log = console.log ;

// Support for termux
if( process.platform == 'android' )
	Object.defineProperty(process, "platform", { get: function () { return 'linux'; } });

// Parse command line
var cmd_opts = require('opts');
cmd_opts.parse([
    {
        'short': 'p',
        'long': 'port',
        'description': 'Web API port number',
        'value': true,
        'required': false
    },
    {
        'long': 'pipe',
        'description': 'path of named pipes without postfix (_r or _w). The server is blocked until the pipe client is connected.',
        'value': true,
        'required': false
    },
],true);

// Initialize each versions and store controller objects into VERSION_CTRLS
VERSIONS.forEach(VERSION=>{
	var ctrl = require('./'+VERSION+'/controller.js') ;
	ctrl.init(cmd_opts).then(re=>{}).catch(console.error) ;
	VERSION_CTRLS[VERSION] = ctrl ;
}) ;


// Start a web server
var SERVER_PORT = cmd_opts.get('port') || 8080 ;

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
VERSIONS.forEach(VERSION=>{
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
		VERSION_CTRLS[VERSION].callproc({method:req.method,path:path,args:args})
			.then( re=>{res.jsonp(re);} ).catch(console.error) ;

	}) ;
}) ;

// Static contents call
var HTDOCS_ROOT ;
try {
	if( fs.statSync( 'htdocs/custom' ).isDirectory() )
		HTDOCS_ROOT = 'htdocs/custom' 
	else throw '' ;
} catch(e){
	HTDOCS_ROOT = 'htdocs/default' ;
}
http.get("*",(req,res,next) => {
	var path = req.path ;
	if( path.charAt(path.length-1)=='/')	path += 'index.html' ;

	fs.readFile(HTDOCS_ROOT+path,(err,data)=>{
		if(err){
			res.status(404).send('No such resource');
			return ;
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

console.log('PicoGW started.') ;

