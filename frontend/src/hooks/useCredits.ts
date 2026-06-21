import { useState, useEffect, useCallback } from 'react';
import { CarbonCredit, CreditEvent } from '../types';
import * as svc from '../services/blockchainService';

export function useCredits() {
  const [credits, setCredits] = useState<CarbonCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await svc.getAllCredits();
      setCredits(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido ao carregar créditos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { credits, loading, error, reload };
}

export function useCreditEvents(creditId: string) {
  const [events, setEvents] = useState<CreditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    svc.getEventsByCredit(creditId)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [creditId]);

  return { events, loading };
}

export function useAuditLog() {
  const [events, setEvents] = useState<CreditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await svc.getAuditLog();
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { events, loading, reload };
}
