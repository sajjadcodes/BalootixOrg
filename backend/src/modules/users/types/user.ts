export interface UserData {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  mobile: string | null;
  isManager: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
