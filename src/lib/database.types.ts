export type PlanTier = "free" | "basic" | "pro";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseRecord = {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  mode: "fundamentals" | "project" | "leetcode" | "mixed";
  checkpoint: string;
  description: string | null;
  progress: number;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type WorkspaceFileRecord = {
  id: string;
  course_id: string;
  path: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceFolderRecord = {
  id: string;
  course_id: string;
  path: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessageRecord = {
  id: string;
  course_id: string;
  role: "user" | "assistant";
  content: string;
  lesson_index: number | null;
  created_at: string;
};

export type CourseProgressRecord = {
  course_id: string;
  lesson_index: number;
  lesson_view: "resume" | "progress" | "exercises" | null;
  selected_file_path: string | null;
  updated_at: string;
};

export type SubscriptionRecord = {
  user_id: string;
  plan: PlanTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: "free" | "trialing" | "active" | "past_due" | "canceled";
  current_period_end: string | null;
  updated_at: string;
};

export type UsageEventRecord = {
  id: string;
  user_id: string;
  course_id: string | null;
  event_type: "tutor_message" | "tool_call" | "code_run";
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  status: "success" | "failed" | "blocked";
  created_at: string;
};
