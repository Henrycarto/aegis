import { signalFloor } from './signals';
import type { AiAssessment, AnalysisResult, EmailInput, Signal } from './types';
import { verdictFor } from './types';

/**
 * The model decides. Verified signals can only raise the score to their floor,
 * never lower it, so an email that talks the model into "safe" still cannot
 * get past a raw-IP link or a lookalike domain.
 */
export function combine(input: EmailInput, signals: Signal[], ai: AiAssessment | null): AnalysisResult {
  const floor = signalFloor(signals);
  const base = {
    signals,
    ai,
    sender_email: input.sender_email,
    sender_name: input.sender_name,
    subject: input.subject,
    body: input.body,
  };

  if (ai) {
    const score = Math.max(ai.risk_score, floor);
    const floorApplied = floor > ai.risk_score;
    return {
      ...base,
      risk_score: score,
      verdict: verdictFor(score),
      summary: floorApplied
        ? `${ai.summary} A verified technical check raised the risk score to ${score}.`.trim()
        : ai.summary,
      red_flags: ai.red_flags,
      source: 'ai',
      floor_applied: floorApplied,
    };
  }

  const top = [...signals].sort((a, b) => b.floor - a.floor)[0];
  return {
    ...base,
    risk_score: floor,
    verdict: verdictFor(floor),
    summary: top && top.floor > 0
      ? `The AI check is unavailable, but a technical check found a serious problem: ${top.description}.`
      : 'The AI check is unavailable, so only technical checks ran. They found nothing conclusive, which is not the same as safe.',
    red_flags: [],
    source: 'signals',
    floor_applied: floor > 0,
  };
}
