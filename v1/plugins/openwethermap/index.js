var fs = require('fs');
let http = require('http');

const REQ_TIMEOUT = 30*1000 ;
const OPENWEATHERMAP_BASE_URL = 'http://api.openweathermap.org/data/2.5/' ;

let pluginInterface ;
let log = console.log ;


exports.init = function(pi){
	pluginInterface = pi ;
	log = pi.log ;

	// pi.on('SettingsUpdated' , newSettings =>{ apikey = newSettings.apikey ; } ) ;

	return onProcCall ;
} ;

function onProcCall( method , path , args ){
	let apikey ;
	try {
		apikey = JSON.parse(
				fs.readFileSync(pluginInterface.getpath()+'settings.json').toString()
			).apikey ;
	} catch(e){
		return {error:'No openweathermap API key is specified.\nYou can obtain your own api key by creating OpenWeatherMap account on https://home.openweathermap.org/users/sign_up'}
	} ;

	let re = {
		weather:{
			lat:'latitude',lon:'longitude'
			, q:'{city name} or {city name. eg."London"},{country code. eg."uk"}.'
			, zip: 'alternatively zip code can be specified.'
		}
		,forecast:{
			lat:'latitude',lon:'longitude'
			, q:'{city name} or {city name. eg."London"},{country code. eg."uk"}.'
			, zip: 'alternatively zip code can be specified.'
		}
	} ;
	if( args && args.option === 'true' ){
		re.weather.option = {
			doc:{
				short:'Current weather'
				,long:
					'Case 1: ?q={city name}(in ISO 3166 country codes) // '
					+'Case 2: ?q={city name},{country code} // '
					+'Case 3: ?id={city ID}    (See http://bulk.openweathermap.org/sample/) // '
					+'Case 4: ?lat={lat}&lon={lon} // '
					+'Case 5: ?zip={zip code},{country code}'

			}
		} ;
		re.forecast.option = {
			doc:{
				short:'5 day / 3 hour weather forecast'
				,long:
					'Case 1:  ?q={city name},{country code}  (both in ISO 3166 country codes) // '
					+'Case 2:  ?id={city ID}    (See http://bulk.openweathermap.org/sample/) // '
					+'Case 3:  ?lat={lat}&lon={lon} // '
					+'Case 4:  ?zip={zip code},{country code}'
			}
		} ;
	}

	switch(method){
	case 'GET' :
		if( path == ''){
			return re ;
		}

		return new Promise( (ac,rj)=>{
			try {
				let args_flat = '' ;
				for( let key in args )
					args_flat += key+'='+args[key]+'&' ;

				if( args_flat.length==0 ){ // No args
					switch( path ){
					case 'weather' :
					case 'forecast' :
						ac(re[path]) ;
						return ;
					}
					rj({error:'No such path:'+path}) ;
					return ;
				}
				http.get(`${OPENWEATHERMAP_BASE_URL}${path}?${args_flat}APPID=${apikey}`, function(res) {
					res.setEncoding('utf8');
					let rep_body = '' ;
					res.on('data', function(str) {
						rep_body += str ;
					}) ;
					res.on('end', function() {
						try {
							ac(JSON.parse(rep_body)) ;
						} catch(e){ rj({error:e.toString()}); };
					});
				})
				.setTimeout(REQ_TIMEOUT)
				.on('timeout', function() {
					rj({error:'Request time out'});
				}).on('error', function(e) {
					rj({error:e.message});
				});
			} catch(e){ rj({error:e.toString()}); };
		}) ;
	case 'POST' :
	case 'PUT' :
	case 'DELETE' :
	default :
		return {error:`The specified method ${method} is not implemented in admin plugin.`} ;
	}
}