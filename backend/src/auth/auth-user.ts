import { User } from '../users/user.entity';

export interface AuthUser {
  user: User;
  roles: string[];
}
