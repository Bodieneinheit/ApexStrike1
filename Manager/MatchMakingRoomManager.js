// Manager/MatchMakingRoomManager.js = state/orchestration for 5v5 matchmaking
class MatchMakingRoomManager {
    constructor() {
        this.rooms = {};
        this.MAX_PLAYERS_PER_ROOM = 1;
        this.PLAYERS_PER_TEAM =1;
        this.roomCounter = 0;
    }

    findOrCreateRoom() {
        for (const roomId in this.rooms) {
            const room = this.rooms[roomId];
            if (room.status === 'waiting' && Object.keys(room.players).length < this.MAX_PLAYERS_PER_ROOM) {
                return room;
            }
        }
        
        this.roomCounter++;
        const newRoomId = `room_${this.roomCounter}`;
        this.rooms[newRoomId] = {
            id: newRoomId,
            players: {},
            status: 'waiting', // 'waiting', 'countdown', 'in_game'
            countdownInterval: null,
            countdownValue: 10
        };
        return this.rooms[newRoomId];
    }

    addPlayerToRoom(room, playerData) {
        const currentCount = Object.keys(room.players).length;
        
        // Assign Team Colors: First 5 are Blue, Next 5 are Red
        const team = currentCount < this.PLAYERS_PER_TEAM ? 'blue' : 'red';
        
        room.players[playerData.id] = {
            ...playerData,
            team: team,
            roomId: room.id
        };

        return room.players[playerData.id];
    }

    removePlayerFromRoom(roomId, playerId) {
        if (this.rooms[roomId] && this.rooms[roomId].players[playerId]) {
            delete this.rooms[roomId].players[playerId];
            
            if (Object.keys(this.rooms[roomId].players).length === 0) {
                this.cancelCountdown(this.rooms[roomId]); // Clean up timer if empty
                delete this.rooms[roomId];
            }
        }
    }

    // Start the 10-second countdown
    startCountdown(room, onTickCallback, onCompleteCallback) {
        room.status = 'countdown';
        room.countdownValue = 10;
        
        // Tick immediately for 10
        onTickCallback(room.countdownValue);

        room.countdownInterval = setInterval(() => {
            room.countdownValue--;
            
            if (room.countdownValue <= 0) {
                this.cancelCountdown(room); // Clears interval
                room.status = 'in_game';
                onCompleteCallback();
            } else {
                onTickCallback(room.countdownValue);
            }
        }, 1000);
    }

    // Cancel countdown (if someone leaves)
    cancelCountdown(room) {
        if (room.countdownInterval) {
            clearInterval(room.countdownInterval);
            room.countdownInterval = null;
        }
        if (room.status === 'countdown') {
            room.status = 'waiting';
        }
    }
}

module.exports = MatchMakingRoomManager;