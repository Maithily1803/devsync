// src/lib/gemini.ts
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export const aiSummariseCommit = async (diff: string): Promise<string> => {
  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash', // Specify the model name
    contents: [
      {
        text: `You are an expert programmer, and you are trying to summarize a git diff.
Reminders about the git diff format:
- Lines starting with "+" were added
- Lines starting with "-" were deleted
- Lines starting with neither are context
EXAMPLE SUMMARY COMMENTS:
* Raised the amount of returned recordings from \`10\` to \`100\` [packages/server/recordings_api.ts], [packages/server/constants.ts]
* Fixed a typo in the github action name [.github/workflows/gpt-commit-summarizer.yml]
* Moved the \`octokit\` initialization to a separate file [src/octokit.ts], [src/index.ts]
* Added an OpenAI API for completions [packages/utils/apis/openai.ts]
* Lowered numeric tolerance for test files
Most commits will have fewer comments than this example list.
The last comment does not include file names if there are more than two relevant files.
Do not include parts of the example in your summary; it is only for reference.`
      },
      {
        text: `Please summarise the following diff file:\n\n${diff}`
      }
    ]
  });

  return response.text ?? '';
};
