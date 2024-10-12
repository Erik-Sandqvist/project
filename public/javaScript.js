//Header
function toggleMenu() {
  const mobileMenu = document.getElementById("mobileMenu");
  mobileMenu.classList.toggle("show");
}
function myFunction() {
  var x = document.getElementById("myLinks");
  if (x.style.display === "block") {
    x.style.display = "none";
  } else {
    x.style.display = "block";
  }
}

//Game
let score = 0;
let timeLeft = 10;
let timer;
let box = document.getElementById("box");
let scoreDisplay = document.getElementById("score");
let gameContainer = document.querySelector(".game-container");

function randomPosition() {
  // Get the dimensions of the game container
  let containerWidth = gameContainer.offsetWidth;
  let containerHeight = gameContainer.offsetHeight;

  // Calculate random x and y positions, ensuring the box stays within the container
  let x = Math.random() * (containerWidth - box.offsetWidth);
  let y = Math.random() * (containerHeight - box.offsetHeight);

  // Set the new position of the box
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
}

box.addEventListener("click", function () {
  score++;
  scoreDisplay.innerText = `Score: ${score}`;
  randomPosition();
});

function startGame() {
  score = 0;
  timeLeft = 10;
  scoreDisplay.innerText = `Score: ${score}`;
  box.style.display = "block";
  randomPosition();

  timer = setInterval(function () {
    timeLeft--;
    if (timeLeft === 0) {
      clearInterval(timer);
      alert(`Time's up! Your score is: ${score}`);
      box.style.display = "none"; // Hide the box when time is up
    }
  }, 1000);
}

// document.addEventListener("DOMContentLoaded", function () {
//   const menuToggle = document.getElementById("mobile-menu");
//   const navbar = document.querySelector(".navbar");

//   menuToggle.addEventListener("click", () => {
//     navbar.classList.toggle("active");
//   });

//   // Lägg till ett klickhändelse till hela dokumentet
//   document.addEventListener("click", function (event) {
//     // Kontrollera om det klickade elementet är hamburgerikonen eller menyn själv
//     if (!menuToggle.contains(event.target) && !navbar.contains(event.target)) {
//       navbar.classList.remove("active"); // Ta bort klassen om användaren klickar utanför menyn eller hamburgerikonen
//     }
//   });
// });

// localStorage.hello = "Hello";

//console.log(localStorage.hello);
