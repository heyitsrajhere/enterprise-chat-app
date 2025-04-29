# WebSocket Events Documentation

## Event Types

| Event Name            | Direction       | Body/Params                         | Description           |
| --------------------- | --------------- | ----------------------------------- | --------------------- |
| **Connection Events** |                 |                                     |                       |
| `connected`           | server → client | `{ message: string }`               | Connection successful |
| `user_online`         | server → client | `{ userId: string }`                | User is online        |
| `previous_messages`   | server → client | `[ ...messages ]`                   | Previous messages     |
| `error_event`         | server → client | `{ type: string, message: string }` | Error notification    |

| **Private Messages** | | | |
| `send_message` | client → server | `{ recipientId: string, message: string }` | Send private message |
| `message_sent` | server → client | `{ messageId: string, recipientId: string }` | Message sent confirmation |
| `new_private_message` | server → client | `{ message: string, senderId: string, messageId: string, createdAt: string }` | New private message received |
| `read_message` | client → server | `{ messageId: string }` | Mark message as read |
| `user_read_message` | server → client | `{ messageId: string, userId: string }` | User read message notification |

| **Group Messages** | | | |
| `send_room_message` | client → server | `{ roomId: string, message: string }` | Send group message |
| `new_room_message` | server → client | `{ message: string, senderId: string, messageId: string, roomId: string, createdAt: string }` | New group message received |
| `room_message_sent` | server → client | `{ messageId: string, roomId: string }` | Group message sent confirmation |
| `read_group_message` | client → server | `{ messageId: string, roomId: string }` | Mark group message as read |
| `read_message_success` | server → client | `{ ...result }` | Group message read confirmation |
| `delete_group_message` | client → server | `{ messageId: string, roomId: string }` | Delete group message (moderator/admin only) |
| `message_deleted` | server → client | `{ messageId: string, roomId: string, deletedBy: string }` | Group message deleted notification |
| `delete_message_success` | server → client | `{ ...result }` | Group message deletion confirmation |

| **Room Management** | | | |
| `create_room` | client → server | `CreateChatRoomDto` | Create new room (admin only) |
| `room_created` | server → client | `{ ...roomData }` | New room created notification |
| `room_created_success` | server → client | `{ ...result }` | Room creation confirmation |
| `delete_room` | client → server | `{ roomId: string }` | Delete room (admin only) |
| `room_deleted` | server → client | `{ roomId: string }` | Room deleted notification |
| `room_deleted_success` | server → client | `{ ...result }` | Room deletion confirmation |
| `join_room` | client → server | `{ roomId: string }` | Join room |
| `join_room_success` | server → client | `{ ...result }` | Join room confirmation |
| `user_joined` | server → client | `{ userId: string }` | User joined room notification |
| `leave_room` | client → server | `{ roomId: string }` | Leave room |
| `leave_room_success` | server → client | `{ ...result }` | Leave room confirmation |
| `user_left` | server → client | `{ userId: string }` | User left room notification |

| **Reactions & Typing** | | | |
| `update_reaction` | client → server | `{ messageId: string, reaction: string, action: 'add' | 'remove' }` | Add/remove reaction |
| `reaction_added` | server → client | `{ userId: string, messageId: string, reaction: string }` | Reaction added notification |
| `reaction_removed` | server → client | `{ userId: string, messageId: string, reaction: string }` | Reaction removed notification |
| `typing` | client → server | `{ roomId: string }` | User is typing |
| `user_typing` | server → client | `{ userId: string, roomId: string }` | User typing notification |
| `stop_typing` | client → server | `{ roomId: string }` | User stopped typing |
| `user_stop_typing` | server → client | `{ userId: string, roomId: string }` | User stopped typing notification |

| **Notifications** | | | |
| `mark_notification_read` | client → server | `{ notificationId: string }` | Mark notification as read |

## Notes

1. **Direction**:

   - `client → server`: Events sent from client to server
   - `server → client`: Events sent from server to client

2. **Error Handling**:

   - All operations can emit `error_event` with:
     ```typescript
     {
       type: string; // Error type (e.g., 'AUTH_ERROR', 'SERVER_ERROR')
       message: string; // Error message
     }
     ```

3. **Authentication**:

   - All events require a valid JWT token in the socket connection
   - Token should be sent in the format: `Bearer <token>`

4. **Room Management**:

   - Room creation and deletion require admin privileges
   - Message deletion in groups requires moderator or admin privileges

5. **Message Encryption**:
   - All messages are encrypted before storage
   - Messages are decrypted before being sent to clients

## Example Usage

### Client-side (JavaScript)

```javascript
// Connect to WebSocket
const socket = io('ws://your-server-url', {
  auth: {
    token: 'Bearer your-jwt-token',
  },
});

// Send a message
socket.emit('send_message', {
  recipientId: 'user-id',
  message: 'Hello!',
});

// Listen for messages
socket.on('new_private_message', (data) => {
  console.log('New message:', data);
});

// Join a room
socket.emit('join_room', {
  roomId: 'room-id',
});
```

### Server-side (NestJS)

```typescript
@SubscribeMessage('send_message')
async handleMessage(
  @MessageBody() data: { recipientId: string; message: string },
  @ConnectedSocket() socket: AuthenticatedSocket,
) {
  // Handle message
}
```
