import { NavLink } from 'react-router-dom';
import { FiHome, FiBook, FiCalendar, FiClock, FiSettings, FiEdit3, FiMessageSquare } from 'react-icons/fi';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-[var(--surface)] border-r border-[var(--border)] hidden md:flex flex-col h-full shrink-0">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--primary)] to-blue-400 bg-clip-text text-transparent">
          MVPrep
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">CA Revision Architect</p>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end>
          <FiHome /> Dashboard
        </NavLink>
        <NavLink to="/subjects" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <FiBook /> Subjects
        </NavLink>
        <NavLink to="/notes" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <FiEdit3 /> Quick Notes
        </NavLink>
        <NavLink to="/planner" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <FiCalendar /> 1.5-Day Planner
        </NavLink>
        <NavLink to="/timer" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <FiClock /> Focus Timer
        </NavLink>
        <NavLink to="/ai-assistant" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <FiMessageSquare /> AI Assistant
        </NavLink>
      </nav>

      <div className="p-4 border-t border-[var(--border)]">
        <NavLink to="/settings" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <FiSettings /> Settings
        </NavLink>
      </div>
    </aside>
  );
}
