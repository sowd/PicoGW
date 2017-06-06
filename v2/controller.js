"use strict";

var VERSION = 'v2';
//var fs = require('fs');

exports.init = function(cmd_opts){
	console.log('API version '+VERSION+' initialized.') ;
	return Promise.resolve({}) ;
} ;

exports.callproc = function(params){
	return new Promise((ac,rj)=>{
		ac(params) ;
	}) ;
} ;