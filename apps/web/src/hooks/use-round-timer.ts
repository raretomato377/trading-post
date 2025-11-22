import { useState, useEffect } from "react";

interface RoundTimer {
  currentRound: number;
  timeUntilNextRound: number; // in seconds
  canGenerateCards: boolean;
  roundStartTime: Date;
  roundEndTime: Date;
}

const ROUND_DURATION_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Calculate the current round based on time
 * Rounds start at the top of each hour
 */
function calculateCurrentRound(): number {
  const now = new Date();
  const hour = now.getHours();
  const day = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  return day * 24 + hour;
}

/**
 * Calculate round start and end times
 */
function calculateRoundTimes(roundId: number): { start: Date; end: Date } {
  const now = new Date();
  const currentDay = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  const roundDay = Math.floor(roundId / 24);
  const roundHour = roundId % 24;
  
  // Calculate the start time of the current round
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0); // Start of today in UTC
  start.setUTCDate(start.getUTCDate() + (roundDay - currentDay));
  start.setUTCHours(roundHour, 0, 0, 0);
  
  const end = new Date(start);
  end.setTime(end.getTime() + ROUND_DURATION_MS);
  
  return { start, end };
}

/**
 * Hook to manage round timing
 */
export function useRoundTimer(): RoundTimer {
  const [currentRound, setCurrentRound] = useState(calculateCurrentRound());
  const [timeUntilNextRound, setTimeUntilNextRound] = useState(0);
  const [roundStartTime, setRoundStartTime] = useState(new Date());
  const [roundEndTime, setRoundEndTime] = useState(new Date());

  useEffect(() => {
    const updateTimer = () => {
      const round = calculateCurrentRound();
      setCurrentRound(round);
      
      const { start, end } = calculateRoundTimes(round);
      setRoundStartTime(start);
      setRoundEndTime(end);
      
      const now = new Date();
      const timeUntilNext = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
      setTimeUntilNextRound(timeUntilNext);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  // Can generate cards if we're in the first 30 minutes of the round
  const canGenerateCards = timeUntilNextRound > 30 * 60;

  return {
    currentRound,
    timeUntilNextRound,
    canGenerateCards,
    roundStartTime,
    roundEndTime,
  };
}

/**
 * Format seconds into readable time string
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Round ended";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

