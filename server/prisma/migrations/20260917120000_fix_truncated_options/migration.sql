-- Fix truncated option_text that used "…" ellipsis for brevity — expand to full Excel texts.
-- Single-assessment mode: verbatim full sentences from Survey - Finance.xlsx Section 2.

UPDATE "question_options" SET "option_text" = 'Top management and decision makers evaluate financial health of organisation using financial statements', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = 'opt_s2_3_a';
UPDATE "question_options" SET "option_text" = 'Some of top management and decision makers can partially evaluate financial health of organisation using financial statements', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = 'opt_s2_3_b';
UPDATE "question_options" SET "option_text" = 'Top management and decision makers know inter linkages between financial statements', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = 'opt_s2_4_a';
UPDATE "question_options" SET "option_text" = 'Some of top management and decision makers know partially inter linkages between financial statements', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = 'opt_s2_4_b';
UPDATE "question_options" SET "option_text" = 'Top management and decision makers are aware of how their decisions are reflected in financial statements', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = 'opt_s2_5_a';
UPDATE "question_options" SET "option_text" = 'Top management and decision makers are not aware of how their decisions are reflected in financial statements', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = 'opt_s2_5_b';
UPDATE "question_options" SET "option_text" = 'Top management and decision makers take appropriate actions to improve organisational performance based on interpretation of financial statements', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = 'opt_s2_6_a';
UPDATE "question_options" SET "option_text" = 'Sometimes, top management and decision makers take actions to improve organisational performance based on interpretation of financial statements', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = 'opt_s2_6_b';
