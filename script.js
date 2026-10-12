"use strict";

const BOARD_SIZE = 8;
const ROUND_SECONDS = 60;
const BEST_SCORE_KEY = "apple-number-game-best-score";

const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const timerElement = document.querySelector("#timer");
const bestScoreElement = document.querySelector("#best-score");
const selectionSumElement = document.querySelector("#selection-sum");
const statusElement = document.querySelector("#game-status");
const timerCardElement = document.querySelector(".timer-card");
const startButton = document.querySelector("#start-button");
const confettiElement = document.querySelector("#confetti");

let numbers = [];
let selectedCells = [];
let score = 0;
let bestScore = loadBestScore();
let secondsLeft = ROUND_SECONDS;
let timerId = null;
let confettiTimeoutId = null;
let isPlaying = false;
let activePointerId = null;

function randomNumber() {
  return Math.floor(Math.random() * 9) + 1;
}

function loadBestScore() {
  try {
    const savedScore = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    return Number.isSafeInteger(savedScore) && savedScore >= 0 ? savedScore : 0;
  } catch (error) {
    console.warn("최고 점수를 불러오지 못했습니다.", error);
    return 0;
  }
}

function saveBestScore() {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  } catch (error) {
    console.warn("최고 점수를 저장하지 못했습니다.", error);
  }
}

function renderBoard() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index += 1) {
    const number = numbers[index];
    const tile = document.createElement("button");
    tile.className = "tile";
    tile.type = "button";
    tile.dataset.index = String(index);
    if (number === undefined) {
      tile.classList.add("is-empty");
      tile.setAttribute("aria-label", "게임 시작 버튼을 눌러 주세요");
    } else {
      const apple = document.createElement("span");
      apple.className = "apple-icon";
      apple.textContent = "🍎";
      apple.setAttribute("aria-hidden", "true");

      const value = document.createElement("span");
      value.className = "apple-number";
      value.textContent = String(number);
      value.setAttribute("aria-hidden", "true");

      tile.append(apple, value);
      tile.setAttribute("aria-label", `${Math.floor(index / BOARD_SIZE) + 1}행 ${index % BOARD_SIZE + 1}열, 사과 ${number}`);
    }
    tile.disabled = !isPlaying;
    fragment.append(tile);
  }

  boardElement.replaceChildren(fragment);
  boardElement.classList.toggle("is-locked", !isPlaying);
}

function showConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  window.clearTimeout(confettiTimeoutId);
  const colors = ["#e85d4a", "#f2c94c", "#4d9b68", "#5b8def", "#bd70c9", "#f08b45"];
  const fragment = document.createDocumentFragment();
  const particleCount = 90;

  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement("span");
    particle.className = "confetti-piece";
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.setProperty("--confetti-color", colors[index % colors.length]);
    particle.style.setProperty("--confetti-drift", `${Math.random() * 240 - 120}px`);
    particle.style.setProperty("--confetti-rotation", `${Math.random() * 1080 - 540}deg`);
    particle.style.setProperty("--confetti-duration", `${2.4 + Math.random() * 1.8}s`);
    particle.style.setProperty("--confetti-delay", `${Math.random() * 0.7}s`);
    fragment.append(particle);
  }

  confettiElement.replaceChildren(fragment);
  confettiTimeoutId = window.setTimeout(() => {
    confettiElement.replaceChildren();
    confettiTimeoutId = null;
  }, 5000);
}

function updateScoreboard() {
  scoreElement.textContent = String(score);
  bestScoreElement.textContent = String(bestScore);
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  timerElement.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timerCardElement.classList.toggle("is-low", secondsLeft <= 10);
}

function getSelectionSum() {
  return selectedCells.reduce((sum, index) => sum + numbers[index], 0);
}

function updateSelection() {
  const selectionSum = getSelectionSum();
  const isValid = selectedCells.length > 0 && selectionSum % 10 === 0;

  boardElement.querySelectorAll(".tile").forEach((tile) => {
    const index = Number(tile.dataset.index);
    const selected = selectedCells.includes(index);
    tile.classList.toggle("is-selected", selected);
    tile.classList.toggle("is-valid", selected && isValid);
  });

  selectionSumElement.textContent = String(selectionSum);
  if (selectedCells.length > 0) {
    statusElement.textContent = isValid ? "좋아요! 손을 떼면 획득해요." : "드래그를 이어 합을 10의 배수로 만드세요.";
  }
}

function getTileFromPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  const tile = element instanceof Element ? element.closest(".tile") : null;
  return tile && boardElement.contains(tile) ? tile : null;
}

function addTileToSelection(tile) {
  const index = Number(tile.dataset.index);
  const lastIndex = selectedCells[selectedCells.length - 1];

  if (index === lastIndex) {
    return;
  }

  if (selectedCells.length > 1 && index === selectedCells[selectedCells.length - 2]) {
    selectedCells.pop();
    updateSelection();
    return;
  }

  if (selectedCells.includes(index)) {
    return;
  }

  if (lastIndex !== undefined) {
    const rowDistance = Math.abs(Math.floor(index / BOARD_SIZE) - Math.floor(lastIndex / BOARD_SIZE));
    const columnDistance = Math.abs((index % BOARD_SIZE) - (lastIndex % BOARD_SIZE));
    if (rowDistance + columnDistance !== 1) {
      return;
    }
  }

  selectedCells.push(index);
  updateSelection();
}

function clearSelection() {
  selectedCells = [];
  selectionSumElement.textContent = "0";
  boardElement.querySelectorAll(".tile").forEach((tile) => {
    tile.classList.remove("is-selected", "is-valid");
  });
}

function resolveSelection() {
  if (selectedCells.length === 0) {
    return;
  }

  const selectionSum = getSelectionSum();
  if (selectionSum % 10 === 0) {
    const removedCells = new Set(selectedCells);
    score += selectionSum;
    if (score > bestScore) {
      bestScore = score;
      saveBestScore();
      showConfetti();
    }

    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const remainingNumbers = [];
      for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
        const index = row * BOARD_SIZE + column;
        if (!removedCells.has(index)) {
          remainingNumbers.push(numbers[index]);
        }
      }

      for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
        const index = row * BOARD_SIZE + column;
        numbers[index] = remainingNumbers[BOARD_SIZE - 1 - row] ?? randomNumber();
      }
    }

    statusElement.textContent = `+${selectionSum}점! 계속 이어 보세요.`;
    renderBoard();
    updateScoreboard();
  } else {
    statusElement.textContent = "합이 10의 배수가 아니에요. 다시 이어 보세요.";
  }

  clearSelection();
}

function finishGame() {
  window.clearInterval(timerId);
  timerId = null;
  isPlaying = false;
  activePointerId = null;
  clearSelection();
  renderBoard();
  statusElement.textContent = `시간 종료! 최종 점수는 ${score}점이에요.`;
  startButton.textContent = "다시 하기";
}

function startGame() {
  window.clearInterval(timerId);
  score = 0;
  secondsLeft = ROUND_SECONDS;
  numbers = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, randomNumber);
  selectedCells = [];
  isPlaying = true;
  activePointerId = null;
  startButton.textContent = "다시 시작";
  statusElement.textContent = "이웃한 숫자를 드래그해 합을 10의 배수로 만드세요!";
  renderBoard();
  updateScoreboard();
  selectionSumElement.textContent = "0";

  timerId = window.setInterval(() => {
    secondsLeft -= 1;
    updateScoreboard();
    if (secondsLeft <= 0) {
      secondsLeft = 0;
      updateScoreboard();
      finishGame();
    }
  }, 1000);
}

boardElement.addEventListener("pointerdown", (event) => {
  const tile = getTileFromPoint(event.clientX, event.clientY);
  if (!isPlaying || !tile || (event.pointerType === "mouse" && event.button !== 0)) {
    return;
  }

  event.preventDefault();
  activePointerId = event.pointerId;
  selectedCells = [];
  addTileToSelection(tile);
});

document.addEventListener("pointermove", (event) => {
  if (event.pointerId !== activePointerId) {
    return;
  }

  const tile = getTileFromPoint(event.clientX, event.clientY);
  if (tile) {
    addTileToSelection(tile);
  }
});

document.addEventListener("pointerup", (event) => {
  if (event.pointerId !== activePointerId) {
    return;
  }

  activePointerId = null;
  resolveSelection();
});

document.addEventListener("pointercancel", (event) => {
  if (event.pointerId !== activePointerId) {
    return;
  }

  activePointerId = null;
  clearSelection();
  statusElement.textContent = "선택이 취소됐어요. 다시 이어 보세요.";
});

startButton.addEventListener("click", startGame);

renderBoard();
updateScoreboard();
