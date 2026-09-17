-- Fix remaining truncated option_text for S1-Q6 (Self) — expand "…" to full Excel sentences.
UPDATE "question_options" SET "option_text" = 'I take appropriate actions to improve organisational performance based on interpretation of financial statements', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = 'opt_s1_6_a';
UPDATE "question_options" SET "option_text" = 'Sometimes, I take actions to improve organisational performance based on interpretation of financial statements', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = 'opt_s1_6_b';
