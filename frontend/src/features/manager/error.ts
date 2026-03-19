import { ManagerApiError } from '../../lib/manager-api';
import { errorMessage } from '../common/ui';

export const managerErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ManagerApiError) {
    if (error.status === 401) {
      return 'Требуется авторизация. Войдите под администратором.';
    }
    if (error.status === 403) {
      return 'Доступ запрещён. У вашей учётной записи нет прав администратора.';
    }
    if (error.message.trim()) {
      return error.message;
    }
  }
  return errorMessage(error, fallback);
};
