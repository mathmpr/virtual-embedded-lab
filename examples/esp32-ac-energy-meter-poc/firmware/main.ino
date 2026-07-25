#include <Wire.h>
#include <ADS1115.h>

ADS1115 adc;

struct PhaseMetrics {
    float vrms;
    float irms;
    float realPowerW;
    float apparentPowerVA;
    float powerFactor;
    double energyKwh;
};

PhaseMetrics phaseA = {0, 0, 0, 0, 0, 0};
PhaseMetrics phaseB = {0, 0, 0, 0, 0, 0};
unsigned long lastPrintMs = 0;

const int SAMPLES = 240;
const float ADC_FULL_SCALE = 4.096f;
const float ADC_MAX_RAW = 32767.0f;
const float VOLTAGE_BIAS = 1.65f;
const float CURRENT_BIAS = 1.65f;
const float VOLTAGE_CAL = 127.0f;
const float CURRENT_CAL = 100.0f;

float fastSqrt(float value)
{
    if (value <= 0) {
        return 0;
    }

    float estimate = value > 1 ? value : 1;

    for (int index = 0; index < 8; index++) {
        estimate = 0.5f * (estimate + value / estimate);
    }

    return estimate;
}

float rawToVolts(int raw)
{
    return ((float)raw / ADC_MAX_RAW) * ADC_FULL_SCALE;
}

void samplePhase(PhaseMetrics *metrics, int voltageChannel, int currentChannel, unsigned long elapsedMs)
{
    double sumV2 = 0;
    double sumI2 = 0;
    double sumP = 0;

    for (int index = 0; index < SAMPLES; index++) {
        float rawV = rawToVolts(adc.readADC_SingleEnded(voltageChannel));
        float rawI = rawToVolts(adc.readADC_SingleEnded(currentChannel));
        float v = (rawV - VOLTAGE_BIAS) * VOLTAGE_CAL;
        float i = (rawI - CURRENT_BIAS) * CURRENT_CAL;

        sumV2 += v * v;
        sumI2 += i * i;
        sumP += v * i;
        delayMicroseconds(250);
    }

    metrics->vrms = fastSqrt(sumV2 / SAMPLES);
    metrics->irms = fastSqrt(sumI2 / SAMPLES);
    metrics->realPowerW = sumP / SAMPLES;
    metrics->apparentPowerVA = metrics->vrms * metrics->irms;
    metrics->powerFactor = metrics->apparentPowerVA > 0.01f ? metrics->realPowerW / metrics->apparentPowerVA : 0;
    metrics->energyKwh += metrics->realPowerW * (double)elapsedMs / 3600000000.0;
}

void printPhase(const char *label, PhaseMetrics metrics)
{
    Serial.print(label);
    Serial.print(": Vrms=");
    Serial.print(metrics.vrms);
    Serial.print(" Irms=");
    Serial.print(metrics.irms);
    Serial.print(" W=");
    Serial.print(metrics.realPowerW);
    Serial.print(" VA=");
    Serial.print(metrics.apparentPowerVA);
    Serial.print(" PF=");
    Serial.print(metrics.powerFactor);
    Serial.print(" kWh=");
    Serial.println(metrics.energyKwh);
}

void setup()
{
    Serial.begin(115200);
    Wire.begin();
    adc.begin(0x48);
    Serial.println("ESP32 AC energy meter ready");
}

void loop()
{
    unsigned long now = millis();
    unsigned long elapsed = lastPrintMs == 0 ? 1000 : now - lastPrintMs;

    samplePhase(&phaseA, 0, 1, elapsed);
    samplePhase(&phaseB, 2, 3, elapsed);

    if (now - lastPrintMs >= 1000 || lastPrintMs == 0) {
        float totalW = phaseA.realPowerW + phaseB.realPowerW;
        double totalKwh = phaseA.energyKwh + phaseB.energyKwh;

        printPhase("A", phaseA);
        printPhase("B", phaseB);
        Serial.print("TOTAL: W=");
        Serial.print(totalW);
        Serial.print(" kWh=");
        Serial.println(totalKwh);
        lastPrintMs = now;
    }

    delay(1000);
}
