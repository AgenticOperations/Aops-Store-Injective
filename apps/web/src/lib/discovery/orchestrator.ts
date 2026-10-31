import { parseNaturalLanguageQuery } from './gemini-parser';
import { parseKeywordsFallback } from './keyword-fallback';

export async function resolveUserQuery(prompt: string) {
  try {
    return await parseNaturalLanguageQuery(prompt);
  } catch {
    return parseKeywordsFallback(prompt);
  }
}
