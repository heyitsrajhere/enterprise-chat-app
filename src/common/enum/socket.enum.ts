import { Socket } from 'socket.io';
import { UserRole } from './user-role.enum';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: {
      userId: string;
      email: string;
      role: UserRole;
    };
  };
}
