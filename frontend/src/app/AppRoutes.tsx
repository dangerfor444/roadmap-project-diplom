import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '../features/common/ui';
import { ManagerIdeasPage } from '../features/manager/ManagerIdeasPage';
import { ManagerModerationPage } from '../features/manager/ManagerModerationPage';
import { ManagerPanelLayout } from '../features/manager/ManagerPanelLayout';
import { ManagerRoadmapPage } from '../features/manager/ManagerRoadmapPage';
import { IdeaDetailsTab } from '../features/public/ideas/IdeaDetailsTab';
import { IdeasTab } from '../features/public/ideas/IdeasTab';
import { RoadmapDetailsTab } from '../features/public/roadmap/RoadmapDetailsTab';
import { RoadmapTab } from '../features/public/roadmap/RoadmapTab';

const RoadmapDetailsRoute = ({ userFingerprint }: { userFingerprint: string }) => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const roadmapItemId = Number.parseInt(params.id ?? '', 10);

  if (!Number.isInteger(roadmapItemId) || roadmapItemId <= 0) {
    return <ErrorState message="Некорректный идентификатор элемента roadmap." />;
  }

  return (
    <RoadmapDetailsTab
      roadmapItemId={roadmapItemId}
      onBack={() => navigate('/roadmap')}
      userFingerprint={userFingerprint}
    />
  );
};

const IdeaDetailsRoute = ({ userFingerprint }: { userFingerprint: string }) => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const ideaId = Number.parseInt(params.id ?? '', 10);

  if (!Number.isInteger(ideaId) || ideaId <= 0) {
    return <ErrorState message="Некорректный идентификатор идеи." />;
  }

  return (
    <IdeaDetailsTab ideaId={ideaId} onBack={() => navigate('/ideas')} userFingerprint={userFingerprint} />
  );
};

const ManagerAccessDeniedPage = () => (
  <section className="tab-content">
    <h2>Доступ запрещен</h2>
    <p className="meta">
      Панель управления доступна только администратору с разрешенной почтой.
    </p>
  </section>
);

const RedirectToRoadmap = () => {
  const location = useLocation();
  return <Navigate to={{ pathname: '/roadmap', search: location.search }} replace />;
};

export const AppRoutes = ({
  userFingerprint,
  isManagerAllowed,
}: {
  userFingerprint: string;
  isManagerAllowed: boolean;
}) => {
  return (
    <Routes>
      <Route path="/" element={<RedirectToRoadmap />} />
      <Route path="/roadmap" element={<RoadmapTab userFingerprint={userFingerprint} />} />
      <Route path="/roadmap/:id" element={<RoadmapDetailsRoute userFingerprint={userFingerprint} />} />
      <Route path="/ideas" element={<IdeasTab userFingerprint={userFingerprint} />} />
      <Route path="/ideas/:id" element={<IdeaDetailsRoute userFingerprint={userFingerprint} />} />

      {isManagerAllowed ? (
        <Route path="/manager" element={<ManagerPanelLayout />}>
          <Route index element={<Navigate to="/manager/roadmap" replace />} />
          <Route path="roadmap" element={<ManagerRoadmapPage />} />
          <Route path="ideas" element={<ManagerIdeasPage />} />
          <Route path="moderation" element={<ManagerModerationPage />} />
        </Route>
      ) : (
        <Route path="/manager/*" element={<ManagerAccessDeniedPage />} />
      )}

      <Route path="*" element={<RedirectToRoadmap />} />
    </Routes>
  );
};
