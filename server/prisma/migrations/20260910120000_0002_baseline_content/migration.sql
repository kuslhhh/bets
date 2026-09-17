-- 0002_baseline_content
-- Baseline content for the Finance v1 assessment, transcribed verbatim from
-- PROJECT.md §2.4/§2.5/§5.2/§5.3/§5.4.
--
-- Roles: ADMIN (full administration) + USER (takes assessments, sees own
-- results). All IDs are fixed so foreign keys are stable across environments.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

INSERT INTO "roles" ("id", "code", "name", "description", "created_at", "updated_at")
VALUES
  ('role_admin', 'ADMIN', 'Administrator',
   'Full system administration: users, roles, assessment configuration, seeded content, reports, settings.',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_user', 'USER', 'User',
   'Takes assigned assessments; sees own results.',
   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

INSERT INTO "permissions" ("id", "code", "description", "created_at")
VALUES
  ('perm_users_view',            'users.view',              'List/view users',                          CURRENT_TIMESTAMP),
  ('perm_users_manage',          'users.manage',            'Create/update/role/activate users',        CURRENT_TIMESTAMP),
  ('perm_assessments_manage',    'assessments.manage',      'Create/update/publish/close assessments',  CURRENT_TIMESTAMP),
  ('perm_questions_manage',      'questions.manage',        'Manage questions/sections/categories',     CURRENT_TIMESTAMP),
  ('perm_questions_scores',      'questions.scores.manage', 'Manage question option score values',      CURRENT_TIMESTAMP),
  ('perm_assignments_manage',    'assignments.manage',      'Create/list all assignments',              CURRENT_TIMESTAMP),
  ('perm_assignments_self_view', 'assignments.self.view',   'View own assignments',                     CURRENT_TIMESTAMP),
  ('perm_assignments_self_resp', 'assignments.self.respond','Answer/submit own assignments',            CURRENT_TIMESTAMP),
  ('perm_results_self_view',     'results.self.view',       'View own results',                         CURRENT_TIMESTAMP),
  ('perm_results_org_view',      'results.org.view',        'View organisation aggregates',             CURRENT_TIMESTAMP),
  ('perm_results_indiv_view',    'results.individual.view', 'View identifiable individual results',     CURRENT_TIMESTAMP),
  ('perm_reports_view',          'reports.view',            'View reports',                             CURRENT_TIMESTAMP),
  ('perm_reports_export',        'reports.export',          'Export reports',                           CURRENT_TIMESTAMP),
  ('perm_settings_manage',       'settings.manage',         'Manage settings',                          CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------------------
-- Role permissions
-- ---------------------------------------------------------------------------

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at", "updated_at")
VALUES
  -- ADMIN: everything
  ('role_admin', 'perm_users_view',            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_users_manage',          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_assessments_manage',    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_questions_manage',      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_questions_scores',      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_assignments_manage',    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_assignments_self_view', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_assignments_self_resp', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_results_self_view',     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_results_org_view',      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_results_indiv_view',    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_reports_view',          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_reports_export',        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_admin', 'perm_settings_manage',       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- USER: self-service only
  ('role_user', 'perm_assignments_self_view',  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_user', 'perm_assignments_self_resp',  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_user', 'perm_results_self_view',      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------------------
-- Bootstrap admin (bets_admin) — strong random placeholder password.
-- (bcrypt cost 12). Dev/bootstrap only: rotate on first login or via
-- scripts/create-admin.ts / a password reset before any real use.
-- ---------------------------------------------------------------------------

INSERT INTO "users" ("id", "email", "password_hash", "name", "role_id", "is_active", "created_at", "updated_at")
VALUES (
  'user_bets_admin',
  'admin@bets.com',
  '$2b$12$YjcmHmX0RJJPFahjEE/UPeW1oPN1ERxbki.DwYWliF.JZac4Nza86',
  'BETS Admin',
  'role_admin',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Assessment (v1 singleton — one DRAFT Finance assessment)
-- ---------------------------------------------------------------------------

INSERT INTO "assessments" ("id", "type", "status", "title", "description", "created_at", "updated_at")
VALUES (
  'asmt_finance_v1',
  'FINANCIAL_MATURITY',
  'DRAFT',
  'Financial Maturity Assessment',
  'Business Health / Financial Maturity Assessment for the organisation.',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Sections
-- ---------------------------------------------------------------------------

INSERT INTO "sections" ("id", "assessment_id", "order", "title", "source_text", "description", "created_at", "updated_at")
VALUES
  ('sect_finance_1', 'asmt_finance_v1', 1, 'Section 1: About self',         'Section 1:  About self',
   'About self — individual respondent perspective (first person).', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sect_finance_2', 'asmt_finance_v1', 2, 'Section 2: About organisation', 'Section  2:  About organisation   ',
   'About organisation — perception of leadership (third person).',  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

INSERT INTO "categories" ("id", "section_id", "order", "name", "source_text", "description", "created_at", "updated_at")
VALUES
  ('cat_s1_knowledge', 'sect_finance_1', 1, 'Knowledge',       'Knowladge',
   'Self: ability to read and interpret financial statements (S1-Q1, S1-Q2).', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_s1_tool',      'sect_finance_1', 2, 'Usage as tool',   'Usage as tool',
   'Self: using financial statements as a management tool (S1-Q3, S1-Q4).',   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_s1_decision',  'sect_finance_1', 3, 'Decision Making', 'Decision Making',
   'Self: evaluating and acting on financial health (S1-Q5, S1-Q6, S1-Q7).',  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_s2_knowledge', 'sect_finance_2', 1, 'Knowledge',       'Knowladge',
   'Organisation: top management''s ability to read financial statements (S2-Q1, S2-Q2).', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_s2_tool',      'sect_finance_2', 2, 'Usage as tool',   'Usage as tool',
   'Organisation: top management using financial statements as a tool (S2-Q3, S2-Q4).',    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_s2_decision',  'sect_finance_2', 3, 'Decision Making', 'Decision Making',
   'Organisation: top management evaluating and acting on financial health (S2-Q5, S2-Q6, S2-Q7).', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------------------
-- Questions (14 scored + 2 open)
-- ---------------------------------------------------------------------------

INSERT INTO "questions" ("id", "assessment_id", "section_id", "category_id", "source_number", "type", "prompt_text", "source_text", "order", "is_required", "slot_count", "status", "created_by", "created_at", "updated_at")
VALUES
  -- Section 1 (self)
  ('q_s1_1', 'asmt_finance_v1', 'sect_finance_1', 'cat_s1_knowledge', '1', 'SINGLE_SELECT',
   'I know, how to read financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements:',
   'I know, how to read financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements:',
   1, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s1_2', 'asmt_finance_v1', 'sect_finance_1', 'cat_s1_knowledge', '2', 'SINGLE_SELECT',
   'I know, how financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements indicate health of organisation:',
   'I know, how financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements indicate health of organisation:',
   2, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s1_3', 'asmt_finance_v1', 'sect_finance_1', 'cat_s1_tool', '3', 'SINGLE_SELECT',
   'I evaluate financial health of organisation using financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements:',
   'I evaluate financial health of organisation using financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements:',
   3, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s1_4', 'asmt_finance_v1', 'sect_finance_1', 'cat_s1_tool', '4', 'SINGLE_SELECT',
   'I know, inter linkages between financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements:',
   'I know, inter linkages between financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements:',
   4, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s1_5', 'asmt_finance_v1', 'sect_finance_1', 'cat_s1_decision', '5', 'SINGLE_SELECT',
   'I am aware of how my decisions are reflected in financial statements:',
   'I am aware of how my decisions are reflected in financial statements:',
   5, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s1_6', 'asmt_finance_v1', 'sect_finance_1', 'cat_s1_decision', '6', 'SINGLE_SELECT',
   'I take appropriate actions to improve organisational performance based on interpretation of financial statements:',
   'I take appropriate actions to improve organisational performance based on interpretation of financial statements:',
   6, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s1_7', 'asmt_finance_v1', 'sect_finance_1', 'cat_s1_decision', '7', 'SINGLE_SELECT',
   'I do feel necessary to improve my knowledge about organisation''s financial statements for professional growth:',
   'I do feel necessary to improve my knowledge about organisation''s financial statements for professional growth:',
   7, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s1_8', 'asmt_finance_v1', 'sect_finance_1', NULL, '8', 'TEXT_MULTI_SLOT',
   'List down 4 areas where you want to improve your knowledge about organisation''s financial activities:',
   'List down 4 areas where you want to improve your knowledge about organisation''s financial activities:',
   8, false, 4, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

  -- Section 2 (organisation)
  ('q_s2_1', 'asmt_finance_v1', 'sect_finance_2', 'cat_s2_knowledge', '1', 'SINGLE_SELECT',
   'In your company, top management and decision makers can read financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements',
   'In your company, top management and decision makers can read financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements',
   1, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s2_2', 'asmt_finance_v1', 'sect_finance_2', 'cat_s2_knowledge', '2', 'SINGLE_SELECT',
   'In your company, top management and decision makers know that financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements indicate health of organisation',
   'In your company, top management and decision makers know that financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements indicate health of organisation',
   2, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s2_3', 'asmt_finance_v1', 'sect_finance_2', 'cat_s2_tool', '3', 'SINGLE_SELECT',
   'In your company, top management and decision makers evaluate financial health of organisation using financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements:',
   'In your company, top management and decision makers evaluate financial health of organisation using financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements:',
   3, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s2_4', 'asmt_finance_v1', 'sect_finance_2', 'cat_s2_tool', '4', 'SINGLE_SELECT',
   'In your company, top management and decision makers know inter linkages between financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements:',
   'In your company, top management and decision makers know inter linkages between financial statements like Balance Sheet, Profit & Loss Statement and Cash flow statements:',
   4, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s2_5', 'asmt_finance_v1', 'sect_finance_2', 'cat_s2_decision', '5', 'SINGLE_SELECT',
   'In your company, top management and decision makers are aware of how their decisions are reflected in financial statements:',
   'In your company, top management and decision makers are aware of how their decisions are reflected in financial statements:',
   5, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s2_6', 'asmt_finance_v1', 'sect_finance_2', 'cat_s2_decision', '6', 'SINGLE_SELECT',
   'In your company, top management and decision makers take appropriate actions to improve organisational performance based on interpretation of financial statements:',
   'In your company, top management and decision makers take appropriate actions to improve organisational performance based on interpretation of financial statements:',
   6, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('q_s2_7', 'asmt_finance_v1', 'sect_finance_2', 'cat_s2_decision', '7', 'SINGLE_SELECT',
   'In your company, it is necessary to improve knowledge of top management and decision makers, about organisation''s financial statements for effective organisational performance:',
   'In your company, it is necessary to improve knowledge of top management and decision makers, about organisation''s financial statements for effective organisational performance:',
   7, true, NULL, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- Excel quirk: prompt is "4 problems" but the source workbook numbers it Q16;
  -- seeded verbatim per PROJECT.md §2.5.
  ('q_s2_16', 'asmt_finance_v1', 'sect_finance_2', NULL, '16', 'TEXT_MULTI_SLOT',
   'In your company, list down 4 problems related to financial activities affecting overall performance:',
   'In your company, list down 4 problems related to financial activities affecting overall performance:',
   8, false, 4, 'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------------------
-- Question options (scored only; 4 per scored question)
-- ---------------------------------------------------------------------------

INSERT INTO "question_options" ("id", "question_id", "order", "label", "option_text", "score_value", "created_at", "updated_at")
VALUES
  -- S1-Q1
  ('opt_s1_1_a', 'q_s1_1', 1, 'a', 'I know how to read financial statements', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_1_b', 'q_s1_1', 2, 'b', 'I need help to read financial statements', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_1_c', 'q_s1_1', 3, 'c', 'I don''t feel it is needed for me', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_1_d', 'q_s1_1', 4, 'd', 'I think, it is not applicable for me', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S1-Q2
  ('opt_s1_2_a', 'q_s1_2', 1, 'a', 'I know', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_2_b', 'q_s1_2', 2, 'b', 'I know partially', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_2_c', 'q_s1_2', 3, 'c', 'I am not aware', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_2_d', 'q_s1_2', 4, 'd', 'I think, it is not applicable for me', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S1-Q3
  ('opt_s1_3_a', 'q_s1_3', 1, 'a', 'I evaluate financial health of organisation using financial statements', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_3_b', 'q_s1_3', 2, 'b', 'I need help to evaluate financial health of organisation using financial statements', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_3_c', 'q_s1_3', 3, 'c', 'I am not aware', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_3_d', 'q_s1_3', 4, 'd', 'I think, it is not applicable for me', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S1-Q4
  ('opt_s1_4_a', 'q_s1_4', 1, 'a', 'I know', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_4_b', 'q_s1_4', 2, 'b', 'I know partially', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_4_c', 'q_s1_4', 3, 'c', 'I am not aware', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_4_d', 'q_s1_4', 4, 'd', 'I think, it is not applicable for me', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S1-Q5
  ('opt_s1_5_a', 'q_s1_5', 1, 'a', 'I am aware', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_5_b', 'q_s1_5', 2, 'b', 'I am not aware', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_5_c', 'q_s1_5', 3, 'c', 'I don''t feel it is important to know it', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_5_d', 'q_s1_5', 4, 'd', 'I think, it is not applicable for me', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S1-Q6
  ('opt_s1_6_a', 'q_s1_6', 1, 'a', 'I take appropriate actions to improve organisational performance based on interpretation of financial statements', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_6_b', 'q_s1_6', 2, 'b', 'Sometimes, I take actions to improve organisational performance based on interpretation of financial statements', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_6_c', 'q_s1_6', 3, 'c', 'I don''t feel it is needed', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_6_d', 'q_s1_6', 4, 'd', 'I think, it is not applicable for me', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S1-Q7
  ('opt_s1_7_a', 'q_s1_7', 1, 'a', 'I do have adequate knowledge about organisation''s financial statements', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_7_b', 'q_s1_7', 2, 'b', 'I do feel to improve my organisational financial literacy', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_7_c', 'q_s1_7', 3, 'c', 'I don''t feel to improve my organisational financial literacy', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s1_7_d', 'q_s1_7', 4, 'd', 'I think, it is not applicable for me', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S2-Q1
  ('opt_s2_1_a', 'q_s2_1', 1, 'a', 'Top management and decision makers can read financial statements', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_1_b', 'q_s2_1', 2, 'b', 'Top management and decision makers need help to read financial statements', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_1_c', 'q_s2_1', 3, 'c', 'They don''t feel need of it', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_1_d', 'q_s2_1', 4, 'd', 'I think, they need not to know it', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S2-Q2
  ('opt_s2_2_a', 'q_s2_2', 1, 'a', 'Top management and decision makers know about it', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_2_b', 'q_s2_2', 2, 'b', 'Some of top management and decision makers know it partially', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_2_c', 'q_s2_2', 3, 'c', 'They are not aware', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_2_d', 'q_s2_2', 4, 'd', 'I think, they need not to know it', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S2-Q3
  ('opt_s2_3_a', 'q_s2_3', 1, 'a', 'Top management and decision makers evaluate financial health of organisation using financial statements', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_3_b', 'q_s2_3', 2, 'b', 'Some of top management and decision makers can partially evaluate financial health of organisation using financial statements', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_3_c', 'q_s2_3', 3, 'c', 'They are not aware', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_3_d', 'q_s2_3', 4, 'd', 'I think, they need not to know it', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S2-Q4
  ('opt_s2_4_a', 'q_s2_4', 1, 'a', 'Top management and decision makers know inter linkages between financial statements', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_4_b', 'q_s2_4', 2, 'b', 'Some of top management and decision makers know partially inter linkages between financial statements', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_4_c', 'q_s2_4', 3, 'c', 'They are not aware', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_4_d', 'q_s2_4', 4, 'd', 'I think, they need not to know it', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S2-Q5
  ('opt_s2_5_a', 'q_s2_5', 1, 'a', 'Top management and decision makers are aware of how their decisions are reflected in financial statements', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_5_b', 'q_s2_5', 2, 'b', 'Top management and decision makers are not aware of how their decisions are reflected in financial statements', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_5_c', 'q_s2_5', 3, 'c', 'They don''t feel it is important to know it', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_5_d', 'q_s2_5', 4, 'd', 'I think, they need not to know it', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S2-Q6
  ('opt_s2_6_a', 'q_s2_6', 1, 'a', 'Top management and decision makers take appropriate actions to improve organisational performance based on interpretation of financial statements', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_6_b', 'q_s2_6', 2, 'b', 'Sometimes, top management and decision makers take actions to improve organisational performance based on interpretation of financial statements', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_6_c', 'q_s2_6', 3, 'c', 'They don''t feel it is needed', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_6_d', 'q_s2_6', 4, 'd', 'I think, they need not to know it', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  -- S2-Q7
  ('opt_s2_7_a', 'q_s2_7', 1, 'a', 'They do have adequate knowledge about organisation''s financial statements', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_7_b', 'q_s2_7', 2, 'b', 'They feel, need to improve knowledge about organisation''s financial statements', 75, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_7_c', 'q_s2_7', 3, 'c', 'They don''t feel, need to improve knowledge about organisation''s financial statements', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('opt_s2_7_d', 'q_s2_7', 4, 'd', 'I think, they need not to know it', 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
