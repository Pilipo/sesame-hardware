// INCLUDE DOT ENV TO OBSCURE SENSATIVE DATA
require('dotenv').config({path: '/home/pi/Code/sesame-hw/.env'});
// INCLUDE BLYNK AND ONOFF TO CONTROL THE PINS
var Blynk = require('blynk-library');
var Gpio = require('onoff').Gpio;
// INCLUDE CMD LINE INTERFACE
var cmd = require('node-cmd');
// INCLUDE EVENT WATCHER ON THE MOUSE AT EVENT0
var ie = require('input-event');
var input = new ie('/dev/input/event0');
var mouse = new ie.Mouse(input);
// INCLUDE LOGGER FOR DEBUG AND DATA GATHERING
const log = require('simple-node-logger').createSimpleFileLogger('/home/pi/Code/sesame-hw/sesame.log');

// INIT THE BLYNK CLIENT
var AUTH = process.env.AUTH;
var blynk = new Blynk.Blynk(AUTH, options = {
    connector : new Blynk.TcpClient( options = { addr:process.env.IP, port:8442 } )
});

// SET TO TRUE TO ENABLE DOOR ACTIVATION
var ARMED = false;

//***********************************
// INIT A FEW PINS.
//***********************************
// VIRTUAL 0:   TIED TO THE "LOCK" BUTTON ON THE APP
// VIRTUAL 1:   TIED TO THE "ACTIVATOR" BUTTON ON THE APP
// VIRTUAL 10:  TIED TO THE CAMERA MODE SELETION ON THE APP
// VIRTUAL 11:  TIED TO THE "TAKE PICTURE" BUTTON ON THE APP
// LEDLOCK:     ACTUAL GPIO CONTROL OF THE LED PIN ON THE HARDWARE
// GARAGEMOTOR: ACTUAL GPIO CONTROL OF THE 4066 IC THAT SHORTS THE GARAGE OPENER
//***********************************/
var v0 = new blynk.VirtualPin(0);
var v1 = new blynk.VirtualPin(1);
var v10 = new blynk.VirtualPin(10);
var v11 = new blynk.VirtualPin(11);
var v13 = new blynk.VirtualPin(13);
var v12 = new blynk.VirtualPin(12);
var v20 = new blynk.VirtualPin(20);
var v21 = new blynk.VirtualPin(21);
var ledLock = new Gpio(18, 'out');
var garageMotor = new Gpio(17, 'out');

var locked = true;
var blinkProgress = 0;
const blinkCount = 58;
var date = new Date();
var garageState = {
    CLOSED: 0,
    OPENED: 1,
    OPENING: 2,
    CLOSING: 3,
};
/**
 * BUILD THE GARAGE OBJECT
 */
var Garage = function(){
    var self = this;

    this.status = garageState.CLOSED;
    this.inMotion = false;
    this.position = 0;
    this.ceiling = 0;
    this.lastMovement = 0;

    this.positionWatcher = function(lastMovement, timeout) {
        var timeout = timeout || 500;

        if(this.lastMovement == lastMovement) {
            v12.write(this.position);
        }
        setTimeout(function(){
            self.positionWatcher(this.lastMovement, timeout);
        }, timeout);
    };

    this.activateIndicators = function() {
        locked = true;
        ledLock.writeSync(0);
        v0.write(1);
        v20.write(0);
        v21.write(0);
        this.inMotion = true;
        if(this.status == garageState.CLOSED) {
            this.status = garageState.OPENING;
        } else {
            this.status = garageState.CLOSING;
        }
        v13.write(centerText(garage.statusToString()));

        // THIS SHOULD BE ADDED TO THE VIRTUAL AND PHYSICAL PINS
        blink(blinkCount);
    };

    this.activateOpener = function(holdTime) {
        var holdTime = holdTime || 200;
    
        // this.status += 2;
        if (ARMED === true) {
            garageMotor.writeSync(1);
            setTimeout(function(){
                garageMotor.writeSync(0);
            }, holdTime);    
        }
    }

    this.statusToString = function(state) {
        var state = state || this.status;
        var keyNames = Object.keys(garageState);
        for (var i in keyNames) {
            if (state == i) {
                return keyNames[i];
            }
        }
    }
};

var garage = new Garage();

// THIS OPENS AND CLOSE THE GARAGE. BE CAREFUL!

v1.on('write', function(param) {
    if(locked == false) {
        if (param[0] == 1) {
            garage.activateIndicators();
            garage.activateOpener(500);
        }
    }
});

// THIS IS THE LOCK FOR THE GARAGE BUTTON

v0.on('write', function(param) {
    if (garage.inMotion == true) {
        // blynk.virtualWrite(0, 1);
        v0.write(1);
        return;
    }
    if(param[0] == 0) {
        locked = false;
        ledLock.writeSync(1);
    }
    if(param[0] == 1) {
        locked = true;
        ledLock.writeSync(0);
    }
});

// Control Camera Exposure

v10.on('write', function(param){
    if (garage.inMotion == true) {
        return;
    }
    var index = param[0];
    switch (index) {
        case "1":
            log.info("Exposure: Auto");
            cmd.run('echo "em auto" > /var/www/html/camera/FIFO');
            break;
        case "2":
            log.info("Exposure: Night");
            cmd.run('echo "em night" > /var/www/html/camera/FIFO');
            break;
        case "3":
            log.info("Exposure: Spotlight");
            cmd.run('echo "em spotlight" > /var/www/html/camera/FIFO');
            break;
        default:
            log.info("What happened?");
            log.info(index);

            break;
    }
});

// SNAP A PIC

v11.on('write', function(param){
    if (param[0] == "1") {
        cmd.run('echo "im 1" > /var/www/html/camera/FIFO');
    }
});

function centerText(text, targetLength) {
    var targetLength = targetLength || 16;
    var difference = targetLength - text.length;
    var returnText = "";

    if (difference <= 0) {
        return text;
    }

    for (i=0; i<(difference/2); i++) {
        returnText += " ";
    }
    returnText += text;
    for (i=0; i<(difference/2); i++) {
        returnText += " ";
    }
    return returnText;
}

function blink(count) {

    if (garage.status == garageState.CLOSING) {
        blinkProgress = Math.round(100*(count/blinkCount));
    } else if (garage.status == garageState.OPENING) {
        blinkProgress = Math.round(100-(100*(count/blinkCount)));
    }
    v13.write(centerText(garage.statusToString()));
    // v13.write("0123456789ABCDEF012345");
    v12.write(blinkProgress);
    if (count <= 0) {
        ledLock.write(0);
        garage.inMotion = false;
        log.info("Blinker stopped.");
        if(garage.status == garageState.OPENING) {
            garage.ceiling = Math.max(garage.ceiling, garage.position);
            // mouse.ceiling = mouse.y;
            log.info("Garage is open with a ceiling of: " + garage.ceiling);
            v20.write(255);
            v21.write(0);
            garage.status = garageState.OPENED;
        }
        if(garage.status == garageState.CLOSING) {
            garage.position = 0;
            // mouse.y = 0;
            log.info("Garage has closed.");
            v20.write(0);
            v21.write(255);
            garage.status = garageState.CLOSED;
        }
        v13.write(centerText(garage.statusToString()));
        // blynk.virtualWrite(13, garageStatus);

        return;// garageMotor.unexport();
    }

    ledLock.read(function (err, value) { // Asynchronous read.
        if (err) {
          throw err;
        }

        ledLock.write(value ^ 1, function (err) { // Asynchronous write.
          if (err) {
            throw err;
          }
        });
    });

    setTimeout(function () {
        blink(count - 1);
    }, 200);
}

mouse.on('move', function(data) {
    if (data.code == 1) {

        // WATCH FOR LOCAL GARAGE ACTIVATION
        if (garage.inMotion == false) {
            blynk.notify("Somebody activated the garage!");
            log.info("Somebody activated the garage!");
            garage.activateIndicators();

            if ((data.value + garage.position) < garage.position) {
                // LESS THAN MEANS THE GARAGE IS CLOSING
                if(garage.status != garageState.CLOSING) {
                    // THIS INDICATES THAT THE GARAGE IS ACTUALLY CLOSING, 
                    // THOUGH THE SYSTEM THINKS IT IS OPENING
                    garage.status = garageState.CLOSING;
                }
            } else {
                // GREATER THAN MEANS THE GARAGE IS OPENING
                if(garage.status != garageState.OPENING) {
                    // THIS INDICATES THAT THE GARAGE IS ACTUALLY OPENING, 
                    // THOUGH THE SYSTEM THINKS IT IS CLOSING
                    garage.status = garageState.CLOSING;
                }
            }    
        }

        garage.position += data.value;
        log.info("garage position = " + garage.position);
        garage.lastMovement = date.getMilliseconds();
    }
    // log.info("mouse y=" + mouse.y);
    // cmd.run('echo "X:' + mouse.x + ' :: Y: ' + mouse.y + '" >> sesame.log');
});
