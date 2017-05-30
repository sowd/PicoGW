////////////////////////////////////////////////
////////////////////////////////////////////////
//  Plugin and Client interfaces
// Plugin context that is passed to each plugin constructor
"use strict";

var fs = require('fs');

var globals = {} ;	// VERSION, admin, PubSub
exports.PluginContext = class {
	constructor ( _globals,prefix ) {
		globals = _globals ;
	    this.prefix = prefix ;
	    this.log = (msg) => { console.log(`${this.prefix} plugin> ${msg}`); };

	    const LOCAL_STORAGE_PATH = this.getpath()+'localstorage.json' ;
	    this.localStorage = {
	    	clear : function(){ fs.writeFileSync(LOCAL_STORAGE_PATH,'{}') ;}
	    	, setItem : function(keyName,keyValue){
	    		var st = {} ;
	    		try {
	    			st = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH).toString()) ;
	    		} catch(e){}
	    		st[keyName] = keyValue ;
    			fs.writeFileSync(LOCAL_STORAGE_PATH,JSON.stringify(st,null,"\t")) ;
	    	}
	    	, getItem : function(keyName , defaultValue){
	    		var st = {} ;
	    		try {
	    			st = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH).toString()) ;
	    		} catch(e){}
	    		return st[keyName] == undefined ? defaultValue : st[keyName] ;
	    	}
	    	, removeItem : function(keyName){
	    		var st = {} ;
	    		try {
	    			st = JSON.parse(fs.readFileSync(LOCAL_STORAGE_PATH).toString()) ;
	    		} catch(e){}
	    		delete st[keyName] ;
    			fs.writeFileSync(LOCAL_STORAGE_PATH,JSON.stringify(st,null,"\t")) ;
	    	}
	    } ;
	}

	publish (devid, topicname, args) {
		globals.PubSub.pub(`${this.prefix}/${devid}/${topicname}`,args) ;
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
	// Get plugin home dir
	getpath (){
		return `${globals.VERSION}/plugins/${this.prefix}/`;
	}
} ;