var canvas = document.getElementById("scene");
var ctx = canvas.getContext("2d");
var particles = [];
var padding = 36;

function drawScene() {
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  canvas.addEventListener('mousemove', move, false);

  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  var texts = ["404", "Not Found"];
  var yPos = 0;
  texts.forEach(function(txt) {
    var fontSize = fitTextOnCanvas(txt, "verdana");
    yPos += fontSize;
    ctx.fillText(txt, canvas.width / 2 - padding, yPos);
  });
  var data = ctx.getImageData(0, 0, canvas.width - padding * 2, yPos);

  // Resize canvas to fit our text
  canvas.height = canvas.style.height = yPos + padding * 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (var y = 0, y2 = data.height; y < y2; y = y + 4) {
    for (var x = 0, x2 = data.width; x < x2; x = x + 4) {
      if (data.data[(y * 4 * data.width) + (x * 4) + 3] > 128) {
        var particle = {
          x: x + padding,
          y: y + padding,
          y0: y + padding,
          x0: x + padding,
          xDelta: 0,
          yDelta: 0
        };
        particles.push(particle);
      }
    }
  }
  ctx.fillStyle = "black";

  var renderStuff = setInterval(function() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0, j = particles.length; i < j; i++) {
      var particle = particles[i];
      if (Math.sqrt(Math.pow(particle.x - particle.x0, 2) + Math.pow(particle.y - particle.y0, 2)) > 1) {
        particle.x += particle.xDelta / 200;
        particle.y += particle.yDelta / 200;
      } else {
        particle.x = particle.x0;
        particle.y = particle.y0;
      }
      ctx.fillRect(particle.x, particle.y, 2, 2);
    }
  }, 1);

}

function fitTextOnCanvas(text, fontface) {
  var size = measureTextBinaryMethod(text, fontface, 0, 72, canvas.width - 2 * padding);
  return size;
}

function measureTextBinaryMethod(text, fontface, min, max, desiredWidth) {
  if (max - min < 1) {
    return min;
  }
  var test = min + ((max - min) / 2); //Find half interval
  ctx.font = test + "px " + fontface;
  measureTest = ctx.measureText(text).width;
  var found;
  if (measureTest > desiredWidth) {
    found = measureTextBinaryMethod(text, fontface, min, test, desiredWidth)
  } else {
    found = measureTextBinaryMethod(text, fontface, test, max, desiredWidth)
  }
  return found;
}

function move(e) {
  mouseX = parseInt(e.clientX - canvas.offsetLeft);
  mouseY = parseInt(e.clientY - canvas.offsetTop);

  for (var i = 0, j = particles.length; i < j; i++) {
    var xDistance = particles[i].x - mouseX;
    var yDistance = particles[i].y - mouseY;
    var distance = Math.sqrt(xDistance * xDistance + yDistance * yDistance);

    if (distance < 20) {
      angle = Math.atan2(yDistance, xDistance);
      particles[i].x += Math.cos(angle) * distance;
      particles[i].y += Math.sin(angle) * distance;

      particles[i].yDelta = particles[i].y0 - particles[i].y;
      particles[i].xDelta = particles[i].x0 - particles[i].x;
    }
  }
}

drawScene();
document.addEventListener("resize", drawScene);

