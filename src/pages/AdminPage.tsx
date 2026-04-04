import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Users, Activity, TrendingUp, ArrowLeft, Search, X, Zap, Flame, Star, BookOpen, Trophy, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ADMIN_EMAIL = 'weareallforyou12345@gmail.com';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  created_at: string;
}

interface UserProgress {
  user_id: string;
  total_xp: number;
  current_level: number;
  daily_streak: number;
  last_activity_date: string;
  grade_level: number | null;
  achievements: string[] | null;
  created_at: string;
}

interface ActivityCount { value: string; count: number; }
interface UserActivitySummary {
  page_visits: ActivityCount[];
  practice_categories: ActivityCount[];
}
interface WeeklyDay { day: string; date: string; active: number; }

interface AdminUser {
  user_id: string;
  name: string;
  email: string | null;
  grade_level: number | null;
  joined_at: string;
  last_active_at: string;
  xp: number;
  level: number;
  streak: number;
  activity: UserActivitySummary;
}

const formatDate = (iso: string) => {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const timeAgo = (iso: string) => {
  if (!iso) return 'N/A';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
};

const isActiveToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const isActiveThisWeek = (iso: string) => Date.now() - new Date(iso).getTime() < 7 * 86400000;
const getInitials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', learn: 'Learn', practice: 'Practice',
  abacus: 'Abacus', solver: 'Solver', profile: 'Profile',
  videos: 'Videos', sutras: 'Sutras', about: 'About',
};
const CAT_LABELS: Record<string, string> = {
  vedic: 'Vedic Math', finger: 'Finger Math', brain: 'Brain Dev',
};
const CAT_BAR_COLORS: Record<string, string> = {
  vedic: 'bg-primary', finger: 'bg-secondary', brain: 'bg-accent',
};

const AdminPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyDay[]>([]);
  const [dailyUserSet, setDailyUserSet] = useState<Record<string, Set<string>>>({});
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== ADMIN_EMAIL) { navigate('/'); return; }
      await fetchAllData();
    };
    init();
  }, []);

  const fetchAllData = async () => {
    setError(null);
    const [profilesRes, progressRes, activityRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, created_at'),
      supabase.from('student_profiles').select('user_id, total_xp, current_level, daily_streak, last_activity_date, grade_level, achievements, created_at'),
      supabase.from('user_activity_log').select('user_id, activity_type, activity_value, created_at'),
    ]);

    if (profilesRes.error) { setError(`Error: ${profilesRes.error.message}`); setLoading(false); return; }

    const profiles: UserProfile[] = profilesRes.data || [];
    const progress: UserProgress[] = progressRes.data || [];
    const activityRows = activityRes.data || [];

    // ── Weekly chart data ───────────────────────────────────────────────
    const past7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
    const dailyUserSet: Record<string, Set<string>> = {};
    for (const row of activityRows) {
      const date = (row.created_at as string).split('T')[0];
      if (!dailyUserSet[date]) dailyUserSet[date] = new Set();
      dailyUserSet[date].add(row.user_id);
    }
    setDailyUserSet(dailyUserSet);
    setWeeklyData(past7.map(date => ({
      day: new Date(date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' }),
      date,
      active: dailyUserSet[date]?.size || 0,
    })));

    // ── Activity map per user ───────────────────────────────────────────
    const activityMap: Record<string, UserActivitySummary> = {};
    for (const row of activityRows) {
      if (!activityMap[row.user_id]) activityMap[row.user_id] = { page_visits: [], practice_categories: [] };
      const key = row.activity_type === 'page_visit' ? 'page_visits' : 'practice_categories';
      const existing = activityMap[row.user_id][key].find(x => x.value === row.activity_value);
      if (existing) existing.count++;
      else activityMap[row.user_id][key].push({ value: row.activity_value, count: 1 });
    }

    const combined: AdminUser[] = profiles.map(p => {
      const prog = progress.find(x => x.user_id === p.id);
      return {
        user_id: p.id,
        name: p.full_name || 'Unknown',
        email: p.email,
        grade_level: prog?.grade_level || null,
        joined_at: prog?.created_at || p.created_at,
        last_active_at: prog?.last_activity_date || p.created_at,
        xp: prog?.total_xp || 0,
        level: prog?.current_level || 1,
        streak: prog?.daily_streak || 0,
        activity: activityMap[p.id] || { page_visits: [], practice_categories: [] },
      };
    });

    combined.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime());
    setUsers(combined);
    setLoading(false);
  };

  const filtered = useMemo(() =>
    users.filter(u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase())
    ), [users, search]);

  const activeToday = users.filter(u => isActiveToday(u.last_active_at)).length;
  const activeWeek = users.filter(u => isActiveThisWeek(u.last_active_at)).length;

  const past7Dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const consistentLearners = users.filter(u =>
    past7Dates.every(date => dailyUserSet[date]?.has(u.user_id))
  );
  const inactiveUsers = users.filter(u => {
    if (!u.last_active_at) return true;
    return (Date.now() - new Date(u.last_active_at).getTime()) >= 7 * 86400000;
  });
  const maxWeekly = Math.max(...weeklyData.map(d => d.active), 1);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground font-body">Loading dashboard…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-hero px-4 py-4 md:py-5">
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-lg md:text-xl text-white leading-tight">Admin Dashboard</h1>
            <p className="text-[11px] md:text-xs text-white/70">Vedic Math — User Overview</p>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 py-4 md:py-5 space-y-4 md:space-y-5 max-w-5xl mx-auto">
        {/* Error */}
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm text-destructive bg-destructive/10 border border-destructive/20">
            ⚠️ {error}
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { icon: Users, label: 'Total Users', shortLabel: 'Users', value: users.length, color: 'text-primary', bg: 'bg-primary/10' },
            { icon: Activity, label: 'Active Today', shortLabel: 'Today', value: activeToday, color: 'text-level', bg: 'bg-level/10' },
            { icon: TrendingUp, label: 'This Week', shortLabel: 'Week', value: activeWeek, color: 'text-secondary', bg: 'bg-secondary/10' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-card border border-border text-center"
            >
              <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl ${stat.bg} flex items-center justify-center mx-auto mb-1.5 sm:mb-2`}>
                <stat.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stat.color}`} />
              </div>
              <p className="font-display font-bold text-xl sm:text-2xl">{stat.value}</p>
              <p className="hidden sm:block text-[10px] text-muted-foreground font-medium mt-0.5">{stat.label}</p>
              <p className="sm:hidden text-[10px] text-muted-foreground font-medium mt-0.5">{stat.shortLabel}</p>
            </motion.div>
          ))}
        </div>

        {/* Weekly Activity Graph */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl p-4 border border-border shadow-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-display font-bold text-sm">Weekly Activity</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Active students per day (last 7 days)</p>
            </div>
            <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full">
              <Activity className="w-3 h-3 text-primary" />
              <span className="text-xs font-bold text-primary">{activeWeek} this week</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={weeklyData} barSize={28} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))', radius: 6 }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-card text-xs">
                      <p className="font-bold text-foreground">{label}</p>
                      <p className="text-primary font-semibold">{payload[0].value} active</p>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="active" radius={[6, 6, 0, 0]}>
                {weeklyData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={isActiveToday(entry.date + 'T00:00:00') || entry.date === new Date().toISOString().split('T')[0]
                      ? 'hsl(var(--primary))'
                      : entry.active > 0 ? 'hsl(var(--secondary))' : 'hsl(var(--muted))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-end">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /><span className="text-[10px] text-muted-foreground">Today</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-secondary inline-block" /><span className="text-[10px] text-muted-foreground">Active day</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-muted inline-block border border-border" /><span className="text-[10px] text-muted-foreground">No activity</span></div>
          </div>
        </motion.div>

        {/* Consistent Learners + Inactive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Consistent Learners */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-2xl p-4 border border-border shadow-card"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-level/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-level" />
              </div>
              <div>
                <p className="font-display font-bold text-sm">Consistent Learners</p>
                <p className="text-[10px] text-muted-foreground">Active every day this week</p>
              </div>
            </div>
            {consistentLearners.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No one active all 7 days yet</p>
            ) : (
              <div className="space-y-2">
                {consistentLearners.slice(0, 5).map(u => (
                  <div key={u.user_id}
                    onClick={() => setSelectedUser(u)}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted cursor-pointer transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-xs font-display font-bold text-white flex-shrink-0">
                      {getInitials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground">{u.xp} XP • 🔥 {u.streak}</p>
                    </div>
                    <span className="text-[10px] font-bold text-level bg-level/10 px-1.5 py-0.5 rounded-full">7/7</span>
                  </div>
                ))}
                {consistentLearners.length > 5 && (
                  <p className="text-[10px] text-muted-foreground text-center">+{consistentLearners.length - 5} more</p>
                )}
              </div>
            )}
          </motion.div>

          {/* Inactive This Week */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-card rounded-2xl p-4 border border-border shadow-card"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="font-display font-bold text-sm">Inactive This Week</p>
                <p className="text-[10px] text-muted-foreground">Not seen in 7+ days</p>
              </div>
            </div>
            {inactiveUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Everyone is active 🎉</p>
            ) : (
              <div className="space-y-2">
                {inactiveUsers.slice(0, 5).map(u => (
                  <div key={u.user_id}
                    onClick={() => setSelectedUser(u)}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-muted cursor-pointer transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-display font-bold text-muted-foreground flex-shrink-0">
                      {getInitials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground">Last: {timeAgo(u.last_active_at)}</p>
                    </div>
                    <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">Away</span>
                  </div>
                ))}
                {inactiveUsers.length > 5 && (
                  <p className="text-[10px] text-muted-foreground text-center">+{inactiveUsers.length - 5} more</p>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-card border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:border-primary/40 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Users heading */}
        <div className="flex items-center justify-between">
          <p className="font-display font-bold text-sm">All Users</p>
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
            {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
          </span>
        </div>

        {/* User grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? 'No users match your search' : 'No users found'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((user, i) => (
              <motion.div
                key={user.user_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedUser(user)}
                className="bg-card rounded-2xl p-4 border border-border shadow-card hover:shadow-elevated hover:border-primary/30 hover:scale-[1.02] transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar with gradient */}
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-sm font-display font-bold text-white shadow-warm">
                      {getInitials(user.name)}
                    </div>
                    {isActiveToday(user.last_active_at) && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-level border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-sm truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email || '—'}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                    Lv.{user.level}
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-xp" />
                    <span className="text-xs font-semibold text-muted-foreground">{user.xp} XP</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Flame className="w-3 h-3 text-streak" />
                    <span className="text-xs font-semibold text-muted-foreground">{user.streak}</span>
                  </div>
                  <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(user.last_active_at)}</span>
                </div>

                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <BookOpen className="w-3 h-3" />
                  <span>Joined {formatDate(user.joined_at)}</span>
                </div>

                <button className="mt-2.5 w-full text-xs text-primary font-semibold py-1.5 rounded-lg bg-primary/8 hover:bg-primary/15 transition-colors">
                  View Details →
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={open => !open && setSelectedUser(null)}>
        <SheetContent className="overflow-y-auto border-border w-full sm:max-w-md p-4 sm:p-6">
          {selectedUser && (
            <>
              {/* Sheet header with gradient */}
              <div className="gradient-hero -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-5 mb-4 sm:mb-5">
                <SheetHeader>
                  <SheetTitle className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-display font-bold text-white flex-shrink-0">
                      {getInitials(selectedUser.name)}
                    </div>
                    <div className="text-left">
                      <p className="font-display font-bold text-lg text-white">{selectedUser.name}</p>
                      <p className="text-xs text-white/70 font-normal mt-0.5">{selectedUser.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                          Level {selectedUser.level}
                        </span>
                        {isActiveToday(selectedUser.last_active_at) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                            ● Active today
                          </span>
                        )}
                      </div>
                    </div>
                  </SheetTitle>
                </SheetHeader>
              </div>

              <div className="space-y-4">
                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Zap, label: 'XP', value: selectedUser.xp, cls: 'text-xp', bg: 'bg-xp/10' },
                    { icon: Flame, label: 'Streak', value: selectedUser.streak, cls: 'text-streak', bg: 'bg-streak/10' },
                    { icon: Star, label: 'Grade', value: selectedUser.grade_level ?? '—', cls: 'text-badge', bg: 'bg-badge/10' },
                  ].map(s => (
                    <div key={s.label} className="bg-card rounded-xl p-3 text-center border border-border shadow-card">
                      <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center mx-auto mb-1.5`}>
                        <s.icon className={`w-3.5 h-3.5 ${s.cls}`} />
                      </div>
                      <p className="font-display font-bold text-base">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                <div className="bg-card rounded-xl p-4 border border-border shadow-card">
                  <p className="font-display font-bold text-xs text-muted-foreground uppercase tracking-wide mb-3">Timeline</p>
                  {[
                    ['Joined', formatDate(selectedUser.joined_at)],
                    ['Last Active', timeAgo(selectedUser.last_active_at)],
                    ['Last Date', formatDate(selectedUser.last_active_at)],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between items-center text-sm py-1.5 border-b border-border last:border-0">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="font-semibold">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Pages Visited */}
                <div className="bg-card rounded-xl p-4 border border-border shadow-card">
                  <p className="font-display font-bold text-xs text-muted-foreground uppercase tracking-wide mb-3">Pages Visited</p>
                  {selectedUser.activity.page_visits.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No visits recorded yet</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedUser.activity.page_visits
                        .sort((a, b) => b.count - a.count)
                        .map(({ value, count }) => {
                          const max = Math.max(...selectedUser.activity.page_visits.map(x => x.count));
                          return (
                            <div key={value}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium">{PAGE_LABELS[value] || value}</span>
                                <span className="text-muted-foreground">{count}×</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(count / max) * 100}%` }}
                                  transition={{ duration: 0.5, ease: 'easeOut' }}
                                  className="h-full gradient-primary rounded-full"
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Practice Categories */}
                <div className="bg-card rounded-xl p-4 border border-border shadow-card">
                  <p className="font-display font-bold text-xs text-muted-foreground uppercase tracking-wide mb-3">Practice Categories</p>
                  {selectedUser.activity.practice_categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No practice recorded yet</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedUser.activity.practice_categories
                        .sort((a, b) => b.count - a.count)
                        .map(({ value, count }) => {
                          const max = Math.max(...selectedUser.activity.practice_categories.map(x => x.count));
                          return (
                            <div key={value}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium">{CAT_LABELS[value] || value}</span>
                                <span className="text-muted-foreground">{count}×</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(count / max) * 100}%` }}
                                  transition={{ duration: 0.5, ease: 'easeOut' }}
                                  className={`h-full rounded-full ${CAT_BAR_COLORS[value] || 'bg-primary'}`}
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
