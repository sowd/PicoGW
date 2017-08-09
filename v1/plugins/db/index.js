const LocalStorage = require('node-localstorage').LocalStorage;

let pluginInterface ;
let log = console.log ;
const MYPATH  = __filename.split('/').slice(0,-1).join('/') ;
const localStorage = new LocalStorage( MYPATH+'/data' ) ;

exports.init = function(pi){
	pluginInterface = pi ;
	log = pi.log ;

	//pi.on('SettingsUpdated' , args =>{} ) ;

	return onProcCall ;
} ;

function onProcCall( method , devid , propname , args ){
	switch(method){
	case 'GET' :
		return {} ; //onProcCall_Get( method , devid , propname , args ) ;
	}
	return {error:`The specified method ${method} is not implemented in admin plugin.`} ;
}
/*
function onProcCall_Get( method , serviceid , propname , args ){
	return new Promise((ac,rj)=>{
		if( localStorage == undefined ){
		}
		if( serviceid == undefined ){
			let years = localStorage.getItem('years') ;
			years = (years == null ? [] : JSON.parse(years)) ;
			years.sort() ;
			let ret = {} ;
			years.forEach(fn=>{
				if( args.option === 'true' )	ret[fn]={option:{leaf:false}};
				else							ret[fn]={};
			}) ;
			ac(ret);
		} else {
			if( propname == undefined || propname.indexOf('/')<0 ){
				let bIsMonth = false ;
				if( propname == undefined )	propname = '' ;
				else					{	propname = '/'+propname ; bIsMonth = true ; }
				let key = `${serviceid}${propname}` ;	// year or year/month
				let months_or_days = localStorage.getItem(key) ;
				months_or_days = ( months_or_days == null ? [] : JSON.parse(months_or_days) ) ;

				months_or_days.sort() ;
				let ret = {} ;
				months_or_days.forEach(fn=>{
					if( args.option === 'true' )	ret[fn]={option:{leaf:bIsMonth }};
					else							ret[fn]={};
				}) ;
				ac(ret);
			} else {	// file
				let key = `${serviceid}/${propname}` ; // year/month/day
				let dayinfo = localStorage.getItem(key) ;
				dayinfo = (dayinfo == null ? [] : JSON.parse(dayinfo)) ;

				if( args && args.path && args.path != '*'){
					let reg = new RegExp(args.path) ;
					dayinfo = dayinfo.filter( entry => entry.path.match(reg)!=null ) ;
				}

				ac(dayinfo) ;
			}
		}
	}) ;
}
*/