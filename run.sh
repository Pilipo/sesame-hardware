#!/bin/bash

until $(/usr/bin/node /home/pi/Code/sesame-hw/sesame.js); do
	echo "Sesame Client has crashed with exit code $?. Respawning... " >&2
	echo "$(date) :: Sesame Client has crashed with exit code $?. Respawning... " >> sesame-run.log
	sleep 1
done
