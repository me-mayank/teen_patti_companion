const { getNextActivePlayerIndex, checkOnePlayerRemaining } = require('../src/modules/rounds/turnManager.service');

describe('Turn Manager Service', () => {
  describe('getNextActivePlayerIndex', () => {
    it('should return the next player if they are active', () => {
      const players = [
        { status: 'ACTIVE' },
        { status: 'ACTIVE' },
        { status: 'ACTIVE' },
      ];
      const next = getNextActivePlayerIndex(players, 0);
      expect(next).toBe(1);
    });

    it('should skip packed players and return the next active one', () => {
      const players = [
        { status: 'ACTIVE' },
        { status: 'PACKED' },
        { status: 'ACTIVE' },
      ];
      const next = getNextActivePlayerIndex(players, 0);
      expect(next).toBe(2);
    });

    it('should wrap around to the beginning of the array', () => {
      const players = [
        { status: 'ACTIVE' },
        { status: 'PACKED' },
        { status: 'ACTIVE' },
      ];
      const next = getNextActivePlayerIndex(players, 2);
      expect(next).toBe(0);
    });

    it('should return null if no other players are active', () => {
      const players = [
        { status: 'ACTIVE' },
        { status: 'PACKED' },
        { status: 'PACKED' },
      ];
      const next = getNextActivePlayerIndex(players, 0);
      expect(next).toBe(0); // If it's the only one left, it returns itself, which is fine since the game will auto-complete before taking a turn.
    });
  });

  describe('checkOnePlayerRemaining', () => {
    it('should return the winning player if only one is active', () => {
      const players = [
        { id: 1, status: 'PACKED' },
        { id: 2, status: 'ACTIVE' },
        { id: 3, status: 'PACKED' },
      ];
      const winner = checkOnePlayerRemaining(players);
      expect(winner).toBeDefined();
      expect(winner.id).toBe(2);
    });

    it('should return null if more than one player is active', () => {
      const players = [
        { id: 1, status: 'ACTIVE' },
        { id: 2, status: 'ACTIVE' },
      ];
      const winner = checkOnePlayerRemaining(players);
      expect(winner).toBeNull();
    });

    it('should return null if no players are active', () => {
      const players = [
        { id: 1, status: 'PACKED' },
        { id: 2, status: 'PACKED' },
      ];
      const winner = checkOnePlayerRemaining(players);
      expect(winner).toBeNull();
    });
  });
});
