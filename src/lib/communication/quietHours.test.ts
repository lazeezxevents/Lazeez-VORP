import { describe, it, expect } from 'vitest';
import { isWithinQuietHours } from './quietHours';

describe('isWithinQuietHours', () => {
  describe('when quiet hours are disabled', () => {
    it('should return false regardless of time', () => {
      const now = new Date('2024-01-15T23:30:00');
      expect(isWithinQuietHours(now, '22:00', '08:00', false)).toBe(false);
    });
  });

  describe('when quiet hours are enabled', () => {
    describe('same-day window (start < end)', () => {
      it('should return true when time is within window', () => {
        const now = new Date('2024-01-15T14:30:00'); // 2:30 PM
        expect(isWithinQuietHours(now, '13:00', '17:00', true)).toBe(true);
      });

      it('should return false when time is before window', () => {
        const now = new Date('2024-01-15T12:30:00'); // 12:30 PM
        expect(isWithinQuietHours(now, '13:00', '17:00', true)).toBe(false);
      });

      it('should return false when time is after window', () => {
        const now = new Date('2024-01-15T18:00:00'); // 6:00 PM
        expect(isWithinQuietHours(now, '13:00', '17:00', true)).toBe(false);
      });

      it('should return true at start time', () => {
        const now = new Date('2024-01-15T13:00:00'); // 1:00 PM
        expect(isWithinQuietHours(now, '13:00', '17:00', true)).toBe(true);
      });

      it('should return false at end time (exclusive)', () => {
        const now = new Date('2024-01-15T17:00:00'); // 5:00 PM
        expect(isWithinQuietHours(now, '13:00', '17:00', true)).toBe(false);
      });
    });

    describe('overnight window (start > end)', () => {
      it('should return true when time is after start', () => {
        const now = new Date('2024-01-15T23:30:00'); // 11:30 PM
        expect(isWithinQuietHours(now, '22:00', '08:00', true)).toBe(true);
      });

      it('should return true when time is before end', () => {
        const now = new Date('2024-01-15T07:30:00'); // 7:30 AM
        expect(isWithinQuietHours(now, '22:00', '08:00', true)).toBe(true);
      });

      it('should return false when time is between end and start', () => {
        const now = new Date('2024-01-15T14:00:00'); // 2:00 PM
        expect(isWithinQuietHours(now, '22:00', '08:00', true)).toBe(false);
      });

      it('should return true at start time', () => {
        const now = new Date('2024-01-15T22:00:00'); // 10:00 PM
        expect(isWithinQuietHours(now, '22:00', '08:00', true)).toBe(true);
      });

      it('should return false at end time (exclusive)', () => {
        const now = new Date('2024-01-15T08:00:00'); // 8:00 AM
        expect(isWithinQuietHours(now, '22:00', '08:00', true)).toBe(false);
      });

      it('should handle midnight correctly', () => {
        const now = new Date('2024-01-15T00:30:00'); // 12:30 AM
        expect(isWithinQuietHours(now, '22:00', '08:00', true)).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should return false when start equals end', () => {
        const now = new Date('2024-01-15T14:00:00');
        expect(isWithinQuietHours(now, '14:00', '14:00', true)).toBe(false);
      });

      it('should handle invalid time format gracefully', () => {
        const now = new Date('2024-01-15T14:00:00');
        expect(isWithinQuietHours(now, 'invalid', '17:00', true)).toBe(false);
        expect(isWithinQuietHours(now, '13:00', 'invalid', true)).toBe(false);
      });

      it('should handle null/undefined time values', () => {
        const now = new Date('2024-01-15T14:00:00');
        expect(isWithinQuietHours(now, '', '17:00', true)).toBe(false);
        expect(isWithinQuietHours(now, '13:00', '', true)).toBe(false);
      });

      it('should handle single-digit hours', () => {
        const now = new Date('2024-01-15T09:30:00'); // 9:30 AM
        expect(isWithinQuietHours(now, '9:00', '11:00', true)).toBe(true);
      });

      it('should handle boundary times correctly', () => {
        const now = new Date('2024-01-15T00:00:00'); // Midnight
        expect(isWithinQuietHours(now, '23:00', '01:00', true)).toBe(true);
      });
    });

    describe('real-world scenarios', () => {
      it('should suppress notifications during typical night hours', () => {
        const lateNight = new Date('2024-01-15T23:45:00'); // 11:45 PM
        const earlyMorning = new Date('2024-01-15T06:30:00'); // 6:30 AM
        const afternoon = new Date('2024-01-15T15:00:00'); // 3:00 PM

        expect(isWithinQuietHours(lateNight, '22:00', '08:00', true)).toBe(true);
        expect(isWithinQuietHours(earlyMorning, '22:00', '08:00', true)).toBe(true);
        expect(isWithinQuietHours(afternoon, '22:00', '08:00', true)).toBe(false);
      });

      it('should handle work hours quiet period', () => {
        const morning = new Date('2024-01-15T10:00:00'); // 10:00 AM
        const lunch = new Date('2024-01-15T12:30:00'); // 12:30 PM
        const evening = new Date('2024-01-15T18:00:00'); // 6:00 PM

        expect(isWithinQuietHours(morning, '09:00', '17:00', true)).toBe(true);
        expect(isWithinQuietHours(lunch, '09:00', '17:00', true)).toBe(true);
        expect(isWithinQuietHours(evening, '09:00', '17:00', true)).toBe(false);
      });
    });
  });
});
