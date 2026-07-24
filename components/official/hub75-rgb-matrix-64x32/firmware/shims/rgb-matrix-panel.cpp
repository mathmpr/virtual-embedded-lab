extern "C" bool __vl_rgbMatrixBegin(int width, int height);
extern "C" void __vl_rgbMatrixFillScreen(unsigned int color);
extern "C" void __vl_rgbMatrixDrawPixel(int x, int y, unsigned int color);
extern "C" void __vl_rgbMatrixPrintText(int x, int y, const char *text, unsigned int color);

unsigned int color565(int red, int green, int blue);

class RGBmatrixPanel {
public:
  RGBmatrixPanel(int a, int b, int c, int d, int e, int clk, int lat, int oe, bool dbuf = false, int width = 64)
    : widthPixels(width), heightPixels(32) {}

  void begin() { __vl_rgbMatrixBegin(widthPixels, heightPixels); }
  void fillScreen(unsigned int color) { __vl_rgbMatrixFillScreen(color); }
  void drawPixel(int x, int y, unsigned int color) { __vl_rgbMatrixDrawPixel(x, y, color); }
  void printText(int x, int y, const char *text, unsigned int color) { __vl_rgbMatrixPrintText(x, y, text, color); }
  unsigned int color565(int red, int green, int blue) { return ::color565(red, green, blue); }

private:
  int widthPixels;
  int heightPixels;
};

unsigned int color565(int red, int green, int blue)
{
  unsigned int r = ((unsigned int)red & 0xf8) << 8;
  unsigned int g = ((unsigned int)green & 0xfc) << 3;
  unsigned int b = ((unsigned int)blue & 0xf8) >> 3;
  return r | g | b;
}
