import { useCallback, useEffect, useState } from 'react';

import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push';

/** Estado e ações dos lembretes por notificação neste aparelho. */
export function usePush() {
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getPushState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback(async () => {
    setBusy(true);
    try {
      setState(state === 'enabled' ? await disablePush() : await enablePush());
    } finally {
      setBusy(false);
    }
  }, [state]);

  return { state, busy, toggle };
}
