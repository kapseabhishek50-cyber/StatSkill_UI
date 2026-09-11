import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Route as RouteIcon,
  UserRound,
  Users,
  TrendingUp,
  Flame,
  Trophy,
  Sparkles,
  FileText,
  Zap,
  Search,
  Bell
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { initials } from '../lib/format.js';
import { ThemeToggle } from './ui.jsx';
import FloatingChatbot from './FloatingChatbot.jsx';
import ScrollProgress from './fx/ScrollProgress.jsx';

const LEARNER_NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/path', label: 'Learning Path', icon: RouteIcon },
  { to: '/my-learning', label: 'Courses', icon: BookOpen },
  { to: '/quiz', label: 'Quizzes', icon: GraduationCap },
  { to: '/discussions', label: 'Communities', icon: Users },
];

const SIDEBAR_SECONDARY_NAV = [
  { to: '/assessment', label: 'Assessments', icon: ClipboardCheck },
  { to: '/streak', label: 'Achievements', icon: Trophy },
  { to: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
];

const TRAINER_NAV = [
  { to: '/trainer', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/trainer/generator', label: 'AI Quiz Generator', icon: Sparkles },
  { to: '/trainer/materials', label: 'Curriculum Materials', icon: FileText },
  { to: '/admin/questions', label: 'Question Bank', icon: HelpCircle },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Workforce Hub', icon: BarChart3, end: true },
  { to: '/admin/officers', label: 'Officers', icon: Users },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/questions', label: 'Question Bank', icon: HelpCircle },
];

function SidebarNavLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
    >
      <Icon size={17} strokeWidth={1.8} />
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const { user, isAdmin, isTrainer, signOut } = useAuth();
  const navigate = useNavigate();
  const primaryNav = isAdmin ? ADMIN_NAV : isTrainer ? TRAINER_NAV : LEARNER_NAV;

  return (
    <div className="min-h-screen bg-plane flex flex-col lg:flex-row">
      {/* ── Navy Sidebar (Desktop) ── */}
      <aside
        className="flex-shrink-0 z-20 hidden lg:flex flex-col sticky top-0 h-screen w-[248px]"
        style={{ background: 'var(--gradient-sidebar)' }}
      >
        {/* Brand */}
        <div
          className="flex h-16 items-center gap-2.5 px-5"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <span className="grid h-9 w-9 place-items-center rounded-button bg-white font-bold text-[13px] leading-none" style={{ color: 'var(--navy)' }}>
            SS
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-white">StatSkill AI</p>
            <p className="text-[10px] font-medium" style={{ color: 'var(--sidebar-text-muted)' }}>
              MoSPI · NSSTA
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-7" aria-label="Sidebar">
          <div>
            <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sidebar-text-muted)' }}>
              Menu
            </div>
            <div className="space-y-0.5">
              {primaryNav.map((item) => (
                <SidebarNavLink key={item.to} {...item} />
              ))}
            </div>
          </div>

          {!isAdmin && !isTrainer && (
            <div>
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sidebar-text-muted)' }}>
                Your Progress
              </div>
              <div className="space-y-0.5">
                {SIDEBAR_SECONDARY_NAV.map((item) => (
                  <SidebarNavLink key={item.to} {...item} />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <div
            className="flex items-center gap-2.5 rounded-button p-2 transition-colors cursor-pointer"
            style={{ ['--tw-bg-opacity']: 1 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sidebar-hover-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => navigate('/profile')}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
              {initials(user?.name)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[11px] truncate" style={{ color: 'var(--sidebar-text-muted)' }}>
                {isAdmin ? 'Administrator' : isTrainer ? 'Trainer' : (user?.jobRole?.title || 'Officer')}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); signOut(); navigate('/login', { replace: true }); }}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--sidebar-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sidebar-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* ── Clean white navbar ── */}
        <header className="sticky top-0 z-10 bg-surface border-b border-hairline h-16 px-5 sm:px-8 flex items-center justify-between gap-4">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-button text-white font-bold text-xs leading-none" style={{ background: 'var(--navy)' }}>
              SS
            </span>
            <span className="text-[15px] font-bold tracking-tight text-ink">StatSkill AI</span>
          </div>

          {/* Search */}
          <div className="flex-1 hidden md:flex items-center max-w-xl">
            <div className="relative w-full group">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search courses, skills, and communities..."
                className="w-full bg-plane border border-hairline rounded-button py-2 pl-10 pr-4 text-[13px] text-ink placeholder:text-ink-muted focus:bg-surface focus:border-primary transition-all outline-none"
              />
            </div>
          </div>
          <div className="flex-1 md:hidden" />

          <div className="flex items-center gap-2 shrink-0">
            {!isAdmin && !isTrainer && (
              <div className="hidden sm:flex items-center gap-3 px-3.5 py-1.5 rounded-button bg-plane border border-hairline">
                <div className="flex items-center gap-1.5" title="Learning Streak">
                  <Flame size={15} className="text-streak" />
                  <span className="tnum text-[13px] font-bold text-ink">{user?.currentStreak ?? 0}</span>
                </div>
                <div className="w-px h-4 bg-baseline" />
                <div className="flex items-center gap-1.5" title="XP Earned">
                  <Zap size={15} className="text-primary" />
                  <span className="tnum text-[13px] font-bold text-ink">{user?.xp ?? 0}</span>
                </div>
              </div>
            )}

            <button className="btn btn-ghost p-2 relative rounded-button" aria-label="Notifications">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-critical rounded-full border border-surface" />
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-5 sm:px-8 py-6 mx-auto w-full max-w-screen-2xl mb-16 lg:mb-0 animate-enter">
          <Outlet />
        </main>

        {/* Footer strip — enterprise trust marker */}
        <footer className="hidden lg:block border-t border-hairline bg-surface px-8 py-3">
          <p className="text-[11px] text-ink-muted">
            StatSkill AI · Competency intelligence for the Indian official statistical system · MoSPI / NSSTA
          </p>
        </footer>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-hairline">
        <div className="flex justify-between px-2 py-1">
          {primaryNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-16 py-2 px-1 rounded-button transition-colors duration-200 ${
                  isActive
                    ? 'text-primary'
                    : 'text-ink-muted'
                }`
              }
            >
              <Icon size={19} strokeWidth={1.8} />
              <span className="text-[10px] mt-0.5 font-medium select-none truncate w-full text-center">{label}</span>
            </NavLink>
          ))}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-16 py-2 px-1 rounded-button transition-colors duration-200 ${
                isActive ? 'text-primary' : 'text-ink-muted'
              }`
            }
          >
            <UserRound size={19} strokeWidth={1.8} />
            <span className="text-[10px] mt-0.5 font-medium select-none">Profile</span>
          </NavLink>
        </div>
      </nav>

      {/* Floating contextual AI Assistant */}
      <FloatingChatbot />
    </div>
  );
}
