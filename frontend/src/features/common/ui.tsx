export const LoadingState = () => <p className="state state-loading">Загрузка...</p>;

export const ErrorState = ({ message }: { message: string }) => (
  <p className="state state-error">{message}</p>
);

export const EmptyState = ({ message }: { message: string }) => (
  <p className="state state-empty">{message}</p>
);

export const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};
