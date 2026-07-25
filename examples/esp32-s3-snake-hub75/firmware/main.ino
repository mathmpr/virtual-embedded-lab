#include <RGBmatrixPanel.h>

const int BUTTON_UP = 1;
const int BUTTON_DOWN = 2;
const int BUTTON_LEFT = 4;
const int BUTTON_RIGHT = 5;
const int START_BUTTON = 39;
const int BUZZER_PIN = 21;

RGBmatrixPanel matrix(12, 13, 14, 15, 16, 17, 18, 38, false, 64);

const int GAME_SIZE = 32;
const int MAX_SNAKE = 128;
int snakeX[MAX_SNAKE];
int snakeY[MAX_SNAKE];
int snakeLength = 4;
int dirX = 1;
int dirY = 0;
int foodX = 20;
int foodY = 12;
int score = 0;
int level = 1;
bool paused = false;
bool gameOver = false;
unsigned long seedValue = 17;

unsigned int BLACK;
unsigned int GREEN;
unsigned int BLUE;
unsigned int RED;
unsigned int ORANGE;
unsigned int WHITE;

unsigned long nextRandom()
{
    seedValue = seedValue * 1103515245 + 12345;
    return (seedValue / 65536) % 32768;
}

void placeFood()
{
    foodX = 1 + (nextRandom() % 30);
    foodY = 1 + (nextRandom() % 30);
}

void resetGame()
{
    snakeLength = 4;
    for (int index = 0; index < snakeLength; index++) {
        snakeX[index] = 10 - index;
        snakeY[index] = 16;
    }
    dirX = 1;
    dirY = 0;
    score = 0;
    level = 1;
    paused = false;
    gameOver = false;
    placeFood();
}

void setup()
{
    Serial.begin(115200);
    pinMode(BUTTON_UP, INPUT);
    pinMode(BUTTON_DOWN, INPUT);
    pinMode(BUTTON_LEFT, INPUT);
    pinMode(BUTTON_RIGHT, INPUT);
    pinMode(START_BUTTON, INPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    matrix.begin();
    BLACK = matrix.color565(0, 0, 0);
    GREEN = matrix.color565(40, 220, 80);
    BLUE = matrix.color565(60, 130, 255);
    RED = matrix.color565(255, 60, 40);
    ORANGE = matrix.color565(255, 160, 30);
    WHITE = matrix.color565(220, 235, 255);
    resetGame();
    Serial.println("ESP32-S3 HUB75 Snake ready");
}

void readControls()
{
    if (digitalRead(BUTTON_LEFT) == HIGH && dirX != 1) { dirX = -1; dirY = 0; }
    if (digitalRead(BUTTON_RIGHT) == HIGH && dirX != -1) { dirX = 1; dirY = 0; }
    if (digitalRead(BUTTON_UP) == HIGH && dirY != 1) { dirX = 0; dirY = -1; }
    if (digitalRead(BUTTON_DOWN) == HIGH && dirY != -1) { dirX = 0; dirY = 1; }

    if (digitalRead(START_BUTTON) == HIGH) {
        paused = !paused;
        delay(180);
    }
}

void stepSnake()
{
    int nextX = snakeX[0] + dirX;
    int nextY = snakeY[0] + dirY;

    if (nextX < 0 || nextY < 0 || nextX >= GAME_SIZE || nextY >= GAME_SIZE) {
        gameOver = true;
    }

    for (int index = 0; index < snakeLength; index++) {
        if (snakeX[index] == nextX && snakeY[index] == nextY) {
            gameOver = true;
        }
    }

    if (gameOver) {
        tone(BUZZER_PIN, 220);
        Serial.print("Game over score: ");
        Serial.println(score);
        resetGame();
        noTone(BUZZER_PIN);
        return;
    }

    for (int index = snakeLength; index > 0; index--) {
        snakeX[index] = snakeX[index - 1];
        snakeY[index] = snakeY[index - 1];
    }

    snakeX[0] = nextX;
    snakeY[0] = nextY;

    if (nextX == foodX && nextY == foodY) {
        if (snakeLength < MAX_SNAKE - 1) { snakeLength++; }
        score += 10;
        level = 1 + score / 50;
        placeFood();
        tone(BUZZER_PIN, 1200);
        delay(30);
        noTone(BUZZER_PIN);
    }
}

void drawGame()
{
    matrix.fillScreen(BLACK);

    for (int y = 0; y < GAME_SIZE; y++) {
        matrix.drawPixel(32, y, BLUE);
    }

    matrix.drawPixel(foodX, foodY, RED);

    for (int index = 0; index < snakeLength; index++) {
        matrix.drawPixel(snakeX[index], snakeY[index], index == 0 ? ORANGE : GREEN);
    }

    matrix.printText(36, 2, "SCORE", WHITE);
    matrix.printText(36, 8, "000", BLUE);
    if (score >= 100) { matrix.printText(36, 8, "100", BLUE); }
    if (score >= 10 && score < 100) { matrix.printText(40, 8, "10", BLUE); }
    matrix.printText(36, 18, "LEVEL", WHITE);
    if (level == 1) { matrix.printText(44, 24, "01", GREEN); }
    if (level == 2) { matrix.printText(44, 24, "02", GREEN); }
    if (level >= 3) { matrix.printText(44, 24, "03", GREEN); }
}

void loop()
{
    readControls();

    if (!paused) {
        stepSnake();
    }

    drawGame();
    Serial.print("Score: ");
    Serial.print(score);
    Serial.print(" Level: ");
    Serial.println(level);
    delay(180);
}
