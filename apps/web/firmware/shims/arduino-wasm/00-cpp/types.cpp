using uint8_t = unsigned char;
using uint16_t = unsigned short;
using uint32_t = unsigned int;
using size_t = unsigned long;
using byte = unsigned char;
#define IRAM_ATTR

int __vl_append_char(char *buffer, size_t size, int index, char value) {
  if (index < (int)size - 1) {
    buffer[index] = value;
  }
  return index + 1;
}

int __vl_append_string(char *buffer, size_t size, int index, const char *value) {
  int source = 0;
  while (value && value[source] != 0) {
    index = __vl_append_char(buffer, size, index, value[source]);
    source++;
  }
  return index;
}

int __vl_append_int(char *buffer, size_t size, int index, int value) {
  char digits[16];
  int count = 0;
  if (value < 0) {
    index = __vl_append_char(buffer, size, index, '-');
    value = -value;
  }
  do {
    digits[count++] = (char)('0' + (value % 10));
    value /= 10;
  } while (value > 0 && count < 16);
  while (count > 0) {
    index = __vl_append_char(buffer, size, index, digits[--count]);
  }
  return index;
}

void __vl_terminate(char *buffer, size_t size, int index) {
  if (size == 0) {
    return;
  }
  buffer[index < (int)size ? index : (int)size - 1] = 0;
}

int snprintf(char *buffer, size_t size, const char *, const char *first, const char *second) {
  int index = __vl_append_string(buffer, size, 0, first);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_string(buffer, size, index, second);
  __vl_terminate(buffer, size, index);
  return index;
}

int snprintf(char *buffer, size_t size, const char *, const char *first, const char *second, int third) {
  int index = __vl_append_string(buffer, size, 0, first);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_string(buffer, size, index, second);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_int(buffer, size, index, third);
  __vl_terminate(buffer, size, index);
  return index;
}

int snprintf(char *buffer, size_t size, const char *, const char *first, const char *second, const char *third, const char *fourth) {
  int index = __vl_append_string(buffer, size, 0, first);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_string(buffer, size, index, second);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_string(buffer, size, index, third);
  index = __vl_append_char(buffer, size, index, ':');
  index = __vl_append_string(buffer, size, index, fourth);
  __vl_terminate(buffer, size, index);
  return index;
}

class String {
public:
  String() { clear(); }
  String(const char *value) { assign(value); }
  void operator+=(char value) {
    int currentLength = length();
    if (currentLength < 127) {
      buffer[currentLength] = value;
      buffer[currentLength + 1] = 0;
    }
  }
  bool operator==(const char *value) const { return equals(value); }
  const char *c_str() const { return buffer; }
  int toInt() const {
    int value = 0;
    int sign = buffer[0] == '-' ? -1 : 1;
    int index = sign < 0 ? 1 : 0;
    while (buffer[index] >= '0' && buffer[index] <= '9') {
      value = value * 10 + (buffer[index] - '0');
      index++;
    }
    return value * sign;
  }
private:
  char buffer[128];
  void clear() { buffer[0] = 0; }
  int length() const {
    int index = 0;
    while (buffer[index] != 0 && index < 127) { index++; }
    return index;
  }
  void assign(const char *value) {
    int index = 0;
    while (value && value[index] != 0 && index < 127) {
      buffer[index] = value[index];
      index++;
    }
    buffer[index] = 0;
  }
  bool equals(const char *value) const {
    int index = 0;
    while (buffer[index] != 0 || (value && value[index] != 0)) {
      if (!value || buffer[index] != value[index]) {
        return false;
      }
      index++;
    }
    return true;
  }
};
