class SimpleTimer {
public:
  SimpleTimer() : count(0) {}
  int setInterval(unsigned long interval, void (*callback)()) {
    if (count >= 8) {
      return -1;
    }
    timers[count] = { interval, millis(), callback };
    count++;
    return count;
  }
  void run() {
    unsigned long now = millis();
    for (int index = 0; index < count; index++) {
      if (timers[index].callback && now - timers[index].last >= timers[index].interval) {
        timers[index].last = now;
        timers[index].callback();
      }
    }
  }
private:
  struct TimerEntry {
    unsigned long interval;
    unsigned long last;
    void (*callback)();
  };
  TimerEntry timers[8];
  int count;
};
