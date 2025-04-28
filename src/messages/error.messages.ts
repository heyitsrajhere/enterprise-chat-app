import { access } from 'fs';

export const errorMessages = {
  organizationNotFound: 'Organization not found',
  userNotFound: 'User not found',
  loginFailed: 'Invalid credentials',
  failedToRefreshToken: 'Failed to refresh token',
  userAlreadyExists: 'User already exists',
  invalidPassword:
    'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character',
  tokenNotFound: "'No token, disconnecting...'",
  invalidPayload: 'Invalid token payload, disconnecting...',
  invalidUserOrRoom: 'Invalid user or room',
  invalidUserOrMessage: 'Invalid user or message',
  messageNotFound: 'Message not found',
  invalidAction: 'Action must be "add" or "remove"',
  limitExceed: 'You are sending messages too quickly. Please wait a moment.',
  emailAlreadyExist: 'Email already exist',
  usernameAlreadyExist: 'Username already exist',
  accessDenied:
    'Access denied: User and ChatRoom belong to different organizations',
  outsideOrganization:
    'You cannot send messages to users outside your organization.',
  invalidUser: 'invalid user or out of organization user',
  chatRoomNotFound: 'Chat room not found',
  userNotInOrganization: 'User not in organization',
  userNotInRoom: 'User is not a member of this chat room',
  userAlreadyModerator: 'User is already a moderator',
};
