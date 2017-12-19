#!/bin/bash

DIR=/home/pi/Code/sesame-hw

mv $DIR/sesame.log $DIR/sesame-$(date +%N).log
touch $DIR/sesame.log

until $(/usr/bin/node $DIR/sesame.js >> sesame-run.log); do
	mv $DIR/sesame.log $DIR/sesame-$(date +%N).log
	touch $DIR/sesame.log
	echo "Sesame Client has crashed with exit code $?. Respawning... " >&2
	echo "$(date) :: Sesame Client has crashed with exit code $?. Respawning... " >> sesame-run.log
	sleep 1
done
