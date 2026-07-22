import { createBoardEditor } from './board-editor.js';

createBoardEditor(document).start().catch((error) => {
  console.error(error);
});
