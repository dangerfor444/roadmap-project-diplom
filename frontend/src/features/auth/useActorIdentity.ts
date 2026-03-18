import { useEffect, useState } from 'react';
import {
  getStoredActorId,
  getStoredActorToken,
  PUBLIC_WRITE_AUTH_UPDATED_EVENT,
  setStoredActorId,
  setStoredActorToken,
} from '../../lib/write-auth';

export const useActorIdentity = () => {
  const [actorId, setActorId] = useState<string>(() => getStoredActorId());
  const [actorToken, setActorToken] = useState<string>(() => getStoredActorToken());

  useEffect(() => {
    const syncAuthState = () => {
      setActorId(getStoredActorId());
      setActorToken(getStoredActorToken());
    };

    window.addEventListener(PUBLIC_WRITE_AUTH_UPDATED_EVENT, syncAuthState as EventListener);
    return () => {
      window.removeEventListener(PUBLIC_WRITE_AUTH_UPDATED_EVENT, syncAuthState as EventListener);
    };
  }, []);

  const onActorIdChange = (nextValue: string) => {
    setActorId(nextValue);
    setStoredActorId(nextValue);
  };

  const onActorTokenChange = (nextValue: string) => {
    setActorToken(nextValue);
    setStoredActorToken(nextValue);
  };

  return {
    actorId,
    actorToken,
    hasActorIdentity: Boolean(actorId.trim() || actorToken.trim()),
    onActorIdChange,
    onActorTokenChange,
    clearActorId: () => onActorIdChange(''),
    clearActorToken: () => onActorTokenChange(''),
  };
};
