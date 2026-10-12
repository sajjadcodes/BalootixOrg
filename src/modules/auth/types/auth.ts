export interface RegisteredUserData {
  id: string;
  email: string;
  displayName: string;
  isManager: boolean;
}

export interface LoginUserData {
  id: string;
  email: string;
  displayName: string;
  isManager: boolean;
  mobile: string | null;
  avatar: string | null;
}

export type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
    tenantId: string;
  };
  cookies: {
    refresh_token?: string;
  };
};
