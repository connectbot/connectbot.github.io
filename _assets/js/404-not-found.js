let drawModule = (function() {
    "use strict";

    /** @type HTMLCanvasElement */
    let canvas = undefined;
    /** @type CanvasRenderingContext2D */
    let ctx = undefined;
    /** @type Particle[] */
    let particles = [];
    let padding = 36;

    /** @type number */
    let renderStuff = undefined;

    function findTarget() {
        let possibleCanvas = document.getElementById("scene");
        if (!(possibleCanvas instanceof HTMLCanvasElement)) {
            throw "#scene must be a <canvas> element!";
        }
        canvas = possibleCanvas;
        ctx = canvas.getContext("2d");
    }

    /**
     *
     * @param {number} x - x coordinate of particle
     * @param {number} y - y coordinate of particle
     * @constructor
     * @class
     */
    function Particle(x, y) {
        this.x = x;
        this.y = y;
        this.x0 = x;
        this.y0 = y;
        this.xDelta = 0;
        this.yDelta = 0;
    }

    Particle.prototype.animate = function() {
        if (this.x === this.x0 && this.y === this.y0) {
            return;
        }

        if (Math.sqrt(Math.pow(this.x - this.x0, 2) + Math.pow(this.y - this.y0, 2)) > 1) {
            this.x += this.xDelta / 200;
            this.y += this.yDelta / 200;
        } else {
            this.x = this.x0;
            this.y = this.y0;
        }
    };

    /**
     * Returns the distance to a given set of coordinates.
     *
     * @param {number} x - X coordinate to check distance to
     * @param {number} y - Y coordinate to check distance to
     * @return {number} distance from this particle to given coordinates
     */
    Particle.prototype.distanceTo = function(x, y) {
        let xDistance = this.x - x;
        let yDistance = this.y - y;
        return Math.sqrt(xDistance * xDistance + yDistance * yDistance);
    };

    Particle.prototype.moveAwayFrom = function (x, y) {
        let xDistance = this.x - x;
        let yDistance = this.y - y;
        let distance = Math.sqrt(xDistance * xDistance + yDistance * yDistance);
        let angle = Math.atan2(yDistance, xDistance);

        this.x += Math.cos(angle) * distance;
        this.y += Math.sin(angle) * distance;

        this.yDelta = this.y0 - this.y;
        this.xDelta = this.x0 - this.x;
    };

    function drawScene() {
        findTarget();
        fitCanvasToScreen();

        if (renderStuff !== undefined) {
            window.clearInterval(renderStuff);
            renderStuff = undefined;
        }

        canvas.addEventListener("mousemove", disperseParticlesMouse, false);
        canvas.addEventListener("touchmove", disperseParticlesTouch, false);
        canvas.addEventListener("click", disperseParticlesMouse, false);

        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        let texts = ["404", "Not Found"];
        let yPos = 0;
        texts.forEach(function (txt) {
            let fontSize = fitTextOnCanvas(txt, "verdana");
            yPos += fontSize;
            ctx.fillText(txt, canvas.width / 2 - padding, yPos);
        });
        let data = ctx.getImageData(0, 0, canvas.width - padding * 2, yPos);

        // Resize canvas to fit our text
        canvas.height = canvas.style.height = yPos + padding * 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles = [];
        for (let y = 0, y2 = data.height; y < y2; y = y + 4) {
            for (let x = 0, x2 = data.width; x < x2; x = x + 4) {
                if (data.data[(y * 4 * data.width) + (x * 4) + 3] > 128) {
                    particles.push(new Particle(x + padding, y + padding));
                }
            }
        }
        ctx.fillStyle = "black";

        renderStuff = window.setInterval(function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0, j = particles.length; i < j; i++) {
                let particle = particles[i];
                particle.animate();
                ctx.fillRect(particle.x, particle.y, 2, 2);
            }
        }, 1);
    }

    function fitCanvasToScreen() {
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }

    /**
     *
     * @param {string} text - text to write in the canvas
     * @param {string} fontface - font string to render
     * @returns {number} size of font that fit
     */
    function fitTextOnCanvas(text, fontface) {
        return measureTextBinaryMethod(text, fontface, 0, 72, canvas.width - 2 * padding);
    }

    /**
     *
     * @param {string} text - text to write in the canvas
     * @param {string} fontface - font string to render
     * @param {number} min - minimum font size
     * @param {number} max - maximum font size
     * @param {number} desiredWidth - width that the font should fit into
     * @returns {number} size of font that fit
     */
    function measureTextBinaryMethod(text, fontface, min, max, desiredWidth) {
        if (max - min < 1) {
            return min;
        }
        let test = min + ((max - min) / 2); //Find half interval
        ctx.font = test + "px " + fontface;
        let measureTest = ctx.measureText(text).width;
        let found;
        if (measureTest > desiredWidth) {
            found = measureTextBinaryMethod(text, fontface, min, test, desiredWidth)
        } else {
            found = measureTextBinaryMethod(text, fontface, test, max, desiredWidth)
        }
        return found;
    }

    /**
     * @param {TouchEvent} e - touch movement events
     */
    function disperseParticlesTouch(e) {
        e.preventDefault();
        for (let i = 0; i < e.targetTouches.length; i++) {
            let touch = e.targetTouches[i];
            let touchX = parseInt(touch.clientX - canvas.offsetLeft);
            let touchY = parseInt(touch.clientY - canvas.offsetTop);
            disperseParticlesXY(touchX, touchY);
        }
    }

    /**
     * @param {MouseEvent} e - mouse movement event
     */
    function disperseParticlesMouse(e) {
        e.preventDefault();
        let mouseX = parseInt(e.clientX - canvas.offsetLeft);
        let mouseY = parseInt(e.clientY - canvas.offsetTop);
        disperseParticlesXY(mouseX, mouseY);
    }

    /**
     *
     * @param {number} x - x coordinate of dispersion source
     * @param {number} y - y coordinate of dispersion source
     */
    function disperseParticlesXY(x, y) {
        particles.forEach(function(particle) {
            if (particle.distanceTo(x, y) < 20) {
                particle.moveAwayFrom(x, y);
            }
        });
    }

    window.addEventListener("DOMContentLoaded", drawScene);
    window.addEventListener("resize", drawScene);
    window.addEventListener("transitionend", drawScene);
}());
