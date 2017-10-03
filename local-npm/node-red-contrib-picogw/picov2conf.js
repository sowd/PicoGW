const PICOGW_PORT = 8080 ;

const fs = require('fs');
const PIPE_NAME = { // inverse of node.js side
    read:'v2/pipe_w'
    ,write:'v2/pipe_r'
};

let active_nodes = {} ;
const log = msg=>{console.log('[v2 conf] '+msg)} ;
function removeTailSlash(str){
    return str.slice(-1)=='/' ? str.slice(0,-1) : str ;
}

module.exports = function(RED) {
    connectPipe() ;


    function picov2(config) {
        config.path = removeTailSlash(config.path) ;

        RED.nodes.createNode(this,config);
        const node = this ;
        const path = config.path ;

        if( !(active_nodes[path] instanceof Array) )
            active_nodes[path] = [node] ;
        else
            active_nodes[path].push(node) ;

        node.on('input', function(msg) {
            if(msg.payload != null ) msg = msg.payload ;
            const ret = {
                path:'/v2/'+path
                ,value:msg.value
            } ;
            if( typeof msg.reqid == 'number' ) ret.reqid = msg.reqid ;
            else ret.method='PUB' ;
            //log('WStream.write:'+JSON.stringify(ret)) ;
            wstream.write(JSON.stringify(ret)+'\n') ;
        });

        node.on('close', function(msg) {
            active_nodes[path] = active_nodes[path].filter(n=>n!=node) ;
        }) ;
    }
    RED.nodes.registerType("pico v2 conf",picov2);
}

let wstream ;

function connectPipe(){
    function connect(){
        if( wstream == null ){
            //log(`connecting ${PIPE_NAME.read} and ${PIPE_NAME.write}`);

            Promise.all([
                // Open read stream
                new Promise((ac2,rj2)=>{
                    let rstream = fs.createReadStream(PIPE_NAME.read, 'utf-8');
                    rstream.on('error',e=>{
                        console.error('Pipe connection error:');
                        console.error(JSON.stringify(e));
                        rj2() ;
                    });
                    rstream.on('open', ()=>{
                        ac2() ;
                    });
                    rstream.on('close', ()=>{
                        log('Read pipe closed.') ;
                        rj2() ;
                    });

                    var readbuf = '' ;
                    rstream.on('data', data=>{
                        readbuf += data ;

                        var ri = readbuf.lastIndexOf("\n") ;
                        if( ri < 0 ) return ;
                        var focus = readbuf.slice(0,ri) ;
                        readbuf = readbuf.slice(ri+1) ;

                        try {
                            focus = JSON.parse(focus) ;
                            focus.path = removeTailSlash(focus.path) ;
                            //log('onData:'+JSON.stringify(focus)) ;
                            if( active_nodes[focus.path] instanceof Array ){
                                active_nodes[focus.path].forEach(n=>{
                                    switch( focus.method ){
                                    case 'GET': n.send([focus,null]) ; break ;
                                    case 'PUT': n.send([null,focus]) ; break ;
                                    }
                                }) ;
                            } else {
                                wstream.write(JSON.stringify(
                                    {error:'No such resource:'+focus.path
                                    ,reqid:focus.reqid}
                                )+'\n') ;
                            }
                        } catch(e){}
                    });
                })

                // Open write stream
                ,new Promise((ac2,rj2)=>{
                    // Write stream setup
                    wstream = fs.createWriteStream(PIPE_NAME.write, 'utf-8');
                    wstream .on('drain', ()=>{})
                        .on('open',()=>{
                            ac2() ;
                        })
                        .on('error', e=>{
                            console.error('Pipe connection error:');
                            console.error(JSON.stringify(e));
                        })
                        .on('close', ()=>{
                            log('Write pipe closed.');
                        }) ;
                })
            ]).then(()=>{
                log('Connected to PicoGW v2 API manager.');
            }).catch(()=>{}) ;
	   }
    }

    connect() ;
}