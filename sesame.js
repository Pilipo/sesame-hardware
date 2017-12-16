require('dotenv').config();
var Blynk = require('blynk-library');
var Gpio = require('onoff').Gpio;
var cmd = require('node-cmd');
var ie = require('input-event');
var input = new ie('/dev/input/event0');
var mouse = new ie.Mouse(input);
const log = require('simple-node-logger').createSimpleFileLogger('sesame.log');
mouse.x = mouse.y = 0;

var AUTH = process.env.AUTH;

var blynk = new Blynk.Blynk(AUTH, options = {
    connector : new Blynk.TcpClient( options = { addr:process.env.IP, port:8442 } )
});

var v0 = new blynk.VirtualPin(0);
var v1 = new blynk.VirtualPin(1);
var v10 = new blynk.VirtualPin(10);
var v11 = new blynk.VirtualPin(11);
var ledLock = new Gpio(18, 'out');
var garageMotor = new Gpio(17, 'out');
var locked = true;
var garageStatus = 'closed';
var garageInMotion = false;
var blinkProgress = 0;
const blinkCount = 58;

// THIS OPENS AND CLOSE THE GARAGE. BE CAREFUL!

v1.on('write', function(param) {
    if(locked == false) {
        if (param[0] == 1) {
            locked = true;
            ledLock.writeSync(0);
            blynk.virtualWrite(0, 1);
            pressGarage(500);
            garageInMotion = true;
            blink(blinkCount);
        }
    }
});

// THIS IS THE LOCK FOR THE GARAGE BUTTON

v0.on('write', function(param) {
    if (garageInMotion == true) {
        blynk.virtualWrite(0, 1);
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
    if (garageInMotion == true) {
        return;
    }
    var index = param[0];
    switch (index) {
        case "1":
            console.log("Exposure: Auto");
            cmd.run('echo "em auto" > /var/www/html/camera/FIFO');
            break;
        case "2":
            console.log("Exposure: Night");
            cmd.run('echo "em night" > /var/www/html/camera/FIFO');
            break;
        case "3":
            console.log("Exposure: Spotlight");
            cmd.run('echo "em spotlight" > /var/www/html/camera/FIFO');
            break;
        default:
            console.log("What happened?");
            console.log(index);
            
            break;
    }
});

// SNAP A PIC

v11.on('write', function(param){
    if (param[0] == "1") {
        cmd.run('echo "im 1" > /var/www/html/camera/FIFO');
    }
});

function pressGarage(timeout) {
    if (typeof timeout == 'undefined') {
        timeout = 200;
    }

    garageMotor.writeSync(1);
    setTimeout(function(){
        garageMotor.writeSync(0);
    }, timeout);
}

function blink(count) {

    if (garageStatus == "closing" ) {
        blinkProgress = Math.round(100*(count/blinkCount));
    } else if (garageStatus == "opening") {
        blinkProgress = Math.round(100-(100*(count/blinkCount)));
    } 
    // log.info("Door progress:" + blinkProgress);
    blynk.virtualWrite(12, blinkProgress);

    if (count <= 0) {
        ledLock.write(0);
        garageInMotion = false;
        log.info("Blinker stopped.");
        if(garageStatus == "opening") {
            mouse.ceiling = mouse.y;
            log.info("Garage is open with a ceiling of: " + mouse.ceiling);
            blynk.virtualWrite(20, 255);
            blynk.virtualWrite(21, 0);
            garageStatus = "opened";
        }
        else if(garageStatus == "closing"){
            mouse.y = 0;
            log.info("Garage has closed.");
            blynk.virtualWrite(20, 0);
            blynk.virtualWrite(21, 255);
            garageStatus = "closed";
        }
        blynk.virtualWrite(13, garageStatus);

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
        if ((data.value + mouse.y) < mouse.y) {
            if(garageStatus != "closing") {
                garageStatus = "closing";
                blynk.virtualWrite(20, 0);
                blynk.virtualWrite(21, 0);
                blynk.virtualWrite(13, garageStatus);
            }
        } else {
            if(garageStatus != "opening") {
                garageStatus = "opening";
                blynk.virtualWrite(20, 0);
                blynk.virtualWrite(21, 0);
                blynk.virtualWrite(13, garageStatus);
            }
        }
        mouse.y += data.value;
        log.info("mouse.y = " + mouse.y);
    }
    // log.info("y=" + mouse.y);
    // console.log("Mouse X: " + mouse.x +"; Mouse Y: " + mouse.y);
    // cmd.run('echo "X:' + mouse.x + ' :: Y: ' + mouse.y + '" >> sesame.log');
});