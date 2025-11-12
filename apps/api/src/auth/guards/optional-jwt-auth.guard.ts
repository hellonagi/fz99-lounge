import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest to make authentication optional
  handleRequest(err: any, user: any, info: any) {
    // If there's no error and user exists, return user
    // If there's an error or no user, return null (don't throw exception)
    if (err || !user) {
      return null;
    }
    return user;
  }
}
