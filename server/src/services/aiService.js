import { env } from '../config/env.js';
import { generateMcqs, quizFeedback, answerAssistant, extractSkills } from './llm/index.js';
import { validateBatch } from './mcqValidator.js';
import { PROFICIENCY_LEVELS, levelLabel } from '../config/competency.js';

/**
 * Unified AI Service for StatSkill AI.
 *
 * Implements:
 *  - generateAssessmentQuestions()
 *  - analyzeSkillGap()
 *  - generateRecommendations()
 *  - generateQuiz()
 *  - generateQuizFeedback()
 *  - generateLearningPlan()
 *  - chatWithAssistant()
 *  - generateQuizFromDocument()
 */
export const aiService = {
  /**
   * Generates tailored baseline assessment questions based on role, experience and competency.
   */
  async generateAssessmentQuestions({ role, experienceYears = 3, competency, targetLevel = 3, count = 5 }) {
    const questionsResult = await generateMcqs({
      competency,
      targetLevel,
      count,
    });
    return {
      questions: questionsResult.questions,
      llmSource: questionsResult.llmSource || 'mock',
    };
  },

  /**
   * Evaluates gaps between current proficiency and target role requirements.
   */
  analyzeSkillGap({ currentLevel, requiredLevel, competencyName, importance = 1 }) {
    const gap = Math.max(0, requiredLevel - currentLevel);
    let priority = 'LOW';
    if (gap >= 3) priority = 'CRITICAL';
    else if (gap === 2) priority = 'HIGH';
    else if (gap === 1) priority = 'MEDIUM';

    const explanation = gap > 0
      ? `${competencyName} has a deficit of ${gap} level(s) against the role requirement of Level ${requiredLevel} (${levelLabel(requiredLevel)}). Prioritized as ${priority}.`
      : `${competencyName} meets or exceeds role expectation (Level ${currentLevel} vs Level ${requiredLevel} required).`;

    return {
      currentLevel,
      requiredLevel,
      gap,
      priority,
      explanation,
    };
  },

  /**
   * Generates personalized course recommendations and AI explanation narratives.
   */
  generateRecommendations({ roleTitle, topGaps, availableCourses }) {
    const recommendations = [];

    for (const gap of topGaps) {
      // Find matching courses
      const matched = availableCourses.filter((c) =>
        c.competencies?.some(
          (comp) => String(comp.competency?._id || comp.competency) === String(gap.competencyId),
        ),
      );

      for (const course of matched.slice(0, 2)) {
        recommendations.push({
          course,
          competencyName: gap.competency?.name || 'Competency',
          priority: gap.priority,
          band: gap.band,
          reason: `${course.title} is recommended from ${course.provider} because ${gap.competency?.name} is currently your highest priority gap (${gap.band}) for your role as ${roleTitle}.`,
        });
      }
    }

    return recommendations.slice(0, 5);
  },

  /**
   * Synthesizes MCQs directly from uploaded training material (PDF/DOCX/PPTX/TXT).
   */
  async generateQuizFromDocument({ documentText, fileName, count = 5, difficulty = 'Medium', language = 'English', competency }) {
    const level = difficulty === 'Hard' ? 4 : difficulty === 'Easy' ? 2 : 3;

    if (env.googleApiKey && !process.env.DEMO_MODE_FORCED) {
      try {
        const systemPrompt = `You are StatSkill AI, an expert exam author for India's Official Statistical System (MoSPI / NSSTA).
Generate exactly ${count} multiple choice questions (MCQs) strictly based on the provided learning material.
Language: ${language}.
Difficulty: ${difficulty} (target proficiency level: ${level} on 0-5 scale).

Rules:
- Exactly 4 options per question.
- Exactly 1 option must be correct.
- Provide a clear, educational explanation for why the correct option is right and the distractors are wrong.
- Never write "All of the above" or "None of the above".
- Return pure valid JSON array of objects with keys:
  "stem": question text
  "options": [ {"text": "...", "isCorrect": true/false}, ... ]
  "explanation": "..."
  "topic": "${competency?.name || 'Statistical Practice'}"
  "difficulty": "${difficulty}"`;

        const userPrompt = `Learning Material (${fileName}):
"""
${documentText.slice(0, 15000)}
"""

Generate ${count} MCQs in valid JSON format:`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${env.googleModel}:generateContent?key=${encodeURIComponent(env.googleApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
            }),
            signal: AbortSignal.timeout(30000),
          },
        );

        if (response.ok) {
          const payload = await response.json();
          const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);

          if (Array.isArray(parsed) && parsed.length > 0) {
            const formatted = parsed.map((q) => ({
              stem: q.stem || q.question,
              options: q.options,
              explanation: q.explanation || 'Verified statistical concept from training material.',
              targetLevel: level,
              topic: q.topic || competency?.name || 'Official Statistics',
              difficulty,
            }));

            const { accepted } = validateBatch(formatted);
            return {
              questions: accepted.length > 0 ? accepted : formatted,
              llmSource: 'google-gemini',
            };
          }
        }
      } catch (err) {
        console.warn(`[aiService] Gemini doc generation fallback to template: ${err.message}`);
      }
    }

    // Deterministic Hackathon Demo Fallback
    const questionsResult = await generateMcqs({
      competency: competency || { name: 'Statistical Methodology' },
      targetLevel: level,
      count,
    });

    return {
      questions: questionsResult.questions.map((q) => ({
        ...q,
        topic: competency?.name || 'Official Statistics',
        difficulty,
      })),
      llmSource: 'mock',
    };
  },

  /**
   * Provides constructive feedback on a submitted quiz attempt.
   */
  async generateQuizFeedback({ competency, targetLevel, answers, scoreRatio, passed }) {
    return quizFeedback({
      competency,
      targetLevel,
      answers,
      scoreRatio,
      passed,
    });
  },

  /**
   * Synthesizes a multi-day structured study plan.
   */
  async generateLearningPlan({ user, gaps, days = 7 }) {
    const topGap = gaps[0]?.competency?.name || 'Statistical Programming';
    return {
      days,
      focusCompetency: topGap,
      schedule: [
        { day: 1, title: 'Foundations & Concepts', task: `Review ${topGap} definitions and MoSPI guidelines on iGOT.` },
        { day: 2, title: 'Methodology Study', task: `Study sampling and calculation routines (1.5 hours).` },
        { day: 3, title: 'Hands-on Exercises', task: `Practice with sample NSS / ASI dataset tabulations.` },
        { day: 4, title: 'Mid-Plan Self Check', task: `Take Level 2 practice quiz to verify terminology.` },
        { day: 5, title: 'Case Study & Exceptions', task: `Review non-routine exception handling in field records.` },
        { day: 6, title: 'Discussion & Peer Review', task: `Ask a question in the ${topGap} discussion group.` },
        { day: 7, title: 'Certification Assessment', task: `Attempt Level 3 verification quiz on StatSkill AI.` },
      ],
    };
  },

  /**
   * Context-aware floating chat assistant.
   */
  async chatWithAssistant({ question, context }) {
    return answerAssistant({ question, context });
  },
};

