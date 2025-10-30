export interface EmailJobData {
  type: 'verification';
  to: string;
  token: string;
  name?: string;
}

