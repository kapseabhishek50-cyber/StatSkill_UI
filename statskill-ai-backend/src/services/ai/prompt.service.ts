/** Central place for prompt composition. Services never inline raw LLM prompts. */
import { assistantSystemPrompt, assistantContextPrompt } from '../../ai/prompts/assistant.prompts';
import { quizGenerationPrompt, assessmentQuestionsPrompt, QuizPromptContext } from '../../ai/prompts/quiz.prompts';
import { recommendationExplanationPrompt } from '../../ai/prompts/recommendation.prompts';

export const promptService = {
  assistant: (context: Record<string, unknown>, question: string) => ({
    system: assistantSystemPrompt(),
    prompt: assistantContextPrompt(context, question),
  }),
  quiz: (ctx: QuizPromptContext) => quizGenerationPrompt(ctx),
  assessmentQuestions: assessmentQuestionsPrompt,
  recommendationExplanations: recommendationExplanationPrompt,
};
