export function register(registry) {
  registry.register({
    id: 'component-mcp3008-library',
    libraries: ['MCP3008'],
    capabilities: ['spi-adc'],
    imports({ runtime }) {
      return {
        __vl_mcp3008Begin(chipSelectPin) {
          return runtime.mcp3008Begin(Number(chipSelectPin)) ? 1 : 0;
        },
        __vl_mcp3008Read(chipSelectPin, channel) {
          return runtime.mcp3008Read(Number(chipSelectPin), Number(channel));
        }
      };
    }
  });
}
