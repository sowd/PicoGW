"use strict";

const VERSION = 'v1';
const CALL_TIMEOUT = 60*1000 ;

var fs = require('fs');
var PubSub = require('./PubSub.js').PubSub;
var PluginInterface = require('./PluginInterface.js').PluginInterface ;
var ClientInterface = require('./ClientInterface.js').ClientInterface ;

var log = console.log ;
var admin ;

var Plugins = {} , clientInterface ;
exports.init = function(cmd_opts){
	clientInterface = new ClientInterface(
		{VERSION:VERSION,PubSub:PubSub,Plugins:Plugins,CALL_TIMEOUT:CALL_TIMEOUT}) ;

	return new Promise( function(ac,rj){
		// Scan plugins
		const PLUGINS_FOLDER = './'+VERSION+'/plugins/' ;
		try {
			fs.statSync( PLUGINS_FOLDER ) ;
			fs.readdir( PLUGINS_FOLDER, (err, files) => {
				if (err){ rj('No plugin folder found.'); return; }

				// Admin plugin should be initialized first.
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
					[ 'publish','log','getNetIDFromIPv4Address','setNetIDCallbacks','getSettingsSchema','getSettings','getpath','getprefix']
						.forEach(methodname => {
						exportmethods[methodname] = function(){
							return pc[methodname].apply(pc,arguments);
						} ;
					}) ;
					exportmethods.localStorage = pc.localStorage ;
					exportmethods.localSettings = pc.localSettings ;

					if( plugin_name === 'admin' ){	// Admin plugin can work also as a client.
						var ci = new ClientInterface(
							{VERSION:VERSION,PubSub:PubSub,Plugins:Plugins,CALL_TIMEOUT:CALL_TIMEOUT} ) ;
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
	}) ;
} ;

exports.callproc = function(params){
	return clientInterface.callproc(params.method,params.path,params.args) ;
} ;