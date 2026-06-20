export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: string[];
}
