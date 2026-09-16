// Shared client domain types (single definition — was redefined per route file).

export interface Option {
  id: string;
  label: string;
  optionText: string;
  order: number;
}

export type QuestionType = "SINGLE_SELECT" | "TEXT_MULTI_SLOT";

export interface Question {
  id: string;
  promptText: string;
  type: QuestionType;
  order: number;
  isRequired: boolean;
  slotCount?: number | null;
  status: string;
  categoryId?: string | null;
  sectionId: string;
  options: Option[];
}

export interface Section {
  id: string;
  title: string;
  order: number;
  sourceText?: string | null;
}

export interface AssessmentListItem {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  createdAt: string;
}

export interface AssignmentRef {
  id: string;
  status: string;
  assessmentId: string;
  assessment: { id: string; title: string };
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  role: { code: string };
}

export interface CategoryScore {
  id: string;
  name: string;
  averageScore: number;
  minScore?: number | null;
  maxScore?: number | null;
  sectionOrder?: number;
  band?: { label: string };
}

export interface Progress {
  answered: number;
  required: number;
}

// Assessment detail tree (admin view; options may carry scoreValue for admins).
export interface AssessmentTreeQuestion extends Omit<Question, "options"> {
  options: (Option & { scoreValue?: number })[];
}

export interface AssessmentTreeSection extends Section {
  categories: { id: string; name: string }[];
  questions: AssessmentTreeQuestion[];
}

export interface AssessmentDetail extends AssessmentListItem {
  sections: AssessmentTreeSection[];
}
