var Blynk = require('blynk-library');
var Gpio = require('onoff').Gpio;
var cmd = require('node-cmd');
var ie = require('input-event');
var input = new ie('/dev/input/event0');
var mouse = new ie.Mouse(input);
mouse.x = mouse.y = 0;

var AUTH = '9bc8eb8d80c049ff89927c587ddd239f';

var blynk = new Blynk.Blynk(AUTH, options = {
    connector : new Blynk.TcpClient( options = { addr:"192.168.1.120", port:8442 } )
});

var v0 = new blynk.VirtualPin(0);
var v1 = new blynk.VirtualPin(1);
var v10 = new blynk.VirtualPin(10);
var v11 = new blynk.VirtualPin(11);
var ledLock = new Gpio(18, 'out');
var garageMotor = new Gpio(17, 'out');
var locked = true;
var garageInMotion = false;

// THIS OPENS AND CLOSE THE GARAGE!

v1.on('write', function(param) {
    if(locked == false) {
        if (param[0] == 1) {
            locked = true;
            ledLock.writeSync(0);
            blynk.virtualWrite(0, 1);
            pressGarage(500);
            garageInMotion = true;
            blink(75);
        }
    }
});

// THIS IS THE LOCK FOR THE GARAGE MOTOR

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

    if (count <= 0) {
        ledLock.write(0);
        garageInMotion = false;
        console.log("Blink complete!");
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
    if (data.code == 0) {
        mouse.x += data.value;
    }
    if (data.code == 1) {
        mouse.y += data.value;
    }
    console.log("Mouse X: " + mouse.x +"; Mouse Y: " + mouse.y);
});