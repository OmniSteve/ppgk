/**
 * Shared helpers for player_performance records.
 *
 * Explicit, named field mappers (not the generic toSnake regex mapper) are used
 * deliberately here: this project has a history of snake_case/camelCase field-name
 * bugs, and a named mapper fails loudly (undefined column) on a typo instead of
 * silently dropping a field.
 */

export const RATING_FIELDS = [
  'overallRating',
  'handlingRating',
  'divingRating',
  'footworkRating',
  'distributionRating',
  'communicationRating',
  'attitudeRating',
];

/** True if value is an integer from 1 to 5 inclusive. */
export function isValidRating(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Validate all 7 rating fields on a request body; returns an error message or null. */
export function validateRatings(body) {
  for (const field of RATING_FIELDS) {
    if (!isValidRating(body[field])) return `${field} must be an integer from 1 to 5`;
  }
  return null;
}

/**
 * Explicit camelCase request body -> snake_case column map, for INSERT/UPDATE binds.
 * Does not include player_id / client_id / booking_id / session_id / created_by —
 * those are handled separately since they're validated/derived, and immutable on update.
 */
export function mapPerformanceInput(body) {
  return {
    evaluation_date: body.evaluationDate,
    overall_rating: body.overallRating,
    handling_rating: body.handlingRating,
    diving_rating: body.divingRating,
    footwork_rating: body.footworkRating,
    distribution_rating: body.distributionRating,
    communication_rating: body.communicationRating,
    attitude_rating: body.attitudeRating,
    strengths: body.strengths ?? null,
    areas_to_improve: body.areasToImprove ?? null,
    coach_notes: body.coachNotes ?? null,
    recommended_focus: body.recommendedFocus ?? null,
    is_visible_to_client: body.isVisibleToClient === false ? 0 : 1,
  };
}
