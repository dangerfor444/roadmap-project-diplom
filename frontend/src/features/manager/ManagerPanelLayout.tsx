import { NavLink, Outlet } from 'react-router-dom';

const MANAGER_PANEL_ENABLED = (import.meta.env.VITE_MANAGER_PANEL_ENABLED ?? 'true') === 'true';

export const ManagerPanelLayout = () => {
  if (!MANAGER_PANEL_ENABLED) {
    return (
      <section className="tab-content">
        <h2>Панель управления отключена</h2>
        <p className="meta">
          Включите `VITE_MANAGER_PANEL_ENABLED=true` и перезапустите клиент, чтобы использовать
          этот раздел.
        </p>
      </section>
    );
  }

  return (
    <section className="manager-panel">
      <header className="manager-header">
        <h2>Панель управления продуктом</h2>
        <p className="meta">
          Доступ разрешен только администратору. Все действия выполняются через защищенные
          методы панели управления.
        </p>
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
          Идеи
        </NavLink>
        <NavLink
          to="/manager/moderation"
          className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}
        >
          Модерация
        </NavLink>
      </nav>

      <Outlet />
    </section>
  );
};
