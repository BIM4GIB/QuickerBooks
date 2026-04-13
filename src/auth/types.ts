export interface TokenData {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: number;           // Unix ms when access token expires
  refresh_expires_at: number;   // Unix ms when refresh token expires
  realm_id: string;             // QBO company ID
}
