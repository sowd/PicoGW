#!/bin/sh

if [ $# -eq 0 ]; then
	node --inspect main.js
elif [ $1 = "break" ]; then
	node --inspect --debug-brk main.js $2 $3 $3 $5 $6 $7 $8 $9
elif [ $1 = "start" ]; then
	forever start --inspect main.js $2 $3 $3 $5 $6 $7 $8 $9
elif [ $1 = "stop" ]; then
	forever stop main.js $2 $3 $3 $5 $6 $7 $8 $9
elif [ $1 = "help" ]; then
        echo './debug.sh [brk|start|stop|help]'
	echo ''
	echo 'No argument: run with node-inspector'
	echo 'break: Break at the beginning'
	echo 'start: forever start'
	echo 'stop: forever stop'
	echo 'help: show this message'
else
	node --inspect main.js $1 $2 $3 $3 $5 $6 $7 $8 $9
fi

