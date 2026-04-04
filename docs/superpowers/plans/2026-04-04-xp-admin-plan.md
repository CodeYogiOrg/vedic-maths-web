# XP System + Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-answer XP awards and an admin dashboard with user activity tracking.

**Architecture:** XP is awarded inside `checkAnswer()` in PracticePage using the existing `addXP()` from GameContext (which saves to Supabase). Activity is logged to a new `user_activity_log` table via a utility function called from AppLayout (page visits) and PracticePage (category changes). AdminPage reads all users' data and renders cards with a detail sheet.

**Tech Stack:** React + TypeScript + Vite, Supabase (postgres + RLS), Shadcn UI components (Sheet, Card, Badge), React Router, Framer Motion

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| Supabase SQL Editor | Run SQL | Create `user_activity_log` table + RLS policies |
| `src/integrations/supabase/types.ts` | Modify | Add `user_activity_log` table types |
| `src/lib/logActivity.ts` | Create | Utility to insert activity rows into Supabase |
| `src/pages/PracticePage.tsx` | Modify | Award XP per correct answer; log category selection |
| `src/components/AppLayout.tsx` | Modify | Log page visits on route change |
| `src/pages/AdminPage.tsx` | Create | Full admin dashboard UI |
| `src/App.tsx` | Modify | Add `/admin` route |

---

## Task 1: Create `user_activity_log` table in Supabase

**Files:**
- Run in: Supabase Dashboard → SQL Editor

- [ ] **Step 1: Open Supabase SQL Editor**

Go to your Supabase project dashboard → SQL Editor → New query

- [ ] **Step 2: Run this SQL**

```sql
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  activity_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own rows
CREATE POLICY "Users can insert own activity"
  ON public.user_activity_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin can read all activity
CREATE POLICY "Admin can read all activity"
  ON public.user_activity_log
  FOR SELECT
  USING (auth.email() = 'weareallforyou12345@gmail.com');

-- Admin can read all profiles
CREATE POLICY "Admin can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Admin can read all student_progress
CREATE POLICY "Admin can read all student progress"
  ON public.student_progress
  FOR SELECT
  USING (true);
```

- [ ] **Step 3: Verify table was created**

In Supabase → Table Editor — confirm `user_activity_log` appears with columns: `id`, `user_id`, `activity_type`, `activity_value`, `created_at`

---

## Task 2: Update TypeScript types for `user_activity_log`

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Add `user_activity_log` to the Tables section**

In `src/integrations/supabase/types.ts`, find the `Tables` section inside `public:` (after the `student_progress` block, around line 97). Add this block before the closing `}` of `Tables`:

```typescript
      user_activity_log: {
        Row: {
          id: string
          user_id: string
          activity_type: string
          activity_value: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          activity_type: string
          activity_value: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          activity_type?: string
          activity_value?: string
          created_at?: string
        }
        Relationships: []
      }
```

- [ ] **Step 2: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "feat: add user_activity_log types"
```

---

## Task 3: Create `logActivity` utility

**Files:**
- Create: `src/lib/logActivity.ts`

- [ ] **Step 1: Create the file**

Create `src/lib/logActivity.ts` with this content:

```typescript
import { supabase } from '@/integrations/supabase/client';

export type ActivityType = 'page_visit' | 'practice_category';

export async function logActivity(
  userId: string,
  activityType: ActivityType,
  activityValue: string
): Promise<void> {
  await supabase.from('user_activity_log').insert({
    user_id: userId,
    activity_type: activityType,
    activity_value: activityValue,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/logActivity.ts
git commit -m "feat: add logActivity utility"
```

---

## Task 4: Award XP per correct answer in PracticePage

**Files:**
- Modify: `src/pages/PracticePage.tsx`

- [ ] **Step 1: Remove game-end XP call**

In `src/pages/PracticePage.tsx`, find this useEffect (around line 318):

```typescript
  useEffect(() => {
    if (timeLeft <= 0 && isPlaying) {
      setIsPlaying(false);
      addXP(score);
    }
  }, [timeLeft, addXP, isPlaying, score]);
```

Replace with (remove `addXP(score)`):

```typescript
  useEffect(() => {
    if (timeLeft <= 0 && isPlaying) {
      setIsPlaying(false);
    }
  }, [timeLeft, isPlaying]);
```

- [ ] **Step 2: Add XP per correct answer**

In the `checkAnswer` callback, find the `if (isCorrect)` block (around line 353):

```typescript
    if (isCorrect) {
      const points = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 35;
      setScore(s => s + points + streak * 2);
      setStreak(s => s + 1);
      setCorrectCount(c => c + 1);
```

Replace with:

```typescript
    if (isCorrect) {
      const points = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 35;
      setScore(s => s + points + streak * 2);
      setStreak(s => s + 1);
      setCorrectCount(c => c + 1);
      const xpAward = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
      addXP(xpAward);
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/PracticePage.tsx
git commit -m "feat: award XP per correct answer (easy=1, medium=2, hard=3)"
```

---

## Task 5: Log practice category selection in PracticePage

**Files:**
- Modify: `src/pages/PracticePage.tsx`

- [ ] **Step 1: Import logActivity and get userId**

At the top of `src/pages/PracticePage.tsx`, add the import (after existing imports):

```typescript
import { logActivity } from '@/lib/logActivity';
import { supabase } from '@/integrations/supabase/client';
```

- [ ] **Step 2: Add userId state**

Inside the `PracticePage` component, after `const [searchParams] = useSearchParams();`, add:

```typescript
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);
```

- [ ] **Step 3: Log on category change**

Find `handleCategoryChange` (around line 325):

```typescript
  const handleCategoryChange = (cat: PracticeCategory) => {
    setCategory(cat);
    const firstOp = categoryOps[cat].ops[0];
    setOperation(firstOp);
    setProblem(generateProblem(difficulty, firstOp));
  };
```

Replace with:

```typescript
  const handleCategoryChange = (cat: PracticeCategory) => {
    setCategory(cat);
    const firstOp = categoryOps[cat].ops[0];
    setOperation(firstOp);
    setProblem(generateProblem(difficulty, firstOp));
    if (userId) logActivity(userId, 'practice_category', cat);
  };
```

- [ ] **Step 4: Also log initial category on mount**

After the `userId` useEffect, add:

```typescript
  useEffect(() => {
    if (userId) logActivity(userId, 'practice_category', category);
  }, [userId]);
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/PracticePage.tsx
git commit -m "feat: log practice category selection to activity log"
```

---

## Task 6: Log page visits in AppLayout

**Files:**
- Modify: `src/components/AppLayout.tsx`

- [ ] **Step 1: Rewrite AppLayout with page tracking**

Replace the entire content of `src/components/AppLayout.tsx` with:

```typescript
import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import Footer from './Footer';
import AuthGuard from './AuthGuard';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/logActivity';

const PAGE_NAMES: Record<string, string> = {
  '/': 'dashboard',
  '/learn': 'learn',
  '/practice': 'practice',
  '/abacus': 'abacus',
  '/solver': 'solver',
  '/profile': 'profile',
  '/videos': 'videos',
  '/sutras': 'sutras',
  '/about': 'about',
};

const AppLayout = () => {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const pageName = PAGE_NAMES[location.pathname];
    if (!pageName || lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        logActivity(session.user.id, 'page_visit', pageName);
      }
    });
  }, [location.pathname]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background flex flex-col">
        <TopBar />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </AuthGuard>
  );
};

export default AppLayout;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "feat: log page visits to activity log on route change"
```

---

## Task 7: Create AdminPage

**Files:**
- Create: `src/pages/AdminPage.tsx`

- [ ] **Step 1: Create the file**

Create `src/pages/AdminPage.tsx` with this content:

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Users, Activity, TrendingUp, User, ArrowLeft } from 'lucide-react';

const ADMIN_EMAIL = 'weareallforyou12345@gmail.com';

interface UserProfile {
  user_id: string;
  display_name: string | null;
  class_grade: number | null;
  created_at: string;
}

interface UserProgress {
  user_id: string;
  xp: number;
  level: number;
  streak: number;
  total_problems: number;
  accuracy: number;
  joined_at: string;
  last_active_at: string;
}

interface ActivityCount {
  value: string;
  count: number;
}

interface UserActivitySummary {
  page_visits: ActivityCount[];
  practice_categories: ActivityCount[];
}

interface AdminUser {
  user_id: string;
  name: string;
  class_grade: number | null;
  joined_at: string;
  last_active_at: string;
  xp: number;
  level: number;
  streak: number;
  total_problems: number;
  accuracy: number;
  activity: UserActivitySummary;
}

const formatDate = (iso: string) => {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const timeAgo = (iso: string) => {
  if (!iso) return 'N/A';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', learn: 'Learn', practice: 'Practice',
  abacus: 'Abacus', solver: 'Solver', profile: 'Profile',
  videos: 'Videos', sutras: 'Sutras', about: 'About',
};

const CAT_LABELS: Record<string, string> = {
  vedic: 'Vedic Math', finger: 'Finger Math', brain: 'Brain Dev',
};

const AdminPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== ADMIN_EMAIL) {
        navigate('/');
        return;
      }
      await fetchAllData();
    };
    init();
  }, []);

  const fetchAllData = async () => {
    const [profilesRes, progressRes, activityRes] = await Promise.all([
      supabase.from('profiles').select('user_id, display_name, class_grade, created_at'),
      supabase.from('student_progress').select('user_id, xp, level, streak, total_problems, accuracy, joined_at, last_active_at'),
      supabase.from('user_activity_log').select('user_id, activity_type, activity_value'),
    ]);

    const profiles: UserProfile[] = profilesRes.data || [];
    const progress: UserProgress[] = progressRes.data || [];
    const activityRows = activityRes.data || [];

    // Build activity summary per user
    const activityMap: Record<string, UserActivitySummary> = {};
    for (const row of activityRows) {
      if (!activityMap[row.user_id]) {
        activityMap[row.user_id] = { page_visits: [], practice_categories: [] };
      }
      const key = row.activity_type === 'page_visit' ? 'page_visits' : 'practice_categories';
      const existing = activityMap[row.user_id][key].find(x => x.value === row.activity_value);
      if (existing) existing.count++;
      else activityMap[row.user_id][key].push({ value: row.activity_value, count: 1 });
    }

    // Join profiles + progress
    const combined: AdminUser[] = profiles.map(p => {
      const prog = progress.find(x => x.user_id === p.user_id);
      return {
        user_id: p.user_id,
        name: p.display_name || 'Unknown',
        class_grade: p.class_grade,
        joined_at: prog?.joined_at || p.created_at,
        last_active_at: prog?.last_active_at || p.created_at,
        xp: prog?.xp || 0,
        level: prog?.level || 1,
        streak: prog?.streak || 0,
        total_problems: prog?.total_problems || 0,
        accuracy: prog?.accuracy || 0,
        activity: activityMap[p.user_id] || { page_visits: [], practice_categories: [] },
      };
    });

    combined.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime());
    setUsers(combined);
    setLoading(false);
  };

  const today = new Date().toDateString();
  const activeToday = users.filter(u => u.last_active_at && new Date(u.last_active_at).toDateString() === today).length;
  const activeWeek = users.filter(u => {
    if (!u.last_active_at) return false;
    return Date.now() - new Date(u.last_active_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="font-bold text-lg">Admin Dashboard</h1>
      </div>

      <div className="px-4 py-4 space-y-5 max-w-7xl mx-auto">
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: 'Total Users', value: users.length },
            { icon: Activity, label: 'Active Today', value: activeToday },
            { icon: TrendingUp, label: 'Active This Week', value: activeWeek },
          ].map(stat => (
            <div key={stat.label} className="bg-card rounded-xl p-3 border border-border text-center shadow-sm">
              <stat.icon className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="font-bold text-xl">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* User Cards */}
        <div>
          <h2 className="font-bold text-sm text-muted-foreground mb-3 uppercase tracking-wide">All Users</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {users.map((user, i) => (
              <motion.div
                key={user.user_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card rounded-xl p-4 border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => setSelectedUser(user)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground">Level {user.level} • {user.xp} XP</p>
                    {user.class_grade && <p className="text-xs text-muted-foreground">Class {user.class_grade}</p>}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs text-muted-foreground">
                  <span>Joined: {formatDate(user.joined_at)}</span>
                  <span>{timeAgo(user.last_active_at)}</span>
                </div>
                <button className="mt-2 w-full text-xs text-primary font-semibold py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
                  View Details →
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={open => !open && setSelectedUser(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedUser && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">{selectedUser.name}</p>
                    <p className="text-xs text-muted-foreground font-normal">Level {selectedUser.level} • {selectedUser.xp} XP • 🔥 {selectedUser.streak}</p>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-4">
                {/* Basic Stats */}
                <div className="bg-muted rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Stats</p>
                  {[
                    ['Joined', formatDate(selectedUser.joined_at)],
                    ['Last Active', timeAgo(selectedUser.last_active_at)],
                    ['Problems Solved', selectedUser.total_problems.toString()],
                    ['Accuracy', `${selectedUser.accuracy}%`],
                    ['Class Grade', selectedUser.class_grade ? `Class ${selectedUser.class_grade}` : 'N/A'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Pages Visited */}
                <div className="bg-muted rounded-xl p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Pages Visited</p>
                  {selectedUser.activity.page_visits.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No page visits recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedUser.activity.page_visits
                        .sort((a, b) => b.count - a.count)
                        .map(({ value, count }) => {
                          const maxCount = Math.max(...selectedUser.activity.page_visits.map(x => x.count));
                          return (
                            <div key={value}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium">{PAGE_LABELS[value] || value}</span>
                                <span className="text-muted-foreground">{count}x</span>
                              </div>
                              <div className="h-1.5 bg-background rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${(count / maxCount) * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Practice Categories */}
                <div className="bg-muted rounded-xl p-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Practice Categories</p>
                  {selectedUser.activity.practice_categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No practice recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedUser.activity.practice_categories
                        .sort((a, b) => b.count - a.count)
                        .map(({ value, count }) => {
                          const maxCount = Math.max(...selectedUser.activity.practice_categories.map(x => x.count));
                          return (
                            <div key={value}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium">{CAT_LABELS[value] || value}</span>
                                <span className="text-muted-foreground">{count}x</span>
                              </div>
                              <div className="h-1.5 bg-background rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-secondary rounded-full"
                                  style={{ width: `${(count / maxCount) * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminPage;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/AdminPage.tsx
git commit -m "feat: add admin dashboard with user cards and detail sheet"
```

---

## Task 8: Add `/admin` route in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add AdminPage import and route**

In `src/App.tsx`, add the import after the existing imports:

```typescript
import AdminPage from "./pages/AdminPage";
```

Inside `<Routes>`, after the `<Route path="/auth" .../>` line, add:

```tsx
<Route path="/admin" element={<AdminPage />} />
```

The final Routes block should look like:

```tsx
<Routes>
  <Route element={<AppLayout />}>
    <Route path="/" element={<Dashboard />} />
    <Route path="/learn" element={<LearnPage />} />
    <Route path="/practice" element={<PracticePage />} />
    <Route path="/abacus" element={<AbacusPage />} />
    <Route path="/solver" element={<SolverPage />} />
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/videos" element={<VideosPage />} />
    <Route path="/sutras" element={<SutrasPage />} />
    <Route path="/about" element={<AboutPage />} />
  </Route>
  <Route path="/auth" element={<AuthPage />} />
  <Route path="/admin" element={<AdminPage />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /admin route"
```

---

## Task 9: Verify everything works

- [ ] **Step 1: Run dev server**

```bash
cd vedic-maths-web
npm run dev
```

- [ ] **Step 2: Test XP awarding**

1. Login to the app
2. Go to Practice → start a game
3. Answer a question correctly
4. Go to Profile — XP should have increased by 1/2/3 depending on difficulty

- [ ] **Step 3: Test activity logging**

1. While logged in, navigate between pages (Learn, Videos, etc.)
2. In Supabase → Table Editor → `user_activity_log` — rows should appear

- [ ] **Step 4: Test admin dashboard**

1. Login with `weareallforyou12345@gmail.com`
2. Navigate to `/admin`
3. All users should appear as cards
4. Click a card — detail sheet opens with stats + activity bars

- [ ] **Step 5: Test non-admin redirect**

1. Login with a different account
2. Navigate to `/admin`
3. Should immediately redirect to `/`
