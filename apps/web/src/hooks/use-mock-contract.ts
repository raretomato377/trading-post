import { useState, useCallback } from "react";
import {
  getRandomCardNumbers,
  selectCards,
  getCurrentRound,
  canGenerateCards,
  getUserScore,
  getLeaderboard,
} from "@/lib/mock-contract";
import { Card } from "@/types/card";

export function useMockContract() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCardNumbers = useCallback(async (count: number = 5): Promise<number[]> => {
    setLoading(true);
    setError(null);
    try {
      const numbers = await getRandomCardNumbers(count);
      return numbers;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch card numbers");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitCardSelection = useCallback(async (
    roundId: number,
    selectedCards: Card[]
  ): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const cardNumbers = selectedCards.map((card) => card.cardNumber);
      const txHash = await selectCards(roundId, cardNumbers);
      return txHash;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to submit card selection");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCurrentRound = useCallback(async (): Promise<number> => {
    setLoading(true);
    setError(null);
    try {
      return await getCurrentRound();
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch current round");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkCanGenerate = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      return await canGenerateCards();
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to check if can generate");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserScore = useCallback(async (address: string): Promise<number> => {
    setLoading(true);
    setError(null);
    try {
      return await getUserScore(address);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user score");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(async (limit: number = 10) => {
    setLoading(true);
    setError(null);
    try {
      return await getLeaderboard(limit);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch leaderboard");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchCardNumbers,
    submitCardSelection,
    fetchCurrentRound,
    checkCanGenerate,
    fetchUserScore,
    fetchLeaderboard,
  };
}

