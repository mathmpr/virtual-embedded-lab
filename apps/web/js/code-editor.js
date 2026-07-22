import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

export function createCodeEditor(parent, initialValue = '') {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initialValue,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        cpp(),
        oneDark,
        highlightActiveLine(),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': {
            height: '100%',
            backgroundColor: '#1e1f22',
            fontSize: '13px'
          },
          '.cm-scroller': {
            fontFamily: 'var(--mono)',
            lineHeight: '1.55'
          },
          '.cm-content': {
            padding: '12px 0'
          },
          '.cm-gutters': {
            backgroundColor: '#1b1c1f',
            borderRight: '1px solid #34373c'
          }
        })
      ]
    })
  });

  return {
    get value() {
      return view.state.doc.toString();
    },
    set value(nextValue) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: nextValue
        }
      });
    },
    focus() {
      view.focus();
    },
    destroy() {
      view.destroy();
    }
  };
}

