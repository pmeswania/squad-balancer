export interface IAMUser {
  id: string;
  name: string;
  pin: string;
  role: 'Master Admin' | 'Admin' | 'User';
  createdAt: string;
}
