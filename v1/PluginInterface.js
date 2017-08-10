// Plugin interface that is passed to each plugin constructor
"use strict";

var fs = require('fs');
let SingleFileLocalStorage = require('../MyLocalStorage.js').SingleFileLocalStorage ;

var globals = {} ;	// VERSION, admin, PubSub
exports.PluginInterface = class {
	constructor ( _globals,prefix ) {
		globals = _globals ;
	    this.prefix = prefix ;
	    this.log = (msg) => { console.log(`${this.prefix} plugin> ${msg}`); };

	    this.localStorage = new SingleFileLocalStorage(this.getpath()+'localstorage.json') ;
	    this.localSettings = new SingleFileLocalStorage(this.getpath()+'settings.json') ;

	    //These can return Promise, but never call reject().
		this.getSettingsSchema = ()=>{ try {
   			return JSON.parse(fs.readFileSync(this.getpath()+'settings_schema.json').toString()) ;
   		} catch(e){} } ;
		this.getSettings = ()=>{ try {
   			return JSON.parse(fs.readFileSync(this.getpath()+'settings.json').toString()) ;
   		} catch(e){} } ;

   		
	    this.onSettingsUpdated = newsettings=>{} ;
   	}
	setOnGetSettingsSchemaCallback(callback){ this.getSettingsSchema = callback ; }
	setOnGetSettingsCallback(callback){ this.getSettings = callback ; }
	setOnSettingsUpdatedCallback(callback){ this.onSettingsUpdated = callback ; }

	publish ( /*devid,*/ topicname, args) {
		if( topicname.slice(-1)=='/') topicname=topicname.slice(0,-1) ;
		var re = {method:'PUB'} ;
		var path = `/${globals.VERSION}/${this.prefix}/${topicname}` ;
		//var path = `/${globals.VERSION}/${this.prefix}/${devid}/${topicname}` ;
		re[path] = args ;
		globals.PubSub.pub(path,re /*{method:'PUB',path:path,args:args}*/) ;
	}

	// Returns promise
	getNetIDFromIPv4Address (ipv4addr) {
		if( this.prefix == 'admin')
			return Promise.reject('Cannot call getNetIDFromIPv4Address from admin plugin') ;
		return globals.admin.getNetIDFromIPv4Address_Forward(ipv4addr) ;
	}

	// callbacks_obj can contain the following four members
	// onNewIDFoundCallback			: function(newid,newip) ;
	// onIPAddressLostCallback		: function(id,lostip) ;
	// onIPAddressRecoveredCallback	: function(id,recoveredip) ;
	// onIPAddressChangedCallback	: function(id,oldip,newip) ;
	setNetIDCallbacks (callbacks_obj) {
		globals.admin.setNetIDCallbacks_Forward(this.prefix , callbacks_obj) ;
	}


	getPubKey(){ return globals.admin.getPubKey() ; }
	encrypt(){ return globals.admin.getPubKey() ; }
	decrypt(){ return globals.admin.decrypt() ; }
	// handlerName = 'SettingsUpdated', etc...
	on(handlerName,handler_body){ this['on'+handlerName] = handler_body ; }
	off(handlerName){ delete this['on'+handlerName] ; this['on'+handlerName] = undefined ;}
	// Get plugin home dir
	getpath(){ return `${globals.VERSION}/plugins/${this.prefix}/` ; }

	getprefix (){ return this.prefix; }
} ;