"use strict";

const VERSION = 'v1';
const CALL_TIMEOUT = 60*1000 ;

var fs = require('fs');

var PluginInterface = require('./PluginInterface.js').PluginInterface ;

var log = console.log ;
var admin ;

var globals ;
var Plugins = {} ;//, clientInterface ;
exports.init = function(_globals,clientFactory){
	globals = _globals ;
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
					var fo = fs.lstatSync(PLUGINS_FOLDER + dirname) ;
					return fo.isDirectory() || fo.isSymbolicLink();
				}).forEach(dirname => {
					if( dirname == 'admin') return ;
					plugin_names.push(dirname) ;
		   	 	}) ;
		   	 	log('Plugins registeration started.') ;
		   	 	function registerplugin(){
		   	 		var plugin_name = plugin_names.shift() ;
					var pc = new PluginInterface(
						{VERSION:VERSION,admin:admin,PubSub:globals.PubSub}
						,plugin_name) ;
					var exportmethods = {} ;
					[ 'publish','log','on','off','getNetIDFromIPv4Address','setNetIDCallbacks','getSettingsSchema'
						,'getSettings','getpath','getprefix']
						.forEach(methodname => {
						exportmethods[methodname] = function(){
							return pc[methodname].apply(pc,arguments);
						} ;
					}) ;
					exportmethods.localStorage = pc.localStorage ;
					exportmethods.localSettings = pc.localSettings ;

					try {
						var pobj = require('./plugins/' + plugin_name + '/index.js') ;
						// Plugin init must return procedure call callback function.
						Promise.all([pobj.init(exportmethods)]).then( p => {
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
	var method = params.method ;
	var procedure = params.path ;
	var args = params.args ;
	if(args==undefined) args={} ;

	return new Promise( (ac,rj)=>{
		try {
			if( procedure.length == 0 ){ // access for '/v1/' => plugin list
				var ps = {} ;
				for( var prfx in Plugins ){
					var plugin = Plugins[prfx] ;
					ps[prfx] = {
						path : plugin.getpath()
						, callable: (typeof plugin.procCallback == 'function')
					} ;
					if( args.option === 'true')
						ps[prfx].option = {
							leaf:false,doc:{short:'Plugin'}
							,settings_schema : plugin.getSettingsSchema()
							,settings : plugin.getSettings()
						}
				}
				ac(ps) ;
				return ;
			}
			var terms = procedure.split('/') ;
			var pprefix = terms[0] , pdevid = terms[1] , ppropname = terms[2] ;

			// Update settings.json
			if( method === 'POST' && Plugins[pprefix] != undefined
				&& pdevid === 'settings'
				&& (ppropname == undefined || ppropname == '') ){

				fs.writeFile( Plugins[pprefix].getpath()+'settings.json'
					, JSON.stringify(args,null,"\t") , function(){
						Plugins[pprefix].onSettingsUpdated(args) ;
						ac({success:true,message:'settings.json was successfully updated.'}) ;
					} ) ;
				return ;
			}


			if( pdevid != undefined && pdevid.length==0 )		pdevid = undefined ;
			if( ppropname != undefined && ppropname.length==0 )	ppropname = undefined ;
			if( terms.length > 3 && terms[3].length>0)	method = terms[3] ;
			var proccallback = Plugins[pprefix].procCallback ;
			if( typeof proccallback == 'function'){

				var bReplied = false ;
				Promise.all([proccallback(method.toUpperCase(),pdevid,ppropname,args)])
					.then(re=>{ if( !bReplied ){ bReplied = true ; ac(re[0]); } })
					.catch(re=>{ if( !bReplied ){ bReplied = true ; rj(re[0]); } }) ;
				setTimeout(()=>{if( !bReplied ){ bReplied = true ; rj({error:`GET request timeout:${pdevid}/${ppropname}`})}}
					,CALL_TIMEOUT) ;
			} else rj('Procedure callback is not defined for the plugin '+pprefix) ;
		} catch(e){
			rj('Invalidly formatted procedure: ' + procedure);
		} ;
	}) ;
} ;