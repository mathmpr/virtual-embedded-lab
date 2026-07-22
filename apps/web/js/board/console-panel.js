export function createConsolePanel({ consoleOutput }) {
  function setConsoleText(text) {
    consoleOutput.textContent = text;
  }

  function appendConsoleText(text) {
    consoleOutput.textContent += text;
  }

  return {
    consoleOutput,
    setConsoleText,
    appendConsoleText
  };
}
