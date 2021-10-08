/* global Runtime */
import { h } from 'preact';
import { useState, useLayoutEffect } from 'preact/hooks';
import {
  coreSyntaxFormatters,
  secondarySyntaxFormatters,
} from './markdownSyntaxFormatters';
import { Overflow, Help } from './icons';
import { Button } from '@crayons';
import { KeyboardShortcuts } from '@components/useKeyboardShortcuts';
import { BREAKPOINTS, useMediaQuery } from '@components/useMediaQuery';

const getIndexOfLineStart = (text, cursorStart) => {
  const currentCharacter = text.charAt(cursorStart);
  if (currentCharacter === '\n') {
    return cursorStart;
  }

  if (cursorStart !== 0) {
    return getIndexOfLineStart(text, cursorStart - 1);
  }

  return 0;
};

export const MarkdownToolbar = ({ textAreaId }) => {
  const [textArea, setTextArea] = useState(null);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const smallScreen = useMediaQuery(`(max-width: ${BREAKPOINTS.Medium - 1}px)`);

  const keyboardShortcutModifierText =
    Runtime.currentOS() === 'macOS' ? 'CMD' : 'CTRL';

  const markdownSyntaxFormatters = {
    ...coreSyntaxFormatters,
    ...secondarySyntaxFormatters,
  };

  const keyboardShortcuts = Object.fromEntries(
    Object.keys(markdownSyntaxFormatters)
      .filter(
        (syntaxName) => !!markdownSyntaxFormatters[syntaxName].keyboardShortcut,
      )
      .map((syntaxName) => {
        const { keyboardShortcut } = markdownSyntaxFormatters[syntaxName];
        return [keyboardShortcut, () => insertSyntax(syntaxName)];
      }),
  );

  useLayoutEffect(() => {
    setTextArea(document.getElementById(textAreaId));
  }, [textAreaId]);

  useLayoutEffect(() => {
    // If a user resizes their screen, make sure roving tabindex continues to operate
    const focusableToolbarButton = document.querySelector(
      '.toolbar-btn[tabindex="0"]',
    );
    if (!focusableToolbarButton) {
      document.querySelector('.toolbar-btn').setAttribute('tabindex', '0');
    }
  }, [smallScreen]);

  useLayoutEffect(() => {
    //   TODO: maybe tidy this up with an extracted version of dropdownUtils
    const clickOutsideHandler = ({ target }) => {
      if (
        target.id !== 'overflow-menu-button' &&
        !document
          .querySelector('.editor-toolbar__overflow-menu')
          .contains(target)
      ) {
        setOverflowMenuOpen(false);
      }
    };
    const escapePressHandler = ({ key }) => {
      if (key === 'Escape') {
        setOverflowMenuOpen(false);
        document.getElementById('overflow-menu-button').focus();
      }
      if (key === 'Tab') {
        // User tabbing away from toolbar, close without changing focus
        setOverflowMenuOpen(false);
      }
    };

    if (overflowMenuOpen) {
      // send focus to the first option
      document
        .getElementsByClassName('editor-toolbar__overflow-menu')[0]
        .getElementsByClassName('overflow-menu-btn')[0]
        .focus();

      document.addEventListener('keyup', escapePressHandler);
      document.addEventListener('click', clickOutsideHandler);
    } else {
      document.removeEventListener('keyup', escapePressHandler);
      document.removeEventListener('click', clickOutsideHandler);
    }

    return () => {
      document.removeEventListener('keyup', escapePressHandler);
      document.removeEventListener('click', clickOutsideHandler);
    };
  }, [overflowMenuOpen]);

  const handleToolbarButtonKeyPress = (event, className) => {
    const { key, target } = event;
    const {
      nextElementSibling: nextButton,
      previousElementSibling: previousButton,
    } = target;

    switch (key) {
      case 'ArrowRight':
        event.preventDefault();
        target.setAttribute('tabindex', '-1');
        if (nextButton) {
          nextButton.setAttribute('tabindex', 0);
          nextButton.focus();
        } else {
          const firstButton = document.querySelector(`.${className}`);
          firstButton.setAttribute('tabindex', '0');
          firstButton.focus();
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        target.setAttribute('tabindex', '-1');
        if (previousButton) {
          previousButton.setAttribute('tabindex', 0);
          previousButton.focus();
        } else {
          const allButtons = document.getElementsByClassName(className);
          const lastButton = allButtons[allButtons.length - 1];
          lastButton.setAttribute('tabindex', '0');
          lastButton.focus();
        }
        break;
      case 'ArrowDown':
        if (target.id === 'overflow-menu-button') {
          event.preventDefault();
          setOverflowMenuOpen(true);
        }
        break;
    }
  };

  const getSelectionData = (syntaxName) => {
    const {
      selectionStart: initialSelectionStart,
      selectionEnd,
      value,
    } = textArea;

    let selectionStart = initialSelectionStart;

    // The 'heading' formatter can edit a previously inserted syntax,
    // so we check if we need adjust the selection to the start of the line
    if (syntaxName === 'heading') {
      const startOfLine = getIndexOfLineStart(
        textArea.value,
        initialSelectionStart,
      );

      if (textArea.value.charAt(startOfLine + 1) === '#') {
        selectionStart = startOfLine + 1;
      }
    }

    const textBeforeInsertion = value.substring(0, selectionStart);
    const textAfterInsertion = value.substring(selectionEnd, value.length);
    const selectedText = value.substring(selectionStart, selectionEnd);

    return {
      textBeforeInsertion,
      textAfterInsertion,
      selectedText,
      selectionStart,
      selectionEnd,
    };
  };

  const insertSyntax = (syntaxName) => {
    setOverflowMenuOpen(false);

    const {
      textBeforeInsertion,
      textAfterInsertion,
      selectedText,
      selectionStart,
      selectionEnd,
    } = getSelectionData(syntaxName);

    const {
      formattedText,
      cursorOffsetStart,
      cursorOffsetEnd,
      insertOnNewLine,
    } = markdownSyntaxFormatters[syntaxName].getFormatting(selectedText);

    const requiresANewLine = selectionStart !== 0 && insertOnNewLine;
    const newLineOffset = requiresANewLine ? 1 : 0;

    const newTextContent = `${textBeforeInsertion}${
      requiresANewLine ? '\n' : ''
    }${formattedText}${textAfterInsertion}`;

    textArea.value = newTextContent;
    textArea.focus();
    textArea.setSelectionRange(
      selectionStart + cursorOffsetStart + newLineOffset,
      selectionEnd + cursorOffsetEnd + newLineOffset,
    );
  };

  const getSecondaryFormatterButtons = (isOverflow) =>
    Object.keys(secondarySyntaxFormatters).map((controlName, index) => {
      const { icon, label, keyboardShortcutKeys } =
        secondarySyntaxFormatters[controlName];
      return (
        <Button
          key={`${controlName}-btn`}
          role={isOverflow ? 'menuitem' : 'button'}
          variant="ghost"
          contentType="icon"
          icon={icon}
          className={`formatter-btn  ${
            isOverflow
              ? 'overflow-menu-btn hidden m:block'
              : 'toolbar-btn m:hidden'
          }`}
          tabindex={isOverflow && index === 0 ? '0' : '-1'}
          onClick={() => insertSyntax(controlName)}
          onKeyUp={(e) =>
            handleToolbarButtonKeyPress(
              e,
              isOverflow ? 'overflow-menu-btn' : 'toolbar-btn',
            )
          }
          aria-label={label}
          tooltip={
            smallScreen ? null : (
              <span aria-hidden="true" className="formatter-btn__tooltip">
                {label}
                {keyboardShortcutKeys ? (
                  <span className="opacity-75">
                    {` ${keyboardShortcutModifierText} + ${keyboardShortcutKeys}`}
                  </span>
                ) : null}
              </span>
            )
          }
        />
      );
    });

  return (
    <div
      className="editor-toolbar relative overflow-x-auto m:overflow-visible"
      aria-label="Markdown formatting toolbar"
      role="toolbar"
      aria-controls={textAreaId}
    >
      {Object.keys(coreSyntaxFormatters).map((controlName, index) => {
        const { icon, label, keyboardShortcutKeys } =
          coreSyntaxFormatters[controlName];
        return (
          <Button
            key={`${controlName}-btn`}
            variant="ghost"
            contentType="icon"
            icon={icon}
            className="toolbar-btn formatter-btn"
            tabindex={index === 0 ? '0' : '-1'}
            onClick={() => insertSyntax(controlName)}
            onKeyUp={(e) => handleToolbarButtonKeyPress(e, 'toolbar-btn')}
            aria-label={label}
            tooltip={
              smallScreen ? null : (
                <span aria-hidden="true">
                  {label}
                  {keyboardShortcutKeys ? (
                    <span className="opacity-75">
                      {` ${keyboardShortcutModifierText} + ${keyboardShortcutKeys}`}
                    </span>
                  ) : null}
                </span>
              )
            }
          />
        );
      })}
      {smallScreen ? getSecondaryFormatterButtons(false) : null}

      {smallScreen ? null : (
        <Button
          id="overflow-menu-button"
          onClick={() => setOverflowMenuOpen(!overflowMenuOpen)}
          onKeyUp={(e) => handleToolbarButtonKeyPress(e, 'toolbar-btn')}
          aria-expanded={overflowMenuOpen ? 'true' : 'false'}
          aria-haspopup="true"
          variant="ghost"
          contentType="icon"
          icon={Overflow}
          className="toolbar-btn ml-auto formatter-btn hidden m:block"
          tabindex="-1"
          aria-label="More options"
        />
      )}

      {overflowMenuOpen && (
        <div
          role="menu"
          className="absolute editor-toolbar editor-toolbar__overflow-menu crayons-dropdown p-2 right-0 top-100"
        >
          {getSecondaryFormatterButtons(true)}
          <Button
            tagName="a"
            role="menuitem"
            url="/p/editor_guide"
            variant="ghost"
            contentType="icon"
            icon={Help}
            className="overflow-menu-btn"
            tabindex="-1"
            aria-label="Help"
            onKeyUp={(e) => handleToolbarButtonKeyPress(e, 'overflow-menu-btn')}
          />
        </div>
      )}
      {textArea && (
        <KeyboardShortcuts
          shortcuts={keyboardShortcuts}
          eventTarget={textArea}
        />
      )}
    </div>
  );
};