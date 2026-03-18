import {
  CONTROL_CHARS_REGEX,
  HTML_TAG_REGEX,
  SCRIPT_OR_STYLE_REGEX,
} from './constants';
import { asString } from './utils';

export const normalizePlainText = (
  value: unknown,
  { multiline }: { multiline: boolean }
): string => {
  const raw = asString(value);
  const withoutScripts = raw.replace(SCRIPT_OR_STYLE_REGEX, ' ');
  const withoutHtml = withoutScripts.replace(HTML_TAG_REGEX, ' ');
  const withoutControlChars = withoutHtml.replace(CONTROL_CHARS_REGEX, '');
  const withNormalizedNewLines = withoutControlChars.replace(/\r\n?/g, '\n');

  if (!multiline) {
    return withNormalizedNewLines.replace(/\s+/g, ' ').trim();
  }

  return withNormalizedNewLines
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
