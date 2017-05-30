"use strict";

var VERSION ;
const CALL_TIMEOUT = 60*1000 ;

var fs = require('fs');
var PubSub = require('./PubSub.js').PubSub;
var PluginInterface = require('./PluginInterface.js').PluginInterface ;
var ClientInterface = require('./ClientInterface.js').ClientInterface ;

var log = console.log ;
var admin ;

var Plugins = {} , Clients = {} ;
exports.init = function(_VERSION){
	VERSION = _VERSION ;

	var cmd_opts = require('opts');
	cmd_opts.VERSION = VERSION ;

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

	return Promise.all([
		new Promise( (ac,rj)=>{
			// Scan plugins
			const PLUGINS_FOLDER = './'+VERSION+'/plugins/' ;
			try {
				// Setup admin plugin first
				fs.statSync( PLUGINS_FOLDER ) ;
				fs.readdir( PLUGINS_FOLDER, (err, files) => {
					if (err){ rj('No plugin folder found.'); return; }

					var plugin_names = ['admin'] ;
					files.filter(dirname => {
						return fs.lstatSync(PLUGINS_FOLDER + dirname).isDirectory();
					}).forEach(dirname => {
						if( dirname == 'admin') return ;
						plugin_names.push(dirname) ;
			   	 	}) ;
			   	 	log('Plugins registeration started.') ;
			   	 	function registerplugin(){
			   	 		var plugin_name = plugin_names.shift() ;
						var pc = new PluginInterface(
							{VERSION:VERSION,admin:admin,PubSub:PubSub}
							,plugin_name) ;
						var exportmethods = {} ;
						[ 'publish','log','getNetIDFromIPv4Address','setNetIDCallbacks','getpath','getprefix']
							.forEach(methodname => {
							exportmethods[methodname] = function(){
								return pc[methodname].apply(pc,arguments);
							} ;
						}) ;
						exportmethods.localStorage = pc.localStorage ;

						if( plugin_name === 'admin' ){	// Admin plugin can work also as a client.
							var ci = new ClientInterface(
								{VERSION:VERSION,PubSub:PubSub,Plugins:Plugins,CALL_TIMEOUT:CALL_TIMEOUT}
								,plugin_name) ;
							['callproc','subscribe','unsubscribe','unsubscribeall','log'
							,'get_expanded_paths_from_regexp_path'].forEach(methodname => {
								exportmethods[methodname] = function(){
									return ci[methodname].apply(ci,arguments);
								} ;
							}) ;
						}
						try {
							var pobj = require('./plugins/' + plugin_name + '/index.js') ;
							// Plugin init must return procedure call callback function.
							Promise.all([pobj.init(exportmethods,cmd_opts)]).then( p => {
								pc.procCallback = p[0] ;

								Plugins[plugin_name] = pc ;
								if( plugin_name === 'admin' )	admin = pobj ;
								log(plugin_name+' plugin initiaized') ;
					   	 		if( plugin_names.length == 0 ){ac('All plugins initialization process is ended.'); return;}
					   	 		registerplugin() ;
							}).catch(e=>{
								log(plugin_name+' plugin could not be initiaized') ;
					   	 		if( plugin_names.length == 0 ){ac('All plugins initialization process is ended.'); return;}
					   	 		registerplugin() ;
							}) ;

						} catch (e){log('Error in initializing '+plugin_name+' plugin: '+JSON.stringify(e)) ;}
					}
		   	 		registerplugin() ;
				}) ;
			} catch(e){
				rj('No plugins exists.') ;
			}
		}) , new Promise( (ac,rj)=>{
			// Scan Clients
			const CLIENTS_FOLDER = './'+VERSION+'/clients/' ;
			try {
				fs.statSync( CLIENTS_FOLDER ) ;
				fs.readdir( CLIENTS_FOLDER, (err, files) => {
					if (err){ rj('No clients folder found.'); return; }

					var client_names = [] ;
					files.filter(dirname => {
						return fs.lstatSync(CLIENTS_FOLDER + dirname).isDirectory();
					}).forEach(dirname => {
						client_names.push(dirname) ;
					}) ;
			   	 	log('Clients registration started.') ;
			   	 	function registerclient(){
			   	 		var client_name = client_names.shift() ;
						//var ci = new ClientInterface({VERSION:VERSION,PubSub:PubSub,Plugins:Plugins},client_name) ;
						var ci = new ClientInterface(
							{VERSION:VERSION,PubSub:PubSub,Plugins:Plugins,CALL_TIMEOUT:CALL_TIMEOUT}
							,client_name) ;
						var exportmethods = {} ;
						['callproc','subscribe','unsubscribe','unsubscribeall','log','getpath'
						,'get_expanded_paths_from_regexp_path'].forEach(methodname => {
							exportmethods[methodname] = function(){
								return ci[methodname].apply(ci,arguments);
							} ;
						}) ;
						exportmethods.localStorage = ci.localStorage ;
						try {
							Promise.all([require('./clients/' + client_name + '/index.js').init(exportmethods,cmd_opts)]).then(()=>{
								Clients[client_name] = ci ;
								log(client_name+' client initiaized') ;
								if( client_names.length == 0 ){ac('All client initialization process is ended.'); return;}
					   	 		registerclient() ;
							}).catch(e=>{
								log(client_name+' client could not initiaize') ;
								if( client_names.length == 0 ){ac('All client initialization process is ended.'); return;}
					   	 		registerclient() ;
							}) ;
						} catch (e){log('Error in initializing '+client_name+' client: '+JSON.stringify(e)) ;}
					}
					registerclient() ;
				}) ;
			} catch(e){
				rj('No Clients exists.') ;
			}
		})
	]) ;
} ;
