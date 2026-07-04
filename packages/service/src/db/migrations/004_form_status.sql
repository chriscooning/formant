-- Form lifecycle: 'draft' (not live), 'published' (live + accepting),
-- 'closed' (live page shows a closed notice; responses rejected).
ALTER TABLE forms ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
