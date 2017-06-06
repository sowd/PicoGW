"use strict";

const VERSION = 'v2';
//var fs = require('fs');

exports.init = function(cmd_opts){
	return Promise.resolve({}) ;
} ;

exports.callproc = function(params){
	return new Promise((ac,rj)=>{
		ac(params) ;
	}) ;
} ;