import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedSocket } from 'src/common/enum';
import { errorMessages } from 'src/messages';

@Injectable()
export class SocketAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const token = client.handshake.headers.authorization;

    if (!token || !token.startsWith('Bearer ')) {
      client.emit('error_event', {
        type: 'AUTH_ERROR',
        message: errorMessages.tokenNotFound,
      });
      client.disconnect();
      return false;
    }

    try {
      const jwtToken = token.split(' ')[1];
      const decoded = jwt.verify(
        jwtToken,
        this.configService.get<string>('JWT_SECRET'),
      ) as AuthenticatedSocket['data']['user'];

      if (!decoded?.userId) {
        client.emit('error_event', {
          type: 'AUTH_ERROR',
          message: errorMessages.invalidPayload,
        });
        client.disconnect();
        return false;
      }

      client.data.user = decoded;
      return true;
    } catch (error) {
      client.emit('error_event', {
        type: 'AUTH_ERROR',
        message: error.message,
      });
      client.disconnect();
      return false;
    }
  }
}
