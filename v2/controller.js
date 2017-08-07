"use strict";

const VERSION = 'v2';

let MyLocalStorage = require('../MyLocalStorage.js').MyLocalStorage ;

let globals,client ;

exports.init = function(_globals,clientFactory){
	return new Promise((ac,rj)=>{
		globals = _globals ;
		clientFactory().then(_client=>{
			client = _client ;
			ac({}) ;
		}).catch(e=>{rj(e);}) ;
	});
} ;

exports.callproc = function(params){
	//console.log('V2 API :: \n'+JSON.stringify( params,null,'\t' ) ) ;

	while( params.path[params.path.length-1]=='/' ){
		params.path = params.path.slice(0,-1) ;
	}
	let aliases = localStorage.getItem('aliases',{}) ;
	if( params.path.length == 0 )
		return Promise.resolve( aliases ) ;

	for( let ppath in SPECIAL_PATHS )
		if( params.path.indexOf(ppath) == 0 )
			return SPECIAL_PATHS[ppath](params) ;

	if( params.path.length == 0 || aliases[params.path] == undefined )
		return Promise.resolve({error:`Alias ${params.path} not found`}) ;
	// Found alias in the path
	params.path = aliases[params.path] ;	// Replace path and proceed
	return client.callproc(params) ;
} ;


// Alias

const MYPATH = __filename.split('/').slice(0,-1).join('/')+'/' ;
const LOCAL_STORAGE_PATH = MYPATH+'localstorage.json' ;
let localStorage = new MyLocalStorage(LOCAL_STORAGE_PATH) ;

const SPECIAL_PATHS = {
	'function/alias' : params => {
		let aliases = localStorage.getItem('aliases',{}) ;
		let path = params.path.slice('function/alias'.length+1) ;
		let ret = {} ;
		switch(params.method){
		case 'GET' :
			ret = localStorage.getItem('aliases',{}) ;
			break ;
		case 'POST' : // Newly create a new alias
			if( path.length==0 )
				ret = {error:'No alias name is specified for creation.'} ;
			else if( params.args.path == undefined )
				ret = {error:'No path name is specified for alias creation.'} ;
			else if( aliases[path] != undefined )
				ret = {error:`The alias ${path} already exists.`} ;
			else {
				aliases[path] = params.args.path ;
				localStorage.setItem('aliases',aliases) ;
				ret = {success:true,message:`Alias ${path} is successfully associated with the path ${params.args.path}`} ;
			}
			break ;
		case 'PUT' : // Replace an existing alias
			if( path.length==0 )
				ret = {error:'No alias name is specified for replacement.'} ;
			else if( params.args.path == undefined )
				ret = {error:'No path name is specified for alias replacement.'} ;
			else if( aliases[path] == null )
				ret = {error:`The alias ${path} does not exist.`} ;
			else {
				aliases[path] = params.args.path ;
				localStorage.setItem('aliases',aliases) ;

				ret = {success:true,message:`Alias ${path} is successfully updated with the path ${params.args.path}`} ;
			}
			break ;
		case 'DELETE' : // Replace an existing alias
			if( path.length==0 )
				ret = {error:'No alias name is specified for deletion.'} ;
			else if( aliases[path] == undefined )
				ret = {error:`Alias name ${path} does not exist.`} ;
			else {
				delete aliases[path] ;
				localStorage.setItem('aliases',aliases) ;

				ret = {success:true,message:`Alias ${path} was successfully removed`} ;
			}
			break ;
		default :
			ret = {error:`Unknown method ${params.method} for alias setting.`} ;
		}
		return Promise.resolve(ret) ;
	}
	, 'function' : params => {
		if( params.method == 'GET' ){
			let re = {} ;
			for( let sp in SPECIAL_PATHS )
				if( sp.indexOf('function/')==0 ){
					let cp = sp.slice('function/'.length) ;
					if( cp.indexOf('/')<0 )
						re[cp] = {} ;
				}
			return Promise.resolve(re) ;
		}
		return Promise.resolve({error:`The method ${params.method} is not supported.`}) ;
	}
}
