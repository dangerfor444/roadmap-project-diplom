import { NavLink, Outlet } from 'react-router-dom';

const MANAGER_PANEL_ENABLED = (import.meta.env.VITE_MANAGER_PANEL_ENABLED ?? 'true') === 'true';

const UI_TEXT = {
  disabledTitle: 'Панель управления отключена',
  disabledDescription:
    'Включите `VITE_MANAGER_PANEL_ENABLED=true` и перезапустите клиент, чтобы использовать этот раздел.',
  title: 'Панель управления продуктом',
  description:
    'Внутренний интерфейс для управления roadmap и идеями.',
  ideas: 'Идеи',
} as const;

export const ManagerPanelLayout = () => {
  if (!MANAGER_PANEL_ENABLED) {
    return (
      <section className="tab-content">
        <h2>{UI_TEXT.disabledTitle}</h2>
        <p className="meta">{UI_TEXT.disabledDescription}</p>
      </section>
    );
  }

  return (
    <section className="manager-panel">
      <header className="manager-header">
        <h2>{UI_TEXT.title}</h2>
        <p className="meta">{UI_TEXT.description}</p>
      </header>

      <nav className="manager-nav">
        <NavLink
          to="/manager/roadmap"
          className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}
        >
          roadmap
        </NavLink>
        <NavLink
          to="/manager/ideas"
          className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}
        >
          {UI_TEXT.ideas}
        </NavLink>
      </nav>

      <Outlet />
    </section>
  );
};
