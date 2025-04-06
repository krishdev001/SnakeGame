const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Constants ---
const GRID_SIZE = 20; // Size of each grid square (previously 'box')
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;
const INITIAL_SNAKE_LENGTH = 3; // Start with 3 blocks instead of 1
const GAME_SPEEDS = {
    easy: 150,
    medium: 100,
    hard: 70
};

// --- Game State ---
let snake;
let food;
let powerup = null;
let score;
let highScore;
let direction; // Current direction ('LEFT', 'RIGHT', 'UP', 'DOWN')
let changingDirection; // Lock to prevent rapid direction changes within one frame
let paused;
let gameOver;
let gameStarted = false;
let gameLoopInterval;
let difficulty = 'medium'; // Default difficulty
let lastFoodEatenTime = 0;
let scoreAnimation = null;
let particles = [];

// --- Initialization ---
function initGame() {
    snake = [];
    // Center the initial snake position
    const startX = Math.floor((CANVAS_WIDTH / GRID_SIZE) / 2) * GRID_SIZE;
    const startY = Math.floor((CANVAS_HEIGHT / GRID_SIZE) / 2) * GRID_SIZE;
    for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
        snake.push({ x: startX - i * GRID_SIZE, y: startY });
    }

    score = 0;
    highScore = localStorage.getItem('snakeHighScore') || 0; // Load high score
    direction = 'RIGHT'; // Start moving right
    changingDirection = false;
    paused = false;
    gameOver = false;
    gameStarted = true;
    powerup = null;
    particles = [];

    placeFood(); // Place initial food
    startGameLoop();
}

// --- Game Loop ---
function startGameLoop() {
    // Clear any existing interval
    if (gameLoopInterval) {
        clearInterval(gameLoopInterval);
    }
    // Start new interval with current difficulty
    gameLoopInterval = setInterval(gameTick, GAME_SPEEDS[difficulty]);
}

function gameTick() {
    if (paused || gameOver) {
        return; // Do nothing if paused or game over
    }
    
    // Update particles
    updateParticles();
    
    changingDirection = false; // Allow direction change for the next tick
    moveSnake();
    checkCollision();
    
    // Randomly spawn powerup (1% chance per tick if none exists)
    if (!powerup && Math.random() < 0.01) {
        placePowerup();
    }
    
    // Remove powerup after 10 seconds
    if (powerup && Date.now() - powerup.spawnTime > 10000) {
        powerup = null;
    }
    
    if (!gameOver) { // Only draw if game is not over after collision check
        drawGame();
    }
}

// --- Drawing ---
function drawGame() {
    // Clear canvas
    ctx.fillStyle = "#2c3e50"; // Dark blue background
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw grid lines for better visibility (optional)
    drawGrid();

    // Draw snake with gradient effect
    snake.forEach((segment, index) => {
        // Calculate color based on position in snake
        const greenValue = Math.max(255 - (index * 5), 100);
        
        if (index === 0) {
            // Draw head with eyes
            ctx.fillStyle = "#2ecc71"; // Green head
            ctx.fillRect(segment.x, segment.y, GRID_SIZE, GRID_SIZE);
            
            // Draw eyes
            ctx.fillStyle = "black";
            const eyeSize = GRID_SIZE / 5;
            const eyeOffset = GRID_SIZE / 3;
            
            // Position eyes based on direction
            if (direction === 'RIGHT') {
                ctx.fillRect(segment.x + GRID_SIZE - eyeOffset, segment.y + eyeOffset, eyeSize, eyeSize);
                ctx.fillRect(segment.x + GRID_SIZE - eyeOffset, segment.y + GRID_SIZE - eyeOffset - eyeSize, eyeSize, eyeSize);
            } else if (direction === 'LEFT') {
                ctx.fillRect(segment.x + eyeOffset - eyeSize, segment.y + eyeOffset, eyeSize, eyeSize);
                ctx.fillRect(segment.x + eyeOffset - eyeSize, segment.y + GRID_SIZE - eyeOffset - eyeSize, eyeSize, eyeSize);
            } else if (direction === 'UP') {
                ctx.fillRect(segment.x + eyeOffset, segment.y + eyeOffset - eyeSize, eyeSize, eyeSize);
                ctx.fillRect(segment.x + GRID_SIZE - eyeOffset - eyeSize, segment.y + eyeOffset - eyeSize, eyeSize, eyeSize);
            } else if (direction === 'DOWN') {
                ctx.fillRect(segment.x + eyeOffset, segment.y + GRID_SIZE - eyeOffset, eyeSize, eyeSize);
                ctx.fillRect(segment.x + GRID_SIZE - eyeOffset - eyeSize, segment.y + GRID_SIZE - eyeOffset, eyeSize, eyeSize);
            }
        } else {
            // Body segments with gradient
            ctx.fillStyle = `rgb(46, ${greenValue}, 113)`;
            ctx.fillRect(segment.x, segment.y, GRID_SIZE, GRID_SIZE);
        }
        
        // Add subtle border
        ctx.strokeStyle = "#27ae60";
        ctx.strokeRect(segment.x, segment.y, GRID_SIZE, GRID_SIZE);
    });

    // Draw food with pulsing animation
    const pulseScale = 1 + 0.1 * Math.sin(Date.now() / 200);
    const foodSize = GRID_SIZE * pulseScale;
    const foodOffset = (GRID_SIZE - foodSize) / 2;
    
    ctx.fillStyle = "#e74c3c"; // Red food
    ctx.beginPath();
    ctx.arc(
        food.x + GRID_SIZE/2, 
        food.y + GRID_SIZE/2, 
        foodSize/2, 
        0, 
        Math.PI * 2
    );
    ctx.fill();
    
    // Draw powerup if exists
    if (powerup) {
        const powerupPulse = 1 + 0.15 * Math.sin(Date.now() / 150);
        const powerupSize = GRID_SIZE * powerupPulse;
        const powerupOffset = (GRID_SIZE - powerupSize) / 2;
        
        ctx.fillStyle = "#f39c12"; // Orange powerup
        ctx.beginPath();
        ctx.arc(
            powerup.x + GRID_SIZE/2, 
            powerup.y + GRID_SIZE/2, 
            powerupSize/2, 
            0, 
            Math.PI * 2
        );
        ctx.fill();
        
        // Draw star shape
        ctx.fillStyle = "#f1c40f";
        drawStar(powerup.x + GRID_SIZE/2, powerup.y + GRID_SIZE/2, 5, GRID_SIZE/4, GRID_SIZE/2.5);
    }
    
    // Draw particles
    drawParticles();
    
    // Draw score animation if active
    if (scoreAnimation) {
        drawText(
            `+${scoreAnimation.value}`, 
            scoreAnimation.x, 
            scoreAnimation.y, 
            scoreAnimation.size, 
            scoreAnimation.color
        );
        
        // Update animation
        scoreAnimation.y -= 1;
        scoreAnimation.size -= 0.2;
        scoreAnimation.alpha -= 0.02;
        
        if (scoreAnimation.alpha <= 0) {
            scoreAnimation = null;
        }
    }

    // Draw score and high score
    drawText(`Score: ${score}`, GRID_SIZE, GRID_SIZE * 1.5, 20, "#ecf0f1");
    drawText(`High Score: ${highScore}`, CANVAS_WIDTH - GRID_SIZE * 7, GRID_SIZE * 1.5, 20, "#ecf0f1");
    
    // Draw difficulty indicator
    const difficultyColor = {
        easy: "#2ecc71",
        medium: "#f39c12",
        hard: "#e74c3c"
    };
    drawText(`Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`, 
             CANVAS_WIDTH / 2 - 60, GRID_SIZE * 1.5, 16, difficultyColor[difficulty]);

    // Draw Pause message
    if (paused) {
        drawCenterText("Paused", 60, "#f1c40f"); // Yellow pause text
        drawCenterText("Press 'P' to Resume", 20, "#ecf0f1", CANVAS_HEIGHT / 2 + 50);
    }
}

function drawGrid() {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 0.5;
    
    // Draw vertical lines
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }
}

function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

function drawText(text, x, y, size = 20, color = "white", font = "Arial") {
    ctx.fillStyle = color;
    ctx.font = `${size}px ${font}`;
    ctx.fillText(text, x, y);
}

function drawCenterText(text, size = 30, color = "white", font = "Arial", yOffset = 0) {
    ctx.fillStyle = color;
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + yOffset);
    ctx.textAlign = "left"; // Reset alignment
}

function drawGameOver() {
    // Dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawCenterText("Game Over!", 60, "#e74c3c"); // Red Game Over text
    drawCenterText(`Score: ${score}`, 30, "#ecf0f1", "Arial", 50);
    if (score > highScore) {
        drawCenterText("New High Score!", 25, "#f1c40f", "Arial", 90); // Yellow High Score text
    }
    drawCenterText("Press Enter to Restart", 20, "#ecf0f1", "Arial", 130);
    drawCenterText("Press M for Menu", 20, "#3498db", "Arial", 160);
}

function drawStartMenu() {
    // Background
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Title
    drawCenterText("SNAKE GAME", 60, "#2ecc71", "Arial", -100);
    
    // Difficulty options
    const diffY = -20;
    const spacing = 40;
    
    // Easy
    ctx.fillStyle = difficulty === 'easy' ? "#2ecc71" : "#7f8c8d";
    ctx.fillRect(CANVAS_WIDTH/2 - 100, CANVAS_HEIGHT/2 + diffY, 200, 30);
    drawCenterText("Easy", 20, "#ffffff", "Arial", diffY + 20);
    
    // Medium
    ctx.fillStyle = difficulty === 'medium' ? "#f39c12" : "#7f8c8d";
    ctx.fillRect(CANVAS_WIDTH/2 - 100, CANVAS_HEIGHT/2 + diffY + spacing, 200, 30);
    drawCenterText("Medium", 20, "#ffffff", "Arial", diffY + spacing + 20);
    
    // Hard
    ctx.fillStyle = difficulty === 'hard' ? "#e74c3c" : "#7f8c8d";
    ctx.fillRect(CANVAS_WIDTH/2 - 100, CANVAS_HEIGHT/2 + diffY + spacing*2, 200, 30);
    drawCenterText("Hard", 20, "#ffffff", "Arial", diffY + spacing*2 + 20);
    
    // Start button
    ctx.fillStyle = "#3498db";
    ctx.fillRect(CANVAS_WIDTH/2 - 100, CANVAS_HEIGHT/2 + diffY + spacing*3 + 20, 200, 40);
    drawCenterText("Start Game", 24, "#ffffff", "Arial", diffY + spacing*3 + 45);
    
    // Instructions
    drawCenterText("Arrow Keys or WASD to move", 16, "#bdc3c7", "Arial", diffY + spacing*4 + 80);
    drawCenterText("P to pause, M for menu", 16, "#bdc3c7", "Arial", diffY + spacing*4 + 105);
}

// --- Particle System ---
function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x + GRID_SIZE/2,
            y: y + GRID_SIZE/2,
            size: Math.random() * 5 + 2,
            color: color,
            speedX: (Math.random() - 0.5) * 4,
            speedY: (Math.random() - 0.5) * 4,
            life: 1.0 // Full opacity
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.life -= 0.02;
        p.size -= 0.1;
        
        if (p.life <= 0 || p.size <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0; // Reset alpha
}

// --- Movement & Logic ---
function moveSnake() {
    // Calculate new head position based on direction
    let headX = snake[0].x;
    let headY = snake[0].y;

    switch (direction) {
        case 'LEFT': headX -= GRID_SIZE; break;
        case 'UP': headY -= GRID_SIZE; break;
        case 'RIGHT': headX += GRID_SIZE; break;
        case 'DOWN': headY += GRID_SIZE; break;
    }

    // --- Wall Wrapping Logic ---
    if (headX < 0) {
        headX = CANVAS_WIDTH - GRID_SIZE;
    } else if (headX >= CANVAS_WIDTH) {
        headX = 0;
    }
    if (headY < 0) {
        headY = CANVAS_HEIGHT - GRID_SIZE;
    } else if (headY >= CANVAS_HEIGHT) {
        headY = 0;
    }
    // --- End Wall Wrapping ---

    const newHead = { x: headX, y: headY };
    snake.unshift(newHead); // Add new head

    // Check if food is eaten
    if (headX === food.x && headY === food.y) {
        // Create food particles
        createParticles(food.x, food.y, 15, "#e74c3c");
        
        // Create score animation
        scoreAnimation = {
            value: 1,
            x: food.x,
            y: food.y,
            size: 24,
            color: "#f1c40f",
            alpha: 1.0
        };
        
        score++;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('snakeHighScore', highScore); // Save new high score
        }
        
        // Play eating sound
        playSound('eat');
        
        lastFoodEatenTime = Date.now();
        placeFood(); // Place new food
    } 
    // Check if powerup is eaten
    else if (powerup && headX === powerup.x && headY === powerup.y) {
        // Create powerup particles
        createParticles(powerup.x, powerup.y, 25, "#f39c12");
        
        // Create score animation
        scoreAnimation = {
            value: 5,
            x: powerup.x,
            y: powerup.y,
            size: 30,
            color: "#f1c40f",
            alpha: 1.0
        };
        
        score += 5; // Powerups worth 5 points
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('snakeHighScore', highScore);
        }
        
        // Play powerup sound
        playSound('powerup');
        
        // Grow the snake by 2 more segments
        for (let i = 0; i < 2; i++) {
            snake.push({...snake[snake.length-1]});
        }
        
        powerup = null;
    }
    else {
        snake.pop(); // Remove tail if food not eaten
    }
}

function placeFood() {
    let foodX, foodY;
    let foodOnSnake;
    do {
        foodOnSnake = false;
        foodX = Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)) * GRID_SIZE;
        foodY = Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE)) * GRID_SIZE;
        // Check if the food location is on the snake
        for (let segment of snake) {
            if (segment.x === foodX && segment.y === foodY) {
                foodOnSnake = true;
                break;
            }
        }
        
        // Also check if food would be on powerup
        if (powerup && foodX === powerup.x && foodY === powerup.y) {
            foodOnSnake = true;
        }
    } while (foodOnSnake); // Keep trying until food is not on the snake

    food = { x: foodX, y: foodY };
}

function placePowerup() {
    let powerupX, powerupY;
    let powerupOnSnakeOrFood;
    do {
        powerupOnSnakeOrFood = false;
        powerupX = Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)) * GRID_SIZE;
        powerupY = Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE)) * GRID_SIZE;
        
        // Check if on snake
        for (let segment of snake) {
            if (segment.x === powerupX && segment.y === powerupY) {
                powerupOnSnakeOrFood = true;
                break;
            }
        }
        
        // Check if on food
        if (food.x === powerupX && food.y === powerupY) {
            powerupOnSnakeOrFood = true;
        }
    } while (powerupOnSnakeOrFood);

    powerup = { 
        x: powerupX, 
        y: powerupY,
        spawnTime: Date.now()
    };
}

// --- Collision Detection ---
function checkCollision() {
    const head = snake[0];

    // Self collision (check against the rest of the body)
    // Wall collision is now handled by wrapping in moveSnake()
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            triggerGameOver();
            return;
        }
    }
}

function triggerGameOver() {
    gameOver = true;
    clearInterval(gameLoopInterval); // Stop the game loop
    drawGameOver(); // Draw the game over screen immediately
    playSound('gameover');
}

// --- Sound System ---
function playSound(type) {
    // Create simple sounds using AudioContext
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    if (type === 'eat') {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } 
    else if (type === 'powerup') {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1);
        oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
    }
    else if (type === 'gameover') {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.5);
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    }
}

// --- Input Handling ---
document.addEventListener("keydown", handleKeyPress);
canvas.addEventListener("click", handleCanvasClick);

// Add mobile touch controls
const mobileControls = document.querySelectorAll('.mobile-button');
mobileControls.forEach(button => {
    button.addEventListener('touchstart', handleMobileControl);
});

function handleMobileControl(event) {
    event.preventDefault(); // Prevent scrolling when touching the buttons
    
    if (!gameStarted || gameOver || paused) return;
    
    const direction = event.currentTarget.classList[1]; // up, down, left, right
    
    const goingUp = direction === 'UP';
    const goingDown = direction === 'DOWN';
    const goingLeft = direction === 'LEFT';
    const goingRight = direction === 'RIGHT';
    
    // Update direction based on touch, preventing 180-degree turns
    if (direction === 'left' && !goingRight) {
        direction = 'LEFT';
        changingDirection = true;
    } else if (direction === 'up' && !goingDown) {
        direction = 'UP';
        changingDirection = true;
    } else if (direction === 'right' && !goingLeft) {
        direction = 'RIGHT';
        changingDirection = true;
    } else if (direction === 'down' && !goingUp) {
        direction = 'DOWN';
        changingDirection = true;
    }
}

function handleKeyPress(event) {
    const key = event.key; // Use event.key

    // Menu controls
    if (!gameStarted && !gameOver) {
        if (key === 'ArrowUp' || key === 'w' || key === 'W') {
            cycleDifficulty(-1);
            drawStartMenu();
            return;
        } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
            cycleDifficulty(1);
            drawStartMenu();
            return;
        } else if (key === 'Enter' || key === ' ') {
            initGame();
            return;
        }
    }

    if (gameOver) {
        if (key === 'Enter') {
            initGame(); // Restart game
            return;
        } else if (key === 'm' || key === 'M') {
            showStartMenu();
            return;
        }
    }

    if (key === 'p' || key === 'P') {
        togglePause();
        return;
    }
    
    if (key === 'm' || key === 'M') {
        if (gameStarted && !gameOver) {
            clearInterval(gameLoopInterval);
            showStartMenu();
        }
        return;
    }

    // Prevent changing direction if already changing or paused/game over
    if (changingDirection || paused || gameOver || !gameStarted) {
        return;
    }

    const goingUp = direction === 'UP';
    const goingDown = direction === 'DOWN';
    const goingLeft = direction === 'LEFT';
    const goingRight = direction === 'RIGHT';

    // Update direction based on key press, preventing 180-degree turns
    if ((key === 'ArrowLeft' || key === 'a' || key === 'A') && !goingRight) {
        direction = 'LEFT';
        changingDirection = true;
    } else if ((key === 'ArrowUp' || key === 'w' || key === 'W') && !goingDown) {
        direction = 'UP';
        changingDirection = true;
    } else if ((key === 'ArrowRight' || key === 'd' || key === 'D') && !goingLeft) {
        direction = 'RIGHT';
        changingDirection = true;
    } else if ((key === 'ArrowDown' || key === 's' || key === 'S') && !goingUp) {
        direction = 'DOWN';
        changingDirection = true;
    }
}

function handleCanvasClick(event) {
    if (!gameStarted && !gameOver) {
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        const diffY = CANVAS_HEIGHT/2 - 20;
        const spacing = 40;
        
        // Check if clicked on difficulty options
        if (clickX >= CANVAS_WIDTH/2 - 100 && clickX <= CANVAS_WIDTH/2 + 100) {
            // Easy button
            if (clickY >= diffY && clickY <= diffY + 30) {
                difficulty = 'easy';
                drawStartMenu();
            }
            // Medium button
            else if (clickY >= diffY + spacing && clickY <= diffY + spacing + 30) {
                difficulty = 'medium';
                drawStartMenu();
            }
            // Hard button
            else if (clickY >= diffY + spacing*2 && clickY <= diffY + spacing*2 + 30) {
                difficulty = 'hard';
                drawStartMenu();
            }
            // Start button
            else if (clickY >= diffY + spacing*3 + 20 && clickY <= diffY + spacing*3 + 60) {
                initGame();
            }
        }
    }
}

// Add swipe controls for mobile
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

document.addEventListener('touchstart', function(event) {
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
}, false);

document.addEventListener('touchend', function(event) {
    touchEndX = event.changedTouches[0].screenX;
    touchEndY = event.changedTouches[0].screenY;
    handleSwipe();
}, false);

function handleSwipe() {
    if (!gameStarted || gameOver || paused) return;
    
    const xDiff = touchStartX - touchEndX;
    const yDiff = touchStartY - touchEndY;
    
    // Determine if the swipe was horizontal or vertical
    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        // Horizontal swipe
        if (xDiff > 50) { // Left swipe, threshold of 50px
            // Going left
            if (direction !== 'RIGHT') {
                direction = 'LEFT';
                changingDirection = true;
            }
        } else if (xDiff < -50) { // Right swipe
            // Going right
            if (direction !== 'LEFT') {
                direction = 'RIGHT';
                changingDirection = true;
            }
        }
    } else {
        // Vertical swipe
        if (yDiff > 50) { // Up swipe
            // Going up
            if (direction !== 'DOWN') {
                direction = 'UP';
                changingDirection = true;
            }
        } else if (yDiff < -50) { // Down swipe
            // Going down
            if (direction !== 'UP') {
                direction = 'DOWN';
                changingDirection = true;
            }
        }
    }
}

// Add a pause button for mobile
document.addEventListener('touchstart', function(event) {
    // Check if the game canvas was double-tapped
    if (event.target === canvas) {
        const now = new Date().getTime();
        const timeSince = now - lastTap;
        
        if (timeSince < 300 && timeSince > 0) {
            // Double tap detected
            togglePause();
            event.preventDefault();
        }
        
        lastTap = now;
    }
});

let lastTap = 0;

function cycleDifficulty(direction) {
    const difficulties = ['easy', 'medium', 'hard'];
    const currentIndex = difficulties.indexOf(difficulty);
    let newIndex = (currentIndex + direction) % difficulties.length;
    
    if (newIndex < 0) newIndex = difficulties.length - 1;
    
    difficulty = difficulties[newIndex];
}

function togglePause() {
    if (gameOver || !gameStarted) return; // Can't pause if game over or not started

    paused = !paused;
    if (paused) {
        clearInterval(gameLoopInterval); // Stop loop when paused
        drawGame(); // Redraw to show "Paused" message
    } else {
        startGameLoop(); // Resume loop
    }
}

function showStartMenu() {
    gameStarted = false;
    gameOver = false;
    drawStartMenu();
}

// --- Start the Game ---
// Show menu instead of starting game immediately
showStartMenu();
