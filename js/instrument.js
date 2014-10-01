jQuery(document).ready(function() {

    var qKey = 81;
    var wKey = 87;
    var eKey = 69;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////GUITAR////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function Guitar() {
        this.stringColor = 0x7f6b00;
        this.stringXPosition = 0;
        this.rotation = 1.57;
        this.stringLength = window.innerWidth;
        this.stringRadius = 2;
        this.stringDifference = 0.15;
        this.stringSpace = 5;
        this.stringsCount = 6;
        this.stringsArray = new Array(this.stringsCount);

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.rotateY(-0.3);
        this.camera.position.y = -20;
        this.camera.position.z = 100;
        this.scene.add(this.camera);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        this.directionalLight.position.set(-30, 10, 100);
        this.scene.add(this.directionalLight);

        this.renderer = new THREE.WebGLRenderer();

        $("#container").height($(window).height() / 1.5);
        this.renderer.setSize($("#container").innerWidth(), $("#container").innerHeight());
        this.renderer.setClearColor(0xffffff);
        $("#container").html(this.renderer.domElement);

        this.tuning = [E2, A2, D3, G3, B3, E4];

        this.Am = [0, A2, E3, A3, C4, E4];
        this.G = [G2, B2, D3, G3, D4, G4];
        this.D = [0, 0, D3, A3, D4, Gb4];

        this.amplifier = new Amplifier();
    }

    Guitar.prototype.initialize = function() {
        this.makeStrings();
        this.populateScene(this.stringsArray);
    };

    Guitar.prototype.makeStrings = function() {
        for(var i = 0; i < this.stringsCount; i++) {
            var geometry = new THREE.CylinderGeometry(this.stringRadius - this.stringDifference * i, this.stringRadius - this.stringDifference * i, this.stringLength, 50, 50);
            var material = new THREE.MeshPhongMaterial( { ambient: this.stringColor, color: this.stringColor, specular: 0xE5D5CE, shininess: 10, shading: THREE.FlatShading } );
            var mesh = new THREE.Mesh(geometry, material);

            var x = this.stringXPosition;
            var y = i * this.stringRadius * this.stringSpace;

            var string = new GuitarString(this, this.tuning[i], new THREE.Vector3(x, -y, -1), mesh, this.rotation);
            this.stringsArray[i] = string;
        }
    };

    Guitar.prototype.populateScene = function(objects) {
        for(var i = 0; i < objects.length; i++) {
            this.scene.add(objects[i].mesh);
        }
    };

    Guitar.prototype.pickingHandler = function(pickPosition) {
        var ray = new THREE.Ray(this.camera.position, pickPosition.sub(this.camera.position).normalize());

        for(var i = 0; i < this.stringsArray.length; i++) {
            if(ray.intersectBox(this.stringsArray[i].boundingBox) != null)
                this.stringsArray[i].vibrate();
        }
    };

    Guitar.prototype.stringDownHandler = function(keyCode) {
        var chord;
        if(keyCode == qKey)
            chord = this.Am;
        else if(keyCode == wKey)
            chord = this.G;
        else if(keyCode == eKey)
            chord = this.D;

        for(var i = 0; i < this.stringsArray.length; i++) {
            this.stringsArray[i].setStep(chord[i]);
        }
    };

    Guitar.prototype.stringReleaseHandler = function() {
        for(var i = 0; i < this.stringsArray.length; i++) {
            this.stringsArray[i].setStep(this.tuning[i]);
        }
    };

    Guitar.prototype.render = function(deltaTime) {
        for(var i = 0; i < this.stringsArray.length; i++) {
            this.stringsArray[i].update(deltaTime);
        }

        this.renderer.render(this.scene, this.camera);
    };

    Guitar.prototype.input = function(note) {
        this.amplifier.input(note);
    };

    Guitar.prototype.cutNote = function(note) {
        this.amplifier.cutNote(note);
    };

    Guitar.prototype.getDomElement = function() {
        return this.renderer.domElement;
    };
    //////////////////////////////////////////////////ENDGUITAR/////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////STRING////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function GuitarString(guitar, note, position, mesh, rotation) {
        this.guitar = guitar;
        this.note = note;

        this.position = position;
        this.mesh = mesh;

        this.mesh.rotateZ(rotation);

        this.mesh.position = this.position;

        this.boundingBox = new THREE.Box3();
        this.boundingBox.setFromObject(this.mesh);

        this.targetHeight = this.position.y;
        this.velocity = 0;

        this.tetnsion = 0.3;
        this.dampening = 0.05;

        this.step = 0;

        this.maxAmplitude = 1.4;
    }

    GuitarString.prototype.vibrate = function() {
        this.velocity = this.maxAmplitude;
        this.guitar.input(this.note + this.step);
    };

    GuitarString.prototype.update = function(deltaTime) {
        var x = this.position.y - this.targetHeight;
        this.velocity += -(this.tetnsion * x) - this.dampening * this.velocity;
        if(this.velocity > this.maxAmplitude * 2) {
            this.velocity = 0;
            this.position.y = this.targetHeight;
        }

        this.position.y += this.velocity * deltaTime;

        this.boundingBox.setFromObject(this.mesh);
    };

    GuitarString.prototype.setStep = function(step) {
        this.step = step - this.note;
    };

    //////////////////////////////////////////////////ENDSTRING/////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////AMPLIFIER/////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function Amplifier() {
        this.jazzGuitar = 26;
        this.acousticNylon = 24;
        this.electricClean = 27;

        this.activeInstrument = this.jazzGuitar;

        this.effects = new Effects(this);

        MIDI.loadPlugin({
            soundfontUrl: "./soundfont/",
            instruments: ["electric_guitar_jazz", "acoustic_guitar_nylon", "electric_guitar_clean"],
            callback: this.loadedHandler.bind(this)
        });

        this.activeEffects = new Object();
        for(var e in this.effects.EFFECT_TYPES) {
            this.activeEffects[this.effects.EFFECT_TYPES[e]] = false;
        }
        this.activeEffects[this.effects.EFFECT_TYPES.CLEAN] = true;
    }

    Amplifier.prototype.changeInstrumentHandler = function(instrument) {
        if(instrument == "jazz-guitar")
            this.activeInstrument = this.jazzGuitar;
        else if(instrument == "electric-clean")
            this.activeInstrument = this.electricClean;
        else if(instrument == "acoustic-nylon")
            this.activeInstrument = this.acousticNylon;

        MIDI.programChange(0, this.activeInstrument);
    };

    Amplifier.prototype.loadedHandler = function() {
        console.log("LOADED");
        MIDI.programChange(0, this.activeInstrument);
        MIDI.noteOn(0, 71, 127, 0)
    };

    Amplifier.prototype.input = function(note) {
        for(var e in this.activeEffects) {
            if(this.activeEffects[e] == true) {
                this.effects.applyEffect(note, e);
            }
        }
    };

    Amplifier.prototype.output = function(channel, note, velocity, delay) {
        MIDI.noteOn(channel, note, velocity, delay);
    };

    Amplifier.prototype.cutNote = function(note, delay) {
        MIDI.noteOff(0, note, delay);
    };

    Amplifier.prototype.effectChangeHandler = function(effect) {
        this.activeEffects[effect] = !this.activeEffects[effect];
    };

    //////////////////////////////////////////////////ENDAMPLIFIER//////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////EFFECTS//////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function Effects(amplifier) {
        if (!window.AudioContext) {
            if (!window.webkitAudioContext) {
                alert("Your browser sucks because it does NOT support any AudioContext!");
                return;
            }
            window.AudioContext = window.webkitAudioContext;
        }

        this.ctx = new AudioContext();

        this.EFFECT_TYPES = {
            CLEAN: "clean",
            ECHO: "echo",
            SPECIAL: "special"
        };

        this.amplifier = amplifier;

        this.decay = 0.4;
        this.delay = 1;

        this.delta = 0.8;
    }

    Effects.prototype.applyEffect = function(note, effect) {
        if(effect == this.EFFECT_TYPES.CLEAN)
            this.clean(note);
        if(effect == this.EFFECT_TYPES.ECHO)
            this.echo(note);
        if(effect == this.EFFECT_TYPES.SPECIAL)
            this.special(note);
    };

    Effects.prototype.echo = function(note) {
        var velocity = 30;
        var i = 0;
        while(velocity > 1) {
            this.amplifier.output(0, note, velocity, i * this.delay);
            velocity = velocity * this.decay;
            i++;
        }
    };

    Effects.prototype.clean = function(note) {
        this.amplifier.output(0, note, 30, 0);
    };

    Effects.prototype.special = function(note) {
        var freq = this.frequencyFromNoteNumber(note);
        var freqTwo = freq;
        for(var i = 0; i < 48; i++) {
            if(i == 8 || i == 32)
                freqTwo = freq / 2;
            else if(i == 16)
                freqTwo = freq * 2;


            var y = this.delta * Math.sin(2 * Math.PI * freq * i * 1 / 16);
            this.amplifier.output(0, this.noteFromPitch(freq + y * freq), 30 + 30 * y, i * 0.2);
            this.amplifier.output(0, this.noteFromPitch(freqTwo + y * freqTwo), 20 + 20 * y, i * 0.2);

            this.amplifier.cutNote(this.noteFromPitch(freq + y * freq), i * 0.2 + 0.2);
            this.amplifier.cutNote(this.noteFromPitch(freqTwo + y * freqTwo), i * 0.2 + 0.2);
        }
    };

    Effects.prototype.noteFromPitch = function(frequency) {
        var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
        return Math.round( noteNum ) + 69;
    };

    Effects.prototype.frequencyFromNoteNumber = function(note) {
        return 440 * Math.pow(2,(note - 69)/12);
    };

    //////////////////////////////////////////////////EFFECTS/////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////LOOPER////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function Looper(renderable, domElement) {
        this.renderable = renderable;
        this.domElement = domElement;

        this.lastTime = 0;
        this.deltaTime = 0;
    }

    Looper.prototype.calculateDeltaTime = function() {
        var timeNow = new Date().getTime();
        if(this.lastTime != 0) {
            this.deltaTime = (timeNow - this.lastTime) / 16;
        }
        this.lastTime = timeNow;
    };

    Looper.prototype.loop = function() {
        requestAnimationFrame(this.loop.bind(this), this.domElement);

        this.calculateDeltaTime();
        this.renderable.render(this.deltaTime);

    };

    //////////////////////////////////////////////////ENDLOOPER/////////////////////////////////////////////////

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////COMMUNICATOR//////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function Communicator(guitar) {
        this.guitar = guitar;
        this.projector = new THREE.Projector();
        this.domElement = this.guitar.getDomElement();

        this.isMouseDown = false;
        this.isKeyDown = false;

        $(document).on("mousedown", this.mouseDownHandler.bind(this));
        $(document).on("mouseup", this.mouseUpHandler.bind(this));
        $("#container").on("mousemove", this.mouseMoveHandler.bind(this));
        $(document).on("keydown", this.keyDownHandler.bind(this));
        $(document).on("keyup", this.keyUpHandler.bind(this));

        $(".clean-button").on("click", function() {
            this.guitar.amplifier.effectChangeHandler($(".clean-button").data("type"));
            this.changeButtonStatus($(".clean-button"));
        }.bind(this));

        $(".echo-button").on("click", function() {
            this.guitar.amplifier.effectChangeHandler($(".echo-button").data("type"));
            this.changeButtonStatus($(".echo-button"));
        }.bind(this));

        $(".special-button").on("click", function() {
            this.guitar.amplifier.effectChangeHandler($(".special-button").data("type"));
            this.changeButtonStatus($(".special-button"));
        }.bind(this));

        $(".clean-electric-guitar-button").on("click", function() {
            this.guitar.amplifier.changeInstrumentHandler("electric-clean");
        }.bind(this));

        $(".jazz-guitar-button").on("click", function() {
            this.guitar.amplifier.changeInstrumentHandler("jazz-guitar");
        }.bind(this));

        $(".acoustic-guitar-nylon-button").on("click", function() {
            this.guitar.amplifier.changeInstrumentHandler("acoustic-nylon");
        }.bind(this));
    }

    Communicator.prototype.changeButtonStatus = function(button) {
        if(button.find(".status").html() == "ON")
            button.find(".status").html("OFF");
        else
            button.find(".status").html("ON");
    };

    Communicator.prototype.changeInstrumentHandler = function(instrument) {

    };

    Communicator.prototype.mouseDownHandler = function(evt) {
        if(!this.isMouseDown)
            this.setIsMouseDown();
    };

    Communicator.prototype.mouseUpHandler = function(evt) {
        if(this.isMouseDown)
            this.setIsMouseDown();
    };

    Communicator.prototype.setIsMouseDown = function() {
        this.isMouseDown = !this.isMouseDown;
    };

    Communicator.prototype.mouseMoveHandler = function(evt) {
        if(this.isMouseDown) {
            var rect = this.domElement.getBoundingClientRect();
            var x = ((evt.clientX - rect.left) / $("#container").innerWidth()) * 2 - 1;
            var y = -((evt.clientY - rect.top) / $("#container").innerHeight()) * 2 + 1;
            var z = 0.5;

            var pickPosition = new THREE.Vector3(x, y, z);
            this.projector.unprojectVector(pickPosition, this.guitar.camera);
            this.guitar.pickingHandler(pickPosition);
        }
    };

    Communicator.prototype.keyDownHandler = function(evt) {
        if(evt.keyCode == qKey || evt.keyCode == wKey || evt.keyCode == eKey) {
            this.guitar.stringDownHandler(evt.keyCode);
            this.isKeyDown = true;
        }
    };

    Communicator.prototype.keyUpHandler = function(evt) {
        if(this.isKeyDown) {
            this.guitar.stringReleaseHandler();
            this.isKeyDown = false;
        }
    };

    //////////////////////////////////////////////////ENDCOMMUNICATOR///////////////////////////////////////////
    var guitar = new Guitar();
    guitar.initialize();

    var communicator = new Communicator(guitar);

    var looper = new Looper(guitar, guitar.getDomElement());
    looper.loop();
});