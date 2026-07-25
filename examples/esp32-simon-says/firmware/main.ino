/*
   Simon Game for ESP32 with score display.
   Adapted for Virtual Embedded Lab from Uri Shaked's MIT licensed Simon example.
   This version is non-blocking so the simulator can read UI button pulses frame-by-frame.
*/

#define NOTE_C4 262
#define NOTE_DS5 622
#define NOTE_D5 587
#define NOTE_CS5 554
#define NOTE_C5 523
#define NOTE_E4 330
#define NOTE_G3 196
#define NOTE_G4 392
#define NOTE_E5 659
#define NOTE_G5 784

const uint8_t buttonPins[] = {0, 1, 2, 3};
const uint8_t ledPins[] = {32, 33, 25, 26};
#define SPEAKER_PIN 17

const int LATCH_PIN = 18;
const int DATA_PIN = 19;
const int CLOCK_PIN = 5;

#define MAX_GAME_LENGTH 100
#define NO_BUTTON 255

const int gameTones[] = { NOTE_G3, NOTE_C4, NOTE_E4, NOTE_G5 };
uint8_t gameSequence[MAX_GAME_LENGTH] = {0};
uint8_t gameIndex = 0;
uint8_t showIndex = 0;
uint8_t inputIndex = 0;
uint8_t activeLed = NO_BUTTON;
uint8_t feedbackButton = NO_BUTTON;
unsigned long phaseStartedAt = 0;

const uint8_t digitTable[] = {
  0b00111111,
  0b00000110,
  0b01011011,
  0b01001111,
  0b01100110,
  0b01101101,
  0b01111101,
  0b00000111,
  0b01111111,
  0b01101111,
};
const uint8_t DASH = 0b01000000;

enum GamePhase {
  START_ROUND,
  SHOW_ON,
  SHOW_OFF,
  SHOW_PAUSE,
  WAIT_INPUT,
  FEEDBACK_ON,
  FEEDBACK_OFF,
  LEVEL_UP_ON,
  LEVEL_UP_OFF,
  GAME_OVER_WAIT
};

GamePhase phase = START_ROUND;

void sendScore(uint8_t high, uint8_t low) {
  digitalWrite(LATCH_PIN, LOW);
  shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, low);
  shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, high);
  digitalWrite(LATCH_PIN, HIGH);
}

void displayScore() {
  int high = gameIndex % 100 / 10;
  int low = gameIndex % 10;
  sendScore(digitTable[high], digitTable[low]);
}

void setPhase(GamePhase nextPhase) {
  phase = nextPhase;
  phaseStartedAt = millis();
}

bool elapsed(unsigned long durationMs) {
  return millis() - phaseStartedAt >= durationMs;
}

void startLedAndTone(byte ledIndex) {
  activeLed = ledIndex;
  digitalWrite(ledPins[ledIndex], HIGH);
  tone(SPEAKER_PIN, gameTones[ledIndex]);
}

void stopLedAndTone() {
  if (activeLed != NO_BUTTON) {
    digitalWrite(ledPins[activeLed], LOW);
  }
  activeLed = NO_BUTTON;
  noTone(SPEAKER_PIN);
}

byte readPressedButton() {
  for (byte i = 0; i < 4; i++) {
    if (digitalRead(buttonPins[i]) == LOW) {
      return i;
    }
  }
  return NO_BUTTON;
}

void beginGameOver() {
  Serial.print("Game over! your score: ");
  Serial.println(gameIndex > 0 ? gameIndex - 1 : 0);
  stopLedAndTone();
  gameIndex = 0;
  sendScore(DASH, DASH);
  tone(SPEAKER_PIN, NOTE_DS5);
  setPhase(GAME_OVER_WAIT);
}

void loop() {
  switch (phase) {
    case START_ROUND:
      displayScore();
      gameSequence[gameIndex] = random(0, 4);
      gameIndex++;
      if (gameIndex >= MAX_GAME_LENGTH) {
        gameIndex = MAX_GAME_LENGTH - 1;
      }
      showIndex = 0;
      inputIndex = 0;
      Serial.print("Round ");
      Serial.println(gameIndex);
      setPhase(SHOW_ON);
      break;

    case SHOW_ON:
      if (showIndex < gameIndex) {
        startLedAndTone(gameSequence[showIndex]);
        setPhase(SHOW_OFF);
      } else {
        setPhase(WAIT_INPUT);
      }
      break;

    case SHOW_OFF:
      if (elapsed(300)) {
        stopLedAndTone();
        showIndex++;
        setPhase(SHOW_PAUSE);
      }
      break;

    case SHOW_PAUSE:
      if (elapsed(80)) {
        setPhase(SHOW_ON);
      }
      break;

    case WAIT_INPUT: {
      byte button = readPressedButton();
      if (button != NO_BUTTON) {
        feedbackButton = button;
        startLedAndTone(button);
        setPhase(FEEDBACK_ON);
      } else if (elapsed(5000)) {
        beginGameOver();
      }
      break;
    }

    case FEEDBACK_ON:
      if (elapsed(180)) {
        stopLedAndTone();
        setPhase(FEEDBACK_OFF);
      }
      break;

    case FEEDBACK_OFF:
      if (!elapsed(80)) {
        break;
      }
      if (feedbackButton != gameSequence[inputIndex]) {
        beginGameOver();
        break;
      }
      inputIndex++;
      if (inputIndex >= gameIndex) {
        tone(SPEAKER_PIN, NOTE_E5);
        setPhase(LEVEL_UP_ON);
      } else {
        setPhase(WAIT_INPUT);
      }
      break;

    case LEVEL_UP_ON:
      if (elapsed(180)) {
        noTone(SPEAKER_PIN);
        setPhase(LEVEL_UP_OFF);
      }
      break;

    case LEVEL_UP_OFF:
      if (elapsed(300)) {
        setPhase(START_ROUND);
      }
      break;

    case GAME_OVER_WAIT:
      if (elapsed(500)) {
        noTone(SPEAKER_PIN);
        setPhase(START_ROUND);
      }
      break;
  }

  delay(20);
}

void setup() {
  Serial.begin(9600);
  for (byte i = 0; i < 4; i++) {
    pinMode(ledPins[i], OUTPUT);
    pinMode(buttonPins[i], INPUT_PULLUP);
    digitalWrite(ledPins[i], LOW);
  }
  pinMode(SPEAKER_PIN, OUTPUT);
  pinMode(LATCH_PIN, OUTPUT);
  pinMode(CLOCK_PIN, OUTPUT);
  pinMode(DATA_PIN, OUTPUT);
  randomSeed(analogRead(4));
  sendScore(digitTable[0], digitTable[0]);
  Serial.println("Simon Says ready");
  setPhase(START_ROUND);
}
