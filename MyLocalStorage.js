"use strict";

let fs = require('fs');

exports.MyLocalStorage = class {
	constructor (MYPATH){
		this.MYPATH = MYPATH ;
	}
	clear(){ fs.writeFileSync(this.MYPATH,'{}') ;}
	setItem(keyName,keyValue){
		let st = {} ;
		try {
			st = JSON.parse(fs.readFileSync(this.MYPATH).toString()) ;
		} catch(e){}
		st[keyName] = keyValue ;
		fs.writeFileSync(this.MYPATH,JSON.stringify(st,null,"\t")) ;
	}
	getItem(keyName , defaultValue){
		let st = {} ;
		try {
			st = JSON.parse(fs.readFileSync(this.MYPATH).toString()) ;
		} catch(e){}
		return st[keyName] == undefined ? defaultValue : st[keyName] ;
	}
	removeItem(keyName){
		let st = {} ;
		try {
			st = JSON.parse(fs.readFileSync(this.MYPATH).toString()) ;
		} catch(e){}
		delete st[keyName] ;
		fs.writeFileSync(this.MYPATH,JSON.stringify(st,null,"\t")) ;
	}
}